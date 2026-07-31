import { supabase, isSupabaseConfigured } from './supabaseClient';

const NOTIFICATION_TABLE='app_notifications';

function isoNow(){ return new Date().toISOString(); }
function clone(value){
  try{ return JSON.parse(JSON.stringify(value||{})); }
  catch(e){ return {}; }
}

function notificationToRow(organizationId,notification){
  const payload={
    ...clone(notification.payload),
    actorId:notification.actorId??notification.payload?.actorId??null,
    actorName:notification.actorName??notification.payload?.actorName??'',
    logId:notification.logId??notification.payload?.logId??null,
  };
  return {
    organization_id:organizationId,
    id:String(notification.id),
    task_id:notification.taskId||null,
    user_id:notification.userId||null,
    text:notification.text||'',
    event:notification.event||null,
    status_id:notification.statusId||null,
    done:!!notification.done,
    at:notification.at||isoNow(),
    payload,
    updated_at:isoNow(),
  };
}

function notificationFromRow(row){
  const payload=row?.payload||{};
  return {
    ...payload,
    id:row.id,
    taskId:row.task_id??payload.taskId??null,
    userId:row.user_id??payload.userId??null,
    text:row.text??payload.text??'',
    event:row.event??payload.event??null,
    statusId:row.status_id??payload.statusId??null,
    done:row.done??payload.done??false,
    at:row.at??payload.at,
    actorId:payload.actorId??null,
    actorName:payload.actorName??'',
    logId:payload.logId??null,
  };
}

export async function loadNotificationRecords(organizationId){
  if(!isSupabaseConfigured||!organizationId) return [];
  const {data,error}=await supabase
    .from(NOTIFICATION_TABLE)
    .select('*')
    .eq('organization_id',organizationId)
    .is('deleted_at',null)
    .order('at',{ascending:false});
  if(error) throw error;
  return (data||[]).map(notificationFromRow);
}

export async function upsertNotificationRecords(organizationId,notifications=[]){
  const clean=(notifications||[]).filter(n=>n?.id);
  if(!clean.length) return;
  const rows=clean.map(n=>notificationToRow(organizationId,n));
  const {error}=await supabase
    .from(NOTIFICATION_TABLE)
    .upsert(rows,{onConflict:'organization_id,id'});
  if(error) throw error;
}

export async function softDeleteNotificationRecords(organizationId,ids=[]){
  const clean=[...new Set((ids||[]).filter(Boolean).map(String))];
  if(!clean.length) return;
  const stamp=isoNow();
  const {error}=await supabase
    .from(NOTIFICATION_TABLE)
    .update({deleted_at:stamp,updated_at:stamp})
    .eq('organization_id',organizationId)
    .in('id',clean);
  if(error) throw error;
}

export async function bootstrapNotificationsFromTable(organizationId,legacyNotifications=[]){
  const current=await loadNotificationRecords(organizationId);
  if(current.length) return current;
  const legacy=(legacyNotifications||[]).filter(n=>n?.id);
  if(!legacy.length) return [];
  await upsertNotificationRecords(organizationId,legacy);
  return await loadNotificationRecords(organizationId);
}

function changedNotifications(previous=[],next=[]){
  const prevMap=new Map((previous||[]).filter(n=>n?.id).map(n=>[String(n.id),n]));
  return (next||[]).filter(n=>{
    if(!n?.id) return false;
    return JSON.stringify(prevMap.get(String(n.id))||null)!==JSON.stringify(n);
  });
}

export async function syncNotificationListDelta(organizationId,previous=[],next=[]){
  if(!organizationId) return;
  const prevIds=new Set((previous||[]).filter(n=>n?.id).map(n=>String(n.id)));
  const nextIds=new Set((next||[]).filter(n=>n?.id).map(n=>String(n.id)));
  const changed=changedNotifications(previous,next);
  if(changed.length) await upsertNotificationRecords(organizationId,changed);
  const removed=[...prevIds].filter(id=>!nextIds.has(id));
  if(removed.length) await softDeleteNotificationRecords(organizationId,removed);
}
