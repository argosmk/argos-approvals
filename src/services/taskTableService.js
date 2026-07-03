import { supabase, isSupabaseConfigured } from './supabaseClient';

const TASK_TABLE = 'app_tasks';
const LOG_TABLE = 'app_task_logs';

function isoNow(){ return new Date().toISOString(); }
function clone(value){
  try{ return JSON.parse(JSON.stringify(value || {})); }
  catch(e){ return {}; }
}
function withoutLogs(task){
  const copy = clone(task);
  delete copy.logs;
  return copy;
}

function taskToRow(organizationId, task, patchOnly=false){
  const now = isoNow();
  const data = {
    organization_id: organizationId,
    id: String(task.id),
    title: task.title || '',
    company_id: task.companyId || null,
    responsible_id: task.responsibleId || null,
    type: task.type || null,
    status: task.status || null,
    post_date: task.postDate || null,
    internal_date: task.internalDate || null,
    archived: !!task.archived,
    material_links: task.materialLinks || '',
    payload: withoutLogs(task),
    updated_at: now,
  };
  if(!patchOnly) data.created_at = task.createdAt || now;
  return data;
}

function taskFromRow(row, logs=[]){
  const payload = row?.payload || {};
  return {
    ...payload,
    id: row.id,
    title: row.title ?? payload.title ?? '',
    companyId: row.company_id ?? payload.companyId ?? '',
    responsibleId: row.responsible_id ?? payload.responsibleId ?? '',
    type: row.type ?? payload.type ?? '',
    status: row.status ?? payload.status ?? '',
    postDate: row.post_date ?? payload.postDate ?? '',
    internalDate: row.internal_date ?? payload.internalDate ?? '',
    archived: row.archived ?? payload.archived ?? false,
    materialLinks: row.material_links ?? payload.materialLinks ?? '',
    createdAt: row.created_at ?? payload.createdAt,
    updatedAt: row.updated_at ?? payload.updatedAt,
    logs: logs.sort((a,b)=>new Date(a.at||0)-new Date(b.at||0)),
  };
}

function logToRow(organizationId, taskId, log){
  return {
    organization_id: organizationId,
    id: String(log.id),
    task_id: String(taskId),
    user_id: log.userId || null,
    user_name: log.user || '',
    type: log.type || 'log',
    visibility: log.visibility || 'internal',
    text: log.text || '',
    at: log.at || isoNow(),
    resolved: !!log.resolved,
    resolved_at: log.resolvedAt || null,
    resolved_by: log.resolvedBy || null,
    payload: clone(log),
    updated_at: isoNow(),
  };
}

function logFromRow(row){
  const payload = row?.payload || {};
  return {
    ...payload,
    id: row.id,
    userId: row.user_id ?? payload.userId,
    user: row.user_name ?? payload.user,
    type: row.type ?? payload.type ?? 'log',
    visibility: row.visibility ?? payload.visibility ?? 'internal',
    text: row.text ?? payload.text ?? '',
    at: row.at ?? payload.at,
    resolved: row.resolved ?? payload.resolved ?? false,
    resolvedAt: row.resolved_at ?? payload.resolvedAt ?? null,
    resolvedBy: row.resolved_by ?? payload.resolvedBy ?? null,
  };
}

export async function loadTaskRecords(organizationId){
  if(!isSupabaseConfigured) return [];
  const { data: taskRows, error: taskError } = await supabase
    .from(TASK_TABLE)
    .select('*')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if(taskError) throw taskError;

  const ids = (taskRows || []).map(t=>t.id);
  let logRows = [];
  if(ids.length){
    const { data, error } = await supabase
      .from(LOG_TABLE)
      .select('*')
      .eq('organization_id', organizationId)
      .in('task_id', ids)
      .order('at', { ascending: true });
    if(error) throw error;
    logRows = data || [];
  }
  const logsByTask = new Map();
  logRows.forEach(row=>{
    if(!logsByTask.has(row.task_id)) logsByTask.set(row.task_id, []);
    logsByTask.get(row.task_id).push(logFromRow(row));
  });
  return (taskRows || []).map(row=>taskFromRow(row, logsByTask.get(row.id) || []));
}

export async function upsertTaskRecord(organizationId, task){
  const row = taskToRow(organizationId, task);
  const { error } = await supabase.from(TASK_TABLE).upsert(row, { onConflict: 'organization_id,id' });
  if(error) throw error;
  if(Array.isArray(task.logs) && task.logs.length){
    await upsertTaskLogs(organizationId, task.id, task.logs);
  }
}

export async function patchTaskRecord(organizationId, taskId, patch){
  const { data: existing, error } = await supabase
    .from(TASK_TABLE)
    .select('*')
    .eq('organization_id', organizationId)
    .eq('id', String(taskId))
    .maybeSingle();
  if(error) throw error;
  const current = existing ? taskFromRow(existing, []) : { id: String(taskId) };
  const next = { ...current, ...patch, id: String(taskId), updatedAt: isoNow() };
  const row = taskToRow(organizationId, next, !!existing);
  if(existing){
    const { error: updateError } = await supabase
      .from(TASK_TABLE)
      .update(row)
      .eq('organization_id', organizationId)
      .eq('id', String(taskId));
    if(updateError) throw updateError;
  } else {
    const { error: insertError } = await supabase.from(TASK_TABLE).insert(row);
    if(insertError) throw insertError;
  }
}

export async function softDeleteTaskRecord(organizationId, taskId){
  const { error } = await supabase
    .from(TASK_TABLE)
    .update({ deleted_at: isoNow(), updated_at: isoNow() })
    .eq('organization_id', organizationId)
    .eq('id', String(taskId));
  if(error) throw error;
}

export async function upsertTaskLogs(organizationId, taskId, logs=[]){
  if(!logs.length) return;
  const rows = logs.filter(Boolean).map(log=>logToRow(organizationId, taskId, log));
  const { error } = await supabase.from(LOG_TABLE).upsert(rows, { onConflict: 'organization_id,id' });
  if(error) throw error;
}

export async function bootstrapTasksFromTables(organizationId, legacyTasks=[]){
  let current = await loadTaskRecords(organizationId);
  if(current.length) return current;
  const cleanLegacy = (legacyTasks || []).filter(t=>t && t.id && !t.deletedAt && !t.deleted_at);
  if(!cleanLegacy.length) return [];
  for(const task of cleanLegacy){
    await upsertTaskRecord(organizationId, task);
  }
  return await loadTaskRecords(organizationId);
}

function changedPatch(prev={}, next={}){
  const patch = {};
  const ignore = new Set(['logs','updatedAt']);
  const keys = new Set([...Object.keys(prev||{}), ...Object.keys(next||{})]);
  keys.forEach(key=>{
    if(ignore.has(key)) return;
    const a = JSON.stringify(prev?.[key] ?? null);
    const b = JSON.stringify(next?.[key] ?? null);
    if(a !== b) patch[key] = next?.[key];
  });
  return patch;
}

function changedLogs(prevLogs=[], nextLogs=[]){
  const prevMap = new Map((prevLogs||[]).filter(l=>l?.id).map(l=>[String(l.id), l]));
  return (nextLogs||[]).filter(log=>{
    if(!log?.id) return false;
    const old = prevMap.get(String(log.id));
    return JSON.stringify(old || null) !== JSON.stringify(log || null);
  });
}

export async function syncTaskListDelta(organizationId, previousTasks=[], nextTasks=[]){
  if(!organizationId) return;
  const prevMap = new Map((previousTasks||[]).filter(t=>t?.id).map(t=>[String(t.id), t]));
  const nextMap = new Map((nextTasks||[]).filter(t=>t?.id).map(t=>[String(t.id), t]));

  for(const [id, task] of nextMap.entries()){
    const prev = prevMap.get(id);
    if(!prev){
      await upsertTaskRecord(organizationId, task);
      continue;
    }
    const patch = changedPatch(prev, task);
    if(Object.keys(patch).length){
      await patchTaskRecord(organizationId, id, patch);
    }
    const logs = changedLogs(prev.logs || [], task.logs || []);
    if(logs.length){
      await upsertTaskLogs(organizationId, id, logs);
    }
  }

  for(const id of prevMap.keys()){
    if(!nextMap.has(id)) await softDeleteTaskRecord(organizationId, id);
  }
}
