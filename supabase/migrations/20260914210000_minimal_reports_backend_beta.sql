-- Backend mínimo de Relatórios para o ambiente Beta.
-- Não inclui cron, autopost, tokens, métricas automáticas nem publicação real.

create table if not exists public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id text not null,
  platform text not null default 'instagram',
  username text,
  auth_type text not null default 'beta_mock',
  connected_from timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.social_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.social_accounts(id) on delete cascade,
  company_id text,
  kind text not null default 'weekly' check (kind in ('weekly','monthly')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  numbers jsonb not null default '{}'::jsonb,
  narrative text,
  actions jsonb not null default '[]'::jsonb,
  narrative_source text not null default 'beta_mock',
  created_at timestamptz not null default now(),
  unique(account_id, kind, period_start, period_end)
);

alter table public.social_accounts enable row level security;
alter table public.social_reports enable row level security;

drop policy if exists social_accounts_beta_select on public.social_accounts;
create policy social_accounts_beta_select on public.social_accounts
for select to authenticated
using (organization_id = (select public.current_org_id()));

drop policy if exists social_reports_beta_select on public.social_reports;
create policy social_reports_beta_select on public.social_reports
for select to authenticated
using (organization_id = (select public.current_org_id()));

grant select on public.social_accounts to authenticated;
grant select on public.social_reports to authenticated;

create or replace function public.contas_com_relatorio()
returns table(account_id uuid, company_id text, username text, kind text, conectada_em timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_role text;
begin
  select p.organization_id, coalesce(p.role,'client')
    into v_org, v_role
  from public.profiles p
  where p.id = auth.uid() and coalesce(p.active,true);

  if v_org is null or v_role <> 'admin' then
    return;
  end if;

  return query
  select a.id, a.company_id, a.username, a.auth_type, a.connected_from
  from public.social_accounts a
  where a.organization_id = v_org
  order by coalesce(a.username,a.company_id);
end;
$$;

revoke all on function public.contas_com_relatorio() from public;
grant execute on function public.contas_com_relatorio() to authenticated;

create or replace function public.gerar_relatorio(
  p_account_id uuid,
  p_kind text default 'weekly'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_role text;
  v_account public.social_accounts%rowtype;
  v_end timestamptz := now();
  v_start timestamptz;
  v_numbers jsonb;
  v_report public.social_reports%rowtype;
begin
  if p_kind not in ('weekly','monthly') then
    raise exception 'período inválido: %', p_kind using errcode='22023';
  end if;

  select p.organization_id, coalesce(p.role,'client')
    into v_org, v_role
  from public.profiles p
  where p.id = auth.uid() and coalesce(p.active,true);

  if v_org is null or v_role <> 'admin' then
    raise exception 'sem permissão' using errcode='42501';
  end if;

  select * into v_account
  from public.social_accounts
  where id = p_account_id and organization_id = v_org;

  if not found then
    raise exception 'conta não encontrada' using errcode='42501';
  end if;

  v_start := v_end - case when p_kind='monthly' then interval '30 days' else interval '7 days' end;
  v_numbers := jsonb_build_object(
    'conta', coalesce(v_account.username,''),
    'resumo', jsonb_build_object(
      'posts',0,'views',0,'alcance',0,'interacoes',0,
      'seguidores_ganhos',0,'visitas_perfil',0,'indice_medio',0
    ),
    'semana_anterior', jsonb_build_object(
      'posts',null,'views',null,'alcance',null,
      'seguidores_ganhos',null,'indice_medio',null
    ),
    'melhores','[]'::jsonb,
    'piores','[]'::jsonb,
    'por_pilar','[]'::jsonb,
    'por_horario','[]'::jsonb
  );

  insert into public.social_reports(
    organization_id, account_id, company_id, kind,
    period_start, period_end, numbers, narrative, actions, narrative_source
  ) values (
    v_org, v_account.id, v_account.company_id, p_kind,
    v_start, v_end, v_numbers,
    'Relatório de teste do ambiente Beta. Não há coleta automática de métricas nem publicação conectada neste ambiente.',
    '[]'::jsonb,
    'beta_mock'
  )
  returning * into v_report;

  return jsonb_build_object(
    'id',v_report.id,
    'posts',0,
    'conta',coalesce(v_account.username,''),
    'kind',p_kind,
    'period_start',v_start,
    'period_end',v_end
  );
end;
$$;

revoke all on function public.gerar_relatorio(uuid,text) from public;
grant execute on function public.gerar_relatorio(uuid,text) to authenticated;
