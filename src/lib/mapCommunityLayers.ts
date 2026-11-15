import type { Map as GLMap, GeoJSONSource } from 'maplibre-gl';
import { ENERGY_ORB_PREFIX, installOnDemandRealEnergyOrbs } from './mapEnergyOrb.ts';

/** Only real open challenges may contribute to the wide-area community count.
 * Demo markers and the viewer's own location are in separate map sources. */
export type CommunityEntry = {
  id: string;
  lat: number;
  lng: number;
  kind: 'race' | 'player' | 'demo-race' | 'demo-player';
  isOwn?: boolean;
};
export type CommunityCoordinate = { lat: number; lng: number };
export const COMMUNITY_REAL_SOURCE = 'runnit-community-real';
export const COMMUNITY_DEMO_SOURCE = 'runnit-community-demo';
export const COMMUNITY_GPS_SOURCE = 'runnit-community-gps';
export const COMMUNITY_CLUSTER_LAYER = 'runnit-community-clusters';
export const COMMUNITY_RACE_DOT_LAYER = 'runnit-community-real-dots';
const COMMUNITY_SINGLE_HALO_LAYER = 'runnit-community-single-glows';
const COMMUNITY_SINGLE_SIGNAL_RING = 'runnit-community-single-signal-ring';
const COMMUNITY_CLUSTER_HALO_LAYER = 'runnit-community-cluster-glows';
const COMMUNITY_DEMO_LAYER = 'runnit-community-demo-dots';
const COMMUNITY_GPS_LAYER = 'runnit-community-gps-dot';
const COMMUNITY_GPS_AURA_LAYER = 'runnit-community-gps-aura';
const valid = (p: CommunityCoordinate) =>
  Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;

export function buildCommunityCollections(entries: readonly CommunityEntry[], gps: CommunityCoordinate | null) {
  const real = new Map<string, CommunityEntry>();
  const demo: CommunityEntry[] = [];
  for (const item of entries) {
    if (!valid(item)) continue;
    if (item.kind === 'demo-race' || item.kind === 'demo-player') demo.push(item);
    else if (item.kind === 'race') {
      // Wide-area "LIVE CHALLENGE" numbers count ONLY confirmed open
      // races, never locally inferred or otherwise unverified players.
      const key = item.kind + ':' + item.id;
      if (!real.has(key) || item.isOwn) real.set(key, item);
    }
  }
  const feature = (item: CommunityEntry) => ({
    type: 'Feature' as const,
    properties: {
      color: item.isOwn ? '#c9ff0b' :
        (item.kind === 'player' || item.kind === 'demo-player' ? '#a985ff' : '#f13edc'),
    },
    geometry: { type: 'Point' as const, coordinates: [item.lng, item.lat] },
  });
  const collection = (items: CommunityEntry[]) => ({
    type: 'FeatureCollection' as const, features: items.map(feature),
  });
  return {
    real: collection([...real.values()]),
    demo: collection(demo),
    gps: collection(gps && valid(gps) ? [{ id: 'viewer', ...gps, kind: 'player' as const }] : []),
  };
}

export function installCommunityLayers(map: GLMap) {
  // Real clusters get the same high-definition energy-orb system as the demo,
  // with on-demand sprites for whatever genuine open-race total appears.
  installOnDemandRealEnergyOrbs(map);
  if (!map.getSource(COMMUNITY_REAL_SOURCE)) {
    map.addSource(COMMUNITY_REAL_SOURCE, {
      type: 'geojson', data: { type: 'FeatureCollection', features: [] },
      cluster: true, clusterMaxZoom: 11, clusterRadius: 52,
    });
  }
  // Even one genuine race should be visible across a region without
  // pretending it represents multiple runners.
  if (!map.getLayer(COMMUNITY_SINGLE_HALO_LAYER)) {
    map.addLayer({
      id: COMMUNITY_SINGLE_HALO_LAYER, type: 'circle', source: COMMUNITY_REAL_SOURCE,
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 21, 4, 29, 7, 43, 10, 36, 12.8, 8],
        'circle-color': ['get', 'color'],
        'circle-blur': 0.82,
        'circle-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.29, 7, 0.5, 10, 0.42, 12.8, 0],
      },
    });
  }
  if (!map.getLayer(COMMUNITY_SINGLE_SIGNAL_RING)) {
    // Exactly one real open race still reads like an active signal, not a
    // fabricated cluster. Ring always shares its genuine coordinates.
    map.addLayer({
      id: COMMUNITY_SINGLE_SIGNAL_RING, type: 'circle', source: COMMUNITY_REAL_SOURCE,
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 11, 5, 16, 8, 20, 12.8, 8],
        'circle-color': '#081e3f',
        'circle-opacity': 0,
        'circle-stroke-color': ['get', 'color'],
        'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 0, 1.3, 8, 2.0, 12.8, 0],
        'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.65, 8, 0.86, 12.8, 0],
      },
    });
  }
  if (!map.getLayer(COMMUNITY_RACE_DOT_LAYER)) {
    map.addLayer({
      id: COMMUNITY_RACE_DOT_LAYER, type: 'circle', source: COMMUNITY_REAL_SOURCE,
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 3.8, 5, 4.7, 9, 5.6, 12.8, 5.5],
        'circle-color': ['get', 'color'],
        'circle-stroke-color': '#122849',
        'circle-stroke-width': 1.6,
        'circle-opacity': ['interpolate', ['linear'], ['zoom'], 12.2, 1, 12.8, 0],
        'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 12.2, 1, 12.8, 0],
      },
    });
  }
  if (!map.getLayer(COMMUNITY_CLUSTER_HALO_LAYER)) {
    map.addLayer({
      id: COMMUNITY_CLUSTER_HALO_LAYER, type: 'circle', source: COMMUNITY_REAL_SOURCE,
      filter: ['has', 'point_count'],
      paint: {
        'circle-radius': ['step', ['get', 'point_count'], 23, 5, 33, 20, 42],
        'circle-color': '#a23af4',
        'circle-blur': 0.86,
        'circle-opacity': ['interpolate', ['linear'], ['zoom'], 0, .08, 10, .16, 12.8, 0],
      },
    });
  }
  if (!map.getLayer(COMMUNITY_CLUSTER_LAYER)) {
    map.addLayer({
      id: COMMUNITY_CLUSTER_LAYER, type: 'symbol', source: COMMUNITY_REAL_SOURCE,
      filter: ['has', 'point_count'],
      layout: {
        // Counts come exclusively from MapLibre's genuine clustered open
        // races, never mocked runners or matches. Sprite IDs are resolved
        // lazily by installOnDemandRealEnergyOrbs().
        'icon-image': ['concat', ENERGY_ORB_PREFIX, '-open-race-',
          ['to-string', ['get', 'point_count']]],
        'icon-size': ['interpolate', ['linear'], ['zoom'],
          0, .61, 6, .73, 10, .84, 12.6, .72],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-anchor': 'center',
        'icon-pitch-alignment': 'viewport',
        'icon-rotation-alignment': 'viewport',
      },
      paint: {
        'icon-opacity': ['interpolate', ['linear'], ['zoom'],
          0, 1, 12.2, 1, 12.8, 0],
      },
    });
  }
  // Demo dots are only local previews and disappear from the country view.
  if (!map.getSource(COMMUNITY_DEMO_SOURCE)) {
    map.addSource(COMMUNITY_DEMO_SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  }
  if (!map.getLayer(COMMUNITY_DEMO_LAYER)) {
    map.addLayer({
      id: COMMUNITY_DEMO_LAYER, type: 'circle', source: COMMUNITY_DEMO_SOURCE,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 1.5, 11, 3, 12.8, 5],
        'circle-color': ['get', 'color'],
        'circle-stroke-color': '#482b6b',
        'circle-stroke-width': 1,
        'circle-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0, 10.5, 0.7, 12.2, 0.7, 12.8, 0],
        'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0, 10.5, 0.7, 12.2, 0.7, 12.8, 0],
      },
    });
  }
  if (!map.getSource(COMMUNITY_GPS_SOURCE)) {
    map.addSource(COMMUNITY_GPS_SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  }
  // GPS is deliberately a DIFFERENT source from real racing activity, so
  // it remains geographically anchored without ever increasing cluster totals.
  // A soft cyan outer aura is narrower than a real race's lime/magenta halo;
  // when an own race and GPS overlap, both rings remain recognizable.
  if (!map.getLayer(COMMUNITY_GPS_AURA_LAYER)) {
    map.addLayer({
      id: COMMUNITY_GPS_AURA_LAYER, type: 'circle', source: COMMUNITY_GPS_SOURCE,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'],
          0, 8, 5, 11, 9, 12, 12.8, 10],
        'circle-color': '#09bfff',
        'circle-blur': 0.7,
        'circle-opacity': ['interpolate', ['linear'], ['zoom'],
          0, 0.27, 12.2, 0.27, 12.8, 0],
      },
    });
  }
  if (!map.getLayer(COMMUNITY_GPS_LAYER)) {
    map.addLayer({
      id: COMMUNITY_GPS_LAYER, type: 'circle', source: COMMUNITY_GPS_SOURCE,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'],
          0, 3.3, 5, 3.8, 9, 4.3, 12.8, 5.0],
        'circle-color': '#237bff',
        'circle-stroke-color': '#adf8ff',
        'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 0, 1.2, 8, 1.6, 12.8, 1.9],
        // Crossfade into the original, geographic HTML GPS marker when
        // zoomed in: no duplicate blue centers at street level.
        'circle-opacity': ['interpolate', ['linear'], ['zoom'], 0, 1, 12.2, 1, 12.8, 0],
        'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 0, 1, 12.2, 1, 12.8, 0],
      },
    });
  }
}

export function syncCommunityLayers(map: GLMap, entries: readonly CommunityEntry[], gps: CommunityCoordinate | null) {
  const collections = buildCommunityCollections(entries, gps);
  (map.getSource(COMMUNITY_REAL_SOURCE) as GeoJSONSource | undefined)?.setData(collections.real);
  (map.getSource(COMMUNITY_DEMO_SOURCE) as GeoJSONSource | undefined)?.setData(collections.demo);
  (map.getSource(COMMUNITY_GPS_SOURCE) as GeoJSONSource | undefined)?.setData(collections.gps);
}
