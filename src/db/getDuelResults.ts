import type { SupabaseClient } from '@supabase/supabase-js';

export async function getDuelResults(supabase: SupabaseClient, duelId: string) {
  return await supabase.rpc('get_duel_results', { p_duel_id: duelId });
}
