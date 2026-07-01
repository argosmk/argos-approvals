-- ARGOS APPROVAL - INFRA ROUND 21
-- Rode este arquivo no SQL Editor do Supabase.
-- Ele cria a estrutura profissional: organizações, usuários, empresas, tarefas, comentários, logs e notificações.

create extension if not exists "pgcrypto";

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  logo_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  role text not null check (role in ('admin','team','client')),
  title text,
  avatar_url text,
  active boolean not null default true,
  visible_statuses text[] not null default '{}',
  notification_prefs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  instagram text,
  logo_url text,
  entry_date date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_company_access (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(profile_id, company_id)
);

create table if not exists public.task_statuses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  name text not null,
  color text not null default '#999999',
  sort_order integer not null default 0,
  active boolean not null default true,
  final boolean not null default false,
  timer boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, key)
);

create table if not exists public.task_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  price numeric(12,2),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique(organization_id, name)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  responsible_id uuid references public.profiles(id) on delete set null,
  title text not null,
  task_type text not null,
  status_key text not null,
  post_date date,
  internal_date date,
  version integer not null default 1,
  alteration_count integer not null default 0,
  archived boolean not null default false,
  instructions text,
  copy text,
  caption text,
  material_links text,
  total_edit_seconds integer not null default 0,
  total_alter_seconds integer not null default 0,
  started_at timestamptz,
  previous_status_key text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (event_type in ('comment','change_request','approval','log')),
  body text not null,
  form_selection jsonb not null default '{}'::jsonb,
  visibility text not null default 'internal' check (visibility in ('internal','client','all')),
  resolved boolean not null default false,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  event_key text not null,
  status_key text,
  title text not null,
  body text,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  done_at timestamptz
);

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_id uuid references public.profiles(id) on delete set null,
  task_id uuid references public.tasks(id) on delete cascade,
  bucket text not null,
  path text not null,
  public_url text,
  file_type text,
  created_at timestamptz not null default now()
);

-- Estado temporário de migração. Permite salvar todo o app atual em JSONB enquanto migramos tela por tela.
create table if not exists public.workspace_state (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.current_profile()
returns public.profiles
language sql stable security definer
set search_path = public
as $$
  select * from public.profiles where id = auth.uid() limit 1;
$$;

create or replace function public.current_org_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid() limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin' and active = true);
$$;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.client_company_access enable row level security;
alter table public.task_statuses enable row level security;
alter table public.task_types enable row level security;
alter table public.tasks enable row level security;
alter table public.task_events enable row level security;
alter table public.notifications enable row level security;
alter table public.files enable row level security;
alter table public.workspace_state enable row level security;

-- Políticas base por organização.
drop policy if exists org_select on public.organizations;
create policy org_select on public.organizations for select using (id = public.current_org_id());

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (organization_id = public.current_org_id());
drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles for all using (public.is_admin() and organization_id = public.current_org_id()) with check (public.is_admin() and organization_id = public.current_org_id());

drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies for select using (
  organization_id = public.current_org_id()
  and (
    public.is_admin()
    or exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'team')
    or exists(select 1 from public.client_company_access a where a.profile_id = auth.uid() and a.company_id = companies.id)
  )
);
drop policy if exists companies_admin_all on public.companies;
create policy companies_admin_all on public.companies for all using (public.is_admin() and organization_id = public.current_org_id()) with check (public.is_admin() and organization_id = public.current_org_id());

drop policy if exists client_company_access_select on public.client_company_access;
create policy client_company_access_select on public.client_company_access for select using (organization_id = public.current_org_id());
drop policy if exists client_company_access_admin_all on public.client_company_access;
create policy client_company_access_admin_all on public.client_company_access for all using (public.is_admin() and organization_id = public.current_org_id()) with check (public.is_admin() and organization_id = public.current_org_id());

drop policy if exists statuses_select on public.task_statuses;
create policy statuses_select on public.task_statuses for select using (organization_id = public.current_org_id());
drop policy if exists statuses_admin_all on public.task_statuses;
create policy statuses_admin_all on public.task_statuses for all using (public.is_admin() and organization_id = public.current_org_id()) with check (public.is_admin() and organization_id = public.current_org_id());

drop policy if exists types_select on public.task_types;
create policy types_select on public.task_types for select using (organization_id = public.current_org_id());
drop policy if exists types_admin_all on public.task_types;
create policy types_admin_all on public.task_types for all using (public.is_admin() and organization_id = public.current_org_id()) with check (public.is_admin() and organization_id = public.current_org_id());

drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select using (
  organization_id = public.current_org_id()
  and (
    public.is_admin()
    or responsible_id = auth.uid()
    or exists(select 1 from public.client_company_access a where a.profile_id = auth.uid() and a.company_id = tasks.company_id)
  )
);
drop policy if exists tasks_admin_all on public.tasks;
create policy tasks_admin_all on public.tasks for all using (public.is_admin() and organization_id = public.current_org_id()) with check (public.is_admin() and organization_id = public.current_org_id());
drop policy if exists tasks_team_update on public.tasks;
create policy tasks_team_update on public.tasks for update using (responsible_id = auth.uid() and organization_id = public.current_org_id()) with check (responsible_id = auth.uid() and organization_id = public.current_org_id());

drop policy if exists events_select on public.task_events;
create policy events_select on public.task_events for select using (
  organization_id = public.current_org_id()
  and exists(select 1 from public.tasks t where t.id = task_events.task_id)
);
drop policy if exists events_insert on public.task_events;
create policy events_insert on public.task_events for insert with check (organization_id = public.current_org_id());
drop policy if exists events_update_resolve on public.task_events;
create policy events_update_resolve on public.task_events for update using ((public.is_admin() or exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'team')) and organization_id = public.current_org_id());

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select using (profile_id = auth.uid() and organization_id = public.current_org_id());
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications for update using (profile_id = auth.uid() and organization_id = public.current_org_id());
drop policy if exists notifications_admin_insert on public.notifications;
create policy notifications_admin_insert on public.notifications for insert with check (organization_id = public.current_org_id());

drop policy if exists files_select on public.files;
create policy files_select on public.files for select using (organization_id = public.current_org_id());
drop policy if exists files_insert on public.files;
create policy files_insert on public.files for insert with check (organization_id = public.current_org_id());

drop policy if exists workspace_select on public.workspace_state;
create policy workspace_select on public.workspace_state for select using (organization_id = public.current_org_id());
drop policy if exists workspace_admin_all on public.workspace_state;
create policy workspace_admin_all on public.workspace_state for all using (public.is_admin() and organization_id = public.current_org_id()) with check (public.is_admin() and organization_id = public.current_org_id());

-- Organização inicial e configurações padrão.
insert into public.organizations (name, slug)
values ('Argos', 'argos')
on conflict (slug) do nothing;

insert into public.task_statuses (organization_id, key, name, color, sort_order, final, timer)
select o.id, v.key, v.name, v.color, v.sort_order, v.final, v.timer
from public.organizations o
cross join (values
  ('criar','Criar','#9ca3af',1,false,false),
  ('copy','Copy','#3b82f6',2,false,false),
  ('edicao','Edição','#a855f7',3,false,true),
  ('aguardando','Aguardando','#eab308',4,false,false),
  ('aprovacao','Aprovação','#f97316',5,false,false),
  ('alteracao','Alteração','#ef4444',6,false,true),
  ('agendamento','Agendamento','#ec4899',7,true,false),
  ('pronto','Pronto','#22c55e',8,true,false)
) as v(key,name,color,sort_order,final,timer)
where o.slug='argos'
on conflict (organization_id, key) do nothing;

insert into public.task_types (organization_id, name, sort_order)
select o.id, v.name, v.sort_order
from public.organizations o
cross join (values
  ('Estático',1),('Carrossel',2),('Vídeo',3),('Vídeo Inglês',4),('Pacote de criativos',5),('Outras demandas',6)
) as v(name,sort_order)
where o.slug='argos'
on conflict (organization_id, name) do nothing;
