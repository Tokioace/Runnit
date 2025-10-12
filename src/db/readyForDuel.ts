import type { SupabaseClient } from '@supabase/supabase-js';

export async function readyForDuel(supabase: SupabaseClient, duelId: string) {
  return await supabase.rpc('ready_for_duel', { p_duel_id: duelId });
}
