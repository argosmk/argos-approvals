from pathlib import Path

path = Path('src/main.jsx')
text = path.read_text(encoding='utf-8')
old = '<span>hora(s) em <b>{status?.name||rule.statusKey}</b></span>'
new = '<span>hora(s) em <b style={{color:status?.color||undefined}}>{status?.name||rule.statusKey}</b></span>'
count = text.count(old)
if count != 1:
    raise SystemExit(f'Esperava 1 ocorrência do status de lembrete, achei {count}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
