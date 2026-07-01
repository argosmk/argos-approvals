-- Rode este arquivo DEPOIS de criar o usuário no Supabase Auth.
-- 1) Authentication > Users > Add user
-- 2) Email: andre.admin@argos.local
-- 3) Password: #Resultados2020
-- 4) Marque como confirmado, se a interface oferecer essa opção.
-- 5) Copie o User UID e substitua abaixo em AUTH_USER_UUID.

insert into public.profiles (
  id,
  organization_id,
  username,
  display_name,
  role,
  title,
  active,
  visible_statuses,
  notification_prefs
)
select
  'AUTH_USER_UUID'::uuid,
  o.id,
  'andre.admin',
  'Andre Admin',
  'admin',
  'Administrador',
  true,
  '{}',
  '{}'::jsonb
from public.organizations o
where o.slug='argos'
on conflict (id) do update set
  username = excluded.username,
  display_name = excluded.display_name,
  role = excluded.role,
  title = excluded.title,
  active = true;
