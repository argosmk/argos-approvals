import { supabase, isSupabaseConfigured } from './supabaseClient';

// Estado legado em JSONB com proteção contra sobrescrita concorrente.
// A migração futura para tabelas relacionais pode reaproveitar essas funções como ponte segura.
export async function loadWorkspaceRecord(organizationId) {
  if (!isSupabaseConfigured) throw new Error('Supabase ainda não configurado.');
  const { data, error } = await supabase
    .from('workspace_state')
    .select('payload, updated_at')
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (error) throw error;
  return {
    payload: data?.payload || null,
    updatedAt: data?.updated_at || null,
  };
}

export async function loadWorkspaceState(organizationId) {
  const record = await loadWorkspaceRecord(organizationId);
  return record.payload;
}

export async function saveWorkspaceState(organizationId, payload, expectedUpdatedAt) {
  if (!isSupabaseConfigured) throw new Error('Supabase ainda não configurado.');
  const nextUpdatedAt = new Date().toISOString();

  // Sem versão esperada: cria/atualiza. Usado apenas no bootstrap.
  if (!expectedUpdatedAt) {
    const { data, error } = await supabase
      .from('workspace_state')
      .upsert({ organization_id: organizationId, payload, updated_at: nextUpdatedAt }, { onConflict: 'organization_id' })
      .select('payload, updated_at')
      .single();
    if (error) throw error;
    return { payload: data?.payload || payload, updatedAt: data?.updated_at || nextUpdatedAt, conflict: false };
  }

  // Proteção otimista: só salva se ninguém alterou o workspace desde que carregamos/salvamos.
  const { data, error } = await supabase
    .from('workspace_state')
    .update({ payload, updated_at: nextUpdatedAt })
    .eq('organization_id', organizationId)
    .eq('updated_at', expectedUpdatedAt)
    .select('payload, updated_at')
    .maybeSingle();

  if (error) throw error;
  if (!data) return { conflict: true };
  return { payload: data?.payload || payload, updatedAt: data?.updated_at || nextUpdatedAt, conflict: false };
}
