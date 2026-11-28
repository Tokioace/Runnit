/** Physical hosting radius is the visible 500 m cyan ring, not the 5 km race discovery radius. */
export const HOST_PLACEMENT_RADIUS_METERS = 500;

export type MapPoint = Readonly<{ lat: number; lng: number }>;

export function validMapPoint(value: MapPoint | null | undefined): value is MapPoint {
  return Boolean(value &&
    Number.isFinite(value.lat) && Number.isFinite(value.lng) &&
    Math.abs(value.lat) <= 90 && Math.abs(value.lng) <= 180);
}

/** Invalid GPS coordinates must never produce a usable distance or pass a radius check. */
export function mapDistanceMeters(a: MapPoint, b: MapPoint): number {
  if (!validMapPoint(a) || !validMapPoint(b)) return Infinity;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const v = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(Math.min(1, v)), Math.sqrt(Math.max(0, 1 - v)));
}

export function canHostAt(currentGps: MapPoint | null, requested: MapPoint): boolean {
  return validMapPoint(currentGps) && validMapPoint(requested) &&
    mapDistanceMeters(currentGps, requested) <= HOST_PLACEMENT_RADIUS_METERS;
}
