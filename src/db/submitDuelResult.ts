import type { SupabaseClient } from '@supabase/supabase-js';

export async function submitDuelResult(supabase: SupabaseClient, duelId: string, timeMs: number) {
  return await supabase.rpc('submit_duel_result', { p_duel_id: duelId, p_time_ms: Math.round(timeMs) });
}
