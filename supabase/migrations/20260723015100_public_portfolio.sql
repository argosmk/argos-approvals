-- Round151A: portfólio público automático e seguro.
-- Cria somente a configuração pública e uma função RPC de leitura limitada.
-- Tarefas arquivadas continuam aparecendo. Apenas tarefas excluídas são omitidas.

create table if not exists public.public_portfolio_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  public_slug text not null unique,
  profile_name text not null default 'Argos',
  profile_username text not null default '@argosmarketing',
  avatar_url text not null default '',
  bio text not null default '',
  cta_text text not null default 'Solicitar orçamento',
  cta_url text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint public_portfolio_slug_format check (public_slug ~ '^[a-z0-9][a-z0-9-]{1,62}$')
);

alter table public.public_portfolio_settings enable row level security;

-- Usuários autenticados da organização podem consultar a própria configuração.
drop policy if exists public_portfolio_settings_select_same_org on public.public_portfolio_settings;
create policy public_portfolio_settings_select_same_org
on public.public_portfolio_settings
for select
to authenticated
using (organization_id = public.current_org_id());

-- Somente administradores ativos podem criar ou editar a configuração.
drop policy if exists public_portfolio_settings_admin_insert on public.public_portfolio_settings;
create policy public_portfolio_settings_admin_insert
on public.public_portfolio_settings
for insert
to authenticated
with check (
  public.is_admin()
  and organization_id = public.current_org_id()
);

drop policy if exists public_portfolio_settings_admin_update on public.public_portfolio_settings;
create policy public_portfolio_settings_admin_update
on public.public_portfolio_settings
for update
to authenticated
using (
  public.is_admin()
  and organization_id = public.current_org_id()
)
with check (
  public.is_admin()
  and organization_id = public.current_org_id()
);

-- Atualiza updated_at sem depender da interface.
create or replace function public.touch_public_portfolio_settings_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_public_portfolio_settings_updated_at
on public.public_portfolio_settings;

create trigger trg_public_portfolio_settings_updated_at
before update on public.public_portfolio_settings
for each row
execute function public.touch_public_portfolio_settings_updated_at();

-- Configuração inicial da organização Argos, sem sobrescrever futuras edições.
insert into public.public_portfolio_settings (
  organization_id,
  public_slug,
  profile_name,
  profile_username,
  bio,
  cta_text,
  active
)
select
  o.id,
  'argos',
  'Argos',
  '@argosmarketing',
  '',
  'Solicitar orçamento',
  true
from public.organizations o
where o.slug = 'argos'
on conflict (organization_id) do nothing;

-- RPC pública. Retorna somente configuração pública e materiais de tarefas Pronto.
-- Não expõe payload, comentários, prazos, responsáveis, clientes, logs ou usuários.
create or replace function public.get_public_portfolio(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with selected_settings as (
    select
      s.organization_id,
      s.public_slug,
      s.profile_name,
      s.profile_username,
      s.avatar_url,
      s.bio,
      s.cta_text,
      s.cta_url,
      s.updated_at
    from public.public_portfolio_settings s
    where s.public_slug = lower(trim(p_slug))
      and s.active = true
    limit 1
  ),
  public_tasks as (
    select
      t.id,
      t.title,
      t.type,
      t.post_date,
      t.created_at,
      t.updated_at,
      coalesce(
        (
          select jsonb_agg(link order by ord)
          from (
            select trim(piece) as link, ord
            from regexp_split_to_table(coalesce(t.material_links, ''), E'\\r?\\n')
              with ordinality as parts(piece, ord)
            where trim(piece) <> ''
              and trim(piece) ~* '^https?://'
          ) valid_links
        ),
        '[]'::jsonb
      ) as materials
    from public.app_tasks t
    join selected_settings s on s.organization_id = t.organization_id
    where t.deleted_at is null
      and lower(trim(coalesce(t.status, ''))) = 'pronto'
      and exists (
        select 1
        from regexp_split_to_table(coalesce(t.material_links, ''), E'\\r?\\n') as raw_link
        where trim(raw_link) ~* '^https?://'
      )
    -- archived não entra no filtro de propósito: trabalhos arquivados seguem públicos.
  )
  select case
    when not exists (select 1 from selected_settings) then null
    else jsonb_build_object(
      'profile', (
        select jsonb_build_object(
          'slug', s.public_slug,
          'name', s.profile_name,
          'username', s.profile_username,
          'avatarUrl', s.avatar_url,
          'bio', s.bio,
          'ctaText', s.cta_text,
          'ctaUrl', s.cta_url,
          'updatedAt', s.updated_at
        )
        from selected_settings s
      ),
      'items', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', p.id,
              'title', p.title,
              'type', p.type,
              'postDate', p.post_date,
              'materials', p.materials,
              'previewUrl', p.materials ->> 0
            )
            order by p.post_date desc nulls last, p.updated_at desc, p.created_at desc
          )
          from public_tasks p
        ),
        '[]'::jsonb
      )
    )
  end;
$$;

-- A página pública usa a chave anônima apenas para executar esta RPC.
revoke all on function public.get_public_portfolio(text) from public;
grant execute on function public.get_public_portfolio(text) to anon, authenticated;

-- A tabela continua inacessível ao visitante anônimo.
revoke all on table public.public_portfolio_settings from anon;
