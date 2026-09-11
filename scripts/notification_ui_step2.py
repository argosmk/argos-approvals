from pathlib import Path

p=Path('src/main.jsx')
s=p.read_text(encoding='utf-8')

def rep(old,new,label):
    global s
    if old not in s:
        raise SystemExit(f'Bloco não encontrado: {label}')
    s=s.replace(old,new,1)

# Usuário individual: painel Notificações fica só com opções do próprio painel.
old="""    if(panel.id==='notifications') return <div>
      <div style={notificationInheritance!=='custom'?{pointerEvents:'none'}:undefined}>
        <h3 style={{display:'flex',alignItems:'center',gap:7}}>{notificationsDiff&&<span className=\"item-custom-dot\"/>}<span style={{opacity:notificationsDiff?1:.62}}>Painel e ações</span></h3>
        <div className=\"checks one-col compact-checks-v3\">{NOTIFICATION_PANEL_PERMISSION_ITEMS.map(item=>{const def=(roleDefault.notificationPanel||builtInNotificationPanelPermissionsForRole(f.role))?.[item.id];const itemDiff=notificationPanelConfig?.[item.id]!==def;return <label key={item.id} className={itemDiff?'custom-access-field':undefined} style={!itemDiff?{opacity:.62}:undefined}>{itemDiff&&<span className=\"item-custom-dot\"/>}<input type=\"checkbox\" checked={notificationPanelConfig?.[item.id]===true} onChange={e=>toggleNotificationPanelPermission(item.id,e.target.checked)}/>{item.label}</label>;})}</div>
        <div className=\"notification-prefs-grid\" style={{marginTop:18}}>
          <div><h3>Eventos que geram notificação</h3><div className=\"checks one-col compact-checks-v3\">{events.map(ev=>{const itemDiff=(roleDefault.notificationPrefs||[]).includes(ev)!==(f.notificationPrefs||[]).includes(ev);return <label key={ev} className={itemDiff?'custom-access-field':undefined} style={!itemDiff?{opacity:.62}:undefined}>{itemDiff&&<span className=\"item-custom-dot\"/>}<input type=\"checkbox\" checked={(f.notificationPrefs||[]).includes(ev)} onChange={e=>toggleEvent(ev,e.target.checked)}/>{ev}</label>;})}</div></div>
          <div><h3>Status que geram notificação</h3><div className=\"checks one-col status-notify-list compact-checks-v3\">{statuses.map(st=>{const itemDiff=(roleDefault.notificationStatusPrefs?.[st.id]??true)!==(f.notificationStatusPrefs?.[st.id]??true);return <label key={st.id} className={itemDiff?'custom-access-field':undefined} style={!itemDiff?{opacity:.62}:undefined}>{itemDiff&&<span className=\"item-custom-dot\"/>}<input type=\"checkbox\" checked={f.notificationStatusPrefs?.[st.id]??true} onChange={e=>set('notificationStatusPrefs',{...(f.notificationStatusPrefs||{}),[st.id]:e.target.checked})}/><span className=\"status-dot\" style={{background:st.color}}></span>{st.name}</label>;})}</div></div>
        </div>
      </div>
    </div>;"""
new="""    if(panel.id==='notifications') return <div>
      <div style={notificationInheritance!=='custom'?{pointerEvents:'none'}:undefined}>
        <h3 style={{display:'flex',alignItems:'center',gap:7}}>{notificationsDiff&&<span className=\"item-custom-dot\"/>}<span style={{opacity:notificationsDiff?1:.62}}>Painel e ações</span></h3>
        <div className=\"checks one-col compact-checks-v3\">{NOTIFICATION_PANEL_PERMISSION_ITEMS.map(item=>{const def=(roleDefault.notificationPanel||builtInNotificationPanelPermissionsForRole(f.role))?.[item.id];const itemDiff=notificationPanelConfig?.[item.id]!==def;return <label key={item.id} className={itemDiff?'custom-access-field':undefined} style={!itemDiff?{opacity:.62}:undefined}>{itemDiff&&<span className=\"item-custom-dot\"/>}<input type=\"checkbox\" checked={notificationPanelConfig?.[item.id]===true} onChange={e=>toggleNotificationPanelPermission(item.id,e.target.checked)}/>{item.label}</label>;})}</div>
      </div>
    </div>;"""
rep(old,new,'painel de notificações individual')

anchor="""      {f.role!=='admin'&&<AccessConfigCard title=\"Tipos de tarefas disponíveis\" open={openSection==='rule:types'} onToggleOpen={()=>toggleSection('rule:types')} accent customized={typesDiff}>
        <div style={typeInheritance!=='custom'?{pointerEvents:'none'}:undefined}>
          <TaskTypeVisibilityChecks selected={typeInheritance==='custom'?(f.visibleTypes||[]):(roleDefault.visibleTypes||TASK_TYPES)} onToggle={toggleType} defaultSelected={roleDefault.visibleTypes||TASK_TYPES}/>
        </div>
      </AccessConfigCard>}

"""
insert=anchor+"""      <AccessConfigCard title=\"Notificações e alertas\" open={openSection==='rule:notifications'} onToggleOpen={()=>toggleSection('rule:notifications')} accent customized={notificationsDiff}>
        <div style={notificationInheritance!=='custom'?{pointerEvents:'none'}:undefined}>
          <div className=\"notification-prefs-grid\">
            <div><h3>Eventos que geram notificação</h3><div className=\"checks one-col compact-checks-v3\">{events.map(ev=>{const itemDiff=(roleDefault.notificationPrefs||[]).includes(ev)!==(f.notificationPrefs||[]).includes(ev);return <label key={ev} className={itemDiff?'custom-access-field':undefined} style={!itemDiff?{opacity:.62}:undefined}>{itemDiff&&<span className=\"item-custom-dot\"/>}<input type=\"checkbox\" checked={(f.notificationPrefs||[]).includes(ev)} onChange={e=>toggleEvent(ev,e.target.checked)}/>{ev}</label>;})}</div></div>
            <div><h3>Status que geram notificação</h3><div className=\"checks one-col status-notify-list compact-checks-v3\">{statuses.map(st=>{const itemDiff=(roleDefault.notificationStatusPrefs?.[st.id]??true)!==(f.notificationStatusPrefs?.[st.id]??true);return <label key={st.id} className={itemDiff?'custom-access-field':undefined} style={!itemDiff?{opacity:.62}:undefined}>{itemDiff&&<span className=\"item-custom-dot\"/>}<input type=\"checkbox\" checked={f.notificationStatusPrefs?.[st.id]??true} onChange={e=>set('notificationStatusPrefs',{...(f.notificationStatusPrefs||{}),[st.id]:e.target.checked})}/><span className=\"status-dot\" style={{background:st.color}}></span>{st.name}</label>;})}</div></div>
          </div>
        </div>
      </AccessConfigCard>

"""
rep(anchor,insert,'seção Notificações e alertas individual')

# Padrão da função: mesma mudança, somente posição na interface.
old="""    if(panel.id==='notifications') return <div>
      <h4>Painel e ações</h4><div className=\"checks one-col compact-checks-v3\">{NOTIFICATION_PANEL_PERMISSION_ITEMS.map(item=><label key={item.id}><input type=\"checkbox\" checked={draft.notificationPanel?.[item.id]===true} onChange={e=>toggleNotificationPanelPermission(item.id,e.target.checked)}/>{item.label}</label>)}</div>
      <div className=\"notification-prefs-grid\" style={{marginTop:18}}><div><h4>Eventos</h4><div className=\"checks one-col compact-checks-v3\">{NOTIFICATION_VISIBLE_EVENTS.map(ev=><label key={ev}><input type=\"checkbox\" checked={(draft.notificationPrefs||[]).includes(ev)} onChange={e=>toggleEvent(ev,e.target.checked)}/>{ev}</label>)}</div></div><div><h4>Status que geram notificação</h4><div className=\"checks one-col status-notify-list compact-checks-v3\">{statuses.map(st=><label key={st.id}><input type=\"checkbox\" checked={(draft.notificationStatusPrefs?.[st.id]??true)} onChange={e=>setDraftValue('notificationStatusPrefs',{...(draft.notificationStatusPrefs||{}),[st.id]:e.target.checked})}/><span className=\"status-dot\" style={{background:st.color}}></span>{st.name}</label>)}</div></div></div>
    </div>;"""
new="""    if(panel.id==='notifications') return <div>
      <h4>Painel e ações</h4><div className=\"checks one-col compact-checks-v3\">{NOTIFICATION_PANEL_PERMISSION_ITEMS.map(item=><label key={item.id}><input type=\"checkbox\" checked={draft.notificationPanel?.[item.id]===true} onChange={e=>toggleNotificationPanelPermission(item.id,e.target.checked)}/>{item.label}</label>)}</div>
    </div>;"""
rep(old,new,'painel de notificações padrão')

anchor="""        {role!=='admin'&&<AccessConfigCard title=\"Tipos de tarefas disponíveis\" open={openSection==='rule:types'} onToggleOpen={()=>toggleSection('rule:types')} accent>
          <TaskTypeVisibilityChecks selected={draft.visibleTypes||TASK_TYPES} onToggle={toggleType}/>
        </AccessConfigCard>}

"""
insert=anchor+"""        <AccessConfigCard title=\"Notificações e alertas\" open={openSection==='rule:notifications'} onToggleOpen={()=>toggleSection('rule:notifications')} accent>
          <div className=\"notification-prefs-grid\"><div><h4>Eventos</h4><div className=\"checks one-col compact-checks-v3\">{NOTIFICATION_VISIBLE_EVENTS.map(ev=><label key={ev}><input type=\"checkbox\" checked={(draft.notificationPrefs||[]).includes(ev)} onChange={e=>toggleEvent(ev,e.target.checked)}/>{ev}</label>)}</div></div><div><h4>Status que geram notificação</h4><div className=\"checks one-col status-notify-list compact-checks-v3\">{statuses.map(st=><label key={st.id}><input type=\"checkbox\" checked={(draft.notificationStatusPrefs?.[st.id]??true)} onChange={e=>setDraftValue('notificationStatusPrefs',{...(draft.notificationStatusPrefs||{}),[st.id]:e.target.checked})}/><span className=\"status-dot\" style={{background:st.color}}></span>{st.name}</label>)}</div></div></div>
        </AccessConfigCard>

"""
rep(anchor,insert,'seção Notificações e alertas padrão')

p.write_text(s,encoding='utf-8')
print('Etapa 2 aplicada em main.jsx')
