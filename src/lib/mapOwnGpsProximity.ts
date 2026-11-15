import { mapDistanceMeters, validMapPoint, type MapPoint } from './mapHostPlacement.ts';

/**
 * The tiny blue satellite is a proximity INDICATOR, not a second GPS pin
 * moved to the event. The actual GPS feature and its coordinates stay intact.
 * Only sufficiently precise and recent browser geolocation fixes qualify.
 */
export type ViewerGpsFix = MapPoint & {
  accuracyMeters?: number;
  sampledAtMs?: number;
};
export type OwnRacePoint = MapPoint & { id: string; isOwn?: boolean };

export const OWN_GPS_BADGE_RADIUS_METERS = 30;
export const OWN_GPS_MAX_ACCURACY_METERS = 60;
export const OWN_GPS_MAX_FIX_AGE_MS = 30_000;

export function closestOwnRaceForGps(
  gps: ViewerGpsFix | null,
  races: readonly OwnRacePoint[],
  nowMs = Date.now(),
): string | null {
  if (!validMapPoint(gps) ||
      !Number.isFinite(gps.accuracyMeters) ||
      (gps.accuracyMeters ?? 0) <= 0 ||
      (gps.accuracyMeters ?? Infinity) > OWN_GPS_MAX_ACCURACY_METERS ||
      !Number.isFinite(gps.sampledAtMs) ||
      (gps.sampledAtMs ?? Infinity) > nowMs + 5_000 ||
      nowMs - (gps.sampledAtMs ?? 0) > OWN_GPS_MAX_FIX_AGE_MS) return null;

  let candidate: string | null = null;
  let nearest = OWN_GPS_BADGE_RADIUS_METERS;
  for (const race of races) {
    if (!race.isOwn || !validMapPoint(race)) continue;
    const distance = mapDistanceMeters(gps, race);
    if (distance <= nearest) {
      nearest = distance;
      candidate = race.id;
    }
  }
  return candidate;
}
