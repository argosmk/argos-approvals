from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: esperava 1 ocorrência, achei {count}')
    return text.replace(old, new, 1)

# panelAccess.js
path = Path('src/services/panelAccess.js')
text = path.read_text(encoding='utf-8')
old = """export const CLIENT_REQUEST_NOTIFICATION_EVENT = 'Solicitações de clientes';
export const BASE_NOTIFICATION_VISIBLE_EVENTS = ['Comentário na tarefa','Prazo vencido','Prazo hoje'];
export const NOTIFICATION_VISIBLE_EVENTS = [...BASE_NOTIFICATION_VISIBLE_EVENTS,CLIENT_REQUEST_NOTIFICATION_EVENT];
export function defaultNotificationPrefsForRole(role){
  if(role==='client') return [];
  if(role==='admin') return [...NOTIFICATION_VISIBLE_EVENTS];
  return [...BASE_NOTIFICATION_VISIBLE_EVENTS];
}
"""
new = """export const CLIENT_REQUEST_NOTIFICATION_EVENT = 'Solicitações de clientes';
export const BASE_NOTIFICATION_VISIBLE_EVENTS = ['Comentário na tarefa'];
export const NOTIFICATION_VISIBLE_EVENTS = [...BASE_NOTIFICATION_VISIBLE_EVENTS,CLIENT_REQUEST_NOTIFICATION_EVENT];
export const NOTIFICATION_EVENT_ROWS = Object.freeze([
  Object.freeze({id:'status',event:'Status da tarefa',label:'Mudança de status'}),
  Object.freeze({id:'comment',event:'Comentário na tarefa',label:'Comentário'}),
  Object.freeze({id:'request',event:CLIENT_REQUEST_NOTIFICATION_EVENT,label:'Solicitação'}),
]);
export function defaultNotificationPrefsForRole(role){
  if(role==='client') return [];
  if(role==='admin') return [...NOTIFICATION_VISIBLE_EVENTS];
  return [...BASE_NOTIFICATION_VISIBLE_EVENTS];
}
export function defaultNotificationPushPrefsForRole(role){
  return {
    events: defaultNotificationPrefsForRole(role),
    status: role!=='client',
  };
}
"""
text = replace_once(text, old, new, 'catálogo de eventos')
text = replace_once(
    text,
    "    notificationStatusPrefs:{__all__:normalizedRole!=='client'},\n    notificationPanel:builtInNotificationPanelPermissionsForRole(normalizedRole),",
    "    notificationStatusPrefs:{__all__:normalizedRole!=='client'},\n    notificationPushPrefs:defaultNotificationPushPrefsForRole(normalizedRole),\n    notificationPanel:builtInNotificationPanelPermissionsForRole(normalizedRole),",
    'default push prefs'
)
text = replace_once(
    text,
    "    notificationStatusPrefs:saved.notificationStatusPrefs&&typeof saved.notificationStatusPrefs==='object'?saved.notificationStatusPrefs:builtIn.notificationStatusPrefs,\n    notificationPanel:{...builtIn.notificationPanel,...(saved.notificationPanel||{})},",
    "    notificationStatusPrefs:saved.notificationStatusPrefs&&typeof saved.notificationStatusPrefs==='object'?saved.notificationStatusPrefs:builtIn.notificationStatusPrefs,\n    notificationPushPrefs:saved.notificationPushPrefs&&typeof saved.notificationPushPrefs==='object'?{events:Array.isArray(saved.notificationPushPrefs.events)?saved.notificationPushPrefs.events:builtIn.notificationPushPrefs.events,status:typeof saved.notificationPushPrefs.status==='boolean'?saved.notificationPushPrefs.status:builtIn.notificationPushPrefs.status}:builtIn.notificationPushPrefs,\n    notificationPanel:{...builtIn.notificationPanel,...(saved.notificationPanel||{})},",
    'merge default push prefs'
)
text = replace_once(
    text,
    "    notificationStatusPrefs:inheritance.notifications==='custom'?(user.notificationStatusPrefs||{}):defaults.notificationStatusPrefs,\n    notificationPanelPermissions:inheritance.notifications==='custom'",
    "    notificationStatusPrefs:inheritance.notifications==='custom'?(user.notificationStatusPrefs||{}):defaults.notificationStatusPrefs,\n    notificationPushPrefs:inheritance.notifications==='custom'?(user.notificationPushPrefs||defaults.notificationPushPrefs):defaults.notificationPushPrefs,\n    notificationPanelPermissions:inheritance.notifications==='custom'",
    'resolve push prefs'
)
path.write_text(text, encoding='utf-8')

# profileTableService.js
path = Path('src/services/profileTableService.js')
text = path.read_text(encoding='utf-8')
text = replace_once(
    text,
    "    notificationStatusPrefs: profile.notification_prefs?.statuses || undefined,\n    notificationPrefsFromProfile: !!profile.notification_prefs,",
    "    notificationStatusPrefs: profile.notification_prefs?.statuses || undefined,\n    notificationPushPrefs: profile.notification_prefs ? {\n      events: Array.isArray(profile.notification_prefs?.push_events) ? profile.notification_prefs.push_events : undefined,\n      status: typeof profile.notification_prefs?.push_status === 'boolean' ? profile.notification_prefs.push_status : undefined,\n    } : undefined,\n    notificationPrefsFromProfile: !!profile.notification_prefs,",
    'map push prefs'
)
text = replace_once(
    text,
    "  const notification_prefs = {\n    events: prefs.notificationPrefs || [],\n    statuses: prefs.notificationStatusPrefs || {},\n  };",
    "  const notification_prefs = {\n    events: prefs.notificationPrefs || [],\n    statuses: prefs.notificationStatusPrefs || {},\n    push_events: Array.isArray(prefs.notificationPushPrefs?.events) ? prefs.notificationPushPrefs.events : (prefs.notificationPrefs || []),\n    push_status: typeof prefs.notificationPushPrefs?.status === 'boolean' ? prefs.notificationPushPrefs.status : false,\n  };",
    'save push prefs'
)
path.write_text(text, encoding='utf-8')

# main.jsx
path = Path('src/main.jsx')
text = path.read_text(encoding='utf-8')
text = replace_once(
    text,
    "  NOTIFICATION_VISIBLE_EVENTS,\n  defaultNotificationPrefsForRole",
    "  NOTIFICATION_VISIBLE_EVENTS,\n  NOTIFICATION_EVENT_ROWS,\n  defaultNotificationPrefsForRole",
    'import event rows'
)
text = replace_once(
    text,
    "function wantsNotification(user, event, statusId){\n  if(!user?.active) return false;\n  if(event==='Status da tarefa'){\n    if(!statusId) return false;\n    if(user.role!=='admin'){\n      const visibleStatuses=Array.isArray(user.visibleStatuses)?user.visibleStatuses:[];\n      if(!visibleStatuses.includes(statusId)) return false;\n    }\n    return statusChangeNotificationsEnabled(user.notificationStatusPrefs||{},user.role);\n  }",
    "function wantsNotification(user, event, statusId){\n  if(!user?.active) return false;\n  if(statusId&&user.role!=='admin'){\n    const visibleStatuses=Array.isArray(user.visibleStatuses)?user.visibleStatuses:[];\n    if(!visibleStatuses.includes(statusId)) return false;\n  }\n  if(event==='Status da tarefa'){\n    if(!statusId) return false;\n    return statusChangeNotificationsEnabled(user.notificationStatusPrefs||{},user.role);\n  }",
    'status gate all events'
)
text = replace_once(
    text,
    "    notificationStatusPrefs: profile.notification_prefs?.statuses || undefined,\n    notificationPrefsFromProfile: !!profile.notification_prefs,",
    "    notificationStatusPrefs: profile.notification_prefs?.statuses || undefined,\n    notificationPushPrefs: profile.notification_prefs ? {\n      events: Array.isArray(profile.notification_prefs?.push_events) ? profile.notification_prefs.push_events : undefined,\n      status: typeof profile.notification_prefs?.push_status === 'boolean' ? profile.notification_prefs.push_status : undefined,\n    } : undefined,\n    notificationPrefsFromProfile: !!profile.notification_prefs,",
    'main profile push prefs'
)
text = replace_once(
    text,
    "    notificationStatusPrefs: profile?.notificationPrefsFromProfile ? (profile.notificationStatusPrefs || {}) : (existing.notificationStatusPrefs || profile?.notificationStatusPrefs || {}),\n    socialInstagram:",
    "    notificationStatusPrefs: profile?.notificationPrefsFromProfile ? (profile.notificationStatusPrefs || {}) : (existing.notificationStatusPrefs || profile?.notificationStatusPrefs || {}),\n    notificationPushPrefs: profile?.notificationPrefsFromProfile ? {\n      events:Array.isArray(profile?.notificationPushPrefs?.events)?profile.notificationPushPrefs.events:(existing.notificationPushPrefs?.events||profile.notificationPrefs||defaultNotificationPrefsForRole(profile?.role)),\n      status:typeof profile?.notificationPushPrefs?.status==='boolean'?profile.notificationPushPrefs.status:(typeof existing.notificationPushPrefs?.status==='boolean'?existing.notificationPushPrefs.status:profile?.role!=='client')\n    } : (existing.notificationPushPrefs || profile?.notificationPushPrefs || {events:defaultNotificationPrefsForRole(profile?.role),status:profile?.role!=='client'}),\n    socialInstagram:",
    'merge profile push prefs'
)
text = replace_once(
    text,
    "  delete copy.notificationStatusPrefs;\n  return copy;",
    "  delete copy.notificationStatusPrefs;\n  delete copy.notificationPushPrefs;\n  return copy;",
    'exclude push prefs from workspace'
)
text = replace_once(
    text,
    "    const recipients = users\n      .filter(u=>u.active && u.role!=='client' && (u.role==='admin' || u.id===task.responsibleId))\n      .filter(u=>u.id!==actorId)",
    "    const recipients = users\n      .filter(u=>u.active && (u.role==='admin' || (u.role==='team'&&u.id===task.responsibleId) || (u.role==='client'&&Array.isArray(u.companyIds)&&u.companyIds.includes(task.companyId))))\n      .filter(u=>u.id!==actorId)",
    'client notification recipients'
)
text = replace_once(
    text,
    "      ...(section==='notifications'&&mode==='custom'?{\n        notificationPrefs:[...(roleDefault.notificationPrefs||[])],\n        notificationStatusPrefs:{...(roleDefault.notificationStatusPrefs||{})}\n      }:{}),",
    "      ...(section==='notifications'&&mode==='custom'?{\n        notificationPrefs:[...(roleDefault.notificationPrefs||[])],\n        notificationStatusPrefs:{...(roleDefault.notificationStatusPrefs||{})},\n        notificationPushPrefs:{events:[...(roleDefault.notificationPushPrefs?.events||[])],status:roleDefault.notificationPushPrefs?.status===true}\n      }:{}),",
    'individual inherit push prefs'
)
text = replace_once(
    text,
    "  function toggleEvent(ev,checked){\n    const current=notificationInheritance==='custom'?(f.notificationPrefs||[]):(roleDefault.notificationPrefs||events);\n    set('notificationPrefs',checked?[...new Set([...current,ev])]:current.filter(x=>x!==ev));\n  }",
    "  function toggleEvent(ev,checked){\n    const current=notificationInheritance==='custom'?(f.notificationPrefs||[]):(roleDefault.notificationPrefs||events);\n    const next=checked?[...new Set([...current,ev])]:current.filter(x=>x!==ev);\n    setF(prev=>({\n      ...prev,\n      notificationPrefs:next,\n      notificationPushPrefs:checked?(prev.notificationPushPrefs||roleDefault.notificationPushPrefs):{...(prev.notificationPushPrefs||roleDefault.notificationPushPrefs),events:(prev.notificationPushPrefs?.events||roleDefault.notificationPushPrefs?.events||[]).filter(x=>x!==ev)}\n    }));\n  }\n  function togglePushEvent(ev,checked){\n    const current=f.notificationPushPrefs?.events||roleDefault.notificationPushPrefs?.events||[];\n    set('notificationPushPrefs',{...(f.notificationPushPrefs||roleDefault.notificationPushPrefs),events:checked?[...new Set([...current,ev])]:current.filter(x=>x!==ev)});\n  }\n  function toggleStatusSystem(checked){\n    setF(prev=>({...prev,notificationStatusPrefs:{__all__:checked},notificationPushPrefs:checked?(prev.notificationPushPrefs||roleDefault.notificationPushPrefs):{...(prev.notificationPushPrefs||roleDefault.notificationPushPrefs),status:false}}));\n  }",
    'individual notification toggles'
)
text = replace_once(
    text,
    "  const notificationRulesDiff=!deepPermEqual(f.notificationPrefs||[], roleDefault.notificationPrefs||[])\n    || statusNotificationsEnabled!==defaultStatusNotificationsEnabled;",
    "  const notificationRulesDiff=!deepPermEqual(f.notificationPrefs||[], roleDefault.notificationPrefs||[])\n    || statusNotificationsEnabled!==defaultStatusNotificationsEnabled\n    || !deepPermEqual(f.notificationPushPrefs||roleDefault.notificationPushPrefs||{}, roleDefault.notificationPushPrefs||{});",
    'individual push diff'
)
old_individual = """      <AccessConfigCard title=\"Notificações e alertas\" open={openSection==='rule:notifications'} onToggleOpen={()=>toggleSection('rule:notifications')} accent customized={notificationRulesDiff}>
        <div style={notificationInheritance!=='custom'?{pointerEvents:'none'}:undefined}>
          <p className=\"muted\" style={{marginTop:0}}>As notificações de mudança de status só são geradas para status liberados em \"Status disponíveis\".</p>
          <div className=\"checks one-col compact-checks-v3\">
            {(()=>{const itemDiff=statusNotificationsEnabled!==defaultStatusNotificationsEnabled;return <label className={itemDiff?'custom-access-field':undefined} style={!itemDiff?{opacity:.62}:undefined}>{itemDiff&&<span className=\"item-custom-dot\"/>}<input type=\"checkbox\" checked={statusNotificationsEnabled} onChange={e=>set('notificationStatusPrefs',{__all__:e.target.checked})}/>Mudança de status</label>;})()}
            {events.map(ev=>{const itemDiff=(roleDefault.notificationPrefs||[]).includes(ev)!==(f.notificationPrefs||[]).includes(ev);return <label key={ev} className={itemDiff?'custom-access-field':undefined} style={!itemDiff?{opacity:.62}:undefined}>{itemDiff&&<span className=\"item-custom-dot\"/>}<input type=\"checkbox\" checked={(f.notificationPrefs||[]).includes(ev)} onChange={e=>toggleEvent(ev,e.target.checked)}/>{ev}</label>;})}
          </div>
        </div>
      </AccessConfigCard>"""
new_individual = """      <AccessConfigCard title=\"Notificações e alertas\" open={openSection==='rule:notifications'} onToggleOpen={()=>toggleSection('rule:notifications')} accent customized={notificationRulesDiff}>
        <div style={notificationInheritance!=='custom'?{pointerEvents:'none'}:undefined}>
          <p className=\"muted\" style={{marginTop:0}}>\"Sistema\" cria a notificação dentro do Argos. \"Push\" envia o mesmo aviso fora do sistema. Status continuam limitados por \"Status disponíveis\".</p>
          <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) 72px 72px',gap:8,alignItems:'center'}}>
            <small className=\"muted\">Evento</small><small className=\"muted\" style={{textAlign:'center'}}>Sistema</small><small className=\"muted\" style={{textAlign:'center'}}>Push</small>
            {NOTIFICATION_EVENT_ROWS.map(row=>{const isStatus=row.id==='status';const systemOn=isStatus?statusNotificationsEnabled:(f.notificationPrefs||[]).includes(row.event);const pushOn=isStatus?(f.notificationPushPrefs?.status??roleDefault.notificationPushPrefs?.status??false):(f.notificationPushPrefs?.events||roleDefault.notificationPushPrefs?.events||[]).includes(row.event);return <React.Fragment key={row.id}><span>{row.label}</span><input style={{margin:'0 auto'}} type=\"checkbox\" checked={systemOn} onChange={e=>isStatus?toggleStatusSystem(e.target.checked):toggleEvent(row.event,e.target.checked)}/><input style={{margin:'0 auto'}} type=\"checkbox\" disabled={!systemOn} checked={systemOn&&pushOn} onChange={e=>isStatus?set('notificationPushPrefs',{...(f.notificationPushPrefs||roleDefault.notificationPushPrefs),status:e.target.checked}):togglePushEvent(row.event,e.target.checked)}/></React.Fragment>;})}
          </div>
        </div>
      </AccessConfigCard>"""
text = replace_once(text, old_individual, new_individual, 'individual notification matrix')

text = replace_once(
    text,
    "  function toggleEvent(ev,checked){\n    const current=draft.notificationPrefs||[];\n    setDraftValue('notificationPrefs',checked?[...new Set([...current,ev])]:current.filter(x=>x!==ev));\n  }",
    "  function toggleEvent(ev,checked){\n    const current=draft.notificationPrefs||[];\n    const next=checked?[...new Set([...current,ev])]:current.filter(x=>x!==ev);\n    setDraft(prev=>({...prev,notificationPrefs:next,notificationPushPrefs:checked?(prev.notificationPushPrefs||{events:[],status:false}):{...(prev.notificationPushPrefs||{events:[],status:false}),events:(prev.notificationPushPrefs?.events||[]).filter(x=>x!==ev)}}));\n  }\n  function toggleDefaultPushEvent(ev,checked){\n    const current=draft.notificationPushPrefs?.events||[];\n    setDraft(prev=>({...prev,notificationPushPrefs:{...(prev.notificationPushPrefs||{events:[],status:false}),events:checked?[...new Set([...current,ev])]:current.filter(x=>x!==ev)}}));\n  }\n  function toggleDefaultStatusSystem(checked){\n    setDraft(prev=>({...prev,notificationStatusPrefs:{__all__:checked},notificationPushPrefs:checked?(prev.notificationPushPrefs||{events:[],status:false}):{...(prev.notificationPushPrefs||{events:[],status:false}),status:false}}));\n  }",
    'default notification toggles'
)
old_default = """        <AccessConfigCard title=\"Notificações e alertas\" open={openSection==='rule:notifications'} onToggleOpen={()=>toggleSection('rule:notifications')} accent>
          <h4 style={{marginTop:0}}>Eventos desta função</h4>
          <p className=\"muted\">Mudanças de status só avisam sobre status que também estejam liberados em \"Status disponíveis\".</p>
          <div className=\"checks one-col compact-checks-v3\">
            <label><input type=\"checkbox\" checked={statusChangeNotificationsEnabled(draft.notificationStatusPrefs||{},role)} onChange={e=>setDraftValue('notificationStatusPrefs',{__all__:e.target.checked})}/>Mudança de status</label>
            {NOTIFICATION_VISIBLE_EVENTS.map(ev=><label key={ev}><input type=\"checkbox\" checked={(draft.notificationPrefs||[]).includes(ev)} onChange={e=>toggleEvent(ev,e.target.checked)}/>{ev}</label>)}
          </div>
          <div style={{marginTop:18,paddingTop:16,borderTop:'1px solid var(--line)'}}>
            <NotificationDeliverySettings currentUser={currentUser} statuses={statuses} role={role}/>
          </div>
        </AccessConfigCard>"""
new_default = """        <AccessConfigCard title=\"Notificações e alertas\" open={openSection==='rule:notifications'} onToggleOpen={()=>toggleSection('rule:notifications')} accent>
          <p className=\"muted\" style={{marginTop:0}}>Escolha apenas o canal de cada evento. Push só pode ser ativado quando a notificação no sistema também estiver ativa.</p>
          <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) 72px 72px',gap:8,alignItems:'center'}}>
            <small className=\"muted\">Evento</small><small className=\"muted\" style={{textAlign:'center'}}>Sistema</small><small className=\"muted\" style={{textAlign:'center'}}>Push</small>
            {NOTIFICATION_EVENT_ROWS.map(row=>{const isStatus=row.id==='status';const systemOn=isStatus?statusChangeNotificationsEnabled(draft.notificationStatusPrefs||{},role):(draft.notificationPrefs||[]).includes(row.event);const pushOn=isStatus?(draft.notificationPushPrefs?.status===true):(draft.notificationPushPrefs?.events||[]).includes(row.event);return <React.Fragment key={row.id}><span>{row.label}</span><input style={{margin:'0 auto'}} type=\"checkbox\" checked={systemOn} onChange={e=>isStatus?toggleDefaultStatusSystem(e.target.checked):toggleEvent(row.event,e.target.checked)}/><input style={{margin:'0 auto'}} type=\"checkbox\" disabled={!systemOn} checked={systemOn&&pushOn} onChange={e=>isStatus?setDraft(prev=>({...prev,notificationPushPrefs:{...(prev.notificationPushPrefs||{events:[],status:false}),status:e.target.checked}})):toggleDefaultPushEvent(row.event,e.target.checked)}/></React.Fragment>;})}
          </div>
          <div style={{marginTop:18,paddingTop:16,borderTop:'1px solid var(--line)'}}>
            <NotificationDeliverySettings currentUser={currentUser} statuses={statuses} role={role}/>
          </div>
        </AccessConfigCard>"""
text = replace_once(text, old_default, new_default, 'default notification matrix')

text = replace_once(
    text,
    "          notificationPrefs: nextUser.notificationPrefs || events,\n          notificationStatusPrefs: nextUser.notificationStatusPrefs || {}\n        });",
    "          notificationPrefs: nextUser.notificationPrefs || events,\n          notificationStatusPrefs: nextUser.notificationStatusPrefs || {},\n          notificationPushPrefs: nextUser.notificationPushPrefs || {events:nextUser.notificationPrefs||events,status:statusChangeNotificationsEnabled(nextUser.notificationStatusPrefs||{},nextUser.role)}\n        });",
    'save team push prefs'
)
text = replace_once(
    text,
    "  async function saveClientSettings(nextUser){\n    if(isSupabaseConfigured && nextUser?.accessInheritance?.statuses==='custom'){\n      await updateAuthBackedAppUserProfile(nextUser);\n    }\n    setUsers(prev=>prev.map(x=>x.id===nextUser.id?nextUser:x));",
    "  async function saveClientSettings(nextUser){\n    if(isSupabaseConfigured){\n      await updateProfileNotificationPrefs(nextUser.id,{\n        notificationPrefs:nextUser.notificationPrefs||[],\n        notificationStatusPrefs:nextUser.notificationStatusPrefs||{},\n        notificationPushPrefs:nextUser.notificationPushPrefs||{events:[],status:false}\n      });\n      if(nextUser?.accessInheritance?.statuses==='custom') await updateAuthBackedAppUserProfile(nextUser);\n    }\n    setUsers(prev=>prev.map(x=>x.id===nextUser.id?nextUser:x));",
    'save client notification prefs'
)

start = text.find("function NotificationDeliverySettings({currentUser,statuses,role='team'}){")
end = text.find("\nconst DEFAULT_DOCUMENT_FOLDERS", start)
if start < 0 or end < 0:
    raise SystemExit('não encontrou limites de NotificationDeliverySettings')
new_component = r'''function NotificationDeliverySettings({currentUser,statuses,role='team'}){
  const organizationId=currentUser?.organizationId;
  const empty={enabled:true,teamDigestMinutes:30,clientApprovalDelayMinutes:5,presenceGraceSeconds:120,rules:[]};
  const [form,setForm]=useState(empty);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [newStatusKey,setNewStatusKey]=useState('');

  useEffect(()=>{
    let alive=true;
    if(!organizationId){setLoading(false);setError('Organização não identificada.');return()=>{alive=false};}
    (async()=>{
      try{
        setLoading(true);setError('');
        const data=await loadNotificationDeliverySettings(organizationId);
        if(alive)setForm({...empty,...data,rules:Array.isArray(data?.rules)?data.rules:[]});
      }catch(err){if(alive)setError(err.message||'Não foi possível carregar as configurações de lembrete.');}
      finally{if(alive)setLoading(false);}
    })();
    return()=>{alive=false};
  },[organizationId]);

  const roleTargets=role==='client'?['client_approvers']:['task_responsible','admins'];
  const targetOptions=role==='client'
    ? [['client_approvers','Responsáveis do cliente']]
    : [['task_responsible','Responsável da tarefa'],['admins','Admins']];
  const relevantRules=(form.rules||[]).filter(rule=>rule.enabled!==false&&(rule.targets||[]).some(target=>roleTargets.includes(target)));
  const availableStatuses=(statuses||[]).filter(status=>!relevantRules.some(rule=>rule.statusKey===status.id));

  function addReminder(){
    const statusKey=newStatusKey||availableStatuses[0]?.id;
    if(!statusKey)return;
    setForm(prev=>{
      const rules=[...(prev.rules||[])];
      const index=rules.findIndex(rule=>rule.statusKey===statusKey);
      const target=targetOptions[0][0];
      if(index>=0){
        const current=rules[index];
        rules[index]={...current,enabled:true,targets:[...new Set([...(current.targets||[]),target])],firstAfterMinutes:Number(current.firstAfterMinutes||1440)};
      }else{
        rules.push({statusKey,enabled:true,targets:[target],firstAfterMinutes:1440,intervalMinutes:2880});
      }
      return {...prev,rules};
    });
    setNewStatusKey('');
  }
  function patchReminder(statusKey,patch){
    setForm(prev=>({...prev,rules:(prev.rules||[]).map(rule=>rule.statusKey===statusKey?{...rule,...patch}:rule)}));
  }
  function changeRoleTarget(statusKey,target){
    setForm(prev=>({...prev,rules:(prev.rules||[]).map(rule=>{
      if(rule.statusKey!==statusKey)return rule;
      const others=(rule.targets||[]).filter(item=>!roleTargets.includes(item));
      return {...rule,targets:[...others,target]};
    })}));
  }
  function removeReminder(statusKey){
    setForm(prev=>({...prev,rules:(prev.rules||[]).map(rule=>{
      if(rule.statusKey!==statusKey)return rule;
      const targets=(rule.targets||[]).filter(item=>!roleTargets.includes(item));
      return {...rule,targets};
    }).filter(rule=>(rule.targets||[]).length)}));
  }
  async function saveDelivery(){
    try{
      setSaving(true);setError('');setMessage('');
      const saved=await saveNotificationDeliverySettings(organizationId,form);
      setForm({...empty,...saved,rules:Array.isArray(saved?.rules)?saved.rules:[]});
      setMessage('Lembretes salvos.');
      notifySettingsSaved('Lembretes salvos');
    }catch(err){setError(err.message||'Não foi possível salvar os lembretes.');}
    finally{setSaving(false);}
  }

  if(loading)return <p className="muted">Carregando lembretes...</p>;
  return <div>
    <h4 style={{margin:'0 0 6px'}}>Lembretes</h4>
    <p className="muted" style={{marginTop:0}}>Crie somente as exceções de atraso que realmente precisam cobrar alguém.</p>
    {error&&<div className="cloud-error">{error}</div>}
    {message&&<div className="public-portfolio-success">{message}</div>}
    <div style={{display:'flex',flexDirection:'column',gap:8}}>
      {relevantRules.map(rule=>{const status=(statuses||[]).find(item=>item.id===rule.statusKey);const target=(rule.targets||[]).find(item=>roleTargets.includes(item))||targetOptions[0][0];const hours=Math.max(1,Math.round(Number(rule.firstAfterMinutes||1440)/60));return <div key={`${role}:${rule.statusKey}`} className="panel" style={{padding:10}}>
        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <span>Se permanecer</span>
          <input type="number" min="1" value={hours} onChange={e=>patchReminder(rule.statusKey,{firstAfterMinutes:Math.max(1,parseInt(e.target.value,10)||1)*60})} style={{width:74}}/>
          <span>hora(s) em <b>{status?.name||rule.statusKey}</b></span>
          <span>→ lembrar</span>
          <select value={target} onChange={e=>changeRoleTarget(rule.statusKey,e.target.value)}>{targetOptions.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select>
          <button type="button" onClick={()=>removeReminder(rule.statusKey)}>Remover</button>
        </div>
      </div>;})}
      {!relevantRules.length&&<small className="muted">Nenhum lembrete configurado para esta função.</small>}
    </div>
    {!!availableStatuses.length&&<div style={{display:'flex',gap:8,alignItems:'end',marginTop:12,flexWrap:'wrap'}}>
      <label style={{margin:0}}>Status<select value={newStatusKey||availableStatuses[0]?.id||''} onChange={e=>setNewStatusKey(e.target.value)}>{availableStatuses.map(status=><option key={status.id} value={status.id}>{status.name}</option>)}</select></label>
      <button type="button" onClick={addReminder}>+ Adicionar lembrete</button>
    </div>}
    <div className="row-actions" style={{marginTop:12}}><button className="primary" onClick={saveDelivery} disabled={saving||!organizationId}>{saving?'Salvando...':'Salvar lembretes'}</button></div>
  </div>;
}
'''
text = text[:start] + new_component + text[end:]
path.write_text(text, encoding='utf-8')

# Edge Function: push uses dedicated channel prefs; reminders become one-shot per status stay.
path = Path('supabase/functions/process-notification-push-queue/index.ts')
text = path.read_text(encoding='utf-8')
old = """function profileAllowsPushEvent(profile: any, event: string | null | undefined) {
  if (!event) return true;
  if (event === \"Status da tarefa\") return statusChangePushEnabled(profile);
  const events = profile?.notification_prefs?.events;
  return Array.isArray(events) ? events.includes(event) : true;
}
"""
new = """function profileAllowsPushEvent(profile: any, event: string | null | undefined) {
  if (!event) return true;
  if (event === \"Status da tarefa\") {
    const dedicated = profile?.notification_prefs?.push_status;
    return typeof dedicated === \"boolean\" ? dedicated : statusChangePushEnabled(profile);
  }
  const dedicatedEvents = profile?.notification_prefs?.push_events;
  if (Array.isArray(dedicatedEvents)) return dedicatedEvents.includes(event);
  const legacyEvents = profile?.notification_prefs?.events;
  return Array.isArray(legacyEvents) ? legacyEvents.includes(event) : true;
}
"""
text = replace_once(text, old, new, 'edge push channel prefs')
old = """      const elapsedMinutes = Math.floor(minutesBetween(enteredAt, nowMs));
      const first = Math.max(0, Number(rule.first_after_minutes ?? 1440));
      const interval = Math.max(1, Number(rule.interval_minutes ?? 2880));
      if (elapsedMinutes < first) continue;

      const occurrence = Math.floor((elapsedMinutes - first) / interval) + 1;
      const profileIds = await reminderTargets(
"""
new = """      const elapsedMinutes = Math.floor(minutesBetween(enteredAt, nowMs));
      const first = Math.max(0, Number(rule.first_after_minutes ?? 1440));
      if (elapsedMinutes < first) continue;

      const occurrence = 1;
      const enteredKey = new Date(enteredAt).toISOString();
      const profileIds = await reminderTargets(
"""
text = replace_once(text, old, new, 'one-shot reminder timing')
text = replace_once(
    text,
    "        const sourceKey = `reminder:${rule.id}:${task.id}:${profileId}:${occurrence}`;",
    "        const sourceKey = `reminder:${rule.id}:${task.id}:${profileId}:${enteredKey}`;",
    'reminder source key by status stay'
)
path.write_text(text, encoding='utf-8')

print('Step 7 aplicado: matriz Sistema/Push + lembretes simples')
