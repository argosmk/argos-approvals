import { supabase, isSupabaseConfigured } from './supabaseClient';

// Camada temporária para migração segura: permite salvar o estado inteiro em JSONB.
// Depois podemos migrar cada tela para tabelas relacionais sem perder dados.
export async function loadWorkspaceState(organizationId) {
  if (!isSupabaseConfigured) throw new Error('Supabase ainda não configurado.');
  const { data, error } = await supabase
    .from('workspace_state')
    .select('payload')
    .eq('organization_id', organizationId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data?.payload || null;
}

export async function saveWorkspaceState(organizationId, payload) {
  if (!isSupabaseConfigured) throw new Error('Supabase ainda não configurado.');
  const { data, error } = await supabase
    .from('workspace_state')
    .upsert({ organization_id: organizationId, payload, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data;
}
