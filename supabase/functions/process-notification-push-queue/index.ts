import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:contato@argosmk.com";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function minutesBetween(a: string | null | undefined, b: number) {
  if (!a) return Number.POSITIVE_INFINITY;
  return Math.max(0, (b - new Date(a).getTime()) / 60000);
}

async function companyNameForTask(organizationId: string, companyId: string | null | undefined) {
  if (!companyId) return null;
  const { data: ws } = await supabase
    .from("workspace_state")
    .select("payload")
    .eq("organization_id", organizationId)
    .maybeSingle();
  const companies = (ws?.payload?.companies ?? []) as Array<{ id: string; name?: string }>;
  return companies.find((c) => c.id === companyId)?.name || null;
}

async function taskMeta(organizationId: string, taskId: string | null | undefined) {
  if (!taskId) return null;
  const { data } = await supabase
    .from("app_tasks")
    .select("id,title,company_id,responsible_id,status,created_at")
    .eq("organization_id", organizationId)
    .eq("id", taskId)
    .is("deleted_at", null)
    .maybeSingle();
  return data || null;
}

async function activeProfile(organizationId: string, profileId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("id,role,active,last_seen_at")
    .eq("organization_id", organizationId)
    .eq("id", profileId)
    .maybeSingle();
  return data || null;
}

async function deliverySettings(organizationId: string) {
  const { data } = await supabase
    .from("notification_delivery_settings")
    .select("enabled,team_digest_minutes,client_approval_delay_minutes,presence_grace_seconds")
    .eq("organization_id", organizationId)
    .maybeSingle();
  return {
    enabled: data?.enabled !== false,
    teamDigestMinutes: Number(data?.team_digest_minutes ?? 30),
    clientApprovalDelayMinutes: Number(data?.client_approval_delay_minutes ?? 5),
    presenceGraceSeconds: Number(data?.presence_grace_seconds ?? 120),
  };
}

async function markRows(ids: string[], patch: Record<string, unknown>) {
  if (!ids.length) return;
  await supabase
    .from("notification_push_queue")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .in("id", ids);
}

async function sendPayload(organizationId: string, profileId: string, payload: string) {
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id,endpoint,p256dh,auth_key")
    .eq("organization_id", organizationId)
    .eq("profile_id", profileId);

  if (!subs?.length) return { sent: 0, devices: 0 };

  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
        payload,
      );
      sent++;
    } catch (err: any) {
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
      } else {
        console.error("push send failed", err);
      }
    }
  }

  return { sent, devices: subs.length };
}

async function reminderTargets(
  organizationId: string,
  task: any,
  targets: string[],
) {
  const ids = new Set<string>();

  if (targets.includes("task_responsible") && task?.responsible_id) {
    ids.add(String(task.responsible_id));
  }

  if (targets.includes("admins")) {
    const { data: admins } = await supabase
      .from("profiles")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("role", "admin")
      .eq("active", true);
    for (const admin of admins ?? []) ids.add(String(admin.id));
  }

  if (targets.includes("client_approvers")) {
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
        user.companyIds.includes(task.company_id)
      ) {
        ids.add(String(user.id));
      }
    }
  }

  return [...ids];
}

async function generateReminderQueue() {
  const { data: rules, error } = await supabase
    .from("notification_reminder_rules")
    .select("id,organization_id,status_key,enabled,targets,first_after_minutes,interval_minutes")
    .eq("enabled", true);
  if (error) throw error;

  let queued = 0;
  const nowMs = Date.now();

  for (const rule of rules ?? []) {
    const settings = await deliverySettings(rule.organization_id);
    if (!settings.enabled) continue;

    const { data: statusRow } = await supabase
      .from("task_statuses")
      .select("name")
      .eq("organization_id", rule.organization_id)
      .eq("key", rule.status_key)
      .maybeSingle();
    const statusName = statusRow?.name || rule.status_key;

    const { data: tasks } = await supabase
      .from("app_tasks")
      .select("id,title,company_id,responsible_id,status,created_at")
      .eq("organization_id", rule.organization_id)
      .eq("status", rule.status_key)
      .eq("archived", false)
      .is("deleted_at", null);

    for (const task of tasks ?? []) {
      const { data: logs } = await supabase
        .from("app_task_logs")
        .select("at")
        .eq("organization_id", rule.organization_id)
        .eq("task_id", task.id)
        .eq("type", "status")
        .ilike("text", `%para ${statusName}`)
        .order("at", { ascending: false })
        .limit(1);

      const enteredAt = logs?.[0]?.at || task.created_at;
      const elapsedMinutes = Math.floor(minutesBetween(enteredAt, nowMs));
      const first = Math.max(0, Number(rule.first_after_minutes ?? 1440));
      const interval = Math.max(1, Number(rule.interval_minutes ?? 2880));
      if (elapsedMinutes < first) continue;

      const occurrence = Math.floor((elapsedMinutes - first) / interval) + 1;
      const profileIds = await reminderTargets(
        rule.organization_id,
        task,
        Array.isArray(rule.targets) ? rule.targets : ["client_approvers"],
      );

      for (const profileId of profileIds) {
        const sourceKey = `reminder:${rule.id}:${task.id}:${profileId}:${occurrence}`;
        const { error: insertError } = await supabase
          .from("notification_push_queue")
          .insert({
            organization_id: rule.organization_id,
            profile_id: profileId,
            task_id: task.id,
            kind: "reminder",
            status_id: rule.status_key,
            source_key: sourceKey,
            deliver_after: new Date().toISOString(),
            payload: {
              rule_id: rule.id,
              occurrence_number: occurrence,
              status_name: statusName,
              elapsed_minutes: elapsedMinutes,
            },
          });
        if (!insertError) queued++;
        else if (!String(insertError.message || "").toLowerCase().includes("duplicate")) {
          console.error("reminder queue insert failed", insertError);
        }
      }
    }
  }

  return queued;
}

async function processSingle(row: any) {
  const ids = [row.id];
  const profile = await activeProfile(row.organization_id, row.profile_id);
  if (!profile || profile.active === false) {
    await markRows(ids, { status: "skipped", skip_reason: "inactive_profile" });
    return { sent: 0, skipped: 1 };
  }

  const settings = await deliverySettings(row.organization_id);
  if (!settings.enabled) {
    await markRows(ids, { status: "skipped", skip_reason: "delivery_disabled" });
    return { sent: 0, skipped: 1 };
  }

  const lastSeenMs = profile.last_seen_at ? new Date(profile.last_seen_at).getTime() : 0;
  if (lastSeenMs && Date.now() - lastSeenMs <= settings.presenceGraceSeconds * 1000) {
    await markRows(ids, { status: "skipped", skip_reason: "user_active" });
    return { sent: 0, skipped: 1 };
  }

  const task = await taskMeta(row.organization_id, row.task_id);
  if (row.kind === "client_approval") {
    if (!task || task.status !== row.status_id) {
      await markRows(ids, { status: "cancelled", skip_reason: "task_left_status" });
      return { sent: 0, skipped: 1 };
    }
  }

  if (row.kind === "reminder") {
    const ruleId = row.payload?.rule_id;
    const { data: rule } = await supabase
      .from("notification_reminder_rules")
      .select("enabled,status_key")
      .eq("id", ruleId)
      .maybeSingle();
    if (!rule?.enabled || !task || task.status !== rule.status_key) {
      await markRows(ids, { status: "cancelled", skip_reason: "reminder_no_longer_valid" });
      return { sent: 0, skipped: 1 };
    }
  }

  if (!task) {
    await markRows(ids, { status: "cancelled", skip_reason: "task_missing" });
    return { sent: 0, skipped: 1 };
  }

  const companyName = await companyNameForTask(row.organization_id, task.company_id);
  const title = companyName ? `${companyName} • ${task.title}` : task.title;
  const body = row.kind === "reminder"
    ? `Ainda em ${row.payload?.status_name || row.status_id}.`
    : String(row.payload?.text || "Há uma atualização aguardando você.");

  const payload = JSON.stringify({
    title,
    body,
    taskId: task.id,
    url: `/#/task/${task.id}`,
  });

  const result = await sendPayload(row.organization_id, row.profile_id, payload);
  if (result.sent <= 0) {
    await markRows(ids, { status: "skipped", skip_reason: "no_subscription" });
    return { sent: 0, skipped: 1 };
  }

  await markRows(ids, { status: "sent", sent_at: new Date().toISOString(), skip_reason: null });

  if (row.kind === "reminder" && row.payload?.rule_id) {
    await supabase.from("notification_reminders_log").upsert({
      organization_id: row.organization_id,
      rule_id: row.payload.rule_id,
      task_id: row.task_id,
      profile_id: row.profile_id,
      occurrence_number: Number(row.payload?.occurrence_number || 1),
      channel: "push",
      sent_at: new Date().toISOString(),
    }, { onConflict: "rule_id,task_id,profile_id,occurrence_number,channel" });
  }

  return { sent: 1, skipped: 0 };
}

async function processTeamDigest(rows: any[]) {
  if (!rows.length) return { sent: 0, skipped: 0 };
  const ids = rows.map((r) => r.id);
  const row = rows[0];
  const profile = await activeProfile(row.organization_id, row.profile_id);
  if (!profile || profile.active === false) {
    await markRows(ids, { status: "skipped", skip_reason: "inactive_profile" });
    return { sent: 0, skipped: ids.length };
  }

  const settings = await deliverySettings(row.organization_id);
  const lastSeenMs = profile.last_seen_at ? new Date(profile.last_seen_at).getTime() : 0;
  if (lastSeenMs && Date.now() - lastSeenMs <= settings.presenceGraceSeconds * 1000) {
    await markRows(ids, { status: "skipped", skip_reason: "user_active" });
    return { sent: 0, skipped: ids.length };
  }

  const firstTask = await taskMeta(row.organization_id, row.task_id);
  let title = `${rows.length} novas notificações`;
  let body = rows.length === 1
    ? String(row.payload?.text || "Há uma nova atualização no Argos.")
    : `Você tem ${rows.length} atualizações pendentes no Argos.`;

  if (rows.length === 1 && firstTask) {
    const companyName = await companyNameForTask(row.organization_id, firstTask.company_id);
    title = companyName ? `${companyName} • ${firstTask.title}` : firstTask.title;
  }

  const payload = JSON.stringify({
    title,
    body,
    taskId: rows.length === 1 ? row.task_id : null,
    url: rows.length === 1 && row.task_id ? `/#/task/${row.task_id}` : "/",
  });

  const result = await sendPayload(row.organization_id, row.profile_id, payload);
  if (result.sent <= 0) {
    await markRows(ids, { status: "skipped", skip_reason: "no_subscription" });
    return { sent: 0, skipped: ids.length };
  }

  await markRows(ids, { status: "sent", sent_at: new Date().toISOString(), skip_reason: null });
  return { sent: 1, skipped: 0 };
}

Deno.serve(async () => {
  try {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return json({ ok: false, error: "missing_vapid_config" }, 503);
    }

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const queuedReminders = await generateReminderQueue();
    const nowIso = new Date().toISOString();
    const { data: dueRows, error } = await supabase
      .from("notification_push_queue")
      .select("*")
      .eq("status", "pending")
      .lte("deliver_after", nowIso)
      .order("deliver_after", { ascending: true })
      .limit(250);
    if (error) throw error;

    const rows = dueRows ?? [];
    const digestGroups = new Map<string, any[]>();
    const singles: any[] = [];

    for (const row of rows) {
      if (row.kind === "team_digest") {
        const key = `${row.organization_id}:${row.profile_id}`;
        if (!digestGroups.has(key)) digestGroups.set(key, []);
        digestGroups.get(key)!.push(row);
      } else {
        singles.push(row);
      }
    }

    let sent = 0;
    let skipped = 0;

    for (const group of digestGroups.values()) {
      const result = await processTeamDigest(group);
      sent += result.sent;
      skipped += result.skipped;
    }

    for (const row of singles) {
      const result = await processSingle(row);
      sent += result.sent;
      skipped += result.skipped;
    }

    return json({ ok: true, queuedReminders, due: rows.length, sent, skipped });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : String(err);
    return json({ ok: false, error: message }, 500);
  }
});
