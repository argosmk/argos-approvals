from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: esperado 1 bloco, encontrado {count}')
    return text.replace(old, new, 1)

# Catálogo/padrões: mudança de status vira uma única permissão por função.
panel_path = Path('src/services/panelAccess.js')
panel = panel_path.read_text(encoding='utf-8')
panel = replace_once(
    panel,
    "    notificationStatusPrefs:{},\n",
    "    notificationStatusPrefs:{__all__:normalizedRole!=='client'},\n",
    'notificationStatusPrefs padrão'
)
panel_path.write_text(panel, encoding='utf-8')

# Frontend e regra de criação de notificação interna.
main_path = Path('src/main.jsx')
main = main_path.read_text(encoding='utf-8')

main = replace_once(
    main,
    "function isLogNoise(text=''){ return LOG_NOISE_PATTERNS.some(rx=>rx.test(String(text||''))); }\nfunction wantsNotification(user, event, statusId){\n",
    "function isLogNoise(text=''){ return LOG_NOISE_PATTERNS.some(rx=>rx.test(String(text||''))); }\nfunction statusChangeNotificationsEnabled(statusPrefs={},role='team'){\n  if(typeof statusPrefs?.__all__==='boolean') return statusPrefs.__all__;\n  const legacy=Object.entries(statusPrefs||{}).filter(([key])=>key!=='__all__');\n  if(legacy.length) return legacy.some(([,value])=>value!==false);\n  return role!=='client';\n}\nfunction wantsNotification(user, event, statusId){\n",
    'helper de mudança de status'
)

main = replace_once(
    main,
    "function wantsNotification(user, event, statusId){\n  if(!user?.active || user.role==='client') return false;\n  const statusPrefs=user.notificationStatusPrefs||{};\n  if(event==='Status da tarefa'){\n    return !!statusId && (statusPrefs[statusId]??true);\n  }\n  if(BLOCKED_NOTIFICATION_EVENTS.has(event)) return false;\n  if(!NOTIFICATION_VISIBLE_EVENTS.includes(event)) return false;\n  const prefs=Array.isArray(user.notificationPrefs)?user.notificationPrefs:defaultNotificationPrefsForRole(user.role);\n  return prefs.includes(event);\n}\n",
    "function wantsNotification(user, event, statusId){\n  if(!user?.active) return false;\n  if(event==='Status da tarefa'){\n    if(!statusId) return false;\n    if(user.role!=='admin'){\n      const visibleStatuses=Array.isArray(user.visibleStatuses)?user.visibleStatuses:[];\n      if(!visibleStatuses.includes(statusId)) return false;\n    }\n    return statusChangeNotificationsEnabled(user.notificationStatusPrefs||{},user.role);\n  }\n  if(BLOCKED_NOTIFICATION_EVENTS.has(event)) return false;\n  if(!NOTIFICATION_VISIBLE_EVENTS.includes(event)) return false;\n  const prefs=Array.isArray(user.notificationPrefs)?user.notificationPrefs:defaultNotificationPrefsForRole(user.role);\n  return prefs.includes(event);\n}\n",
    'wantsNotification'
)

main = replace_once(
    main,
    "  const notificationsDiff=!deepPermEqual(notificationPanelConfig, roleDefault.notificationPanel||builtInNotificationPanelPermissionsForRole(f.role))\n    || !deepPermEqual(f.notificationPrefs||[], roleDefault.notificationPrefs||[])\n    || !deepPermEqual(f.notificationStatusPrefs||{}, roleDefault.notificationStatusPrefs||{});\n",
    "  const notificationPanelDiff=!deepPermEqual(notificationPanelConfig, roleDefault.notificationPanel||builtInNotificationPanelPermissionsForRole(f.role));\n  const statusNotificationsEnabled=statusChangeNotificationsEnabled(f.notificationStatusPrefs||{},f.role);\n  const defaultStatusNotificationsEnabled=statusChangeNotificationsEnabled(roleDefault.notificationStatusPrefs||{},f.role);\n  const notificationRulesDiff=!deepPermEqual(f.notificationPrefs||[], roleDefault.notificationPrefs||[])\n    || statusNotificationsEnabled!==defaultStatusNotificationsEnabled;\n  const notificationsDiff=notificationPanelDiff||notificationRulesDiff;\n",
    'diffs de notificações'
)

old_individual = '''      <AccessConfigCard title="Notificações e alertas" open={openSection==='rule:notifications'} onToggleOpen={()=>toggleSection('rule:notifications')} accent customized={notificationsDiff}>
        <div style={notificationInheritance!=='custom'?{pointerEvents:'none'}:undefined}>
          <div className="notification-prefs-grid">
            <div><h3>Eventos que geram notificação</h3><div className="checks one-col compact-checks-v3">{events.map(ev=>{const itemDiff=(roleDefault.notificationPrefs||[]).includes(ev)!==(f.notificationPrefs||[]).includes(ev);return <label key={ev} className={itemDiff?'custom-access-field':undefined} style={!itemDiff?{opacity:.62}:undefined}>{itemDiff&&<span className="item-custom-dot"/>}<input type="checkbox" checked={(f.notificationPrefs||[]).includes(ev)} onChange={e=>toggleEvent(ev,e.target.checked)}/>{ev}</label>;})}</div></div>
            <div><h3>Status que geram notificação</h3><div className="checks one-col status-notify-list compact-checks-v3">{statuses.map(st=>{const itemDiff=(roleDefault.notificationStatusPrefs?.[st.id]??true)!==(f.notificationStatusPrefs?.[st.id]??true);return <label key={st.id} className={itemDiff?'custom-access-field':undefined} style={!itemDiff?{opacity:.62}:undefined}>{itemDiff&&<span className="item-custom-dot"/>}<input type="checkbox" checked={f.notificationStatusPrefs?.[st.id]??true} onChange={e=>set('notificationStatusPrefs',{...(f.notificationStatusPrefs||{}),[st.id]:e.target.checked})}/><span className="status-dot" style={{background:st.color}}></span>{st.name}</label>;})}</div></div>
          </div>
        </div>
      </AccessConfigCard>
'''
new_individual = '''      <AccessConfigCard title="Notificações e alertas" open={openSection==='rule:notifications'} onToggleOpen={()=>toggleSection('rule:notifications')} accent customized={notificationRulesDiff}>
        <div style={notificationInheritance!=='custom'?{pointerEvents:'none'}:undefined}>
          <p className="muted" style={{marginTop:0}}>As notificações de mudança de status só são geradas para status liberados em \"Status disponíveis\".</p>
          <div className="checks one-col compact-checks-v3">
            {(()=>{const itemDiff=statusNotificationsEnabled!==defaultStatusNotificationsEnabled;return <label className={itemDiff?'custom-access-field':undefined} style={!itemDiff?{opacity:.62}:undefined}>{itemDiff&&<span className="item-custom-dot"/>}<input type="checkbox" checked={statusNotificationsEnabled} onChange={e=>set('notificationStatusPrefs',{__all__:e.target.checked})}/>Mudança de status</label>;})()}
            {events.map(ev=>{const itemDiff=(roleDefault.notificationPrefs||[]).includes(ev)!==(f.notificationPrefs||[]).includes(ev);return <label key={ev} className={itemDiff?'custom-access-field':undefined} style={!itemDiff?{opacity:.62}:undefined}>{itemDiff&&<span className="item-custom-dot"/>}<input type="checkbox" checked={(f.notificationPrefs||[]).includes(ev)} onChange={e=>toggleEvent(ev,e.target.checked)}/>{ev}</label>;})}
          </div>
        </div>
      </AccessConfigCard>
'''
main = replace_once(main, old_individual, new_individual, 'card individual de notificações')

main = replace_once(
    main,
    "          notifications:notificationsDiff,\n",
    "          notifications:notificationPanelDiff,\n",
    'indicador customizado do painel'
)

old_default = '''        <AccessConfigCard title="Notificações e alertas" open={openSection==='rule:notifications'} onToggleOpen={()=>toggleSection('rule:notifications')} accent>
          <div className="notification-prefs-grid"><div><h4>Eventos</h4><div className="checks one-col compact-checks-v3">{NOTIFICATION_VISIBLE_EVENTS.map(ev=><label key={ev}><input type="checkbox" checked={(draft.notificationPrefs||[]).includes(ev)} onChange={e=>toggleEvent(ev,e.target.checked)}/>{ev}</label>)}</div></div><div><h4>Status que geram notificação</h4><div className="checks one-col status-notify-list compact-checks-v3">{statuses.map(st=><label key={st.id}><input type="checkbox" checked={(draft.notificationStatusPrefs?.[st.id]??true)} onChange={e=>setDraftValue('notificationStatusPrefs',{...(draft.notificationStatusPrefs||{}),[st.id]:e.target.checked})}/><span className="status-dot" style={{background:st.color}}></span>{st.name}</label>)}</div></div></div>
        </AccessConfigCard>
'''
new_default = '''        <AccessConfigCard title="Notificações e alertas" open={openSection==='rule:notifications'} onToggleOpen={()=>toggleSection('rule:notifications')} accent>
          <p className="muted" style={{marginTop:0}}>Mudanças de status só avisam sobre status que também estejam liberados em \"Status disponíveis\".</p>
          <div className="checks one-col compact-checks-v3">
            <label><input type="checkbox" checked={statusChangeNotificationsEnabled(draft.notificationStatusPrefs||{},role)} onChange={e=>setDraftValue('notificationStatusPrefs',{__all__:e.target.checked})}/>Mudança de status</label>
            {NOTIFICATION_VISIBLE_EVENTS.map(ev=><label key={ev}><input type="checkbox" checked={(draft.notificationPrefs||[]).includes(ev)} onChange={e=>toggleEvent(ev,e.target.checked)}/>{ev}</label>)}
          </div>
        </AccessConfigCard>
'''
main = replace_once(main, old_default, new_default, 'card padrão de notificações')

main_path.write_text(main, encoding='utf-8')
print('Etapa 3 aplicada com substituições exatas.')
