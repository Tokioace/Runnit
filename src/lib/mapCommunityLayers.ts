import type { Map as GLMap, GeoJSONSource } from 'maplibre-gl';

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
const COMMUNITY_COUNT_LAYER = 'runnit-community-cluster-counts';
const COMMUNITY_RACE_DOT_LAYER = 'runnit-community-real-dots';
const COMMUNITY_DEMO_LAYER = 'runnit-community-demo-dots';
const COMMUNITY_GPS_LAYER = 'runnit-community-gps-dot';
const valid = (p: CommunityCoordinate) =>
  Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;

export function buildCommunityCollections(entries: readonly CommunityEntry[], gps: CommunityCoordinate | null) {
  const real = new Map<string, CommunityEntry>();
  const demo: CommunityEntry[] = [];
  for (const item of entries) {
    if (!valid(item)) continue;
    if (item.kind === 'demo-race' || item.kind === 'demo-player') demo.push(item);
    else real.set(item.kind + ':' + item.id, item);
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
  if (!map.getSource(COMMUNITY_REAL_SOURCE)) {
    map.addSource(COMMUNITY_REAL_SOURCE, {
      type: 'geojson', data: { type: 'FeatureCollection', features: [] },
      cluster: true, clusterMaxZoom: 11, clusterRadius: 52,
    });
  }
  if (!map.getLayer(COMMUNITY_RACE_DOT_LAYER)) {
    map.addLayer({
      id: COMMUNITY_RACE_DOT_LAYER, type: 'circle', source: COMMUNITY_REAL_SOURCE,
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 2.5, 5, 3.4, 9, 4.2, 12.8, 5.5],
        'circle-color': ['get', 'color'],
        'circle-stroke-color': '#122849',
        'circle-stroke-width': 1.1,
        'circle-opacity': ['interpolate', ['linear'], ['zoom'], 12.2, 1, 12.8, 0],
        'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 12.2, 1, 12.8, 0],
      },
    });
  }
  if (!map.getLayer(COMMUNITY_CLUSTER_LAYER)) {
    map.addLayer({
      id: COMMUNITY_CLUSTER_LAYER, type: 'circle', source: COMMUNITY_REAL_SOURCE,
      filter: ['has', 'point_count'],
      paint: {
        'circle-radius': ['step', ['get', 'point_count'], 16, 5, 22, 20, 28],
        'circle-color': ['step', ['get', 'point_count'], '#3d2d9f', 5, '#7530b5', 20, '#b22c8c'],
        'circle-stroke-color': '#56ebff',
        'circle-stroke-width': 2.4,
        'circle-blur': 0.06,
        'circle-opacity': ['interpolate', ['linear'], ['zoom'], 12.2, 1, 12.8, 0],
        'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 12.2, 1, 12.8, 0],
      },
    });
    map.addLayer({
      id: COMMUNITY_COUNT_LAYER, type: 'symbol', source: COMMUNITY_REAL_SOURCE,
      filter: ['has', 'point_count'],
      layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 13, 'text-allow-overlap': true },
      paint: {
        'text-color': '#faffff',
        'text-halo-color': '#1b1245',
        'text-halo-width': 1,
        'text-opacity': ['interpolate', ['linear'], ['zoom'], 12.2, 1, 12.8, 0],
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
  if (!map.getLayer(COMMUNITY_GPS_LAYER)) {
    map.addLayer({
      id: COMMUNITY_GPS_LAYER, type: 'circle', source: COMMUNITY_GPS_SOURCE,
      paint: {
        'circle-radius': 4,
        'circle-color': '#19e7ff',
        'circle-stroke-color': '#e1ffff',
        'circle-stroke-width': 1.3,
        'circle-opacity': ['interpolate', ['linear'], ['zoom'], 12.2, 1, 12.8, 0],
        'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 12.2, 1, 12.8, 0],
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
