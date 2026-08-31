import { supabase, isSupabaseConfigured } from './supabaseClient';

const SETTINGS_TABLE = 'approval_reminder_settings';

const DEFAULTS = Object.freeze({
  enabled: true,
  statusKeys: ['aprovacao'],
  firstDayAfter: 1,
  intervalDays: 2,
});

export async function loadApprovalReminderSettings(organizationId) {
  if (!organizationId) throw new Error('Organização não informada.');
  if (!isSupabaseConfigured || !supabase) return { ...DEFAULTS };

  const { data, error } = await supabase
    .from(SETTINGS_TABLE)
    .select('*')
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) throw new Error(`Não foi possível carregar as configurações de notificação: ${error.message}`);
  if (!data) return { ...DEFAULTS };

  return {
    enabled: data.enabled !== false,
    statusKeys: Array.isArray(data.status_keys) && data.status_keys.length ? data.status_keys : DEFAULTS.statusKeys,
    firstDayAfter: Number.isFinite(data.first_day_after) ? data.first_day_after : DEFAULTS.firstDayAfter,
    intervalDays: Number.isFinite(data.interval_days) ? data.interval_days : DEFAULTS.intervalDays,
  };
}

export async function saveApprovalReminderSettings(organizationId, settings = {}) {
  if (!organizationId) throw new Error('Organização não informada.');
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase não configurado.');

  const statusKeys = Array.isArray(settings.statusKeys) ? settings.statusKeys.filter(Boolean) : [];
  const row = {
    organization_id: organizationId,
    enabled: settings.enabled !== false,
    status_keys: statusKeys.length ? statusKeys : DEFAULTS.statusKeys,
    first_day_after: Math.max(0, parseInt(settings.firstDayAfter, 10) || DEFAULTS.firstDayAfter),
    interval_days: Math.max(1, parseInt(settings.intervalDays, 10) || DEFAULTS.intervalDays),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from(SETTINGS_TABLE)
    .upsert(row, { onConflict: 'organization_id' })
    .select('*')
    .single();

  if (error) throw new Error(`Não foi possível salvar as configurações de notificação: ${error.message}`);

  return {
    enabled: data.enabled !== false,
    statusKeys: Array.isArray(data.status_keys) && data.status_keys.length ? data.status_keys : DEFAULTS.statusKeys,
    firstDayAfter: Number.isFinite(data.first_day_after) ? data.first_day_after : DEFAULTS.firstDayAfter,
    intervalDays: Number.isFinite(data.interval_days) ? data.interval_days : DEFAULTS.intervalDays,
  };
}
