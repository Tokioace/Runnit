import {
  HOST_PLACEMENT_RADIUS_METERS,
  mapDistanceMeters,
  validMapPoint,
  type MapPoint,
} from './mapHostPlacement.ts';

/**
 * A cyan accessory on the event is not a second GPS pin or a claim that the
 * viewer's exact coordinates equal the race coordinates. It signals one of
 * two *honest* levels of GPS proximity, derived only on the viewer's device.
 */
export type ViewerGpsFix = MapPoint & {
  accuracyMeters?: number;
  sampledAtMs?: number;
};
export type OwnRacePoint = MapPoint & { id: string; isOwn?: boolean };
export type OwnGpsBadge = {
  raceId: string;
  state: 'at-event' | 'in-radius';
  distanceMeters: number;
};

export const OWN_GPS_BADGE_RADIUS_METERS = 30;
export const OWN_GPS_MAX_ACCURACY_METERS = 60;
export const OWN_GPS_MAX_FIX_AGE_MS = 30_000;
export const OWN_GPS_RADIUS_MAX_ACCURACY_METERS = 150;
export const OWN_GPS_RADIUS_MAX_FIX_AGE_MS = 120_000;

/**
 * With typical iPhone GPS drift or an event placed inside the permitted
 * hosting area (rather than at the exact phone coordinate), a strict 30 m
 * indicator may never appear. Show a distinct *hollow* satellite while
 * within the true 500 m hosting radius, but reserve the filled dot for an
 * accurate, fresh fix within 30 m.
 */
export function nearestOwnGpsBadge(
  gps: ViewerGpsFix | null,
  races: readonly OwnRacePoint[],
  nowMs = Date.now(),
): OwnGpsBadge | null {
  if (!validMapPoint(gps) ||
      !Number.isFinite(gps.accuracyMeters) ||
      (gps.accuracyMeters ?? 0) <= 0 ||
      (gps.accuracyMeters ?? Infinity) > OWN_GPS_RADIUS_MAX_ACCURACY_METERS ||
      !Number.isFinite(gps.sampledAtMs) ||
      (gps.sampledAtMs ?? Infinity) > nowMs + 5_000 ||
      nowMs - (gps.sampledAtMs ?? 0) > OWN_GPS_RADIUS_MAX_FIX_AGE_MS) return null;

  let nearest = HOST_PLACEMENT_RADIUS_METERS;
  let candidate: OwnGpsBadge | null = null;
  const age = nowMs - (gps.sampledAtMs ?? 0);
  for (const race of races) {
    if (!race.isOwn || !validMapPoint(race)) continue;
    const distance = mapDistanceMeters(gps, race);
    if (distance > nearest) continue;
    const direct = distance <= OWN_GPS_BADGE_RADIUS_METERS &&
      (gps.accuracyMeters ?? Infinity) <= OWN_GPS_MAX_ACCURACY_METERS &&
      age <= OWN_GPS_MAX_FIX_AGE_MS;
    nearest = distance;
    candidate = {
      raceId: race.id,
      state: direct ? 'at-event' : 'in-radius',
      distanceMeters: distance,
    };
  }
  return candidate;
}

/** Backwards-compatible strict near-event query used by existing tests. */
export function closestOwnRaceForGps(
  gps: ViewerGpsFix | null,
  races: readonly OwnRacePoint[],
  nowMs = Date.now(),
): string | null {
  const badge = nearestOwnGpsBadge(gps, races, nowMs);
  return badge?.state === 'at-event' ? badge.raceId : null;
}
