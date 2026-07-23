-- Round151D: redes sociais modulares no portfólio público.

alter table public.public_portfolio_settings
add column if not exists social_links jsonb not null default '{}'::jsonb;

comment on column public.public_portfolio_settings.social_links is
'Links públicos opcionais por rede social. Apenas chaves preenchidas são exibidas.';

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
      coalesce(s.social_links, '{}'::jsonb) as social_links,
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
          'socialLinks', s.social_links,
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

revoke all on function public.get_public_portfolio(text) from public;
grant execute on function public.get_public_portfolio(text) to anon, authenticated;

grant select, insert, update
on table public.public_portfolio_settings
to authenticated;
