-- ROUND 22 - Permissões para salvar o estado do workspace durante a migração.
-- Rode depois do 01_schema.sql e 02_after_creating_auth_user.sql.
-- Esta política permite que usuários ativos da organização salvem ações no app.
-- As permissões finas continuam sendo aplicadas pela interface e serão endurecidas nas próximas migrações relacionais.

drop policy if exists workspace_active_update on public.workspace_state;
create policy workspace_active_update on public.workspace_state
for update using (
  organization_id = public.current_org_id()
  and exists(select 1 from public.profiles p where p.id = auth.uid() and p.active = true)
)
with check (
  organization_id = public.current_org_id()
  and exists(select 1 from public.profiles p where p.id = auth.uid() and p.active = true)
);

drop policy if exists workspace_active_insert on public.workspace_state;
create policy workspace_active_insert on public.workspace_state
for insert with check (
  organization_id = public.current_org_id()
  and exists(select 1 from public.profiles p where p.id = auth.uid() and p.active = true)
);
