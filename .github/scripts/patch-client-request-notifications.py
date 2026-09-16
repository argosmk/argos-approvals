from pathlib import Path

p=Path('src/services/panelAccess.js')
s=p.read_text()
old="""export function resolveUserAccess(user,system){
  if(!user) return user;
  const defaults=accessDefaultForRole(system,user.role);
  const inheritance=user.accessInheritance||{};
  return {
"""
new="""export function resolveUserAccess(user,system){
  if(!user) return user;
  const defaults=accessDefaultForRole(system,user.role);
  const inheritance=user.accessInheritance||{};
  const savedNotificationPrefs=Array.isArray(user.notificationPrefs)?user.notificationPrefs:[];
  const legacyAdminNotificationPrefs=user.role==='admin'
    && savedNotificationPrefs.length===BASE_NOTIFICATION_VISIBLE_EVENTS.length
    && BASE_NOTIFICATION_VISIBLE_EVENTS.every(event=>savedNotificationPrefs.includes(event));
  const resolvedCustomNotificationPrefs=legacyAdminNotificationPrefs
    ? [...savedNotificationPrefs,CLIENT_REQUEST_NOTIFICATION_EVENT]
    : savedNotificationPrefs;
  return {
"""
assert old in s
s=s.replace(old,new,1)
old2="notificationPrefs:inheritance.notifications==='custom'?(user.notificationPrefs||[]):defaults.notificationPrefs,"
new2="notificationPrefs:inheritance.notifications==='custom'?resolvedCustomNotificationPrefs:defaults.notificationPrefs,"
assert old2 in s
s=s.replace(old2,new2,1)
p.write_text(s)

p=Path('src/main.jsx')
s=p.read_text()
old="if(isClient) notifyTask(task,`${effectiveUser.name} solicitou alteração. ${votes.length} de ${approversForCompany.length} representantes responderam; a tarefa permanece em Aprovar copy.`,CLIENT_REQUEST_NOTIFICATION_EVENT,task.status,effectiveUser.id,{actorName:effectiveUser.name,logId:entry.id,at:eventAt});"
new="if(isClient) notifyTask(task,`${effectiveUser.name} solicitou alteração em ${items.join(' e ')}: ${desc} (${votes.length} de ${approversForCompany.length} representantes responderam; a tarefa permanece em Aprovar copy.)`,CLIENT_REQUEST_NOTIFICATION_EVENT,task.status,effectiveUser.id,{actorName:effectiveUser.name,logId:entry.id,at:eventAt});"
assert old in s
s=s.replace(old,new,1)
old2="if(isClient) notifyTask(task,`${effectiveUser.name} solicitou alteração. ${votes.length} de ${approversForCompany.length} representantes responderam; a tarefa permanece em Aprovação.`,CLIENT_REQUEST_NOTIFICATION_EVENT,task.status,effectiveUser.id,{actorName:effectiveUser.name,logId:entry.id,at:eventAt});"
new2="if(isClient) notifyTask(task,`${effectiveUser.name} solicitou alteração em ${items.join(' e ')}: ${desc} (${votes.length} de ${approversForCompany.length} representantes responderam; a tarefa permanece em Aprovação.)`,CLIENT_REQUEST_NOTIFICATION_EVENT,task.status,effectiveUser.id,{actorName:effectiveUser.name,logId:entry.id,at:eventAt});"
assert old2 in s
s=s.replace(old2,new2,1)
p.write_text(s)
