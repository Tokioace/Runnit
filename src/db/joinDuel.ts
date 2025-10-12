import type { SupabaseClient } from '@supabase/supabase-js';

export async function joinDuel(supabase: SupabaseClient, duelId: string) {
  return await supabase.rpc('join_duel', { duel_id: duelId });
}
