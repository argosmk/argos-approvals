from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: esperava 1 ocorrência, achei {count}')
    return text.replace(old, new, 1)

# main.jsx
path = Path('src/main.jsx')
text = path.read_text(encoding='utf-8')

old = '''function wantsNotification(user, event, statusId){
  if(!user?.active) return false;
  if(statusId&&user.role!=='admin'){
    const visibleStatuses=Array.isArray(user.visibleStatuses)?user.visibleStatuses:[];
    if(!visibleStatuses.includes(statusId)) return false;
  }
  if(event==='Status da tarefa'){
    if(!statusId) return false;
    return statusChangeNotificationsEnabled(user.notificationStatusPrefs||{},user.role);
  }
  if(BLOCKED_NOTIFICATION_EVENTS.has(event)) return false;
  if(!NOTIFICATION_VISIBLE_EVENTS.includes(event)) return false;
  const prefs=Array.isArray(user.notificationPrefs)?user.notificationPrefs:defaultNotificationPrefsForRole(user.role);
  return prefs.includes(event);
}
'''
new = '''function wantsNotification(user, event, statusId){
  if(!user?.active) return false;
  if(statusId&&user.role!=='admin'){
    const visibleStatuses=Array.isArray(user.visibleStatuses)?user.visibleStatuses:[];
    if(!visibleStatuses.includes(statusId)) return false;
  }
  if(event==='Status da tarefa'){
    if(!statusId) return false;
    return statusChangeNotificationsEnabled(user.notificationStatusPrefs||{},user.role);
  }
  if(BLOCKED_NOTIFICATION_EVENTS.has(event)) return false;
  if(!NOTIFICATION_VISIBLE_EVENTS.includes(event)) return false;
  const prefs=Array.isArray(user.notificationPrefs)?user.notificationPrefs:defaultNotificationPrefsForRole(user.role);
  return prefs.includes(event);
}
function wantsPush(user,event,statusId){
  if(!user?.active) return false;
  if(statusId&&user.role!=='admin'){
    const visibleStatuses=Array.isArray(user.visibleStatuses)?user.visibleStatuses:[];
    if(!visibleStatuses.includes(statusId)) return false;
  }
  if(event==='Status da tarefa') return !!statusId && user.notificationPushPrefs?.status===true;
  if(BLOCKED_NOTIFICATION_EVENTS.has(event)) return false;
  if(!NOTIFICATION_VISIBLE_EVENTS.includes(event)) return false;
  const events=Array.isArray(user.notificationPushPrefs?.events)?user.notificationPushPrefs.events:defaultNotificationPrefsForRole(user.role);
  return events.includes(event);
}
function isPushOnlyNotification(notification){
  return notification?.pushOnly===true || notification?.payload?.pushOnly===true;
}
'''
text = replace_once(text, old, new, 'helpers push independente')

old = '''      notification_prefs: {
        events: draft.notificationPrefs || NOTIFICATION_EVENTS,
        statuses: draft.notificationStatusPrefs || {}
      }
'''
new = '''      notification_prefs: {
        events: draft.notificationPrefs || NOTIFICATION_EVENTS,
        statuses: draft.notificationStatusPrefs || {},
        push_events: Array.isArray(draft.notificationPushPrefs?.events) ? draft.notificationPushPrefs.events : [],
        push_status: draft.notificationPushPrefs?.status === true
      }
'''
text = replace_once(text, old, new, 'preserva push no update de profile')

old = '''    const recipients = users
      .filter(u=>u.active && (u.role==='admin' || (u.role==='team'&&u.id===task.responsibleId) || (u.role==='client'&&Array.isArray(u.companyIds)&&u.companyIds.includes(task.companyId))))
      .filter(u=>u.id!==actorId)
      .filter(u=>wantsNotification(u,event,statusId));
    if(!recipients.length) return;
    const stamp=meta.at||now();
    const created=recipients.map(u=>({
      id:safeUUID(),
      taskId:task.id,
      userId:u.id,
'''
new = '''    const recipients = users
      .filter(u=>u.active && (u.role==='admin' || (u.role==='team'&&u.id===task.responsibleId) || (u.role==='client'&&Array.isArray(u.companyIds)&&u.companyIds.includes(task.companyId))))
      .filter(u=>u.id!==actorId)
      .map(u=>({user:u,system:wantsNotification(u,event,statusId),push:wantsPush(u,event,statusId)}))
      .filter(item=>item.system||item.push);
    if(!recipients.length) return;
    const stamp=meta.at||now();
    const created=recipients.map(item=>({
      id:safeUUID(),
      taskId:task.id,
      userId:item.user.id,
'''
text = replace_once(text, old, new, 'notifyTask inclui push-only')

old = '''        fromStatus:meta.fromStatus||null,
        toStatus:meta.toStatus||null
      }
    }));
'''
new = '''        fromStatus:meta.fromStatus||null,
        toStatus:meta.toStatus||null,
        pushOnly:!item.system&&item.push
      }
    }));
'''
text = replace_once(text, old, new, 'marca push-only')

old = '''    const scoped=(notifications||[]).filter(n=>n?.userId===auth.id);
'''
new = '''    const scoped=(notifications||[]).filter(n=>n?.userId===auth.id&&!isPushOnlyNotification(n));
'''
text = replace_once(text, old, new, 'alerta local ignora push-only')

old = '''  const pendingNotificationsCount = (notifications||[]).filter(n=>n?.userId===effectiveUser?.id && !n?.done).length;
'''
new = '''  const pendingNotificationsCount = (notifications||[]).filter(n=>n?.userId===effectiveUser?.id && !n?.done && !isPushOnlyNotification(n)).length;
'''
text = replace_once(text, old, new, 'badge ignora push-only')

old = '''  function toggleEvent(ev,checked){
    const current=notificationInheritance==='custom'?(f.notificationPrefs||[]):(roleDefault.notificationPrefs||events);
    const next=checked?[...new Set([...current,ev])]:current.filter(x=>x!==ev);
    setF(prev=>({
      ...prev,
      notificationPrefs:next,
      notificationPushPrefs:checked?(prev.notificationPushPrefs||roleDefault.notificationPushPrefs):{...(prev.notificationPushPrefs||roleDefault.notificationPushPrefs),events:(prev.notificationPushPrefs?.events||roleDefault.notificationPushPrefs?.events||[]).filter(x=>x!==ev)}
    }));
  }
'''
new = '''  function toggleEvent(ev,checked){
    const current=notificationInheritance==='custom'?(f.notificationPrefs||[]):(roleDefault.notificationPrefs||events);
    set('notificationPrefs',checked?[...new Set([...current,ev])]:current.filter(x=>x!==ev));
  }
'''
text = replace_once(text, old, new, 'evento sistema independente')

old = '''  function toggleStatusSystem(checked){
    setF(prev=>({...prev,notificationStatusPrefs:{__all__:checked},notificationPushPrefs:checked?(prev.notificationPushPrefs||roleDefault.notificationPushPrefs):{...(prev.notificationPushPrefs||roleDefault.notificationPushPrefs),status:false}}));
  }
'''
new = '''  function toggleStatusSystem(checked){
    set('notificationStatusPrefs',{__all__:checked});
  }
'''
text = replace_once(text, old, new, 'status sistema independente')

old = '''          <p className="muted" style={{marginTop:0}}>"Sistema" cria a notificação dentro do Argos. "Push" envia o mesmo aviso fora do sistema. Status continuam limitados por "Status disponíveis".</p>
          <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) 72px 72px',gap:8,alignItems:'center'}}>
            <small className="muted">Evento</small><small className="muted" style={{textAlign:'center'}}>Sistema</small><small className="muted" style={{textAlign:'center'}}>Push</small>
            {NOTIFICATION_EVENT_ROWS.map(row=>{const isStatus=row.id==='status';const systemOn=isStatus?statusNotificationsEnabled:(f.notificationPrefs||[]).includes(row.event);const pushOn=isStatus?(f.notificationPushPrefs?.status??roleDefault.notificationPushPrefs?.status??false):(f.notificationPushPrefs?.events||roleDefault.notificationPushPrefs?.events||[]).includes(row.event);return <React.Fragment key={row.id}><span>{row.label}</span><input style={{margin:'0 auto'}} type="checkbox" checked={systemOn} onChange={e=>isStatus?toggleStatusSystem(e.target.checked):toggleEvent(row.event,e.target.checked)}/><input style={{margin:'0 auto'}} type="checkbox" disabled={!systemOn} checked={systemOn&&pushOn} onChange={e=>isStatus?set('notificationPushPrefs',{...(f.notificationPushPrefs||roleDefault.notificationPushPrefs),status:e.target.checked}):togglePushEvent(row.event,e.target.checked)}/></React.Fragment>;})}
          </div>
'''
new = '''          <p className="muted" style={{marginTop:0}}>"Sistema" e "Push" são canais independentes. Status continuam limitados por "Status disponíveis".</p>
          <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) 72px 72px',gap:8,alignItems:'center'}}>
            <small className="muted">Evento</small><small className="muted" style={{textAlign:'center'}}>Sistema</small><small className="muted" style={{textAlign:'center'}}>Push</small>
            {NOTIFICATION_EVENT_ROWS.map(row=>{const isStatus=row.id==='status';const systemOn=isStatus?statusNotificationsEnabled:(f.notificationPrefs||[]).includes(row.event);const pushOn=isStatus?(f.notificationPushPrefs?.status??roleDefault.notificationPushPrefs?.status??false):(f.notificationPushPrefs?.events||roleDefault.notificationPushPrefs?.events||[]).includes(row.event);const boxStyle={width:14,height:14,minWidth:14,margin:'0 auto'};return <React.Fragment key={row.id}><span>{row.label}</span><input style={boxStyle} type="checkbox" checked={systemOn} onChange={e=>isStatus?toggleStatusSystem(e.target.checked):toggleEvent(row.event,e.target.checked)}/><input style={boxStyle} type="checkbox" checked={pushOn} onChange={e=>isStatus?set('notificationPushPrefs',{...(f.notificationPushPrefs||roleDefault.notificationPushPrefs),status:e.target.checked}):togglePushEvent(row.event,e.target.checked)}/></React.Fragment>;})}
          </div>
'''
text = replace_once(text, old, new, 'matriz individual independente e compacta')

old = '''  function toggleEvent(ev,checked){
    const current=draft.notificationPrefs||[];
    const next=checked?[...new Set([...current,ev])]:current.filter(x=>x!==ev);
    setDraft(prev=>({...prev,notificationPrefs:next,notificationPushPrefs:checked?(prev.notificationPushPrefs||{events:[],status:false}):{...(prev.notificationPushPrefs||{events:[],status:false}),events:(prev.notificationPushPrefs?.events||[]).filter(x=>x!==ev)}}));
  }
'''
new = '''  function toggleEvent(ev,checked){
    const current=draft.notificationPrefs||[];
    setDraftValue('notificationPrefs',checked?[...new Set([...current,ev])]:current.filter(x=>x!==ev));
  }
'''
text = replace_once(text, old, new, 'default evento sistema independente')

old = '''  function toggleDefaultStatusSystem(checked){
    setDraft(prev=>({...prev,notificationStatusPrefs:{__all__:checked},notificationPushPrefs:checked?(prev.notificationPushPrefs||{events:[],status:false}):{...(prev.notificationPushPrefs||{events:[],status:false}),status:false}}));
  }
'''
new = '''  function toggleDefaultStatusSystem(checked){
    setDraftValue('notificationStatusPrefs',{__all__:checked});
  }
'''
text = replace_once(text, old, new, 'default status sistema independente')

old = '''          <p className="muted" style={{marginTop:0}}>Escolha apenas o canal de cada evento. Push só pode ser ativado quando a notificação no sistema também estiver ativa.</p>
          <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) 72px 72px',gap:8,alignItems:'center'}}>
            <small className="muted">Evento</small><small className="muted" style={{textAlign:'center'}}>Sistema</small><small className="muted" style={{textAlign:'center'}}>Push</small>
            {NOTIFICATION_EVENT_ROWS.map(row=>{const isStatus=row.id==='status';const systemOn=isStatus?statusChangeNotificationsEnabled(draft.notificationStatusPrefs||{},role):(draft.notificationPrefs||[]).includes(row.event);const pushOn=isStatus?(draft.notificationPushPrefs?.status===true):(draft.notificationPushPrefs?.events||[]).includes(row.event);return <React.Fragment key={row.id}><span>{row.label}</span><input style={{margin:'0 auto'}} type="checkbox" checked={systemOn} onChange={e=>isStatus?toggleDefaultStatusSystem(e.target.checked):toggleEvent(row.event,e.target.checked)}/><input style={{margin:'0 auto'}} type="checkbox" disabled={!systemOn} checked={systemOn&&pushOn} onChange={e=>isStatus?setDraft(prev=>({...prev,notificationPushPrefs:{...(prev.notificationPushPrefs||{events:[],status:false}),status:e.target.checked}})):toggleDefaultPushEvent(row.event,e.target.checked)}/></React.Fragment>;})}
          </div>
'''
new = '''          <p className="muted" style={{marginTop:0}}>Escolha os canais de forma independente. Um usuário pode receber Push mesmo sem receber a notificação no painel.</p>
          <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) 72px 72px',gap:8,alignItems:'center'}}>
            <small className="muted">Evento</small><small className="muted" style={{textAlign:'center'}}>Sistema</small><small className="muted" style={{textAlign:'center'}}>Push</small>
            {NOTIFICATION_EVENT_ROWS.map(row=>{const isStatus=row.id==='status';const systemOn=isStatus?statusChangeNotificationsEnabled(draft.notificationStatusPrefs||{},role):(draft.notificationPrefs||[]).includes(row.event);const pushOn=isStatus?(draft.notificationPushPrefs?.status===true):(draft.notificationPushPrefs?.events||[]).includes(row.event);const boxStyle={width:14,height:14,minWidth:14,margin:'0 auto'};return <React.Fragment key={row.id}><span>{row.label}</span><input style={boxStyle} type="checkbox" checked={systemOn} onChange={e=>isStatus?toggleDefaultStatusSystem(e.target.checked):toggleEvent(row.event,e.target.checked)}/><input style={boxStyle} type="checkbox" checked={pushOn} onChange={e=>isStatus?setDraft(prev=>({...prev,notificationPushPrefs:{...(prev.notificationPushPrefs||{events:[],status:false}),status:e.target.checked}})):toggleDefaultPushEvent(row.event,e.target.checked)}/></React.Fragment>;})}
          </div>
'''
text = replace_once(text, old, new, 'matriz padrão independente e compacta')

old = '''  const roleTargets=role==='client'?['client_approvers']:['task_responsible','admins'];
  const targetOptions=role==='client'
    ? [['client_approvers','Responsáveis do cliente']]
    : [['task_responsible','Responsável da tarefa'],['admins','Admins']];
  const relevantRules=(form.rules||[]).filter(rule=>rule.enabled!==false&&(rule.targets||[]).some(target=>roleTargets.includes(target)));
'''
new = '''  const roleTargets=role==='client'?['client_approvers']:['task_responsible','admins'];
  const roleTarget=role==='client'?'client_approvers':'task_responsible';
  const roleTargetLabel=role==='client'?'Responsáveis do cliente':'Responsável da tarefa';
  const relevantRules=(form.rules||[]).filter(rule=>rule.enabled!==false&&(rule.targets||[]).some(target=>roleTargets.includes(target)));
'''
text = replace_once(text, old, new, 'remove opções de destinatário de lembrete')

old = '''      const target=targetOptions[0][0];
      if(index>=0){
        const current=rules[index];
        rules[index]={...current,enabled:true,targets:[...new Set([...(current.targets||[]),target])],firstAfterMinutes:Number(current.firstAfterMinutes||1440)};
      }else{
        rules.push({statusKey,enabled:true,targets:[target],firstAfterMinutes:1440,intervalMinutes:2880});
'''
new = '''      const target=roleTarget;
      if(index>=0){
        const current=rules[index];
        const preserved=(current.targets||[]).filter(item=>!roleTargets.includes(item));
        rules[index]={...current,enabled:true,targets:[...preserved,target],firstAfterMinutes:Number(current.firstAfterMinutes||1440)};
      }else{
        rules.push({statusKey,enabled:true,targets:[target],firstAfterMinutes:1440,intervalMinutes:2880});
'''
text = replace_once(text, old, new, 'lembrete usa destino fixo por função')

old = '''  function changeRoleTarget(statusKey,target){
    setForm(prev=>({...prev,rules:(prev.rules||[]).map(rule=>{
      if(rule.statusKey!==statusKey)return rule;
      const others=(rule.targets||[]).filter(item=>!roleTargets.includes(item));
      return {...rule,targets:[...others,target]};
    })}));
  }
'''
text = replace_once(text, old, '', 'remove seletor de destinatário')

old = '''      const saved=await saveNotificationDeliverySettings(organizationId,form);
'''
new = '''      const normalizedForm={...form,rules:(form.rules||[]).map(rule=>({...rule,targets:(rule.targets||[]).filter(target=>target!=='admins')}))};
      const saved=await saveNotificationDeliverySettings(organizationId,normalizedForm);
'''
text = replace_once(text, old, new, 'remove admins legados ao salvar')

old = '''      {relevantRules.map(rule=>{const status=(statuses||[]).find(item=>item.id===rule.statusKey);const target=(rule.targets||[]).find(item=>roleTargets.includes(item))||targetOptions[0][0];const hours=Math.max(1,Math.round(Number(rule.firstAfterMinutes||1440)/60));return <div key={`${role}:${rule.statusKey}`} className="panel" style={{padding:10}}>
'''
new = '''      {relevantRules.map(rule=>{const status=(statuses||[]).find(item=>item.id===rule.statusKey);const hours=Math.max(1,Math.round(Number(rule.firstAfterMinutes||1440)/60));return <div key={`${role}:${rule.statusKey}`} className="panel" style={{padding:10}}>
'''
text = replace_once(text, old, new, 'remove target local do render')

old = '''          <span>→ lembrar</span>
          <select value={target} onChange={e=>changeRoleTarget(rule.statusKey,e.target.value)}>{targetOptions.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select>
          <button type="button" onClick={()=>removeReminder(rule.statusKey)}>Remover</button>
'''
new = '''          <span>→ lembrar <b>{roleTargetLabel}</b></span>
          <button type="button" onClick={()=>removeReminder(rule.statusKey)}>Remover</button>
'''
text = replace_once(text, old, new, 'render sem seletor de destinatário')

old = '''  const scoped=notifications.filter(n=>(!n.userId||n.userId===user.id));
'''
new = '''  const scoped=notifications.filter(n=>(!n.userId||n.userId===user.id)&&!isPushOnlyNotification(n));
'''
text = replace_once(text, old, new, 'painel ignora transportes push-only')

path.write_text(text, encoding='utf-8')

# Edge Function
path = Path('supabase/functions/process-notification-push-queue/index.ts')
text = path.read_text(encoding='utf-8')

old = '''  if (targets.includes("admins")) {
    const { data: admins } = await supabase
      .from("profiles")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("role", "admin")
      .eq("active", true);
    for (const admin of admins ?? []) ids.add(String(admin.id));
  }

'''
text = replace_once(text, old, '', 'edge remove admins dos lembretes')

old = '''      if (!isRecipient) continue;
      if (!profileCanSeeStatus(profile, task.status)) continue;
      if (!profileAllowsSystemEvent(profile, event)) continue;

      const notificationId = `deadline:${event}:${task.id}:${profile.id}:${deadline}`;
'''
new = '''      if (!isRecipient) continue;
      if (!profileCanSeeStatus(profile, task.status)) continue;
      const systemEnabled = profileAllowsSystemEvent(profile, event);
      const pushEnabled = profileAllowsPushEvent(profile, event);
      if (!systemEnabled && !pushEnabled) continue;

      const notificationId = `deadline:${event}:${task.id}:${profile.id}:${deadline}`;
'''
text = replace_once(text, old, new, 'deadline aceita push-only')

old = '''          payload: { actorId: null, actorName: "Sistema", deadline },
'''
new = '''          payload: { actorId: null, actorName: "Sistema", deadline, pushOnly: !systemEnabled && pushEnabled },
'''
text = replace_once(text, old, new, 'deadline marca push-only')

path.write_text(text, encoding='utf-8')
