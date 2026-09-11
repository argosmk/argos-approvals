from pathlib import Path

path = Path('src/services/panelAccess.js')
text = path.read_text(encoding='utf-8')
old = """export const NOTIFICATION_PANEL_PERMISSION_ITEMS = Object.freeze([\n  Object.freeze({id:'showTabs',label:'Pendentes e concluídas'}),\n  Object.freeze({id:'canEnableAlerts',label:'Ativar som e notificações'}),\n  Object.freeze({id:'canOpenTasks',label:'Abrir tarefas'}),\n  Object.freeze({id:'canComplete',label:'Concluir notificações'}),\n  Object.freeze({id:'canCompleteAll',label:'Concluir todas as pendentes'}),\n  Object.freeze({id:'canDeleteCompleted',label:'Limpar notificações concluídas'}),\n  Object.freeze({id:'showDateTime',label:'Data e hora'}),\n  Object.freeze({id:'showCompany',label:'Empresa'}),\n  Object.freeze({id:'showResponsible',label:'Responsável'}),\n  Object.freeze({id:'showPostDate',label:'Data do post'}),\n  Object.freeze({id:'showDeadline',label:'Prazo'}),\n  Object.freeze({id:'showStatus',label:'Status'}),\n]);"""
new = """export const NOTIFICATION_PANEL_PERMISSION_ITEMS = Object.freeze([\n  Object.freeze({id:'showTabs',label:'Pendentes e concluídas'}),\n  Object.freeze({id:'canComplete',label:'Concluir notificações'}),\n  Object.freeze({id:'canCompleteAll',label:'Concluir todas as pendentes'}),\n  Object.freeze({id:'canDeleteCompleted',label:'Limpar notificações concluídas'}),\n]);"""
if text.count(old) != 1:
    raise SystemExit(f'Bloco esperado encontrado {text.count(old)} vezes; abortando sem alterar.')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('Step 1 aplicado: painel de notificações mostra apenas permissões próprias do painel.')
