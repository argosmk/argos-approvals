from pathlib import Path
import re

path = Path('src/main.jsx')
text = path.read_text(encoding='utf-8')

text = text.replace(
    "import { loadApprovalReminderSettings, saveApprovalReminderSettings } from './services/approvalReminderSettingsService';",
    "import { loadNotificationDeliverySettings, saveNotificationDeliverySettings } from './services/notificationDeliverySettingsService';"
)

text = text.replace(
    "function AccessDefaultsEditor({system,setSystem,statuses=[]}){",
    "function AccessDefaultsEditor({system,setSystem,statuses=[],currentUser=null}){"
)

text = text.replace(
    "<AccessDefaultsEditor system={system} setSystem={setSystem} statuses={statuses}/>",
    "<AccessDefaultsEditor system={system} setSystem={setSystem} statuses={statuses} currentUser={currentUser}/>"
)

text = text.replace(
    "['portfolioPublic','Portfólio público'],['approvalReminders','Lembretes de aprovação'],['general','Aparência']",
    "['portfolioPublic','Portfólio público'],['general','Aparência']"
)

text = text.replace(
    " {tab==='approvalReminders'&&<ApprovalReminderSettings currentUser={currentUser} statuses={statuses}/>}",
    ""
)

marker = '  return <div className="settings-section">\n    <div className="view-tabs access-role-tabs">'
replacement = '  return <div className="settings-section">\n    <NotificationDeliverySettings currentUser={currentUser} statuses={statuses}/>\n    <div className="view-tabs access-role-tabs">'
if marker not in text:
    raise SystemExit('AccessDefaultsEditor return marker not found')
text = text.replace(marker, replacement, 1)

new_component = r'''function NotificationDeliverySettings({currentUser,statuses}){
  const organizationId=currentUser?.organizationId;
  const empty={enabled:true,teamDigestMinutes:30,clientApprovalDelayMinutes:5,presenceGraceSeconds:120,rules:[]};
  const [form,setForm]=useState(empty);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');

  useEffect(()=>{
    let alive=true;
    if(!organizationId){setLoading(false);setError('Organização não identificada.');return()=>{alive=false};}
    (async()=>{
      try{
        setLoading(true);setError('');
        const data=await loadNotificationDeliverySettings(organizationId);
        if(alive)setForm({...empty,...data,rules:Array.isArray(data?.rules)?data.rules:[]});
      }catch(err){if(alive)setError(err.message||'Não foi possível carregar as configurações de entrega.');}
      finally{if(alive)setLoading(false);}
    })();
    return()=>{alive=false};
  },[organizationId]);

  function ruleFor(statusKey){
    return (form.rules||[]).find(rule=>rule.statusKey===statusKey)||{
      statusKey,enabled:false,targets:['client_approvers'],firstAfterMinutes:1440,intervalMinutes:2880
    };
  }
  function updateRule(statusKey,patch){
    setForm(prev=>{
      const rules=[...(prev.rules||[])];
      const index=rules.findIndex(rule=>rule.statusKey===statusKey);
      const base=index>=0?rules[index]:ruleFor(statusKey);
      const next={...base,...patch,statusKey};
      if(index>=0)rules[index]=next;else rules.push(next);
      return {...prev,rules};
    });
  }
  function toggleTarget(statusKey,target,checked){
    const rule=ruleFor(statusKey);
    const current=Array.isArray(rule.targets)?rule.targets:[];
    const targets=checked?[...new Set([...current,target])]:current.filter(item=>item!==target);
    updateRule(statusKey,{targets:targets.length?targets:['client_approvers']});
  }
  async function saveDelivery(){
    try{
      setSaving(true);setError('');setMessage('');
      const saved=await saveNotificationDeliverySettings(organizationId,form);
      setForm({...empty,...saved,rules:Array.isArray(saved?.rules)?saved.rules:[]});
      setMessage('Configurações de entrega salvas.');
      notifySettingsSaved('Notificações e lembretes salvos');
    }catch(err){setError(err.message||'Não foi possível salvar as configurações de entrega.');}
    finally{setSaving(false);}
  }

  return <div className="panel" style={{marginBottom:18}}>
    <div className="public-portfolio-settings-head">
      <div><h2 style={{marginBottom:6}}>Entrega de push e lembretes</h2><p className="muted" style={{margin:0}}>Configuração única para agrupamento da equipe, aviso de aprovação, presença e lembretes por status.</p></div>
      <label className="public-portfolio-active"><input type="checkbox" checked={form.enabled!==false} onChange={e=>setForm(prev=>({...prev,enabled:e.target.checked}))}/><span>Push ativo</span></label>
    </div>
    {loading?<p>Carregando configurações...</p>:<>
      {error&&<div className="cloud-error">{error}</div>}
      {message&&<div className="public-portfolio-success">{message}</div>}
      <div className="form-three" style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:12,marginTop:14}}>
        <label>Agrupar push da equipe por (min)<input type="number" min="1" max="1440" value={form.teamDigestMinutes} onChange={e=>setForm(prev=>({...prev,teamDigestMinutes:e.target.value}))}/></label>
        <label>Aguardar antes de avisar cliente (min)<input type="number" min="0" max="1440" value={form.clientApprovalDelayMinutes} onChange={e=>setForm(prev=>({...prev,clientApprovalDelayMinutes:e.target.value}))}/></label>
        <label>Ignorar push se ativo nos últimos (seg)<input type="number" min="0" max="3600" value={form.presenceGraceSeconds} onChange={e=>setForm(prev=>({...prev,presenceGraceSeconds:e.target.value}))}/></label>
      </div>
      <h3 style={{marginTop:22}}>Lembretes por status</h3>
      <p className="muted">Ative só os status que precisam cobrar alguém quando a tarefa ficar parada.</p>
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {(statuses||[]).map(status=>{const rule=ruleFor(status.id);return <div className="panel" key={status.id} style={{padding:12,borderLeft:`3px solid ${status.color}`}}>
          <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
            <label style={{margin:0,display:'flex',alignItems:'center',gap:7}}><input type="checkbox" checked={rule.enabled===true} onChange={e=>updateRule(status.id,{enabled:e.target.checked})}/><b>{status.name}</b></label>
            {rule.enabled===true&&<>
              <label style={{margin:0}}><input type="checkbox" checked={(rule.targets||[]).includes('client_approvers')} onChange={e=>toggleTarget(status.id,'client_approvers',e.target.checked)}/> Clientes aprovadores</label>
              <label style={{margin:0}}><input type="checkbox" checked={(rule.targets||[]).includes('task_responsible')} onChange={e=>toggleTarget(status.id,'task_responsible',e.target.checked)}/> Responsável da tarefa</label>
              <label style={{margin:0}}><input type="checkbox" checked={(rule.targets||[]).includes('admins')} onChange={e=>toggleTarget(status.id,'admins',e.target.checked)}/> Admins</label>
            </>}
          </div>
          {rule.enabled===true&&<div className="form-two" style={{marginTop:10}}>
            <label>Primeiro lembrete após (min)<input type="number" min="0" value={rule.firstAfterMinutes} onChange={e=>updateRule(status.id,{firstAfterMinutes:e.target.value})}/></label>
            <label>Repetir a cada (min)<input type="number" min="1" value={rule.intervalMinutes} onChange={e=>updateRule(status.id,{intervalMinutes:e.target.value})}/></label>
          </div>}
        </div>})}
      </div>
      <small className="muted">No Beta você pode usar 1–2 minutos para testar. Depois ajustamos os tempos finais antes do Alfa.</small>
      <div className="row-actions" style={{marginTop:14}}><button className="primary" onClick={saveDelivery} disabled={saving||!organizationId}>{saving?'Salvando...':'Salvar entrega e lembretes'}</button></div>
    </>}
  </div>;
}'''

pattern = re.compile(r"function ApprovalReminderSettings\(\{currentUser,statuses\}\)\{.*?\n\}\n\nconst DEFAULT_DOCUMENT_FOLDERS", re.S)
if not pattern.search(text):
    raise SystemExit('ApprovalReminderSettings block not found')
text = pattern.sub(new_component + "\n\nconst DEFAULT_DOCUMENT_FOLDERS", text, count=1)

required = [
    'loadNotificationDeliverySettings',
    'NotificationDeliverySettings currentUser={currentUser}',
    'Agrupar push da equipe por (min)',
    'Clientes aprovadores',
    'Responsável da tarefa',
]
for token in required:
    if token not in text:
        raise SystemExit(f'missing expected token: {token}')
if 'approvalReminders' in text:
    raise SystemExit('old approvalReminders tab still present')

path.write_text(text, encoding='utf-8')
print('main.jsx patched successfully')
