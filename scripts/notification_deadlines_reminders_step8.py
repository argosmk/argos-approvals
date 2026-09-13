from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: esperava 1 ocorrência, achei {count}')
    return text.replace(old, new, 1)

# 1) Catálogo: restaura prazo hoje/vencido como eventos reais.
path = Path('src/services/panelAccess.js')
text = path.read_text(encoding='utf-8')
old = """export const CLIENT_REQUEST_NOTIFICATION_EVENT = 'Solicitações de clientes';
export const BASE_NOTIFICATION_VISIBLE_EVENTS = ['Comentário na tarefa'];
export const NOTIFICATION_VISIBLE_EVENTS = [...BASE_NOTIFICATION_VISIBLE_EVENTS,CLIENT_REQUEST_NOTIFICATION_EVENT];
export const NOTIFICATION_EVENT_ROWS = Object.freeze([
  Object.freeze({id:'status',event:'Status da tarefa',label:'Mudança de status'}),
  Object.freeze({id:'comment',event:'Comentário na tarefa',label:'Comentário'}),
  Object.freeze({id:'request',event:CLIENT_REQUEST_NOTIFICATION_EVENT,label:'Solicitação'}),
]);
"""
new = """export const CLIENT_REQUEST_NOTIFICATION_EVENT = 'Solicitações de clientes';
export const BASE_NOTIFICATION_VISIBLE_EVENTS = ['Comentário na tarefa','Prazo hoje','Prazo vencido'];
export const NOTIFICATION_VISIBLE_EVENTS = [...BASE_NOTIFICATION_VISIBLE_EVENTS,CLIENT_REQUEST_NOTIFICATION_EVENT];
export const NOTIFICATION_EVENT_ROWS = Object.freeze([
  Object.freeze({id:'status',event:'Status da tarefa',label:'Mudança de status'}),
  Object.freeze({id:'comment',event:'Comentário na tarefa',label:'Comentário'}),
  Object.freeze({id:'request',event:CLIENT_REQUEST_NOTIFICATION_EVENT,label:'Solicitação'}),
  Object.freeze({id:'deadline_today',event:'Prazo hoje',label:'Prazo hoje'}),
  Object.freeze({id:'deadline_overdue',event:'Prazo vencido',label:'Prazo vencido'}),
]);
"""
text = replace_once(text, old, new, 'catálogo de notificações')
path.write_text(text, encoding='utf-8')

# 2) Worker: lembrete vira Sistema + Push e prazos passam a gerar notificações reais.
path = Path('supabase/functions/process-notification-push-queue/index.ts')
text = path.read_text(encoding='utf-8')

old = """function profileAllowsPushEvent(profile: any, event: string | null | undefined) {
  if (!event) return true;
  if (event === \"Status da tarefa\") {
    const dedicated = profile?.notification_prefs?.push_status;
    return typeof dedicated === \"boolean\" ? dedicated : statusChangePushEnabled(profile);
  }
  const dedicatedEvents = profile?.notification_prefs?.push_events;
  if (Array.isArray(dedicatedEvents)) return dedicatedEvents.includes(event);
  const legacyEvents = profile?.notification_prefs?.events;
  return Array.isArray(legacyEvents) ? legacyEvents.includes(event) : true;
}
"""
new = """function profileAllowsPushEvent(profile: any, event: string | null | undefined) {
  if (!event) return true;
  if (event === \"Status da tarefa\") {
    const dedicated = profile?.notification_prefs?.push_status;
    return typeof dedicated === \"boolean\" ? dedicated : statusChangePushEnabled(profile);
  }
  const dedicatedEvents = profile?.notification_prefs?.push_events;
  if (Array.isArray(dedicatedEvents)) return dedicatedEvents.includes(event);
  const legacyEvents = profile?.notification_prefs?.events;
  return Array.isArray(legacyEvents) ? legacyEvents.includes(event) : true;
}

function profileAllowsSystemEvent(profile: any, event: string) {
  const events = profile?.notification_prefs?.events;
  if (Array.isArray(events)) return events.includes(event);
  return profile?.role !== \"client\";
}

function saoPauloDateKey() {
  const parts = new Intl.DateTimeFormat(\"en-US\", {
    timeZone: \"America/Sao_Paulo\",
    year: \"numeric\",
    month: \"2-digit\",
    day: \"2-digit\",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value || \"\";
  return `${get(\"year\")}-${get(\"month\")}-${get(\"day\")}`;
}
"""
text = replace_once(text, old, new, 'helpers de canal')

old = """      for (const profileId of profileIds) {
        const sourceKey = `reminder:${rule.id}:${task.id}:${profileId}:${enteredKey}`;
        const { error: insertError } = await supabase
          .from(\"notification_push_queue\")
          .insert({
            organization_id: rule.organization_id,
            profile_id: profileId,
            task_id: task.id,
            kind: \"reminder\",
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
        else if (!String(insertError.message || \"\").toLowerCase().includes(\"duplicate\")) {
          console.error(\"reminder queue insert failed\", insertError);
        }
      }
"""
new = """      for (const profileId of profileIds) {
        const sourceKey = `reminder:${rule.id}:${task.id}:${profileId}:${enteredKey}`;
        const notificationId = sourceKey;
        const reminderText = `A tarefa permanece em ${statusName} há ${elapsedMinutes} min.`;

        const { error: notificationError } = await supabase
          .from(\"app_notifications\")
          .upsert({
            organization_id: rule.organization_id,
            id: notificationId,
            task_id: task.id,
            user_id: profileId,
            text: reminderText,
            event: \"Lembrete de status\",
            status_id: rule.status_key,
            done: false,
            at: new Date().toISOString(),
            payload: {
              actorId: null,
              actorName: \"Sistema\",
              reminder: true,
              skip_auto_push: true,
            },
            updated_at: new Date().toISOString(),
          }, { onConflict: \"organization_id,id\" });
        if (notificationError) {
          console.error(\"reminder system notification insert failed\", notificationError);
          continue;
        }

        const { error: insertError } = await supabase
          .from(\"notification_push_queue\")
          .insert({
            organization_id: rule.organization_id,
            profile_id: profileId,
            notification_id: notificationId,
            task_id: task.id,
            kind: \"reminder\",
            event: \"Lembrete de status\",
            status_id: rule.status_key,
            source_key: sourceKey,
            deliver_after: new Date().toISOString(),
            payload: {
              text: reminderText,
              rule_id: rule.id,
              occurrence_number: occurrence,
              status_name: statusName,
              elapsed_minutes: elapsedMinutes,
            },
          });
        if (!insertError) queued++;
        else if (!String(insertError.message || \"\").toLowerCase().includes(\"duplicate\")) {
          console.error(\"reminder queue insert failed\", insertError);
        }
      }
"""
text = replace_once(text, old, new, 'lembrete sistema+push')

insert_before = """async function processSingle(row: any) {
"""
new_block = """async function generateDeadlineNotifications() {
  const today = saoPauloDateKey();
  const { data: finalStatuses } = await supabase
    .from(\"task_statuses\")
    .select(\"organization_id,key\")
    .eq(\"final\", true);
  const finalKeys = new Set((finalStatuses ?? []).map((row: any) => `${row.organization_id}:${row.key}`));

  const { data: tasks, error } = await supabase
    .from(\"app_tasks\")
    .select(\"id,organization_id,title,company_id,responsible_id,status,internal_date,archived\")
    .eq(\"archived\", false)
    .is(\"deleted_at\", null)
    .not(\"internal_date\", \"is\", null);
  if (error) throw error;

  let created = 0;
  for (const task of tasks ?? []) {
    const deadline = String(task.internal_date || \"\").slice(0, 10);
    if (!deadline || deadline > today) continue;
    if (finalKeys.has(`${task.organization_id}:${task.status}`)) continue;

    const event = deadline === today ? \"Prazo hoje\" : \"Prazo vencido\";
    const text = deadline === today
      ? \"O prazo interno desta tarefa vence hoje.\"
      : `O prazo interno desta tarefa venceu em ${deadline}.`;

    const { data: profiles } = await supabase
      .from(\"profiles\")
      .select(\"id,role,active,visible_statuses,company_ids,notification_prefs\")
      .eq(\"organization_id\", task.organization_id)
      .eq(\"active\", true);

    for (const profile of profiles ?? []) {
      const isRecipient = profile.role === \"admin\"
        || (profile.role === \"team\" && String(profile.id) === String(task.responsible_id || \"\"))
        || (profile.role === \"client\" && Array.isArray(profile.company_ids) && profile.company_ids.includes(task.company_id));
      if (!isRecipient) continue;
      if (!profileCanSeeStatus(profile, task.status)) continue;
      if (!profileAllowsSystemEvent(profile, event)) continue;

      const notificationId = `deadline:${event}:${task.id}:${profile.id}:${deadline}`;
      const { error: notificationError } = await supabase
        .from(\"app_notifications\")
        .upsert({
          organization_id: task.organization_id,
          id: notificationId,
          task_id: task.id,
          user_id: String(profile.id),
          text,
          event,
          status_id: task.status,
          done: false,
          at: new Date().toISOString(),
          payload: { actorId: null, actorName: \"Sistema\", deadline },
          updated_at: new Date().toISOString(),
        }, { onConflict: \"organization_id,id\", ignoreDuplicates: true });
      if (!notificationError) created++;
      else if (!String(notificationError.message || \"\").toLowerCase().includes(\"duplicate\")) {
        console.error(\"deadline notification insert failed\", notificationError);
      }
    }
  }
  return created;
}

""" + insert_before
text = replace_once(text, insert_before, new_block, 'gerador de prazos')

old = """    const queuedReminders = await generateReminderQueue();
    const nowIso = new Date().toISOString();
"""
new = """    const queuedReminders = await generateReminderQueue();
    const deadlineNotifications = await generateDeadlineNotifications();
    const nowIso = new Date().toISOString();
"""
text = replace_once(text, old, new, 'chamada de prazo')

old = """    return json({ ok: true, queuedReminders, due: rows.length, sent, skipped });
"""
new = """    return json({ ok: true, queuedReminders, deadlineNotifications, due: rows.length, sent, skipped });
"""
text = replace_once(text, old, new, 'retorno do worker')

path.write_text(text, encoding='utf-8')

# 3) Migration: notificações de sistema geradas pelo worker podem pular o trigger automático,
# e clientes passam a receber push para qualquer evento habilitado, não só aprovação.
migration = Path('supabase/migrations/20260913033500_notification_reminders_deadlines_beta.sql')
migration.write_text(r'''create or replace function public.enqueue_app_notification_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_active boolean;
  v_enabled boolean := true;
  v_digest_minutes integer := 30;
  v_client_delay integer := 5;
  v_due timestamptz;
begin
  if coalesce((new.payload->>'skip_auto_push')::boolean,false) then return new; end if;

  select role, active into v_role, v_active
  from public.profiles
  where id::text = new.user_id and organization_id = new.organization_id
  limit 1;

  if v_role is null or v_active is false then return new; end if;

  select enabled, team_digest_minutes, client_approval_delay_minutes
    into v_enabled, v_digest_minutes, v_client_delay
  from public.notification_delivery_settings
  where organization_id = new.organization_id;

  if coalesce(v_enabled,true) is false then return new; end if;
  v_digest_minutes := coalesce(v_digest_minutes,30);
  v_client_delay := coalesce(v_client_delay,5);

  if v_role in ('team','admin') then
    select min(deliver_after) into v_due
    from public.notification_push_queue
    where organization_id = new.organization_id
      and profile_id = new.user_id
      and kind = 'team_digest'
      and status = 'pending';

    v_due := coalesce(v_due, coalesce(new.at,new.created_at,now()) + make_interval(mins => v_digest_minutes));

    insert into public.notification_push_queue(
      organization_id,profile_id,notification_id,task_id,kind,event,status_id,source_key,deliver_after,payload
    ) values (
      new.organization_id,new.user_id,new.id,new.task_id,'team_digest',new.event,new.status_id,
      'notification:'||new.organization_id::text||':'||new.id,
      v_due,
      jsonb_build_object('text',new.text,'event',new.event,'task_id',new.task_id,'status_id',new.status_id)
    ) on conflict (source_key) do nothing;

  elsif v_role = 'client' then
    insert into public.notification_push_queue(
      organization_id,profile_id,notification_id,task_id,kind,event,status_id,source_key,deliver_after,payload
    ) values (
      new.organization_id,new.user_id,new.id,new.task_id,'client_approval',new.event,new.status_id,
      'notification:'||new.organization_id::text||':'||new.id,
      coalesce(new.at,new.created_at,now()) + make_interval(mins => v_client_delay),
      jsonb_build_object('text',new.text,'event',new.event,'task_id',new.task_id,'status_id',new.status_id)
    ) on conflict (source_key) do nothing;
  end if;

  return new;
end;
$$;
''', encoding='utf-8')

print('Step 8 aplicado: prazos reais + lembretes Sistema/Push')
