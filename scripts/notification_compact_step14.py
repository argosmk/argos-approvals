from pathlib import Path

main_path=Path('src/main.jsx')
panel_path=Path('src/services/panelAccess.js')
main=main_path.read_text(encoding='utf-8')
panel=panel_path.read_text(encoding='utf-8')

old_panel="""export function builtInNotificationPanelPermissionsForRole(role){
  if(role==='admin') return Object.fromEntries(NOTIFICATION_PANEL_PERMISSION_ITEMS.map(item=>[item.id,true]));
  if(role==='team') return {showTabs:true,canEnableAlerts:true,canOpenTasks:true,canComplete:true,canCompleteAll:true,canDeleteCompleted:false,showDateTime:true,showCompany:true,showResponsible:true,showPostDate:true,showDeadline:true,showStatus:true};
  return {showTabs:true,canEnableAlerts:true,canOpenTasks:true,canComplete:true,canCompleteAll:false,canDeleteCompleted:false,showDateTime:true,showCompany:false,showResponsible:false,showPostDate:true,showDeadline:false,showStatus:true};
}
"""
new_panel="""export function builtInNotificationPanelPermissionsForRole(role){
  if(role==='admin') return {...Object.fromEntries(NOTIFICATION_PANEL_PERMISSION_ITEMS.map(item=>[item.id,true])),canEnableAlerts:true,canOpenTasks:true,showDateTime:true,showCompany:true,showResponsible:true,showPostDate:true,showDeadline:true,showStatus:true};
  if(role==='team') return {showTabs:true,canEnableAlerts:true,canOpenTasks:true,canComplete:true,canCompleteAll:true,canDeleteCompleted:false,showDateTime:true,showCompany:true,showResponsible:true,showPostDate:true,showDeadline:true,showStatus:true};
  return {showTabs:true,canEnableAlerts:true,canOpenTasks:true,canComplete:true,canCompleteAll:false,canDeleteCompleted:false,showDateTime:true,showCompany:false,showResponsible:false,showPostDate:true,showDeadline:false,showStatus:true};
}
"""
if panel.count(old_panel)!=1:
    raise SystemExit(f'panel block count={panel.count(old_panel)}')
panel=panel.replace(old_panel,new_panel,1)

old_helper="""  function softColor(color,alpha){
    const value=String(color||'');
    return /^#[0-9a-f]{6}$/i.test(value)?`${value}${alpha}`:'rgba(255,255,255,.05)';
  }
  const preparedNotifications=list.map(n=>({n,info:notificationInfo(n)}));
"""
new_helper="""  function softColor(color,alpha){
    const value=String(color||'');
    return /^#[0-9a-f]{6}$/i.test(value)?`${value}${alpha}`:'rgba(255,255,255,.05)';
  }
  function notificationPresentation(n,info){
    const content=String(info.content||'').trim();
    if(n.event==='Comentário na tarefa') return {type:'text',text:content};
    const statusMatch=content.match(/^Status alterado de\\s+(.+?)\\s+para\\s+(.+?)\\.?$/i);
    if(statusMatch){
      const from=statusMatch[1].trim().replace(/\\.$/,'');
      const to=statusMatch[2].trim().replace(/\\.$/,'');
      const findStatus=name=>(statuses||[]).find(status=>String(status.name||'').trim().toLocaleLowerCase('pt-BR')===String(name||'').trim().toLocaleLowerCase('pt-BR'));
      return {type:'status',from,to,fromColor:findStatus(from)?.color||'var(--text-2)',toColor:findStatus(to)?.color||'var(--text-2)'};
    }
    if(n.event==='Prazo hoje') return {type:'text',text:'Prazo hoje'};
    if(n.event==='Prazo vencido') return {type:'text',text:'Prazo vencido'};
    if(/^publicado no instagram\\.?$/i.test(content)) return {type:'text',text:'Publicado no Instagram'};
    return {type:'text',text:content};
  }
  const preparedNotifications=list.map(n=>({n,info:notificationInfo(n)}));
"""
if main.count(old_helper)!=1:
    raise SystemExit(f'helper anchor count={main.count(old_helper)}')
main=main.replace(old_helper,new_helper,1)

old_map="""      {group.items.map(({n,info})=>{const deadlineTone=deadlineColor(info.deadline);const statusTone=info.status?.color||'#8b8b8b';const canOpenRow=!!(permissions.canOpenTasks&&info.task);return <div className={'notification-item notification-list-row'+(canOpenRow?' is-clickable':'')+(info.originIsClient?' is-client-origin':'')} key={n.id} role={canOpenRow?'button':undefined} tabIndex={canOpenRow?0:undefined} onClick={canOpenRow?()=>open(n.taskId):undefined} onKeyDown={canOpenRow?(event)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open(n.taskId);}}:undefined}>
"""
new_map="""      {group.items.map(({n,info})=>{const deadlineTone=deadlineColor(info.deadline);const statusTone=info.status?.color||'#8b8b8b';const canOpenRow=!!(permissions.canOpenTasks&&info.task);const presentation=notificationPresentation(n,info);return <div className={'notification-item notification-list-row'+(canOpenRow?' is-clickable':'')+(info.originIsClient?' is-client-origin':'')} key={n.id} role={canOpenRow?'button':undefined} tabIndex={canOpenRow?0:undefined} onClick={canOpenRow?()=>open(n.taskId):undefined} onKeyDown={canOpenRow?(event)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open(n.taskId);}}:undefined}>
"""
if main.count(old_map)!=1:
    raise SystemExit(f'map anchor count={main.count(old_map)}')
main=main.replace(old_map,new_map,1)

old_message="""          <div className=\"notification-copy-line notification-copy-message\" title={`${info.actorName?`${info.actorName}: `:''}${info.content||''}`}>
            {info.actorName&&<strong>{info.actorName}: </strong>}
            <span>{info.content}</span>
          </div>
"""
new_message="""          <div className=\"notification-copy-line notification-copy-message\" title={`${info.actorName?`${info.actorName}: `:''}${presentation.type==='status'?`${presentation.from} → ${presentation.to}`:(presentation.text||'')}`}>
            {info.actorName&&<strong>{info.actorName}: </strong>}
            {presentation.type==='status'
              ? <span><span style={{color:presentation.fromColor}}>{presentation.from}</span><span> → </span><span style={{color:presentation.toColor}}>{presentation.to}</span></span>
              : <span>{presentation.text}</span>}
          </div>
"""
if main.count(old_message)!=1:
    raise SystemExit(f'message anchor count={main.count(old_message)}')
main=main.replace(old_message,new_message,1)

main_path.write_text(main,encoding='utf-8')
panel_path.write_text(panel,encoding='utf-8')
