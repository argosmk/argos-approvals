create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

create table if not exists public.notification_delivery_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  enabled boolean not null default true,
  team_digest_minutes integer not null default 30 check (team_digest_minutes between 1 and 1440),
  client_approval_delay_minutes integer not null default 5 check (client_approval_delay_minutes between 0 and 1440),
  presence_grace_seconds integer not null default 120 check (presence_grace_seconds between 0 and 3600),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_reminder_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  status_key text not null,
  enabled boolean not null default true,
  targets text[] not null default array['client_approvers']::text[],
  first_after_minutes integer not null default 1440 check (first_after_minutes >= 0),
  interval_minutes integer not null default 2880 check (interval_minutes >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, status_key)
);

create table if not exists public.notification_reminders_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rule_id uuid not null references public.notification_reminder_rules(id) on delete cascade,
  task_id text not null,
  profile_id text not null,
  occurrence_number integer not null,
  channel text not null default 'push',
  sent_at timestamptz not null default now(),
  unique (rule_id, task_id, profile_id, occurrence_number, channel)
);

create table if not exists public.notification_push_queue (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id text not null,
  notification_id text,
  task_id text,
  kind text not null check (kind in ('team_digest','client_approval','reminder')),
  event text,
  status_id text,
  source_key text not null unique,
  deliver_after timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','processing','sent','skipped','cancelled','failed')),
  attempts integer not null default 0,
  skip_reason text,
  last_error text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists idx_notification_push_queue_due
  on public.notification_push_queue (status, deliver_after);
create index if not exists idx_notification_push_queue_profile
  on public.notification_push_queue (organization_id, profile_id, status, deliver_after);
create index if not exists idx_notification_reminder_rules_org_status
  on public.notification_reminder_rules (organization_id, status_key) where enabled = true;

alter table public.notification_delivery_settings enable row level security;
alter table public.notification_reminder_rules enable row level security;
alter table public.notification_reminders_log enable row level security;
alter table public.notification_push_queue enable row level security;

do $$ begin
  create policy "notification_delivery_settings_select_same_org" on public.notification_delivery_settings
    for select using (organization_id in (select organization_id from public.profiles where id = auth.uid()));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "notification_delivery_settings_admin_write" on public.notification_delivery_settings
    for all using (organization_id in (select organization_id from public.profiles where id = auth.uid() and role='admin'))
    with check (organization_id in (select organization_id from public.profiles where id = auth.uid() and role='admin'));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "notification_reminder_rules_select_same_org" on public.notification_reminder_rules
    for select using (organization_id in (select organization_id from public.profiles where id = auth.uid()));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "notification_reminder_rules_admin_write" on public.notification_reminder_rules
    for all using (organization_id in (select organization_id from public.profiles where id = auth.uid() and role='admin'))
    with check (organization_id in (select organization_id from public.profiles where id = auth.uid() and role='admin'));
exception when duplicate_object then null; end $$;

insert into public.notification_delivery_settings (organization_id)
select id from public.organizations
on conflict (organization_id) do nothing;

do $$
begin
  if to_regclass('public.approval_reminder_settings') is not null then
    insert into public.notification_reminder_rules (
      organization_id,status_key,enabled,targets,first_after_minutes,interval_minutes
    )
    select
      ars.organization_id,
      s.key,
      ars.enabled,
      array['client_approvers']::text[],
      greatest(0,ars.first_day_after)*1440,
      greatest(1,ars.interval_days)*1440
    from public.approval_reminder_settings ars
    cross join lateral unnest(ars.status_keys) as s(key)
    on conflict (organization_id,status_key) do nothing;
  end if;
end $$;

create or replace function public.enqueue_app_notification_push()
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

    v_due := coalesce(
      v_due,
      coalesce(new.at,new.created_at,now()) + make_interval(mins => v_digest_minutes)
    );

    insert into public.notification_push_queue(
      organization_id,profile_id,notification_id,task_id,kind,event,status_id,source_key,deliver_after,payload
    ) values (
      new.organization_id,new.user_id,new.id,new.task_id,'team_digest',new.event,new.status_id,
      'notification:'||new.organization_id::text||':'||new.id,
      v_due,
      jsonb_build_object('text',new.text,'event',new.event,'task_id',new.task_id,'status_id',new.status_id)
    ) on conflict (source_key) do nothing;

  elsif v_role = 'client' and new.status_id in ('aprovacao','aprovar-copy') then
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

drop trigger if exists app_notifications_push_trigger on public.app_notifications;
drop trigger if exists app_notifications_enqueue_push_trigger on public.app_notifications;
create trigger app_notifications_enqueue_push_trigger
after insert on public.app_notifications
for each row execute function public.enqueue_app_notification_push();

select cron.schedule(
  'argos-process-notification-push-queue-beta',
  '* * * * *',
  $$select net.http_post(
      url := 'https://ejgunuqynqldwiplxaqq.supabase.co/functions/v1/process-notification-push-queue',
      headers := jsonb_build_object('Content-Type','application/json'),
      body := '{}'::jsonb
    );$$
);