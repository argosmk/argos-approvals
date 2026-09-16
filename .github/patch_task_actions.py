from pathlib import Path
p=Path('src/main.jsx')
s=p.read_text(encoding='utf-8')
repls={
'''<button className="status-tinted" style={actionStyle('agendamento')} onClick={()=>{ if(confirm('Avançar esta tarefa para Agendamento mesmo sem todos os votos do comitê?'))''':'''<button className="status-tinted task-flow-action" style={actionStyle('agendamento')} onClick={()=>{ if(confirm('Avançar esta tarefa para Agendamento mesmo sem todos os votos do comitê?'))''',
'''<button className="status-tinted" style={actionStyle('aprovacao')} onClick={()=>{ if(confirm('Avançar a copy desta tarefa mesmo sem todos os votos do comitê?'))''':'''<button className="status-tinted task-flow-action" style={actionStyle(createPostStatusId)} onClick={()=>{ if(confirm('Avançar a copy desta tarefa mesmo sem todos os votos do comitê?'))''',
'''<button className="status-tinted" style={actionStyle('aprovacao')} onClick={retractVote}>Revisar novamente</button>''':'''<button className="status-tinted task-flow-action" style={actionStyle(task.status)} onClick={retractVote}>Revisar novamente</button>''',
'''<button className="status-tinted" style={actionStyle('aprovacao')} onClick={retractCopyVote}>Revisar novamente</button>''':'''<button className="status-tinted task-flow-action" style={actionStyle(task.status)} onClick={retractCopyVote}>Revisar novamente</button>''',
'''<button className="status-tinted" style={actionStyle('aprovacao')} onClick={reviewAgain}>Revisar novamente</button>''':'''<button className="status-tinted task-flow-action" style={actionStyle('aprovacao')} onClick={reviewAgain}>Revisar novamente</button>'''
}
for old,new in repls.items():
    if old not in s: raise SystemExit('Trecho esperado não encontrado: '+old[:80])
    s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')

css=Path('src/style.css')
t=css.read_text(encoding='utf-8')
marker='/* ARGOS_TASK_ACTIONS_GROUPING_20260916 */'
if marker not in t:
    t += '''\n\n/* ARGOS_TASK_ACTIONS_GROUPING_20260916 */
.panel-actions{display:flex;flex-direction:column;align-items:flex-start;gap:10px}
.panel-actions>h2{width:100%;margin-bottom:2px}
.panel-actions>.approval-votes-banner{width:100%;margin:0 0 2px}
.panel-actions>.task-flow-action{margin:0}
.panel-actions>.admin-task-actions-row{margin:2px 0 0;padding-top:10px;border-top:1px solid var(--line);gap:8px!important;width:100%}
.panel-actions>.admin-task-actions-row button{margin:0}
.panel-actions>.admin-task-actions-row .danger{margin-left:4px}
.panel-actions>form,.panel-actions>.client-approval-form,.panel-actions>.copy-approval-form{width:100%}
@media(max-width:760px){.panel-actions{gap:8px}.panel-actions>.admin-task-actions-row{padding-top:8px}.panel-actions>.admin-task-actions-row .danger{margin-left:0}}
'''
    css.write_text(t,encoding='utf-8')
