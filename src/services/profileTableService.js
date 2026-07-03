import { supabase, isSupabaseConfigured } from './supabaseClient';

function isoNow(){ return new Date().toISOString(); }

export function profileToPartialAppUser(profile){
  if(!profile) return null;
  return {
    id: profile.id,
    role: profile.role,
    name: profile.display_name || profile.username || '',
    username: profile.username || '',
    active: profile.active !== false,
    avatar: profile.avatar_url || '',
    title: profile.title || (profile.role==='admin'?'Administrador':profile.role==='team'?'Equipe':'Cliente'),
    visibleStatuses: profile.visible_statuses || [],
    notificationPrefs: profile.notification_prefs?.events || undefined,
    notificationStatusPrefs: profile.notification_prefs?.statuses || undefined,
    notificationPrefsFromProfile: !!profile.notification_prefs,
    organizationId: profile.organization_id,
    companyIds: profile.company_ids || undefined,
    socialInstagram: profile.social_instagram || '',
    socialStatus: profile.social_status || '',
    lastSeenAt: profile.last_seen_at || '',
  };
}

export async function loadOrganizationProfiles(organizationId){
  if(!isSupabaseConfigured || !organizationId) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('organization_id', organizationId)
    .order('display_name', { ascending: true });
  if(error) throw error;
  return (data || []).map(profileToPartialAppUser).filter(Boolean);
}

export async function updateProfilePresence(profileId, stamp=isoNow()){
  if(!isSupabaseConfigured || !profileId) return;
  const { error } = await supabase
    .from('profiles')
    .update({ last_seen_at: stamp })
    .eq('id', profileId);
  if(error) throw error;
}

export async function updateProfileSocial(profileId, patch={}){
  if(!isSupabaseConfigured || !profileId) return;
  const payload = {};
  if(Object.prototype.hasOwnProperty.call(patch,'socialInstagram')) payload.social_instagram = String(patch.socialInstagram || '').trim();
  if(Object.prototype.hasOwnProperty.call(patch,'socialStatus')) payload.social_status = String(patch.socialStatus || '').trim().slice(0, 140);
  if(!Object.keys(payload).length) return;
  const { error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', profileId);
  if(error) throw error;
}

export async function updateProfileNotificationPrefs(profileId, prefs={}){
  if(!isSupabaseConfigured || !profileId) return;
  const notification_prefs = {
    events: prefs.notificationPrefs || [],
    statuses: prefs.notificationStatusPrefs || {},
  };
  const { error } = await supabase
    .from('profiles')
    .update({ notification_prefs })
    .eq('id', profileId);
  if(error) throw error;
}
