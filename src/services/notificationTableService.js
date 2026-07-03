import { supabase, isSupabaseConfigured } from './supabaseClient';

const TABLE = 'app_notifications';

function isoNow(){ return new Date().toISOString(); }
function clone(value){
  try{ return JSON.parse(JSON.stringify(value || {})); }
  catch(e){ return {}; }
}

function notificationToRow(organizationId, notification){
  return {
    organization_id: organizationId,
    id: String(notification.id),
    task_id: notification.taskId ? String(notification.taskId) : null,
    user_id: notification.userId ? String(notification.userId) : null,
    text: notification.text || '',
    event: notification.event || null,
    status_id: notification.statusId || null,
    done: !!notification.done,
    at: notification.at || isoNow(),
    payload: clone(notification),
    updated_at: isoNow(),
  };
}

function notificationFromRow(row){
  const payload = row?.payload || {};
  return {
    ...payload,
    id: row.id,
    taskId: row.task_id ?? payload.taskId ?? null,
    userId: row.user_id ?? payload.userId ?? null,
    text: row.text ?? payload.text ?? '',
    event: row.event ?? payload.event ?? null,
    statusId: row.status_id ?? payload.statusId ?? null,
    done: row.done ?? payload.done ?? false,
    at: row.at ?? payload.at,
  };
}

export async function loadNotificationRecords(organizationId){
  if(!isSupabaseConfigured || !organizationId) return [];
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('at', { ascending: false })
    .limit(300);
  if(error) throw error;
  return (data || []).map(notificationFromRow);
}

export async function upsertNotificationRecords(organizationId, notifications=[]){
  if(!isSupabaseConfigured || !organizationId || !notifications.length) return;
  const rows = notifications.filter(n=>n?.id).map(n=>notificationToRow(organizationId, n));
  if(!rows.length) return;
  const { error } = await supabase.from(TABLE).upsert(rows, { onConflict: 'organization_id,id' });
  if(error) throw error;
}

export async function patchNotificationRecord(organizationId, notificationId, patch={}){
  if(!isSupabaseConfigured || !organizationId || !notificationId) return;
  const payload = { updated_at: isoNow() };
  if(Object.prototype.hasOwnProperty.call(patch,'done')) payload.done = !!patch.done;
  if(Object.prototype.hasOwnProperty.call(patch,'text')) payload.text = patch.text || '';
  if(Object.prototype.hasOwnProperty.call(patch,'event')) payload.event = patch.event || null;
  if(Object.prototype.hasOwnProperty.call(patch,'statusId')) payload.status_id = patch.statusId || null;
  if(Object.prototype.hasOwnProperty.call(patch,'payload')) payload.payload = clone(patch.payload);
  const { error } = await supabase
    .from(TABLE)
    .update(payload)
    .eq('organization_id', organizationId)
    .eq('id', String(notificationId));
  if(error) throw error;
}

export async function softDeleteNotificationRecord(organizationId, notificationId){
  if(!isSupabaseConfigured || !organizationId || !notificationId) return;
  const { error } = await supabase
    .from(TABLE)
    .update({ deleted_at: isoNow(), updated_at: isoNow() })
    .eq('organization_id', organizationId)
    .eq('id', String(notificationId));
  if(error) throw error;
}

export async function bootstrapNotificationsFromTables(organizationId, legacyNotifications=[]){
  const current = await loadNotificationRecords(organizationId);
  if(current.length) return current;
  const cleanLegacy = (legacyNotifications || []).filter(n=>n?.id);
  if(cleanLegacy.length){
    await upsertNotificationRecords(organizationId, cleanLegacy);
    return await loadNotificationRecords(organizationId);
  }
  return [];
}

function changed(prev={}, next={}){
  return JSON.stringify(prev || null) !== JSON.stringify(next || null);
}

export async function syncNotificationListDelta(organizationId, previousNotifications=[], nextNotifications=[]){
  if(!isSupabaseConfigured || !organizationId) return;
  const prevMap = new Map((previousNotifications||[]).filter(n=>n?.id).map(n=>[String(n.id), n]));
  const nextMap = new Map((nextNotifications||[]).filter(n=>n?.id).map(n=>[String(n.id), n]));
  const inserts = [];
  for(const [id, notification] of nextMap.entries()){
    const prev = prevMap.get(id);
    if(!prev){ inserts.push(notification); continue; }
    if(changed(prev, notification)){
      await upsertNotificationRecords(organizationId, [{...notification, payload: notification}]);
    }
  }
  if(inserts.length) await upsertNotificationRecords(organizationId, inserts);
  for(const id of prevMap.keys()){
    if(!nextMap.has(id)) await softDeleteNotificationRecord(organizationId, id);
  }
}
