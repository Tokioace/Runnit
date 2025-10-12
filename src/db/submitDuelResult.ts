import type { SupabaseClient } from '@supabase/supabase-js';

export type DuelMetrics = {
  stepsCount?: number;
  stepLengthAvgM?: number;
  maxSpeedMps?: number;
  maxAccelMps2?: number;
  distanceM?: number;
  metricsJson?: unknown;
};

export async function submitDuelResult(
  supabase: SupabaseClient,
  duelId: string,
  timeMs: number,
  metrics?: DuelMetrics
) {
  return await supabase.rpc('submit_duel_result', {
    p_duel_id: duelId,
    p_time_ms: Math.round(timeMs),
    p_steps_count: metrics?.stepsCount ?? null,
    p_step_length_m_avg: metrics?.stepLengthAvgM ?? null,
    p_max_speed_mps: metrics?.maxSpeedMps ?? null,
    p_max_accel_mps2: metrics?.maxAccelMps2 ?? null,
    p_distance_m: metrics?.distanceM ?? null,
    p_metrics_json: metrics?.metricsJson ?? null,
  });
}
