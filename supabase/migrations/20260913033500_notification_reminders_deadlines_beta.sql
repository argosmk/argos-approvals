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
