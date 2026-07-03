-- Round108: campos de perfil que não devem depender do workspace_state JSON.
-- Mantém presença online, recado social e @instagram em profiles para evitar sobrescrita por abas antigas.

alter table if exists public.profiles
  add column if not exists last_seen_at timestamptz;

alter table if exists public.profiles
  add column if not exists social_instagram text default '';

alter table if exists public.profiles
  add column if not exists social_status text default '';

-- Índice simples para consultas de presença por organização.
create index if not exists profiles_organization_last_seen_idx
  on public.profiles (organization_id, last_seen_at desc);
