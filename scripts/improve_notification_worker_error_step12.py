from pathlib import Path
p=Path('supabase/functions/process-notification-push-queue/index.ts')
s=p.read_text(encoding='utf-8')
old='''    const message = err instanceof Error ? err.message : String(err);\n    return json({ ok: false, error: message }, 500);'''
new='''    const message = err instanceof Error\n      ? err.message\n      : (err && typeof err === "object" ? JSON.stringify(err) : String(err));\n    return json({ ok: false, error: message }, 500);'''
if s.count(old)!=1: raise SystemExit(f'expected 1 catch, found {s.count(old)}')
p.write_text(s.replace(old,new,1),encoding='utf-8')
