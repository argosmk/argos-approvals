from pathlib import Path

path = Path('supabase/functions/process-notification-push-queue/index.ts')
text = path.read_text(encoding='utf-8')

old = '''  return (profiles ?? [])
    .filter((profile: any) => profile.active !== false && profileCanSeeStatus(profile, task?.status))
    .map((profile: any) => String(profile.id));
}

async function generateReminderQueue() {'''
new = '''  return (profiles ?? [])
    .filter((profile: any) => profile.active !== false && profileCanSeeStatus(profile, task?.status))
    .map((profile: any) => String(profile.id));
}

async function clientProfileIdsForCompany(organizationId: string, companyId: string | null | undefined) {
  const ids = new Set<string>();
  if (!companyId) return ids;
  const { data: ws } = await supabase
    .from("workspace_state")
    .select("payload")
    .eq("organization_id", organizationId)
    .maybeSingle();
  const users = (ws?.payload?.users ?? []) as Array<{
    id: string;
    role: string;
    active?: boolean;
    companyIds?: string[];
  }>;
  for (const user of users) {
    if (
      user.role === "client" &&
      user.active !== false &&
      Array.isArray(user.companyIds) &&
      user.companyIds.includes(companyId)
    ) {
      ids.add(String(user.id));
    }
  }
  return ids;
}

async function generateReminderQueue() {'''
if text.count(old) != 1:
    raise SystemExit(f'helper anchor: expected 1, found {text.count(old)}')
text = text.replace(old, new, 1)

old = '''    const { data: profiles } = await supabase
      .from("profiles")
      .select("id,role,active,visible_statuses,company_ids,notification_prefs")
      .eq("organization_id", task.organization_id)
      .eq("active", true);

    for (const profile of profiles ?? []) {
      const isRecipient = profile.role === "admin"
        || (profile.role === "team" && String(profile.id) === String(task.responsible_id || ""))
        || (profile.role === "client" && Array.isArray(profile.company_ids) && profile.company_ids.includes(task.company_id));'''
new = '''    const clientProfileIds = await clientProfileIdsForCompany(task.organization_id, task.company_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id,role,active,visible_statuses,notification_prefs")
      .eq("organization_id", task.organization_id)
      .eq("active", true);

    for (const profile of profiles ?? []) {
      const isRecipient = profile.role === "admin"
        || (profile.role === "team" && String(profile.id) === String(task.responsible_id || ""))
        || (profile.role === "client" && clientProfileIds.has(String(profile.id)));'''
if text.count(old) != 1:
    raise SystemExit(f'deadline recipient anchor: expected 1, found {text.count(old)}')
text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
