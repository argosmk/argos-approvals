import { supabase, isSupabaseConfigured } from './supabaseClient';

export async function uploadImage(bucket, path, file) {
  if (!isSupabaseConfigured) throw new Error('Supabase ainda não configurado.');
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
