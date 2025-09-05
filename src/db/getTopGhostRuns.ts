import type { SupabaseClient } from '@supabase/supabase-js';

export async function getTopGhostRuns(supabase: SupabaseClient, city: string) {
  return await supabase
    .from('ghost_runs')
    .select('*')
    .eq('city', city)
    .order('time_ms', { ascending: true })
    .limit(100);
}

