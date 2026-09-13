from pathlib import Path
p=Path('supabase/functions/process-notification-push-queue/index.ts')
s=p.read_text(encoding='utf-8')
old='''function saoPauloDateKey() {\n  const parts = new Intl.DateTimeFormat("en-US", {\n    timeZone: "America/Sao_Paulo",\n    year: "numeric",\n    month: "2-digit",\n    day: "2-digit",\n  }).formatToParts(new Date());'''
new='''function saoPauloDateKey(date = new Date()) {\n  const parts = new Intl.DateTimeFormat("en-US", {\n    timeZone: "America/Sao_Paulo",\n    year: "numeric",\n    month: "2-digit",\n    day: "2-digit",\n  }).formatToParts(date);'''
if s.count(old)!=1: raise SystemExit(f'date helper expected 1, found {s.count(old)}')
s=s.replace(old,new,1)
old='''async function generateDeadlineNotifications() {\n  const today = saoPauloDateKey();'''
new='''async function generateDeadlineNotifications() {\n  const today = saoPauloDateKey();\n  const yesterday = saoPauloDateKey(new Date(Date.now() - 86400000));'''
if s.count(old)!=1: raise SystemExit(f'deadline start expected 1, found {s.count(old)}')
s=s.replace(old,new,1)
old='''    const deadline = String(task.internal_date || "").slice(0, 10);\n    if (!deadline || deadline > today) continue;'''
new='''    const deadline = String(task.internal_date || "").slice(0, 10);\n    if (!deadline || deadline > today || deadline < yesterday) continue;'''
if s.count(old)!=1: raise SystemExit(f'deadline window expected 1, found {s.count(old)}')
s=s.replace(old,new,1)
old='''    const message = err instanceof Error ? err.message : String(err);\n    return json({ ok: false, error: message }, 500);'''
new='''    const message = err instanceof Error\n      ? err.message\n      : (err && typeof err === "object" ? JSON.stringify(err) : String(err));\n    return json({ ok: false, error: message }, 500);'''
if s.count(old)==1: s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')
