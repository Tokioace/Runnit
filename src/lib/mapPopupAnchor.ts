/** A race popup is pinned to the tapped event, NOT the user's GPS fix.
 * MapLibre's coordinate order is [longitude, latitude].
 */
export type PopupEventCoordinate = {
  location: { lat: number; lng: number };
};

export function eventPopupLngLat(event: PopupEventCoordinate): [number, number] {
  const { lat, lng } = event.location;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) ||
      Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new RangeError('Invalid event position');
  }
  return [lng, lat];
}
