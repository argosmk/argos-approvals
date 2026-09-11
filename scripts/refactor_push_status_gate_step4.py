from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'Bloco não encontrado: {label}')
    return text.replace(old, new, 1)

path = Path('supabase/functions/process-notification-push-queue/index.ts')
text = path.read_text(encoding='utf-8')

text = replace_once(
    text,
    '.select("id,role,active,last_seen_at")',
    '.select("id,role,active,last_seen_at,visible_statuses,notification_prefs")',
    'campos do perfil ativo',
)

anchor = '''async function deliverySettings(organizationId: string) {'''
helpers = '''function profileCanSeeStatus(profile: any, statusId: string | null | undefined) {\n  if (!statusId) return true;\n  if (profile?.role === "admin") return true;\n  const visible = Array.isArray(profile?.visible_statuses) ? profile.visible_statuses : [];\n  return visible.includes(statusId);\n}\n\nfunction statusChangePushEnabled(profile: any) {\n  const statuses = profile?.notification_prefs?.statuses;\n  if (typeof statuses?.__all__ === "boolean") return statuses.__all__;\n  if (statuses && typeof statuses === "object") {\n    const legacy = Object.entries(statuses).filter(([key]) => key !== "__all__");\n    if (legacy.length) return legacy.some(([, value]) => value !== false);\n  }\n  return profile?.role !== "client";\n}\n\nfunction profileAllowsPushEvent(profile: any, event: string | null | undefined) {\n  if (!event) return true;\n  if (event === "Status da tarefa") return statusChangePushEnabled(profile);\n  const events = profile?.notification_prefs?.events;\n  return Array.isArray(events) ? events.includes(event) : true;\n}\n\n'''
text = replace_once(text, anchor, helpers + anchor, 'helpers de elegibilidade de push')

old = '''  return [...ids];\n}\n\nasync function generateReminderQueue()'''
new = '''  if (!ids.size) return [];\n\n  const { data: profiles } = await supabase\n    .from("profiles")\n    .select("id,role,active,visible_statuses")\n    .eq("organization_id", organizationId)\n    .in("id", [...ids]);\n\n  return (profiles ?? [])\n    .filter((profile: any) => profile.active !== false && profileCanSeeStatus(profile, task?.status))\n    .map((profile: any) => String(profile.id));\n}\n\nasync function generateReminderQueue()'''
text = replace_once(text, old, new, 'filtro de destinatários dos lembretes')

old = '''  const settings = await deliverySettings(row.organization_id);\n  if (!settings.enabled) {\n    await markRows(ids, { status: "skipped", skip_reason: "delivery_disabled" });\n    return { sent: 0, skipped: 1 };\n  }\n\n  const lastSeenMs'''
new = '''  const settings = await deliverySettings(row.organization_id);\n  if (!settings.enabled) {\n    await markRows(ids, { status: "skipped", skip_reason: "delivery_disabled" });\n    return { sent: 0, skipped: 1 };\n  }\n\n  if (row.status_id && !profileCanSeeStatus(profile, row.status_id)) {\n    await markRows(ids, { status: "skipped", skip_reason: "status_not_visible" });\n    return { sent: 0, skipped: 1 };\n  }\n\n  if (row.kind !== "reminder" && !profileAllowsPushEvent(profile, row.event)) {\n    await markRows(ids, { status: "skipped", skip_reason: "notification_event_disabled" });\n    return { sent: 0, skipped: 1 };\n  }\n\n  const lastSeenMs'''
text = replace_once(text, old, new, 'trava final do push individual')

old = '''async function processTeamDigest(rows: any[]) {\n  if (!rows.length) return { sent: 0, skipped: 0 };\n  const ids = rows.map((r) => r.id);\n  const row = rows[0];\n  const profile = await activeProfile(row.organization_id, row.profile_id);\n  if (!profile || profile.active === false) {\n    await markRows(ids, { status: "skipped", skip_reason: "inactive_profile" });\n    return { sent: 0, skipped: ids.length };\n  }\n\n  const settings = await deliverySettings(row.organization_id);\n  const lastSeenMs = profile.last_seen_at ? new Date(profile.last_seen_at).getTime() : 0;'''
new = '''async function processTeamDigest(rows: any[]) {\n  if (!rows.length) return { sent: 0, skipped: 0 };\n  const allIds = rows.map((r) => r.id);\n  const firstRow = rows[0];\n  const profile = await activeProfile(firstRow.organization_id, firstRow.profile_id);\n  if (!profile || profile.active === false) {\n    await markRows(allIds, { status: "skipped", skip_reason: "inactive_profile" });\n    return { sent: 0, skipped: allIds.length };\n  }\n\n  const settings = await deliverySettings(firstRow.organization_id);\n  if (!settings.enabled) {\n    await markRows(allIds, { status: "skipped", skip_reason: "delivery_disabled" });\n    return { sent: 0, skipped: allIds.length };\n  }\n\n  const eligibleRows: any[] = [];\n  let filtered = 0;\n  for (const candidate of rows) {\n    if (candidate.status_id && !profileCanSeeStatus(profile, candidate.status_id)) {\n      await markRows([candidate.id], { status: "skipped", skip_reason: "status_not_visible" });\n      filtered++;\n      continue;\n    }\n    if (!profileAllowsPushEvent(profile, candidate.event)) {\n      await markRows([candidate.id], { status: "skipped", skip_reason: "notification_event_disabled" });\n      filtered++;\n      continue;\n    }\n    eligibleRows.push(candidate);\n  }\n\n  if (!eligibleRows.length) return { sent: 0, skipped: filtered };\n\n  const ids = eligibleRows.map((r) => r.id);\n  const row = eligibleRows[0];\n  const lastSeenMs = profile.last_seen_at ? new Date(profile.last_seen_at).getTime() : 0;'''
text = replace_once(text, old, new, 'filtro do digest da equipe')

text = replace_once(
    text,
    '  let title = `${rows.length} novas notificações`;\n  let body = rows.length === 1\n    ? String(row.payload?.text || "Há uma nova atualização no Argos.")\n    : `Você tem ${rows.length} atualizações pendentes no Argos.`;',
    '  let title = `${eligibleRows.length} novas notificações`;\n  let body = eligibleRows.length === 1\n    ? String(row.payload?.text || "Há uma nova atualização no Argos.")\n    : `Você tem ${eligibleRows.length} atualizações pendentes no Argos.`;',
    'contagem do digest filtrado',
)
text = replace_once(
    text,
    '    taskId: rows.length === 1 ? row.task_id : null,\n    url: rows.length === 1 && row.task_id ? `/#/task/${row.task_id}` : "/",',
    '    taskId: eligibleRows.length === 1 ? row.task_id : null,\n    url: eligibleRows.length === 1 && row.task_id ? `/#/task/${row.task_id}` : "/",',
    'link do digest filtrado',
)
text = replace_once(
    text,
    '    return { sent: 0, skipped: ids.length };\n  }\n\n  await markRows(ids, { status: "sent", sent_at: new Date().toISOString(), skip_reason: null });\n  return { sent: 1, skipped: 0 };',
    '    return { sent: 0, skipped: ids.length + filtered };\n  }\n\n  await markRows(ids, { status: "sent", sent_at: new Date().toISOString(), skip_reason: null });\n  return { sent: 1, skipped: filtered };',
    'retorno do digest filtrado',
)

path.write_text(text, encoding='utf-8')
print('Etapa 4 aplicada ao worker de push.')
