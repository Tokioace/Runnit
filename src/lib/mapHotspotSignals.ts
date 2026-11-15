import type { ExpressionSpecification, GeoJSONSource, Map as GLMap } from 'maplibre-gl';

/**
 * Read-only visual load test. These coordinates and counts are INVENTED.
 * They never enter Supabase, the real community source or leaderboard.
 * Open races, visible runners and running matches are different signals;
 * matches/runners must not be inferred from the number of open lobbies.
 */
export type HotspotKind = 'open-race' | 'visible-runner' | 'running-match';
export type HotspotTestCity = 'all' | 'backnang' | 'stuttgart' | 'munich';
type HotspotSeed = { city: string; cityId: Exclude<HotspotTestCity, 'all'>; lat: number; lng: number; count: number; kind: HotspotKind };
export const HOTSPOT_TEST_SCENARIOS: readonly HotspotSeed[] = [
  { city: 'Backnang', cityId: 'backnang', lat: 48.946, lng: 9.430, count: 3, kind: 'open-race' },
  { city: 'Stuttgart', cityId: 'stuttgart', lat: 48.776, lng: 9.179, count: 10, kind: 'visible-runner' },
  { city: 'München', cityId: 'munich', lat: 48.137, lng: 11.576, count: 25, kind: 'running-match' },
] as const;

export const HOTSPOT_TEST_SOURCE = 'runnit-hotspot-test-points';
export const HOTSPOT_TEST_CENTERS_SOURCE = 'runnit-hotspot-test-centers';
export const HOTSPOT_TEST_CIRCLES = 'runnit-hotspot-test-circles';
export const HOTSPOT_TEST_LABELS = 'runnit-hotspot-test-labels';
export const REAL_HEAT_LAYER = 'runnit-real-open-activity-heat';

const valid = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

const feature = (lat: number, lng: number, properties: Record<string, string | number>) => ({
  type: 'Feature' as const,
  geometry: { type: 'Point' as const, coordinates: [lng, lat] },
  properties,
});

/** Stable, privacy-safe fake geography for deterministic tests and iPhone previews. */
export function buildHotspotTestData(enabled: boolean) {
  const points = [];
  const centers = [];
  if (enabled) for (const seed of HOTSPOT_TEST_SCENARIOS) {
    if (!valid(seed.lat, seed.lng)) continue;
    centers.push(feature(seed.lat, seed.lng, {
      id: seed.cityId, city: seed.city, count: seed.count, kind: seed.kind,
    }));
    for (let index = 0; index < seed.count; index++) {
      // Golden-angle spread; deterministic, not mock user GPS or real addresses.
      const theta = index * 2.399963229728653;
      const distanceKm = Math.sqrt((index + .5) / seed.count) * (seed.count > 20 ? 2.0 : 1.1);
      const lat = seed.lat + distanceKm * Math.sin(theta) / 111.2;
      const lng = seed.lng + distanceKm * Math.cos(theta) /
        (111.2 * Math.max(.2, Math.cos(seed.lat * Math.PI / 180)));
      points.push(feature(lat, lng, { cityId: seed.cityId, kind: seed.kind, simulated: 1 }));
    }
  }
  return {
    points: { type: 'FeatureCollection' as const, features: points },
    centers: { type: 'FeatureCollection' as const, features: centers },
  };
}

const gradient = (glow: string, mid: string, bright: string): ExpressionSpecification => [
  'interpolate', ['linear'], ['heatmap-density'],
  0, 'rgba(0,0,0,0)',
  .12, 'rgba(0,0,0,0)',
  .32, glow,
  .58, mid,
  .85, bright,
  1, '#fff8dc',
];

export function installRealHotspotHeat(map: GLMap, realSourceId: string, beforeLayerId: string) {
  if (map.getLayer(REAL_HEAT_LAYER)) return;
  // Uses the existing, authenticated and de-duplicated open-race cluster source.
  // point_count is the MapLibre cluster count, not a server-reported match count.
  map.addLayer({
    id: REAL_HEAT_LAYER,
    type: 'heatmap',
    source: realSourceId,
    maxzoom: 13,
    paint: {
      'heatmap-weight': ['interpolate', ['linear'], ['coalesce', ['get', 'point_count'], 1],
        1, .14, 3, .3, 10, .62, 25, 1, 100, 1],
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, .55, 5, .85, 9, 1.1, 12, 1.25],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 25, 4, 34, 8, 50, 11, 57, 12.8, 12],
      'heatmap-color': gradient('rgba(105,26,137,.13)', 'rgba(182,33,178,.48)', 'rgba(249,65,194,.67)'),
      'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 0, .30, 5, .42, 10, .45, 12.8, 0],
    },
  }, beforeLayerId);
}

function addSimulationHeat(map: GLMap, kind: HotspotKind, id: string, glow: string, mid: string, bright: string) {
  if (map.getLayer(id)) return;
  map.addLayer({
    id, type: 'heatmap', source: HOTSPOT_TEST_SOURCE, maxzoom: 13,
    filter: ['==', ['get', 'kind'], kind],
    paint: {
      'heatmap-weight': 1,
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, .7, 5, 1.0, 10, 1.45],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 37, 4, 47, 7, 58, 11, 68, 12.8, 10],
      'heatmap-color': gradient(glow, mid, bright),
      'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 0, .78, 7, .85, 11, .83, 12.8, 0],
    },
  });
}

/** Installed once per MapLibre style. No WebGL overlays or DOM nodes per runner. */
export function installHotspotTestLayers(map: GLMap) {
  if (!map.getSource(HOTSPOT_TEST_SOURCE))
    map.addSource(HOTSPOT_TEST_SOURCE, { type: 'geojson', data: buildHotspotTestData(false).points });
  if (!map.getSource(HOTSPOT_TEST_CENTERS_SOURCE))
    map.addSource(HOTSPOT_TEST_CENTERS_SOURCE, { type: 'geojson', data: buildHotspotTestData(false).centers });

  addSimulationHeat(map, 'open-race', 'runnit-test-open-heat',
    'rgba(155,28,151,.24)', 'rgba(227,51,200,.62)', 'rgba(255,124,219,.95)');
  addSimulationHeat(map, 'visible-runner', 'runnit-test-runner-heat',
    'rgba(64,37,167,.24)', 'rgba(138,74,242,.63)', 'rgba(189,139,255,.95)');
  addSimulationHeat(map, 'running-match', 'runnit-test-running-heat',
    'rgba(167,63,29,.20)', 'rgba(255,136,38,.68)', 'rgba(255,211,82,.97)');

  if (!map.getLayer('runnit-test-hub-aura'))
    map.addLayer({
      id: 'runnit-test-hub-aura', type: 'circle', source: HOTSPOT_TEST_CENTERS_SOURCE,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 27, 5, 38, 10, 48, 12.8, 12],
        'circle-color': ['match', ['get','kind'],
          'open-race', '#f33edb', 'visible-runner', '#9d6cfb', 'running-match', '#ffb73d', '#36e8ff'],
        'circle-opacity': ['interpolate', ['linear'], ['zoom'], 0, .12, 8, .17, 12.8, 0],
        'circle-blur': .76,
      },
    });
  if (!map.getLayer(HOTSPOT_TEST_CIRCLES))
    map.addLayer({
      id: HOTSPOT_TEST_CIRCLES, type: 'circle', source: HOTSPOT_TEST_CENTERS_SOURCE,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 15, 6, 19, 11, 23, 12.8, 3],
        'circle-color': '#131d45',
        'circle-stroke-color': ['match', ['get','kind'],
          'open-race', '#ff61df', 'visible-runner', '#ad88ff', 'running-match', '#ffd15e', '#39e6ff'],
        'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 0, 2, 8, 2.5, 12.8, 0],
        'circle-opacity': ['interpolate', ['linear'], ['zoom'], 0, .93, 12.2, .93, 12.8, 0],
        'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 0, 1, 12.2, 1, 12.8, 0],
      },
    });
  if (!map.getLayer(HOTSPOT_TEST_LABELS))
    map.addLayer({
      id: HOTSPOT_TEST_LABELS, type: 'symbol', source: HOTSPOT_TEST_CENTERS_SOURCE,
      layout: {
        'text-field': ['concat', ['to-string', ['get','count']], '\n', ['get','city']],
        'text-size': ['interpolate', ['linear'], ['zoom'], 0, 10, 6, 12, 10, 13],
        'text-offset': [0, 1.6], 'text-anchor': 'top', 'text-allow-overlap': true,
      },
      paint: {
        'text-color': '#f7fbff', 'text-halo-color': '#091c3b', 'text-halo-width': 2,
        'text-opacity': ['interpolate', ['linear'], ['zoom'], 0, 1, 11.4, 1, 12.8, 0],
      },
    });
}

export function syncHotspotTestLayers(map: GLMap, enabled: boolean) {
  const data = buildHotspotTestData(enabled);
  (map.getSource(HOTSPOT_TEST_SOURCE) as GeoJSONSource | undefined)?.setData(data.points);
  (map.getSource(HOTSPOT_TEST_CENTERS_SOURCE) as GeoJSONSource | undefined)?.setData(data.centers);
}
