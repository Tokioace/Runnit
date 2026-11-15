/** The map heading follows the *visible map scale*, not the phone GPS city.
 * All titles remain truthful when users pan far from their home location. */
export type MapCameraScope = { zoom: number; lat: number; lng: number };
export type MapHeading = { title: string; subtitle: string };

const validZoom = (zoom: number) => Number.isFinite(zoom) ? zoom : 2;
const centeredOnEurope = (camera: MapCameraScope) =>
  Number.isFinite(camera.lat) && Number.isFinite(camera.lng) &&
  camera.lat >= 35 && camera.lat <= 72 &&
  camera.lng >= -12 && camera.lng <= 43;

export function mapHeadingForCamera(
  camera: MapCameraScope,
  cityName: string | null,
  hasGps: boolean,
  view: 'map' | 'list',
): MapHeading {
  const nearby = {
    title: 'RENNEN IN DEINER NÄHE',
    subtitle: hasGps
      ? cityName || 'GPS-Standort ermittelt'
      : 'Standort für genaue Entfernungen aktivieren',
  };
  // The list is explicitly nearby-only, regardless of how far the map was
  // previously zoomed or panned.
  if (view === 'list') return nearby;
  const zoom = validZoom(camera.zoom);
  if (zoom >= 12.5) return nearby;
  if (zoom >= 8.5) return { title: 'RENNEN IN DER REGION', subtitle: 'Regionale Kartenansicht' };
  if (zoom >= 4.8) return { title: 'COMMUNITY-NETZWERK', subtitle: 'Länderübersicht' };
  if (zoom >= 2.5) {
    return centeredOnEurope(camera)
      ? { title: 'EUROPA · COMMUNITY', subtitle: 'Europaübersicht' }
      : { title: 'COMMUNITY-NETZWERK', subtitle: 'Kontinentübersicht' };
  }
  return { title: 'WELTWEITES NETZWERK', subtitle: 'Weltübersicht' };
}
