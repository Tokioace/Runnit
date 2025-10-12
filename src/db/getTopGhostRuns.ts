import type { SupabaseClient } from '@supabase/supabase-js';

// Uses security-definer RPC that returns username and optional coordinates
export async function getTopGhostRuns(supabase: SupabaseClient, city: string, limitCount: number = 100) {
  return await supabase.rpc('get_top_ghost_runs', { city_name: city, limit_count: limitCount });
}

