import { supabase, isSupabaseConfigured } from './supabaseClient';

const SETTINGS_TABLE = 'public_portfolio_settings';
const PUBLIC_RPC = 'get_public_portfolio';

const DEFAULT_PROFILE = Object.freeze({
  slug: 'argos',
  name: 'Argos',
  username: '@argosmarketing',
  avatarUrl: '',
  bio: '',
  ctaText: 'Solicitar orçamento',
  ctaUrl: '',
});

function cleanSlug(value = 'argos') {
  return String(value || 'argos')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'argos';
}

function normalizePublicPortfolio(data, slug) {
  const profile = data?.profile || {};
  return {
    profile: {
      ...DEFAULT_PROFILE,
      ...profile,
      slug: cleanSlug(profile.slug || slug),
    },
    items: Array.isArray(data?.items)
      ? data.items.map(item => ({
          id: String(item?.id || ''),
          title: String(item?.title || ''),
          type: String(item?.type || ''),
          postDate: item?.postDate || null,
          materials: Array.isArray(item?.materials)
            ? item.materials.filter(Boolean)
            : [],
          previewUrl: item?.previewUrl || item?.materials?.[0] || '',
        })).filter(item => item.id && item.previewUrl)
      : [],
  };
}

/**
 * Consulta pública, sem sessão obrigatória.
 * A RPC do Supabase devolve somente campos seguros do portfólio.
 */
export async function loadPublicPortfolio(slug = 'argos') {
  const publicSlug = cleanSlug(slug);
  if (!isSupabaseConfigured || !supabase) {
    return normalizePublicPortfolio({ profile: { slug: publicSlug }, items: [] }, publicSlug);
  }

  const { data, error } = await supabase.rpc(PUBLIC_RPC, { p_slug: publicSlug });
  if (error) throw new Error(`Não foi possível carregar o portfólio público: ${error.message}`);
  if (!data) return null;
  return normalizePublicPortfolio(data, publicSlug);
}

/**
 * Lê a configuração privada da organização autenticada.
 * Será usada na aba administrativa da Round151B.
 */
export async function loadPublicPortfolioSettings(organizationId) {
  if (!organizationId) throw new Error('Organização não informada.');
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase
    .from(SETTINGS_TABLE)
    .select('*')
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) throw new Error(`Não foi possível carregar as configurações do portfólio: ${error.message}`);
  return data;
}

/**
 * Cria ou atualiza a configuração. A RLS permite a operação apenas para admins.
 */
export async function savePublicPortfolioSettings(organizationId, settings = {}) {
  if (!organizationId) throw new Error('Organização não informada.');
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase não configurado.');

  const row = {
    organization_id: organizationId,
    public_slug: cleanSlug(settings.publicSlug || settings.public_slug || 'argos'),
    profile_name: String(settings.profileName ?? settings.profile_name ?? 'Argos').trim() || 'Argos',
    profile_username: String(settings.profileUsername ?? settings.profile_username ?? '@argosmarketing').trim(),
    avatar_url: String(settings.avatarUrl ?? settings.avatar_url ?? '').trim(),
    bio: String(settings.bio ?? '').trim(),
    cta_text: String(settings.ctaText ?? settings.cta_text ?? 'Solicitar orçamento').trim() || 'Solicitar orçamento',
    cta_url: String(settings.ctaUrl ?? settings.cta_url ?? '').trim(),
    active: settings.active !== false,
  };

  const { data, error } = await supabase
    .from(SETTINGS_TABLE)
    .upsert(row, { onConflict: 'organization_id' })
    .select('*')
    .single();

  if (error) throw new Error(`Não foi possível salvar as configurações do portfólio: ${error.message}`);
  return data;
}
