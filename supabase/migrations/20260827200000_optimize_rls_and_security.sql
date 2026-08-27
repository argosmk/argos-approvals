-- ============================================================================
-- Migration aplicada diretamente no ALFA (projeto argos-app / wzgdpfjsyxlxiapbuknp)
-- em 2026-08-27. Este arquivo existe para manter o schema local sincronizado
-- com o estado real do banco de produção. Adicione-o em supabase/migrations/.
--
-- O que este arquivo faz (idêntico ao que já foi rodado no alfa):
--   1. Otimiza políticas RLS para avaliar auth.uid()/current_org_id()/is_admin()
--      uma única vez por query (initplan) em vez de por linha — puro ganho de
--      performance, nenhuma regra de acesso muda.
--   2. Versiona as políticas de app_notifications, que existiam no banco mas
--      não estavam em nenhum arquivo local (foram criadas direto no banco em
--      algum momento).
--   3. Remove um segundo conjunto de políticas duplicadas em app_tasks e
--      app_task_logs (sufixo _org) que também não estava versionado e fazia
--      exatamente a mesma checagem que as políticas _same_org já existentes.
--   4. Adiciona índices de cobertura para foreign keys sem índice.
--   5. Restringe a chamada direta via RPC (/rest/v1/rpc/...) das funções
--      internas de apoio ao RLS (current_org_id, current_profile, is_admin)
--      para usuários anônimos. Usuários logados continuam com acesso, pois
--      as próprias políticas de RLS dependem dessas funções para funcionar.
--      get_public_portfolio NÃO foi restringida: é a função pública do
--      portfólio, uso público é intencional.
--
-- NOTA: a proteção de senha vazada (HaveIBeenPwned) foi ativada manualmente
-- no Dashboard do Supabase (Authentication > Policies) e não tem
-- representação em SQL/migration.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. RLS otimizado — tabelas "core"
-- ---------------------------------------------------------------------------
drop policy if exists org_select on public.organizations;
create policy org_select on public.organizations for select using (id = (select public.current_org_id()));

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (organization_id = (select public.current_org_id()));
drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles for all using ((select public.is_admin()) and organization_id = (select public.current_org_id())) with check ((select public.is_admin()) and organization_id = (select public.current_org_id()));
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies for select using (
  organization_id = (select public.current_org_id())
  and (
    (select public.is_admin())
    or exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'team')
    or exists(select 1 from public.client_company_access cca where cca.company_id = companies.id and cca.profile_id = (select auth.uid()))
  )
);
drop policy if exists companies_admin_all on public.companies;
create policy companies_admin_all on public.companies for all using ((select public.is_admin()) and organization_id = (select public.current_org_id())) with check ((select public.is_admin()) and organization_id = (select public.current_org_id()));

drop policy if exists client_company_access_select on public.client_company_access;
create policy client_company_access_select on public.client_company_access for select using (organization_id = (select public.current_org_id()));
drop policy if exists client_company_access_admin_all on public.client_company_access;
create policy client_company_access_admin_all on public.client_company_access for all using ((select public.is_admin()) and organization_id = (select public.current_org_id())) with check ((select public.is_admin()) and organization_id = (select public.current_org_id()));

drop policy if exists statuses_select on public.task_statuses;
create policy statuses_select on public.task_statuses for select using (organization_id = (select public.current_org_id()));
drop policy if exists statuses_admin_all on public.task_statuses;
create policy statuses_admin_all on public.task_statuses for all using ((select public.is_admin()) and organization_id = (select public.current_org_id())) with check ((select public.is_admin()) and organization_id = (select public.current_org_id()));

drop policy if exists types_select on public.task_types;
create policy types_select on public.task_types for select using (organization_id = (select public.current_org_id()));
drop policy if exists types_admin_all on public.task_types;
create policy types_admin_all on public.task_types for all using ((select public.is_admin()) and organization_id = (select public.current_org_id())) with check ((select public.is_admin()) and organization_id = (select public.current_org_id()));

-- ---------------------------------------------------------------------------
-- 1b. RLS otimizado — tasks, eventos, notificações, arquivos, workspace
-- ---------------------------------------------------------------------------
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select using (
  organization_id = (select public.current_org_id())
  and (
    (select public.is_admin())
    or exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'team')
    or exists(select 1 from public.client_company_access cca where cca.company_id = tasks.company_id and cca.profile_id = (select auth.uid()))
  )
);
drop policy if exists tasks_admin_all on public.tasks;
create policy tasks_admin_all on public.tasks for all using ((select public.is_admin()) and organization_id = (select public.current_org_id())) with check ((select public.is_admin()) and organization_id = (select public.current_org_id()));
drop policy if exists tasks_team_update on public.tasks;
create policy tasks_team_update on public.tasks for update using (responsible_id = (select auth.uid()) and organization_id = (select public.current_org_id())) with check (responsible_id = (select auth.uid()) and organization_id = (select public.current_org_id()));

drop policy if exists events_select on public.task_events;
create policy events_select on public.task_events for select using (
  organization_id = (select public.current_org_id())
  and exists(select 1 from public.tasks t where t.id = task_events.task_id)
);
drop policy if exists events_insert on public.task_events;
create policy events_insert on public.task_events for insert with check (organization_id = (select public.current_org_id()));
drop policy if exists events_update_resolve on public.task_events;
create policy events_update_resolve on public.task_events for update using (((select public.is_admin()) or exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'team')) and organization_id = (select public.current_org_id()));

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select using (profile_id = (select auth.uid()) and organization_id = (select public.current_org_id()));
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications for update using (profile_id = (select auth.uid()) and organization_id = (select public.current_org_id()));
drop policy if exists notifications_admin_insert on public.notifications;
create policy notifications_admin_insert on public.notifications for insert with check (organization_id = (select public.current_org_id()));

drop policy if exists files_select on public.files;
create policy files_select on public.files for select using (organization_id = (select public.current_org_id()));
drop policy if exists files_insert on public.files;
create policy files_insert on public.files for insert with check (organization_id = (select public.current_org_id()));

drop policy if exists workspace_select on public.workspace_state;
create policy workspace_select on public.workspace_state for select using (organization_id = (select public.current_org_id()));
drop policy if exists workspace_admin_all on public.workspace_state;
create policy workspace_admin_all on public.workspace_state for all using ((select public.is_admin()) and organization_id = (select public.current_org_id())) with check ((select public.is_admin()) and organization_id = (select public.current_org_id()));
drop policy if exists workspace_active_update on public.workspace_state;
create policy workspace_active_update on public.workspace_state for update using (
  organization_id = (select public.current_org_id())
  and exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.active = true)
);
drop policy if exists workspace_active_insert on public.workspace_state;
create policy workspace_active_insert on public.workspace_state for insert with check (
  organization_id = (select public.current_org_id())
  and exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.active = true)
);

-- ---------------------------------------------------------------------------
-- 2. app_tasks / app_task_logs / app_notifications
--    Mantém apenas o conjunto _same_org (otimizado). O conjunto _org, que
--    existia direto no banco sem estar versionado, é removido no bloco 3.
-- ---------------------------------------------------------------------------
drop policy if exists app_tasks_select_same_org on public.app_tasks;
create policy app_tasks_select_same_org on public.app_tasks for select using (
  organization_id in (select organization_id from public.profiles where id = (select auth.uid()))
);
drop policy if exists app_tasks_insert_same_org on public.app_tasks;
create policy app_tasks_insert_same_org on public.app_tasks for insert with check (
  organization_id in (select organization_id from public.profiles where id = (select auth.uid()))
);
drop policy if exists app_tasks_update_same_org on public.app_tasks;
create policy app_tasks_update_same_org on public.app_tasks for update using (
  organization_id in (select organization_id from public.profiles where id = (select auth.uid()))
) with check (
  organization_id in (select organization_id from public.profiles where id = (select auth.uid()))
);

drop policy if exists app_task_logs_select_same_org on public.app_task_logs;
create policy app_task_logs_select_same_org on public.app_task_logs for select using (
  organization_id in (select organization_id from public.profiles where id = (select auth.uid()))
);
drop policy if exists app_task_logs_insert_same_org on public.app_task_logs;
create policy app_task_logs_insert_same_org on public.app_task_logs for insert with check (
  organization_id in (select organization_id from public.profiles where id = (select auth.uid()))
);
drop policy if exists app_task_logs_update_same_org on public.app_task_logs;
create policy app_task_logs_update_same_org on public.app_task_logs for update using (
  organization_id in (select organization_id from public.profiles where id = (select auth.uid()))
) with check (
  organization_id in (select organization_id from public.profiles where id = (select auth.uid()))
);

-- Políticas de app_notifications: existiam no banco, não estavam em nenhum
-- arquivo local. Versionando agora.
drop policy if exists app_notifications_select_same_org on public.app_notifications;
create policy app_notifications_select_same_org on public.app_notifications for select using (
  organization_id in (select organization_id from public.profiles where id = (select auth.uid()))
);
drop policy if exists app_notifications_insert_same_org on public.app_notifications;
create policy app_notifications_insert_same_org on public.app_notifications for insert with check (
  organization_id in (select organization_id from public.profiles where id = (select auth.uid()))
);
drop policy if exists app_notifications_update_same_org on public.app_notifications;
create policy app_notifications_update_same_org on public.app_notifications for update using (
  organization_id in (select organization_id from public.profiles where id = (select auth.uid()))
) with check (
  organization_id in (select organization_id from public.profiles where id = (select auth.uid()))
);

-- ---------------------------------------------------------------------------
-- 3. Remove o segundo conjunto de políticas (_org), duplicado e não
--    versionado, criado direto no banco em algum momento.
-- ---------------------------------------------------------------------------
drop policy if exists app_tasks_select_org on public.app_tasks;
drop policy if exists app_tasks_insert_org on public.app_tasks;
drop policy if exists app_tasks_update_org on public.app_tasks;
drop policy if exists app_tasks_delete_org on public.app_tasks;

drop policy if exists app_task_logs_select_org on public.app_task_logs;
drop policy if exists app_task_logs_insert_org on public.app_task_logs;
drop policy if exists app_task_logs_update_org on public.app_task_logs;
drop policy if exists app_task_logs_delete_org on public.app_task_logs;

-- ---------------------------------------------------------------------------
-- 4. Índices de cobertura para foreign keys sem índice
-- ---------------------------------------------------------------------------
create index if not exists idx_app_financial_settings_updated_by on public.app_financial_settings(updated_by);
create index if not exists idx_client_company_access_company_id on public.client_company_access(company_id);
create index if not exists idx_client_company_access_organization_id on public.client_company_access(organization_id);
create index if not exists idx_companies_organization_id on public.companies(organization_id);
create index if not exists idx_files_organization_id on public.files(organization_id);
create index if not exists idx_files_owner_id on public.files(owner_id);
create index if not exists idx_files_task_id on public.files(task_id);
create index if not exists idx_notifications_organization_id on public.notifications(organization_id);
create index if not exists idx_notifications_profile_id on public.notifications(profile_id);
create index if not exists idx_notifications_task_id on public.notifications(task_id);
create index if not exists idx_task_events_organization_id on public.task_events(organization_id);
create index if not exists idx_task_events_profile_id on public.task_events(profile_id);
create index if not exists idx_task_events_resolved_by on public.task_events(resolved_by);
create index if not exists idx_task_events_task_id on public.task_events(task_id);
create index if not exists idx_tasks_company_id on public.tasks(company_id);
create index if not exists idx_tasks_created_by on public.tasks(created_by);
create index if not exists idx_tasks_organization_id on public.tasks(organization_id);
create index if not exists idx_tasks_responsible_id on public.tasks(responsible_id);

-- ---------------------------------------------------------------------------
-- 5. Bloqueia RPC direta (/rest/v1/rpc/...) por usuário anônimo às funções
--    internas de apoio ao RLS. 'authenticated' mantém acesso — necessário
--    para o RLS continuar funcionando para usuários logados.
--    get_public_portfolio NÃO é afetada.
-- ---------------------------------------------------------------------------
revoke execute on function public.current_org_id() from public;
revoke execute on function public.current_profile() from public;
revoke execute on function public.is_admin() from public;

grant execute on function public.current_org_id() to authenticated;
grant execute on function public.current_profile() to authenticated;
grant execute on function public.is_admin() to authenticated;
