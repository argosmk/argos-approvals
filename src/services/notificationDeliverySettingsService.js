import { supabase, isSupabaseConfigured } from './supabaseClient';

export const DEFAULT_NOTIFICATION_DELIVERY_SETTINGS = Object.freeze({
  enabled: true,
  teamDigestMinutes: 30,
  clientApprovalDelayMinutes: 5,
  presenceGraceSeconds: 120,
  rules: [],
});

function normalizeRule(row = {}) {
  return {
    id: row.id || null,
    statusKey: row.status_key || '',
    enabled: row.enabled !== false,
    targets: Array.isArray(row.targets) && row.targets.length ? row.targets : ['client_approvers'],
    firstAfterMinutes: Number.isFinite(row.first_after_minutes) ? row.first_after_minutes : 1440,
    intervalMinutes: Number.isFinite(row.interval_minutes) ? row.interval_minutes : 2880,
  };
}

export async function loadNotificationDeliverySettings(organizationId) {
  if (!organizationId) throw new Error('Organização não informada.');
  if (!isSupabaseConfigured || !supabase) return { ...DEFAULT_NOTIFICATION_DELIVERY_SETTINGS };

  const [{ data: settings, error: settingsError }, { data: rules, error: rulesError }] = await Promise.all([
    supabase
      .from('notification_delivery_settings')
      .select('*')
      .eq('organization_id', organizationId)
      .maybeSingle(),
    supabase
      .from('notification_reminder_rules')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true }),
  ]);

  if (settingsError) throw new Error(`Não foi possível carregar a entrega de notificações: ${settingsError.message}`);
  if (rulesError) throw new Error(`Não foi possível carregar as regras de lembrete: ${rulesError.message}`);

  return {
    enabled: settings?.enabled !== false,
    teamDigestMinutes: Number(settings?.team_digest_minutes ?? 30),
    clientApprovalDelayMinutes: Number(settings?.client_approval_delay_minutes ?? 5),
    presenceGraceSeconds: Number(settings?.presence_grace_seconds ?? 120),
    rules: (rules || []).map(normalizeRule),
  };
}

export async function saveNotificationDeliverySettings(organizationId, settings = {}) {
  if (!organizationId) throw new Error('Organização não informada.');
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase não configurado.');

  const settingsRow = {
    organization_id: organizationId,
    enabled: settings.enabled !== false,
    team_digest_minutes: Math.max(1, parseInt(settings.teamDigestMinutes, 10) || 30),
    client_approval_delay_minutes: Math.max(0, parseInt(settings.clientApprovalDelayMinutes, 10) || 0),
    presence_grace_seconds: Math.max(0, parseInt(settings.presenceGraceSeconds, 10) || 0),
    updated_at: new Date().toISOString(),
  };

  const { error: settingsError } = await supabase
    .from('notification_delivery_settings')
    .upsert(settingsRow, { onConflict: 'organization_id' });
  if (settingsError) throw new Error(`Não foi possível salvar a entrega de notificações: ${settingsError.message}`);

  const normalizedRules = (settings.rules || [])
    .filter(rule => rule?.statusKey)
    .map(rule => ({
      ...(rule.id ? { id: rule.id } : {}),
      organization_id: organizationId,
      status_key: rule.statusKey,
      enabled: rule.enabled !== false,
      targets: Array.isArray(rule.targets) && rule.targets.length ? rule.targets : ['client_approvers'],
      first_after_minutes: Math.max(0, parseInt(rule.firstAfterMinutes, 10) || 0),
      interval_minutes: Math.max(1, parseInt(rule.intervalMinutes, 10) || 1),
      updated_at: new Date().toISOString(),
    }));

  const desiredKeys = normalizedRules.map(rule => rule.status_key);
  let deleteQuery = supabase
    .from('notification_reminder_rules')
    .delete()
    .eq('organization_id', organizationId);
  if (desiredKeys.length) deleteQuery = deleteQuery.not('status_key', 'in', `(${desiredKeys.map(k => `"${String(k).replace(/"/g, '')}"`).join(',')})`);
  const { error: deleteError } = await deleteQuery;
  if (deleteError) throw new Error(`Não foi possível atualizar as regras de lembrete: ${deleteError.message}`);

  if (normalizedRules.length) {
    const { error: rulesError } = await supabase
      .from('notification_reminder_rules')
      .upsert(normalizedRules, { onConflict: 'organization_id,status_key' });
    if (rulesError) throw new Error(`Não foi possível salvar as regras de lembrete: ${rulesError.message}`);
  }

  return loadNotificationDeliverySettings(organizationId);
}
