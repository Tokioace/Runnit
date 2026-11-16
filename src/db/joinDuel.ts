import type { SupabaseClient } from '@supabase/supabase-js';

/** A PostgREST RPC resolves with { error } on failure; it does NOT throw. */
export async function joinDuel(supabase: SupabaseClient, duelId: string) {
  const { data, error } = await supabase.rpc('join_duel', { duel_id: duelId });
  if (error) throw error;
  if (!data || data.id !== duelId || data.status !== 'matched') {
    throw new Error('Join was not confirmed by the database');
  }
  return data;
}
