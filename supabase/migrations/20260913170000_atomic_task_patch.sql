create or replace function public.argos_patch_app_task(
  p_organization_id uuid,
  p_task_id text,
  p_patch jsonb
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_patch jsonb := coalesce(p_patch, '{}'::jsonb);
  v_updated integer := 0;
begin
  update public.app_tasks
  set
    title = case when v_patch ? 'title' then coalesce(v_patch->>'title', '') else title end,
    company_id = case when v_patch ? 'companyId' then nullif(v_patch->>'companyId', '') else company_id end,
    responsible_id = case when v_patch ? 'responsibleId' then nullif(v_patch->>'responsibleId', '') else responsible_id end,
    type = case when v_patch ? 'type' then nullif(v_patch->>'type', '') else type end,
    status = case when v_patch ? 'status' then nullif(v_patch->>'status', '') else status end,
    post_date = case
      when v_patch ? 'postDate' then case when coalesce(v_patch->>'postDate', '') = '' then null else (v_patch->>'postDate')::date end
      else post_date
    end,
    internal_date = case
      when v_patch ? 'internalDate' then case when coalesce(v_patch->>'internalDate', '') = '' then null else (v_patch->>'internalDate')::date end
      else internal_date
    end,
    archived = case when v_patch ? 'archived' then coalesce((v_patch->>'archived')::boolean, false) else archived end,
    material_links = case when v_patch ? 'materialLinks' then coalesce(v_patch->>'materialLinks', '') else material_links end,
    payload = coalesce(payload, '{}'::jsonb) || v_patch,
    updated_at = now()
  where organization_id = p_organization_id
    and id = p_task_id
    and deleted_at is null;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.argos_patch_app_task(uuid,text,jsonb) from public;
revoke all on function public.argos_patch_app_task(uuid,text,jsonb) from anon;
grant execute on function public.argos_patch_app_task(uuid,text,jsonb) to postgres;
grant execute on function public.argos_patch_app_task(uuid,text,jsonb) to authenticated;
grant execute on function public.argos_patch_app_task(uuid,text,jsonb) to service_role;
