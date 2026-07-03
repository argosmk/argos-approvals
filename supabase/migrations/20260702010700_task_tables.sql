-- Round107: separa tarefas e logs do workspace_state.
-- Isso reduz sobrescritas entre abas/usuários porque cada ação grava linhas específicas.

create table if not exists public.app_tasks (
  organization_id uuid not null,
  id text not null,
  title text not null default '',
  company_id text,
  responsible_id text,
  type text,
  status text,
  post_date date,
  internal_date date,
  archived boolean not null default false,
  material_links text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (organization_id, id)
);

create table if not exists public.app_task_logs (
  organization_id uuid not null,
  id text not null,
  task_id text not null,
  user_id text,
  user_name text,
  type text not null default 'log',
  visibility text not null default 'internal',
  text text not null default '',
  at timestamptz not null default now(),
  resolved boolean not null default false,
  resolved_at timestamptz,
  resolved_by text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, id)
);

create index if not exists idx_app_tasks_org_status on public.app_tasks (organization_id, status) where deleted_at is null;
create index if not exists idx_app_tasks_org_resp on public.app_tasks (organization_id, responsible_id) where deleted_at is null;
create index if not exists idx_app_tasks_org_company on public.app_tasks (organization_id, company_id) where deleted_at is null;
create index if not exists idx_app_task_logs_org_task on public.app_task_logs (organization_id, task_id, at);

alter table public.app_tasks enable row level security;
alter table public.app_task_logs enable row level security;

-- Idempotência das policies.
do $$ begin
  create policy "app_tasks_select_same_org" on public.app_tasks
    for select using (
      organization_id in (select organization_id from public.profiles where id = auth.uid())
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "app_tasks_insert_same_org" on public.app_tasks
    for insert with check (
      organization_id in (select organization_id from public.profiles where id = auth.uid())
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "app_tasks_update_same_org" on public.app_tasks
    for update using (
      organization_id in (select organization_id from public.profiles where id = auth.uid())
    ) with check (
      organization_id in (select organization_id from public.profiles where id = auth.uid())
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "app_task_logs_select_same_org" on public.app_task_logs
    for select using (
      organization_id in (select organization_id from public.profiles where id = auth.uid())
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "app_task_logs_insert_same_org" on public.app_task_logs
    for insert with check (
      organization_id in (select organization_id from public.profiles where id = auth.uid())
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "app_task_logs_update_same_org" on public.app_task_logs
    for update using (
      organization_id in (select organization_id from public.profiles where id = auth.uid())
    ) with check (
      organization_id in (select organization_id from public.profiles where id = auth.uid())
    );
exception when duplicate_object then null; end $$;
