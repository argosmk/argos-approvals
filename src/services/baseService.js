import { supabase, isSupabaseConfigured } from './supabaseClient';

function ensure() {
  if (!isSupabaseConfigured) throw new Error('Supabase ainda não configurado.');
}

export async function listRows(table, select = '*', order = 'created_at') {
  ensure();
  let query = supabase.from(table).select(select);
  if (order) query = query.order(order, { ascending: false });
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getRow(table, id, select = '*') {
  ensure();
  const { data, error } = await supabase.from(table).select(select).eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function upsertRow(table, payload) {
  ensure();
  const { data, error } = await supabase.from(table).upsert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateRow(table, id, patch) {
  ensure();
  const { data, error } = await supabase.from(table).update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function softDeleteRow(table, id) {
  return updateRow(table, id, { active: false });
}
