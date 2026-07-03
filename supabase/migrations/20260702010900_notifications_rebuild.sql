-- Round109: notificações em tabela própria.
-- Preferências continuam em public.profiles.notification_prefs.

create table if not exists public.app_notifications (
  organization_id uuid not null,
  id text not null,
  task_id text,
  user_id text,
  text text not null default '',
  event text,
  status_id text,
  done boolean not null default false,
  at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (organization_id, id)
);

create index if not exists idx_app_notifications_org_user_done_at
  on public.app_notifications (organization_id, user_id, done, at desc)
  where deleted_at is null;

create index if not exists idx_app_notifications_org_task
  on public.app_notifications (organization_id, task_id)
  where deleted_at is null;

alter table public.app_notifications enable row level security;

do $$ begin
  create policy "app_notifications_select_same_org" on public.app_notifications
    for select using (
      organization_id in (select organization_id from public.profiles where id = auth.uid())
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "app_notifications_insert_same_org" on public.app_notifications
    for insert with check (
      organization_id in (select organization_id from public.profiles where id = auth.uid())
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "app_notifications_update_same_org" on public.app_notifications
    for update using (
      organization_id in (select organization_id from public.profiles where id = auth.uid())
    ) with check (
      organization_id in (select organization_id from public.profiles where id = auth.uid())
    );
exception when duplicate_object then null; end $$;

alter table if exists public.profiles
  add column if not exists notification_prefs jsonb;
