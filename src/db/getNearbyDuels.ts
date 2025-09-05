import type { SupabaseClient } from '@supabase/supabase-js';

type GetNearbyParams = {
  userLocation: { lat: number; lng: number };
  radiusKm: number;
};

export async function getNearbyDuels(supabase: SupabaseClient, { userLocation, radiusKm }: GetNearbyParams) {
  return await supabase.rpc('get_duels_nearby', {
    lat: userLocation.lat,
    lng: userLocation.lng,
    radius_km: radiusKm,
  });
}

