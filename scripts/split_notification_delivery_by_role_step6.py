from pathlib import Path

path = Path('src/main.jsx')
text = path.read_text(encoding='utf-8')

repls = [
    (
        '<NotificationDeliverySettings currentUser={currentUser} statuses={statuses}/>',
        '<NotificationDeliverySettings currentUser={currentUser} statuses={statuses} role={role}/>'
    ),
    (
        'function NotificationDeliverySettings({currentUser,statuses}){',
        'function NotificationDeliverySettings({currentUser,statuses,role=\'team\'}){'
    ),
]
for old,new in repls:
    if text.count(old) != 1:
        raise SystemExit(f'Esperava 1 ocorrência de {old!r}, achei {text.count(old)}')
    text = text.replace(old,new,1)

old_intro = '''      <div className="form-three" style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:12,marginTop:14}}>
        <label>Agrupar push da equipe por (min)<input type="number" min="1" max="1440" value={form.teamDigestMinutes} onChange={e=>setForm(prev=>({...prev,teamDigestMinutes:e.target.value}))}/></label>
        <label>Aguardar antes de avisar cliente (min)<input type="number" min="0" max="1440" value={form.clientApprovalDelayMinutes} onChange={e=>setForm(prev=>({...prev,clientApprovalDelayMinutes:e.target.value}))}/></label>
        <label>Ignorar push se ativo nos últimos (seg)<input type="number" min="0" max="3600" value={form.presenceGraceSeconds} onChange={e=>setForm(prev=>({...prev,presenceGraceSeconds:e.target.value}))}/></label>
      </div>'''
new_intro = '''      <div className="form-two" style={{marginTop:14}}>
        {role==='team'&&<label>Agrupar push da equipe por (min)<input type="number" min="1" max="1440" value={form.teamDigestMinutes} onChange={e=>setForm(prev=>({...prev,teamDigestMinutes:e.target.value}))}/></label>}
        {role==='client'&&<label>Aguardar antes de avisar cliente (min)<input type="number" min="0" max="1440" value={form.clientApprovalDelayMinutes} onChange={e=>setForm(prev=>({...prev,clientApprovalDelayMinutes:e.target.value}))}/></label>}
        <label>Ignorar push se ativo nos últimos (seg)<input type="number" min="0" max="3600" value={form.presenceGraceSeconds} onChange={e=>setForm(prev=>({...prev,presenceGraceSeconds:e.target.value}))}/></label>
      </div>'''
if text.count(old_intro) != 1:
    raise SystemExit(f'Esperava 1 bloco de tempos, achei {text.count(old_intro)}')
text = text.replace(old_intro,new_intro,1)

old_targets = '''            <div className="checks one-col compact-checks-v3" style={{gap:4,marginBottom:10}}>
              <label style={{margin:0}}><input type="checkbox" checked={(rule.targets||[]).includes('client_approvers')} onChange={e=>toggleTarget(status.id,'client_approvers',e.target.checked)}/> Clientes aprovadores</label>
              <label style={{margin:0}}><input type="checkbox" checked={(rule.targets||[]).includes('task_responsible')} onChange={e=>toggleTarget(status.id,'task_responsible',e.target.checked)}/> Responsável da tarefa</label>
              <label style={{margin:0}}><input type="checkbox" checked={(rule.targets||[]).includes('admins')} onChange={e=>toggleTarget(status.id,'admins',e.target.checked)}/> Admins</label>
            </div>'''
new_targets = '''            <div className="checks one-col compact-checks-v3" style={{gap:4,marginBottom:10}}>
              {role==='client'&&<label style={{margin:0}}><input type="checkbox" checked={(rule.targets||[]).includes('client_approvers')} onChange={e=>toggleTarget(status.id,'client_approvers',e.target.checked)}/> Clientes aprovadores</label>}
              {role==='team'&&<><label style={{margin:0}}><input type="checkbox" checked={(rule.targets||[]).includes('task_responsible')} onChange={e=>toggleTarget(status.id,'task_responsible',e.target.checked)}/> Responsável da tarefa</label><label style={{margin:0}}><input type="checkbox" checked={(rule.targets||[]).includes('admins')} onChange={e=>toggleTarget(status.id,'admins',e.target.checked)}/> Admins</label></>}
            </div>'''
if text.count(old_targets) != 1:
    raise SystemExit(f'Esperava 1 bloco de destinatários, achei {text.count(old_targets)}')
text = text.replace(old_targets,new_targets,1)

old_desc = 'Configuração única para agrupamento da equipe, aviso de aprovação, presença e lembretes por status.'
new_desc = "Configurações de entrega para ${role==='client'?'responsáveis/clientes':'equipe'}, mantendo os mesmos limites de acesso por status."
# JSX needs expression, not template text literal
jsx_desc = '''{role==='client'?'Configurações de entrega para responsáveis/clientes, mantendo os mesmos limites de acesso por status.':'Configurações de entrega para equipe, mantendo os mesmos limites de acesso por status.'}'''
needle = f'<div><h2 style={{{{marginBottom:6}}}}>Entrega de push e lembretes</h2><p className="muted" style={{{{margin:0}}}}>{old_desc}</p></div>'
replacement = f'<div><h2 style={{{{marginBottom:6}}}}>Entrega de push e lembretes</h2><p className="muted" style={{{{margin:0}}}}>{jsx_desc}</p></div>'
if text.count(needle) != 1:
    raise SystemExit(f'Esperava 1 descrição do bloco, achei {text.count(needle)}')
text = text.replace(needle,replacement,1)

path.write_text(text, encoding='utf-8')
print('Etapa 6 aplicada: entrega dividida por função.')
