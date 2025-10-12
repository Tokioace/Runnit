import type { SupabaseClient } from '@supabase/supabase-js';

type CreateDuelParams = {
  hostUserId: string;
  location: { type?: 'Point'; coordinates: [number, number] } | any;
  distanceKm: number;
  targetDistanceM?: number;
};

export async function createDuel(
  supabase: SupabaseClient,
  { hostUserId, location, distanceKm, targetDistanceM }: CreateDuelParams
) {
  const integerDistanceKm = Math.max(1, Math.round(distanceKm));
  return await supabase.from('duels').insert({
    host_user_id: hostUserId,
    location,
    max_distance_km: integerDistanceKm,
    target_distance_m: Math.max(1, Math.round(targetDistanceM ?? distanceKm * 1000) || 100),
    status: 'open',
  });
}

