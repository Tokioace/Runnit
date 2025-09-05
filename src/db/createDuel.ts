import type { SupabaseClient } from '@supabase/supabase-js';

type CreateDuelParams = {
  location: { type?: 'Point'; coordinates: [number, number] } | any;
  distanceKm: number;
};

export async function createDuel(supabase: SupabaseClient, { location, distanceKm }: CreateDuelParams) {
  return await supabase.from('duels').insert({
    location,
    max_distance_km: distanceKm,
    status: 'open',
  });
}

