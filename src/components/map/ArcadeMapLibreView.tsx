import { useEffect, useMemo, useRef, useState } from 'react';
import { Map as GLMap, Marker, Popup, setWorkerUrl } from 'maplibre-gl';
import type { GeoJSONSource } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { ArcadeMapEntry, ArcadeMapView } from './ArcadeMapChrome';
import { eventPopupLngLat } from '../../lib/mapPopupAnchor';
import { canHostAt, HOST_PLACEMENT_RADIUS_METERS, mapDistanceMeters, validMapPoint } from '../../lib/mapHostPlacement';
import { markerInViewport } from '../../lib/mapMarkerVisibility';
import { openEventClockLabel, openEventMsLeft } from '../../lib/duelExpiry.ts';
import type { MapCameraScope } from '../../lib/mapHeadingScope';
import { groupOverlappingRuns } from '../../lib/mapRunGrouping';
import { markerPinOpacityAtZoom, markerScaleAtZoom, PIN_FADE_END_ZOOM } from '../../lib/mapMarkerZoom';
import { COMMUNITY_CLUSTER_LAYER, COMMUNITY_RACE_DOT_LAYER, COMMUNITY_SINGLE_SIGNAL_RING, COMMUNITY_REAL_SOURCE, installCommunityLayers, syncCommunityLayers, type CommunityEntry } from '../../lib/mapCommunityLayers';
import { HOTSPOT_TEST_CENTERS_SOURCE, HOTSPOT_TEST_CIRCLES, HOTSPOT_TEST_SCENARIOS, installRealHotspotHeat, installHotspotTestLayers, syncHotspotTestLayers, type HotspotTestCity } from '../../lib/mapHotspotSignals';

// Required by MapLibre v6 and Vite 8: ship the real same-origin WebGL worker.
// Without ?worker&url, production may show a blank map without a build failure.
setWorkerUrl(workerUrl);

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const BUILDING_TILES = 'https://tiles.openfreemap.org/planet';
const RADAR_ID = 'runnit-gps-radar';
const BUILDING_LAYER_ID = 'runnit-3d-buildings';
const COUNTRY_GLOW_LAYER_ID = 'runnit-country-boundary-glow';
const PITCH_DEGREES = 46;
const BEARING_DEGREES = -13;

export type MapCoordinate = { lat: number; lng: number; accuracyMeters?: number; sampledAtMs?: number };
export type ArcadeVectorRun = ArcadeMapEntry & { location: MapCoordinate };
export type ArcadeVectorPlayer = {
  id: string;
  location: MapCoordinate;
  colorHex: string;
  source: string;
};

export type ArcadeMapLibreProps = {
  initialCenter: MapCoordinate;
  initialZoom: number;
  userCoords: MapCoordinate | null;
  ipCoords: MapCoordinate | null;
  recenterTick: number;
  retryTick: number;
  view: ArcadeMapView;
  players: readonly ArcadeVectorPlayer[];
  runs: readonly ArcadeVectorRun[];
  hostDialogOpen: boolean;
  hostLocation: MapCoordinate | null;
  regionalRuns: readonly { id: string; location: MapCoordinate; expiresAt?: string }[];
  hotspotDemoEnabled: boolean;
  hotspotFocus: { city: HotspotTestCity; tick: number };
  onWideViewChange: (wide: boolean) => void;
  onCameraChange: (camera: MapCameraScope) => void;
  onSelectRun: (id: string) => void;
  onJoinRun: (id: string) => void;
  onCancelRun: (id: string) => void;
  onRunExpired: (id: string) => void;
  onOpenRunGroup: () => void;
  onGhostClick: () => void;
  onHostAt: (position: MapCoordinate) => void;
  onInvalidHostAt: (message: string) => void;
  onTilesLoaded: () => void;
  onTilesError: () => void;
};

const finiteCoords = (pos: MapCoordinate): boolean =>
  Number.isFinite(pos.lat) && Number.isFinite(pos.lng) &&
  Math.abs(pos.lat) <= 90 && Math.abs(pos.lng) <= 180;

function radarPolygon(center: MapCoordinate, radiusMeters = 500) {
  const latRad = center.lat * Math.PI / 180;
  const latScale = radiusMeters / 111_320;
  const lngScale = radiusMeters / (111_320 * Math.max(0.12, Math.cos(latRad)));
  const positions = Array.from({ length: 97 }, (_, index) => {
    const theta = 2 * Math.PI * index / 96;
    return [center.lng + Math.cos(theta) * lngScale, center.lat + Math.sin(theta) * latScale];
  });
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'Polygon' as const, coordinates: [positions] },
  };
}

/** Make bright blue-gray streets and visible extruded blocks, not a black raster. */
function styleArcadeMap(map: GLMap) {
  for (const layer of map.getStyle().layers ?? []) {
    const name = layer.id.toLowerCase();
    try {
      if (layer.type === 'raster' && name === 'natural_earth') {
        // Default hillshading gives low-zoom land large grey patches. Preserve
        // subtle relief while giving the network map its dark arcade contrast.
        map.setPaintProperty(layer.id, 'raster-opacity',
          ['interpolate', ['linear'], ['zoom'], 0, 0.035, 3, 0.03, 6, 0.01, 7, 0]);
      } else if (layer.type === 'line' && name === 'boundary_2') {
        // The OpenFreeMap Liberty country-border layer (admin_level=2).
        map.setPaintProperty(layer.id, 'line-color', '#27e9ff');
        map.setPaintProperty(layer.id, 'line-width',
          ['interpolate', ['linear'], ['zoom'], 0, 0.65, 2, 0.9, 4, 1.25, 7, 1.65, 10, 1.15, 14, 0.7]);
        map.setPaintProperty(layer.id, 'line-opacity',
          ['interpolate', ['linear'], ['zoom'], 0, 0.34, 2, 0.48, 4, 0.66, 7, 0.88, 10, 0.70, 14, 0.33]);
      } else if (layer.type === 'line' && name === 'boundary_3') {
        // Internal states are much quieter so countries remain the hierarchy.
        map.setPaintProperty(layer.id, 'line-color', '#3d8caa');
        map.setPaintProperty(layer.id, 'line-opacity',
          ['interpolate', ['linear'], ['zoom'], 4, 0.13, 9, 0.25, 13, 0.13]);
        map.setPaintProperty(layer.id, 'line-width', 0.85);
      } else if (layer.type === 'line' && name === 'boundary_disputed') {
        // Preserve the style's dashed disputed-boundary semantics.
        map.setPaintProperty(layer.id, 'line-color', '#3aa9c2');
        map.setPaintProperty(layer.id, 'line-opacity', 0.55);
      } else if (layer.type === 'line' && name === 'park_outline') {
        // The bright mint/green perimeter seen around woodland park polygons
        // is not a country border. Lower its intensity rather than highlighting it.
        map.setPaintProperty(layer.id, 'line-color', '#285668');
        map.setPaintProperty(layer.id, 'line-opacity',
          ['interpolate', ['linear'], ['zoom'], 3, 0, 8, 0.02, 11, 0.10, 15, 0.29]);
        map.setPaintProperty(layer.id, 'line-width', 0.75);
      } else if (layer.type === 'fill' && name === 'park') {
        map.setPaintProperty(layer.id, 'fill-color', '#153544');
        map.setPaintProperty(layer.id, 'fill-outline-color', '#285665');
        map.setPaintProperty(layer.id, 'fill-opacity',
          ['interpolate', ['linear'], ['zoom'], 3, 0.012, 7, 0.04, 10, 0.15, 15, 0.56]);
      } else if (layer.type === 'fill' && name.startsWith('landcover_')) {
        const ice = name.includes('ice');
        const sand = name.includes('sand');
        const wetland = name.includes('wetland');
        // Unify forest/grass/sand/wetland/ice silhouettes at far zoom.
        // At street zoom retain subtle landscape differentiation.
        if (wetland) map.setPaintProperty(layer.id, 'fill-pattern', null);
        map.setPaintProperty(layer.id, 'fill-color',
          ['interpolate', ['linear'], ['zoom'],
            2, ice ? '#254252' : '#0b2439',
            9, ice ? '#354f62' : '#133449',
            14, ice ? '#517283' : sand ? '#30485a' : wetland ? '#17384b' : '#163746']);
        map.setPaintProperty(layer.id, 'fill-opacity',
          ['interpolate', ['linear'], ['zoom'], 2, ice ? 0.08 : 0.018, 7, 0.045, 10, 0.15, 14, 0.53]);
      } else if (layer.type === 'fill' && name.startsWith('landuse_')) {
        // Residential/industrial and amenities used to remain pale grey;
        // quiet them down without hiding streets or actual buildings.
        const residential = name === 'landuse_residential';
        map.setPaintProperty(layer.id, 'fill-color', ['interpolate', ['linear'], ['zoom'],
            2, '#0c273d', 9, residential ? '#143348' : '#17394b',
            14, residential ? '#183b50' : '#214355']);
        map.setPaintProperty(layer.id, 'fill-opacity',
          ['interpolate', ['linear'], ['zoom'], 3, 0.012, 7, 0.045, 10, 0.14, 14, 0.56]);
      } else if (layer.type === 'background') {
        map.setPaintProperty(layer.id, 'background-color',
          ['interpolate', ['linear'], ['zoom'],
            0, '#1c3e53', 2, '#1b3b51', 4, '#1b3c50',
            7, '#18394e', 10, '#17364c', 13, '#10243d']);
      } else if (layer.type === 'fill' && /building/.test(name)) {
        map.setPaintProperty(layer.id, 'fill-color', '#3d5c77');
        map.setPaintProperty(layer.id, 'fill-opacity', 0.94);
      } else if (layer.type === 'line' && /road|street|highway|transportation/.test(name)) {
        const main = /motorway|trunk|primary|main/.test(name);
        map.setPaintProperty(layer.id, 'line-color', main
          ? ['interpolate', ['linear'], ['zoom'], 3, '#355676', 8, '#567f9f', 12, '#85b8d5', 16, '#b9d8e9']
          : ['interpolate', ['linear'], ['zoom'], 3, '#29435e', 8, '#416b86', 12, '#608caa', 16, '#779bb9']);
        map.setPaintProperty(layer.id, 'line-opacity',
          main ? ['interpolate', ['linear'], ['zoom'], 3, 0.20, 6, 0.38, 9, 0.68, 12, 0.94, 16, 1]
            : ['interpolate', ['linear'], ['zoom'], 3, 0.06, 6, 0.12, 9, 0.35, 12, 0.82, 16, 0.96]);
      } else if (layer.type === 'fill' && name === 'water') {
        // The Liberty/OpenMapTiles water POLYGON covers seas, lakes and coastlines.
        // Use its polygon edge, rather than inventing a water LineString layer.
        // On world/Europe zoom, water must be substantially darker than land.
        map.setPaintProperty(layer.id, 'fill-color',
          ['interpolate', ['linear'], ['zoom'],
            0, '#05101f', 2, '#061425', 4, '#071728',
            7, '#0a2033', 10, '#0e2940', 13, '#123852']);
        map.setPaintProperty(layer.id, 'fill-outline-color',
          ['interpolate', ['linear'], ['zoom'],
            0, 'rgba(104,213,245,0.56)',
            3, 'rgba(112,226,250,0.72)',
            5, 'rgba(113,232,254,0.78)',
            8, 'rgba(80,205,238,0.42)',
            11, 'rgba(80,205,238,0.08)',
            13, 'rgba(80,205,238,0)']);
      } else if (layer.type === 'fill' && /water/.test(name)) {
        map.setPaintProperty(layer.id, 'fill-color',
          ['interpolate', ['linear'], ['zoom'], 2, '#061425', 8, '#0a2033', 13, '#123852']);
      } else if (layer.type === 'fill' && /park|wood|forest|landcover|grass/.test(name)) {
        map.setPaintProperty(layer.id, 'fill-color',
          ['interpolate', ['linear'], ['zoom'], 2, '#102b39', 8, '#113743', 13, '#193b49']);
      } else if (layer.type === 'symbol' && /label|place|road/.test(name)) {
        map.setPaintProperty(layer.id, 'text-color', '#bed6e9');
        map.setPaintProperty(layer.id, 'text-halo-color', '#081a30');
        map.setPaintProperty(layer.id, 'text-halo-width', 1.4);
      }
    } catch {
      // Optional style layers can have data-driven paint; never break base-map load.
    }
  }
  // Backlit cyan national borders reuse OpenFreeMap's actual boundary data,
  // never hand-drawn approximations or fictional geometry. The verified
  // Liberty style provides openmaptiles/boundary and boundary_2.
  if (map.getSource('openmaptiles') && map.getLayer('boundary_2') &&
      !map.getLayer(COUNTRY_GLOW_LAYER_ID)) {
    map.addLayer({
      id: COUNTRY_GLOW_LAYER_ID,
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'boundary',
      filter: ['all',
        ['==', ['get', 'admin_level'], 2],
        ['!=', ['get', 'maritime'], 1],
        ['!=', ['get', 'disputed'], 1],
        ['!', ['has', 'claimed_by']],
      ],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#17d5ff',
        'line-width': ['interpolate', ['linear'], ['zoom'],
          1, 1.5, 3, 2.5, 5, 4, 8, 4.2, 12, 2],
        'line-opacity': ['interpolate', ['linear'], ['zoom'],
          1, 0.055, 3, 0.095, 5, 0.17, 8, 0.20, 12, 0.035],
        'line-blur': 2.4,
      },
    }, 'boundary_2');
  }
  if (!map.getSource('runnit-buildings-source')) {
    map.addSource('runnit-buildings-source', { type: 'vector', url: BUILDING_TILES });
  }
  if (!map.getLayer(BUILDING_LAYER_ID)) {
    const firstLabelId = map.getStyle().layers?.find((layer) => layer.type === 'symbol')?.id;
    map.addLayer({
      id: BUILDING_LAYER_ID,
      type: 'fill-extrusion',
      source: 'runnit-buildings-source',
      'source-layer': 'building',
      minzoom: 14,
      paint: {
        'fill-extrusion-color': [
          'interpolate', ['linear'],
          ['to-number', ['coalesce', ['get', 'render_height'], ['get', 'height']], 10],
          0, '#38556f', 70, '#648dad', 200, '#91aec5',
        ],
        'fill-extrusion-height': [
          'interpolate', ['linear'], ['zoom'], 14, 0, 15.5,
          ['to-number', ['coalesce', ['get', 'render_height'], ['get', 'height']], 10],
        ],
        'fill-extrusion-base': ['to-number', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': 0.87,
      },
    }, firstLabelId);
  }
  if (!map.getSource(RADAR_ID)) {
    map.addSource(RADAR_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
  }
  if (!map.getLayer('runnit-radar-fill')) {
    map.addLayer({
      id: 'runnit-radar-fill',
      source: RADAR_ID,
      type: 'fill',
      paint: { 'fill-color': '#19e7ff', 'fill-opacity': 0.055 },
    });
    map.addLayer({
      id: 'runnit-radar-outline',
      source: RADAR_ID,
      type: 'line',
      paint: {
        'line-color': '#21ecff',
        'line-opacity': 0.96,
        'line-width': 3.3,
      },
    });
  }
  // WebGL-clustered community layer, with demo and GPS kept separate.
  installCommunityLayers(map);
  installRealHotspotHeat(map, COMMUNITY_REAL_SOURCE, 'runnit-community-single-glows');
  installHotspotTestLayers(map);
}

/** MapLibre geo clusters use the same race locations as the local HTML pins.
 * Regional counts never include sample users or the device location. */
function syncDistantDots(
  map: GLMap,
  players: readonly ArcadeVectorPlayer[],
  runs: readonly ArcadeVectorRun[],
  gps: MapCoordinate | null,
  regionalRuns: readonly { id: string; location: MapCoordinate; expiresAt?: string }[],
) {
  const entries: CommunityEntry[] = [
    ...runs.map(run => ({
      id: run.id, lat: run.location.lat, lng: run.location.lng,
      kind: (run.isDemo ? 'demo-race' : 'race') as CommunityEntry['kind'],
      isOwn: run.isOwn,
    })),
    ...regionalRuns.map(run => ({
      id: run.id, lat: run.location.lat, lng: run.location.lng,
      kind: 'race' as const,
    })),
    ...players.filter(player => player.source !== 'server-unverified').map(player => ({
      id: player.id, lat: player.location.lat, lng: player.location.lng,
      kind: (player.source === 'demo' ? 'demo-player' : 'player') as CommunityEntry['kind'],
    })),
  ];
  syncCommunityLayers(map, entries, gps);
}


const SVG_NS = 'http://www.w3.org/2000/svg';

/** Shapes communicate marker type independently of distance, color and device emoji font. */
function markerGlyph(kind: 'runner' | 'run'): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('runnit-gl-marker-glyph');

  const add = (tag: string, attributes: Record<string, string>) => {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    svg.appendChild(node);
  };
  if (kind === 'runner') {
    // Person silhouette: a circular avatar, not a finish flag or runner emoji.
    add('circle', { cx: '12', cy: '7', r: '3.2' });
    add('path', { d: 'M5 20v-1.7C5 14.7 8.1 12.5 12 12.5s7 2.2 7 5.8V20' });
  } else {
    // Checkered finish flag: the event pin, not a person/leaderboard shortcut.
    add('path', { d: 'M5 3v18M6.5 4h13v11h-13' });
    add('path', { d: 'M6.5 4H13v5.5H6.5zm6.5 5.5h6.5V15H13z', fill: 'currentColor', stroke: 'none' });
  }
  return svg;
}

function markerElement(kind: 'gps' | 'runner' | 'run', color: string, isDemo = false) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'runnit-gl-marker runnit-gl-' + kind + (isDemo ? ' is-demo' : '');
  el.style.setProperty('--runnit-pin', color);
  const label = kind === 'gps' ? 'Dein GPS-Standort'
    : kind === 'runner' ? (isDemo ? 'Demo-Spieler – Rangliste öffnen' : 'Spieler – Rangliste öffnen')
    : (isDemo ? 'Demo-Rennen – Renndetails öffnen' : 'Rennen – Renndetails öffnen');
  el.setAttribute('aria-label', label);
  el.dataset.baseLabel = label;
  if (kind !== 'gps') el.appendChild(markerGlyph(kind));
  return el;
}

/** MapLibre translates this OUTER shell to a geographic coordinate. Scaling only
 * the INNER button avoids overriding MapLibre's transform and drifting pins. */
function markerShell(button: HTMLButtonElement): HTMLDivElement {
  const shell = document.createElement('div');
  shell.className = 'runnit-gl-marker-shell';
  if (button.classList.contains('runnit-gl-runner')) shell.classList.add('is-runner');
  if (button.classList.contains('runnit-gl-gps')) shell.classList.add('is-gps');
  button.style.transformOrigin = button.classList.contains('runnit-gl-run') ? 'center bottom' : 'center center';
  shell.appendChild(button);
  return shell;
}

function detailElement(run: ArcadeVectorRun, onJoin: () => void, onCancel: () => void) {
  const root = document.createElement('div');
  root.className = 'runnit-gl-run-details' + (run.isOwn ? ' is-own-run' : '');
  const title = document.createElement('strong');
  title.className = 'runnit-gl-run-title';
  title.textContent = run.isOwn ? 'DEIN 1V1' : '1v1 DUELL';
  root.appendChild(title);
  const addLine = (value: string, className = '') => {
    const p = document.createElement('p');
    p.className = className;
    p.textContent = value;
    root.appendChild(p);
  };
  const distance = run.distanceAwayMeters;
  const distanceText = distance == null || !Number.isFinite(distance) ? 'Entfernung nicht verfügbar' :
    distance >= 1000 ? (distance / 1000).toFixed(1).replace('.', ',') + ' km entfernt' : Math.round(distance) + ' m entfernt';
  addLine('⌖ ' + distanceText);
  addLine('♧ 1/2 · ' + run.distanceMeters + ' m · @' + run.hostUsername);
  if (run.isDemo) addLine('DEMO · FIKTIVER GEGNER', 'runnit-gl-demo-status');
  if (run.isOwn) addLine('DEIN OFFENES RENNEN', 'runnit-gl-own-status');
  // One server-authoritative mini countdown for BOTH own and foreign races.
  // Do not invent timers for demo challenges, and never extend expiry locally.
  if (!run.isDemo && run.expiresAt) {
    const countdown = document.createElement('div');
    countdown.className = 'runnit-gl-run-expiry';
    countdown.setAttribute('aria-label', 'Verbleibende Zeit zum Beitreten');
    const label = document.createElement('span');
    label.textContent = 'EVENT ENDET IN';
    const clock = document.createElement('time');
    clock.dateTime = run.expiresAt;
    clock.setAttribute('role', 'timer');
    clock.setAttribute('aria-live', 'off');
    clock.textContent = openEventClockLabel(run.expiresAt);
    countdown.append(label, clock);
    root.appendChild(countdown);
  }
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'runnit-gl-run-cta' + (run.isOwn ? ' is-cancel' : '');
  button.textContent = run.isOwn ? 'ABSAGEN' : 'BEITRETEN »';
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    if (run.isOwn) onCancel(); else onJoin();
  });
  root.appendChild(button);
  return root;
}

/** Owns only map rendering: no auth, Supabase, races or geolocation reads. */
export default function ArcadeMapLibreView({
  initialCenter, initialZoom, userCoords, ipCoords, recenterTick, retryTick, view,
  players, runs, regionalRuns, hotspotDemoEnabled, hotspotFocus, onWideViewChange, onCameraChange, onSelectRun, onJoinRun, onCancelRun, onRunExpired, onOpenRunGroup, onGhostClick, onHostAt, onInvalidHostAt,
  onTilesLoaded, onTilesError,
}: ArcadeMapLibreProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GLMap | null>(null);
  const gpsMarkerRef = useRef<Marker | null>(null);
  const activeRunPopupRef = useRef<Popup | null>(null);
  const hostPopupRef = useRef<Popup | null>(null);
  const hostSelectionMarkerRef = useRef<Marker | null>(null);
  const atmosphereRef = useRef<HTMLDivElement | null>(null);
  const ignoreMapClickUntilRef = useRef(0);
  const visiblePlayersRef = useRef<Array<{ marker: Marker; point: MapCoordinate }>>([]);
  const visibleRunsRef = useRef<Array<{ id: string; marker: Marker; point: MapCoordinate; isDemo: boolean; isOwn: boolean }>>([]);
  const latestGpsRef = useRef(userCoords);
  latestGpsRef.current = userCoords;
  const liveRunsRef = useRef(runs);
  liveRunsRef.current = runs;
  const livePlayersRef = useRef(players);
  livePlayersRef.current = players;
  const liveRegionalRef = useRef(regionalRuns);
  liveRegionalRef.current = regionalRuns;
  const hotspotEnabledRef = useRef(hotspotDemoEnabled);
  hotspotEnabledRef.current = hotspotDemoEnabled;
  const [ready, setReady] = useState(false);
  const [tilted, setTilted] = useState(true);
  const [popupVisible, setPopupVisible] = useState(false);
  const callbacks = useRef({ onSelectRun, onJoinRun, onCancelRun, onRunExpired, onOpenRunGroup, onGhostClick, onHostAt, onInvalidHostAt, onTilesLoaded, onTilesError, onWideViewChange, onCameraChange });
  callbacks.current = { onSelectRun, onJoinRun, onCancelRun, onRunExpired, onOpenRunGroup, onGhostClick, onHostAt, onInvalidHostAt, onTilesLoaded, onTilesError, onWideViewChange, onCameraChange };
  const firstGPS = useRef(false);
  const firstIP = useRef(false);
  const previousRecenter = useRef(recenterTick);
  // A GPS fix may change every second. It must NEVER tear down an open race
  // popup or recreate distant race pins. The popup has its own event location.
  const playerMarkerKey = useMemo(() => JSON.stringify(players.map(person => [
    person.id, person.location.lat, person.location.lng, person.colorHex, person.source,
  ])), [players]);
  const regionalMarkerKey = useMemo(() => JSON.stringify(regionalRuns.map(run => [run.id, run.location.lat, run.location.lng])), [regionalRuns]);
  const runMarkerKey = useMemo(() => JSON.stringify(runs.map(run => [
    run.id, run.location.lat, run.location.lng, run.isOwn, run.isDemo,
    run.hostUsername, run.distanceMeters,
  ])), [runs]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const map = new GLMap({
      container: canvasRef.current,
      style: STYLE_URL,
      center: finiteCoords(initialCenter) ? [initialCenter.lng, initialCenter.lat] : [0, 22],
      zoom: initialZoom,
      pitch: PITCH_DEGREES,
      bearing: BEARING_DEGREES,
      maxPitch: 65,
      attributionControl: { compact: false },
      cooperativeGestures: false,
    });
    mapRef.current = map;
    const onStyle = () => {
      try {
        styleArcadeMap(map);
        syncDistantDots(map, livePlayersRef.current, liveRunsRef.current, latestGpsRef.current, liveRegionalRef.current);
        syncHotspotTestLayers(map, hotspotEnabledRef.current);
        callbacks.current.onTilesLoaded();
        callbacks.current.onWideViewChange(map.getZoom() <= 11.2);
        const camera = map.getCenter();
        callbacks.current.onCameraChange({ zoom: map.getZoom(), lat: camera.lat, lng: camera.lng });
        setReady(true);
      } catch {
        callbacks.current.onTilesError();
      }
    };
    const onFailure = () => {
      // A tile or style load failure is not an invented GPS fix.
      callbacks.current.onTilesError();
    };
    const onZoomEnd = () => callbacks.current.onWideViewChange(map.getZoom() <= 11.2);
    const onCameraIdle = () => {
      const center = map.getCenter();
      callbacks.current.onCameraChange({ zoom: map.getZoom(), lat: center.lat, lng: center.lng });
    };
    const onCommunityClusterClick = (event: import('maplibre-gl').MapLayerMouseEvent) => {
      const geometry = event.features?.[0]?.geometry;
      if (!geometry || geometry.type !== 'Point') return;
      const coordinates = geometry.coordinates;
      map.easeTo({ center: [coordinates[0], coordinates[1]], zoom: Math.min(map.getZoom() + 2.5, 13), duration: 400 });
    };
    map.on('style.load', onStyle);
    map.on('error', onFailure);
    map.on('zoomend', onZoomEnd);
    map.on('moveend', onCameraIdle);
    const updateAtmosphere = () => {
      // A quiet thematic overlay only: nothing here represents a fake player.
      const zoom = map.getZoom();
      if (atmosphereRef.current) atmosphereRef.current.style.opacity =
        String(Math.max(0, Math.min(0.9, (13.3 - zoom) / 5.8)));
    };
    map.on('zoom', updateAtmosphere);
    updateAtmosphere();
    map.on('click', COMMUNITY_CLUSTER_LAYER, onCommunityClusterClick);
    map.on('click', COMMUNITY_RACE_DOT_LAYER, onCommunityClusterClick);
    map.on('click', COMMUNITY_SINGLE_SIGNAL_RING, onCommunityClusterClick);
    const onTestHotspotClick = (event: import('maplibre-gl').MapLayerMouseEvent) => {
      if (!hotspotEnabledRef.current) return;
      const feature = event.features?.[0];
      const geometry = feature?.geometry;
      if (!geometry || geometry.type !== 'Point') return;
      const coordinates = geometry.coordinates;
      const target: [number, number] = [coordinates[0], coordinates[1]];
      const clusterId = feature?.properties?.cluster_id;
      if (typeof clusterId === 'number') {
        const source = map.getSource(HOTSPOT_TEST_CENTERS_SOURCE) as GeoJSONSource | undefined;
        // Jump to the FIRST zoom that genuinely splits this particular
        // group. Never guess which of the three cities is behind the marker.
        if (source) {
          void source.getClusterExpansionZoom(clusterId).then(zoom => {
            if (mapRef.current !== map) return;
            map.easeTo({ center: target, zoom: Math.min(13.2, Math.max(zoom + 0.4, map.getZoom() + 1.5)), duration: 500 });
          }).catch(() => {
            if (mapRef.current === map)
              map.easeTo({ center: target, zoom: Math.min(13.2, map.getZoom() + 2.5), duration: 500 });
          });
          return;
        }
      }
      // An individual city's hub reveals the individual synthetic signals.
      map.easeTo({ center: target, zoom: Math.max(13.2, map.getZoom()), duration: 500 });
    };
    map.on('click', HOTSPOT_TEST_CIRCLES, onTestHotspotClick);
    return () => {
      map.off('style.load', onStyle);
      map.off('error', onFailure);
      map.off('zoomend', onZoomEnd);
      map.off('moveend', onCameraIdle);
      map.off('zoom', updateAtmosphere);
      map.off('click', COMMUNITY_CLUSTER_LAYER, onCommunityClusterClick);
      map.off('click', COMMUNITY_RACE_DOT_LAYER, onCommunityClusterClick);
      map.off('click', COMMUNITY_SINGLE_SIGNAL_RING, onCommunityClusterClick);
      map.off('click', HOTSPOT_TEST_CIRCLES, onTestHotspotClick);
      activeRunPopupRef.current?.remove();
      activeRunPopupRef.current = null;
      hostPopupRef.current?.remove();
      hostPopupRef.current = null;
      hostSelectionMarkerRef.current?.remove();
      hostSelectionMarkerRef.current = null;
      gpsMarkerRef.current?.remove();
      gpsMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // Map object intentionally survives sensor polling and result updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (userCoords && finiteCoords(userCoords)) {
      if (!firstGPS.current || previousRecenter.current !== recenterTick) {
        map.easeTo({ center: [userCoords.lng, userCoords.lat], zoom: Math.max(map.getZoom(), 16), pitch: tilted ? PITCH_DEGREES : 0, duration: 450 });
        firstGPS.current = true;
      }
    } else if (ipCoords && finiteCoords(ipCoords) && !firstIP.current) {
      map.easeTo({ center: [ipCoords.lng, ipCoords.lat], zoom: Math.max(map.getZoom(), 13), duration: 450 });
      firstIP.current = true;
    }
    previousRecenter.current = recenterTick;
  }, [ready, userCoords?.lat, userCoords?.lng, ipCoords?.lat, ipCoords?.lng, recenterTick, tilted]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const source = map.getSource(RADAR_ID) as GeoJSONSource | undefined;
    if (!source) return;
    source.setData(userCoords && finiteCoords(userCoords) ?
      radarPolygon(userCoords) : { type: 'FeatureCollection', features: [] });
  }, [ready, userCoords?.lat, userCoords?.lng, retryTick]);

  // GPS location moves independently; keep the same map and the same race popup.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (userCoords && finiteCoords(userCoords)) {
      if (!gpsMarkerRef.current) {
        gpsMarkerRef.current = new Marker({
          element: markerShell(markerElement('gps', '#1b80ff')),
          anchor: 'center',
        }).setLngLat([userCoords.lng, userCoords.lat]).addTo(map);
      } else {
        gpsMarkerRef.current.setLngLat([userCoords.lng, userCoords.lat]);
      }
    } else {
      gpsMarkerRef.current?.remove();
      gpsMarkerRef.current = null;
    }
    syncDistantDots(map, livePlayersRef.current, liveRunsRef.current, userCoords, liveRegionalRef.current);
    refreshVisiblePins();
  }, [ready, userCoords?.lat, userCoords?.lng, userCoords?.accuracyMeters, userCoords?.sampledAtMs]);

  // GPS geolocation watches can pause while iOS Safari is stationary.
  // Re-evaluate the device-only badge timestamps while the map is visible;
  // the satellite must disappear when its last fix becomes stale. No extra
  // network requests, geolocation reads or WebGL redraw loop are created.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const refreshGpsBadge = () => {
      if (document.hidden) return;
      syncDistantDots(map, livePlayersRef.current, liveRunsRef.current,
        latestGpsRef.current, liveRegionalRef.current);
      refreshVisiblePins();
    };
    const interval = window.setInterval(refreshGpsBadge, 15_000);
    document.addEventListener('visibilitychange', refreshGpsBadge);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshGpsBadge);
    };
  }, [ready]);

  // MapLibre HTML Markers can be rendered at a screen edge even when their
  // geographic anchor is far outside a pitched/rotated visible map. Check both
  // the actual geo bounds and screen projection on every camera move.
  const refreshVisiblePins = () => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const rect = map.getContainer().getBoundingClientRect();
    const header = document.querySelector('.runnit-arcade-map-switch')?.getBoundingClientRect();
    const dock = document.querySelector('.runnit-game-dock')?.getBoundingClientRect();
    const width = map.getContainer().clientWidth;
    const height = map.getContainer().clientHeight;
    const viewport = {
      width,
      height,
      top: header ? Math.max(22, header.bottom - rect.top + 12) : 22,
      bottom: dock ? Math.min(height - 22, dock.top - rect.top - 12) : height - 22,
      left: 23,
      right: 23,
    };
    const bounds = map.getBounds();
    const opacity = markerPinOpacityAtZoom(map.getZoom());
    const scale = markerScaleAtZoom(map.getZoom());
    const updateMarker = (marker: Marker, geo: MapCoordinate) => {
      const geographicMatch = validMapPoint(geo) && bounds.contains([geo.lng, geo.lat]);
      const screen = geographicMatch ? map.project([geo.lng, geo.lat]) : { x: NaN, y: NaN };
      const visible = opacity > 0 && markerInViewport(geographicMatch, screen, viewport);
      const shell = marker.getElement();
      // An inline style wins over the decorative CSS display:grid rule.
      shell.style.display = visible ? '' : 'none';
      shell.style.opacity = String(opacity);
      shell.style.pointerEvents = opacity >= 0.8 ? '' : 'none';
      // The shell retains the geographic transform owned by MapLibre.
      const button = shell.firstElementChild as HTMLElement | null;
      if (button) {
        button.style.transform = 'scale(' + scale + ')';
        button.style.pointerEvents = opacity >= 0.8 ? 'auto' : 'none';
      }
    };
    for (const item of [...visiblePlayersRef.current, ...visibleRunsRef.current]) {
      updateMarker(item.marker, item.point);
    }
    // Reuse badge DOM between map movements so the interface never flashes.
    const setGroupBadge = (marker: Marker, count: number, label = '') => {
      const button = marker.getElement().firstElementChild as HTMLElement | null;
      if (!button) return;
      const current = Number(button.dataset.groupCount || '0');
      if (current === count) return;
      button.dataset.groupCount = String(count);
      button.querySelector('.runnit-gl-run-group-count')?.remove();
      button.classList.toggle('is-run-group', count > 1);
      button.setAttribute('aria-label', count > 1 ? label : (button.dataset.baseLabel || 'Rennen'));
      if (count > 1) {
        const badge = document.createElement('span');
        badge.className = 'runnit-gl-run-group-count';
        badge.textContent = String(count);
        badge.setAttribute('aria-hidden', 'true');
        button.appendChild(badge);
      }
    };
    const eligible = visibleRunsRef.current.flatMap((item, index) => {
      if (item.marker.getElement().style.display === 'none') return [];
      const point = map.project([item.point.lng, item.point.lat]);
      return [{ index, x: point.x, y: point.y, isOwn: item.isOwn, isDemo: item.isDemo }];
    });
    const clusters = groupOverlappingRuns(eligible, Math.max(25, Math.min(48, 14 + scale * 42)));
    const counts = new Map<number, { count: number; label: string }>();
    const covered = new Set<number>();
    for (const group of clusters) {
      if (group.members.length < 2) continue;
      counts.set(group.anchor, {
        count: group.members.length,
        label: group.members.length + ' Rennen an diesem Standort, davon ' + group.demoCount + ' Demo. Antippen zum Erkunden',
      });
      for (const index of group.members) {
        if (index !== group.anchor) covered.add(index);
      }
    }
    visibleRunsRef.current.forEach((item, index) => {
      const group = counts.get(index);
      setGroupBadge(item.marker, group?.count ?? 0, group?.label);
      if (covered.has(index)) item.marker.getElement().style.display = 'none';
    });
    // At close street zoom the own event flag must NOT wear a blue satellite.
    // Its geographic GPS position is still shown by the separate normal dot.
    // The combined cyan accessory belongs exclusively to low-zoom real orbs.
    const gps = latestGpsRef.current;
    if (gpsMarkerRef.current && gps && validMapPoint(gps)) {
      updateMarker(gpsMarkerRef.current, gps);
    }

    // A detail popup should not float over an entire continent or under UI
    // chrome after the associated race has left the visible, usable map.
    for (const popup of [activeRunPopupRef.current, hostPopupRef.current]) {
      if (!popup) continue;
      const location = popup.getLngLat();
      const geographicMatch = bounds.contains([location.lng, location.lat]);
      const projected = geographicMatch ? map.project([location.lng, location.lat]) : { x: NaN, y: NaN };
      if (map.getZoom() < PIN_FADE_END_ZOOM || !markerInViewport(geographicMatch, projected, viewport)) {
        popup.remove();
      }
    }
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const onCameraMove = () => refreshVisiblePins();
    map.on('move', onCameraMove);
    map.on('moveend', onCameraMove);
    map.on('resize', onCameraMove);
    window.addEventListener('resize', onCameraMove);
    refreshVisiblePins();
    return () => {
      map.off('move', onCameraMove);
      map.off('moveend', onCameraMove);
      map.off('resize', onCameraMove);
      window.removeEventListener('resize', onCameraMove);
    };
    // The single map instance stays mounted; marker refs are updated separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Long-press is reserved for empty map canvas, not for a marker or a UI tab.
  // A drag or pinch cancels it; desktop right-click is an equivalent gesture.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const canvas = map.getCanvas();
    let pressTimer: ReturnType<typeof setTimeout> | null = null;
    let origin: { id: number; x: number; y: number } | null = null;
    let lastOpened = 0;

    const discard = () => {
      if (pressTimer !== null) clearTimeout(pressTimer);
      pressTimer = null;
      origin = null;
    };
    // Preview pulse exists ONLY while the "RENNEN HIER" chooser is visible.
    // Never retain it beneath a real event flag or the next setup dialog.
    const clearHostSelection = () => {
      hostSelectionMarkerRef.current?.remove();
      hostSelectionMarkerRef.current = null;
    };
    const closeHostPopup = () => {
      hostPopupRef.current?.remove();
      hostPopupRef.current = null;
      clearHostSelection();
    };
    const openAt = (position: MapCoordinate) => {
      if (Date.now() - lastOpened < 900) return;
      lastOpened = Date.now();
      ignoreMapClickUntilRef.current = Date.now() + 900;
      closeHostPopup();
      const gps = latestGpsRef.current;
      if (!validMapPoint(gps)) {
        callbacks.current.onInvalidHostAt('Zum Platzieren eines Rennens benötigst du einen GPS-Standort.');
        return;
      }
      if (!canHostAt(gps, position)) {
        callbacks.current.onInvalidHostAt('Der Punkt liegt außerhalb deines 500-m-Radars. Wähle eine Stelle innerhalb des cyanfarbenen Kreises.');
        return;
      }
      activeRunPopupRef.current?.remove();
      activeRunPopupRef.current = null;
      // A real geographic MapLibre marker, not a screen-fixed decoration.
      const anchor = document.createElement('div');
      anchor.className = 'runnit-gl-host-pulse';
      anchor.setAttribute('aria-hidden', 'true');
      hostSelectionMarkerRef.current = new Marker({ element: anchor, anchor: 'center' })
        .setLngLat([position.lng, position.lat]).addTo(map);

      const root = document.createElement('div');
      root.className = 'runnit-gl-host-details';
      const title = document.createElement('strong');
      title.textContent = 'RENNEN HIER';
      root.appendChild(title);
      const info = document.createElement('p');
      info.textContent = 'IM RADAR · ' + Math.round(mapDistanceMeters(gps, position)) + ' M VON DIR';
      root.appendChild(info);
      const create = document.createElement('button');
      create.type = 'button';
      create.className = 'runnit-gl-host-cta';
      create.textContent = 'WEITER ›';
      create.addEventListener('click', (event) => {
        event.stopPropagation();
        // Leaving the point-picker removes its marker IMMEDIATELY;
        // a confirmed duel replaces it with the normal event flag.
        closeHostPopup();
        callbacks.current.onHostAt(position);
      });
      root.appendChild(create);
      const popup = new Popup({
        className: 'runnit-gl-host-popup',
        closeButton: true,
        closeOnClick: false,
        closeOnMove: false,
        maxWidth: '188px',
        offset: 18,
      }).setLngLat([position.lng, position.lat]).setDOMContent(root);
      popup.setPadding({ top: 175, right: 15, bottom: 145, left: 15 });
      popup.on('close', () => {
        if (hostPopupRef.current === popup) hostPopupRef.current = null;
        setPopupVisible(Boolean(activeRunPopupRef.current));
        clearHostSelection();
      });
      popup.addTo(map);
      hostPopupRef.current = popup;
      // The chooser lives on the map canvas, away from the 2D/3D rail.
      // Only an actual race detail popup needs to obscure tilt controls.
      setPopupVisible(false);
    };

    const pointFromPointer = (ev: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const lngLat = map.unproject([ev.clientX - rect.left, ev.clientY - rect.top]);
      return { lat: lngLat.lat, lng: lngLat.lng };
    };
    const onPointerDown = (ev: PointerEvent) => {
      if (!ev.isPrimary || ev.button !== 0 || ev.pointerType === 'mouse' && ev.buttons !== 1) return;
      discard();
      origin = { id: ev.pointerId, x: ev.clientX, y: ev.clientY };
      const location = pointFromPointer(ev);
      pressTimer = setTimeout(() => {
        if (!origin || origin.id !== ev.pointerId) return;
        pressTimer = null;
        openAt(location);
      }, 600);
    };
    const onPointerMove = (ev: PointerEvent) => {
      if (!origin || origin.id !== ev.pointerId) return;
      if (Math.hypot(ev.clientX - origin.x, ev.clientY - origin.y) > 12) discard();
    };
    const onPointerUp = (ev: PointerEvent) => {
      if (origin && origin.id === ev.pointerId) discard();
    };
    const onRightClick = (ev: import('maplibre-gl').MapMouseEvent) => {
      ev.originalEvent.preventDefault();
      // Mobile uses the pointer timer; avoid a second popup when iOS emits
      // a synthetic contextmenu on finger release after a long hold.
      if (ev.originalEvent.button !== 2) return;
      discard();
      openAt({ lat: ev.lngLat.lat, lng: ev.lngLat.lng });
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    map.on('dragstart', discard);
    map.on('zoomstart', discard);
    map.on('contextmenu', onRightClick);
    return () => {
      discard();
      closeHostPopup();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      map.off('dragstart', discard);
      map.off('zoomstart', discard);
      map.off('contextmenu', onRightClick);
    };
  }, [ready]);

  // Purely local, explicitly opted-in load simulation. It never writes a
  // database record or contributes to the real community source.
  useEffect(() => {
    const map = mapRef.current;
    if (map && ready) syncHotspotTestLayers(map, hotspotDemoEnabled);
  }, [ready, hotspotDemoEnabled]);

  // A slow, low-frequency breathing halo; sprites themselves are static
  // GPU textures. Keep the animation offscreen/reduced-motion safe.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !hotspotDemoEnabled ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const auraLayer = 'runnit-test-hub-aura';
    let frame = 0;
    const pulse = () => {
      if (document.hidden || !map.getLayer(auraLayer)) return;
      frame = (frame + 1) % 16;
      const alpha = .085 + .018 * Math.sin(frame * Math.PI / 8);
      map.setPaintProperty(auraLayer, 'circle-opacity',
        ['interpolate', ['linear'], ['zoom'], 0, alpha, 8, alpha + .025, 12.8, 0]);
    };
    const pulseInterval = window.setInterval(pulse, 320);
    return () => {
      window.clearInterval(pulseInterval);
      if (map.getLayer(auraLayer))
        map.setPaintProperty(auraLayer, 'circle-opacity',
          ['interpolate', ['linear'], ['zoom'], 0, .07, 8, .11, 12.8, 0]);
    };
  }, [ready, hotspotDemoEnabled]);

  // Focus buttons fly between the three synthetic scenes. The user can pan
  // and pinch afterward; camera movements do not retrigger this effect.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !hotspotDemoEnabled) return;
    const seed = HOTSPOT_TEST_SCENARIOS.find(item => item.cityId === hotspotFocus.city);
    map.easeTo({
      center: seed ? [seed.lng, seed.lat] : [10.43, 48.58],
      zoom: seed ? 9 : 6.5,
      pitch: 0,
      bearing: 0,
      duration: 500,
    });
  }, [ready, hotspotDemoEnabled, hotspotFocus.tick]);

  // Data changes are reflected on the low-zoom WebGL layer without rebuilding
  // either the map or the detailed marker DOM nodes.
  useEffect(() => {
    const map = mapRef.current;
    if (map && ready) syncDistantDots(map, livePlayersRef.current, liveRunsRef.current, latestGpsRef.current, liveRegionalRef.current);
  }, [ready, playerMarkerKey, runMarkerKey, regionalMarkerKey]);

  // Green/yellow demo runners still open the leaderboard, never a race popup.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const markers: Marker[] = [];
    const visibleMarkers: Array<{ marker: Marker; point: MapCoordinate }> = [];
    for (const person of players) {
      if (person.source === 'server-unverified' || !finiteCoords(person.location)) continue;
      const el = markerElement('runner', '#a985ff', person.source === 'demo');
      el.addEventListener('click', (event) => {
        event.stopPropagation();
        callbacks.current.onGhostClick();
      });
      const marker = new Marker({ element: markerShell(el), anchor: 'center' })
        .setLngLat([person.location.lng, person.location.lat]).addTo(map);
      markers.push(marker);
      visibleMarkers.push({ marker, point: person.location });
    }
    visiblePlayersRef.current = visibleMarkers;
    refreshVisiblePins();
    return () => {
      visiblePlayersRef.current = [];
      for (const marker of markers) marker.remove();
    };
    // playerMarkerKey is intentionally independent of live GPS and race entries.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, playerMarkerKey]);

  // Pink race pins own a geographically anchored popup for exactly THAT run.
  // Unlike the previous combined effect, GPS updates do not destroy or move it.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const markers: Marker[] = [];
    const visibleMarkers: Array<{ id: string; marker: Marker; point: MapCoordinate; isDemo: boolean; isOwn: boolean }> = [];
    const closePopup = () => {
      activeRunPopupRef.current?.remove();
      activeRunPopupRef.current = null;
    };
    const onMapBackgroundClick = () => {
      if (Date.now() < ignoreMapClickUntilRef.current) return;
      closePopup();
      hostPopupRef.current?.remove();
      hostPopupRef.current = null;
    };
    map.on('click', onMapBackgroundClick);

    for (const originalRun of runs) {
      if (!finiteCoords(originalRun.location)) continue;
      const el = markerElement('run', originalRun.isOwn ? '#c9ff0b' : '#f13edc', originalRun.isDemo);
      if (originalRun.isOwn) el.classList.add('is-own');
      const marker = new Marker({ element: markerShell(el), anchor: 'bottom' })
        .setLngLat(eventPopupLngLat(originalRun))
        .addTo(map);
      markers.push(marker);
      visibleMarkers.push({ id: originalRun.id, marker, point: originalRun.location, isDemo: originalRun.isDemo, isOwn: originalRun.isOwn });

      el.addEventListener('click', (event) => {
        // Prevent MapLibre's background-click handler from instantly closing it.
        event.preventDefault();
        event.stopPropagation();

        const groupCount = Number(el.dataset.groupCount || '0');
        if (groupCount > 1) {
          // Keep geographic anchors intact. Reveal individual flags with zoom;
          // exact coordinate duplicates open the searchable list at street scale.
          if (map.getZoom() < 17.2) {
            map.easeTo({
              center: eventPopupLngLat(originalRun),
              zoom: Math.min(map.getZoom() + 1.7, 18),
              duration: 340,
            });
          } else {
            callbacks.current.onOpenRunGroup();
          }
          return;
        }
        const selectedRun = liveRunsRef.current.find(run => run.id === originalRun.id);
        if (!selectedRun || !finiteCoords(selectedRun.location)) return;
        // Do not briefly expose a join action on a race whose server deadline
        // has already passed but whose status-change event is still in flight.
        if (!selectedRun.isDemo && selectedRun.expiresAt &&
            openEventMsLeft(selectedRun.expiresAt) === 0) {
          callbacks.current.onRunExpired(selectedRun.id);
          return;
        }
        const eventPosition = eventPopupLngLat(selectedRun);
        closePopup();
        hostPopupRef.current?.remove();
        hostPopupRef.current = null;
        const detail = detailElement(selectedRun,
          () => callbacks.current.onJoinRun(selectedRun.id),
          () => callbacks.current.onCancelRun(selectedRun.id));
        const clock = detail.querySelector<HTMLTimeElement>('.runnit-gl-run-expiry time');
        const expiryBox = detail.querySelector<HTMLElement>('.runnit-gl-run-expiry');
        const action = detail.querySelector<HTMLButtonElement>('.runnit-gl-run-cta');
        const popup = new Popup({
          className: 'runnit-gl-race-popup' + (selectedRun.isOwn ? ' is-own-popup' : ''),
          maxWidth: selectedRun.isOwn ? '242px' : '290px',
          offset: 23,
          closeButton: true,
          closeOnClick: false,
          closeOnMove: false,
        })
          .setLngLat(eventPosition)
          .setDOMContent(detail);
        let expiryInterval: number | null = null;
        const updatePopupClock = () => {
          if (!selectedRun.expiresAt) return;
          const msLeft = openEventMsLeft(selectedRun.expiresAt);
          if (clock) clock.textContent = openEventClockLabel(selectedRun.expiresAt);
          expiryBox?.classList.toggle('is-urgent', msLeft > 0 && msLeft <= 300_000);
          if (msLeft === 0) {
            if (action) action.disabled = true;
            popup.remove();
            // The server cron expires the database row. Client cleanup only
            // removes an already-expired open challenge from every map view.
            callbacks.current.onRunExpired(selectedRun.id);
          }
        };
        const onPageVisible = () => {
          if (!document.hidden) updatePopupClock();
        };
        popup.setPadding({ top: 190, right: 18, bottom: 155, left: 18 });
        popup.on('close', () => {
          if (expiryInterval !== null) window.clearInterval(expiryInterval);
          document.removeEventListener('visibilitychange', onPageVisible);
          if (activeRunPopupRef.current === popup) activeRunPopupRef.current = null;
          setPopupVisible(Boolean(activeRunPopupRef.current));
        });
        popup.addTo(map);
        activeRunPopupRef.current = popup;
        setPopupVisible(true);
        callbacks.current.onSelectRun(selectedRun.id);
        if (selectedRun.expiresAt && !selectedRun.isDemo) {
          // Isolated 1Hz clock only while this popup is open; no map rerender.
          expiryInterval = window.setInterval(updatePopupClock, 1000);
          document.addEventListener('visibilitychange', onPageVisible);
          updatePopupClock();
        }

        // Leave room ABOVE the event for the entire detail card and BELOW it
        // for the bottom dock. Never pan towards the runner's GPS position.
        const rect = map.getContainer().getBoundingClientRect();
        const header = document.querySelector('.runnit-arcade-map-switch')?.getBoundingClientRect();
        const dock = document.querySelector('.runnit-game-dock')?.getBoundingClientRect();
        const top = header ? header.bottom - rect.top + 16 : 190;
        const bottom = dock ? dock.top - rect.top - 22 : map.getContainer().clientHeight - 100;
        const targetY = Math.max(top + 190, Math.min(bottom - 30, top + (bottom - top) * 0.68));
        const point = map.project(eventPosition);
        const { clientWidth, clientHeight } = map.getContainer();
        if (Math.abs(point.y - targetY) > 35 ||
            point.x < 35 || point.x > clientWidth - 35) {
          map.easeTo({ center: eventPosition, offset: [0, targetY - clientHeight / 2], duration: 260 });
        }
      });
    }
    visibleRunsRef.current = visibleMarkers;
    refreshVisiblePins();
    return () => {
      visibleRunsRef.current = [];
      map.off('click', onMapBackgroundClick);
      closePopup();
      for (const marker of markers) marker.remove();
    };
    // runMarkerKey deliberately excludes distanceAwayMeters and live GPS fixes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, runMarkerKey]);

  useEffect(() => {
    if (view === 'list') {
      activeRunPopupRef.current?.remove();
      activeRunPopupRef.current = null;
      hostPopupRef.current?.remove();
      hostPopupRef.current = null;
    }
  }, [view]);

  useEffect(() => {
    // A retry reinitializes the vector style, then style.load rebuilds 3D + radar.
    const map = mapRef.current;
    if (map && retryTick > 0) map.setStyle(STYLE_URL);
  }, [retryTick]);

  return (
    <>
      <div ref={canvasRef} className="runnit-gl-canvas" role="application" aria-label="Dreidimensionale Karte mit Rennen in deiner Nähe. Zum Veranstalten Karte an einem Punkt im 500-Meter-Radar länger gedrückt halten." />
      <div ref={atmosphereRef} className={'runnit-gl-distance-atmosphere' + (view === 'list' ? ' is-hidden' : '')} aria-hidden="true" />
      {view === 'map' && <button
        type="button"
        className={'runnit-gl-tilt-button' + (popupVisible ? ' is-obscured-by-popup' : '')}
        aria-label={tilted ? 'Zur flachen 2D-Karte wechseln' : 'Zur schrägen 3D-Karte wechseln'}
        aria-pressed={tilted}
        aria-hidden={popupVisible}
        disabled={popupVisible}
        onClick={() => {
          const next = !tilted;
          setTilted(next);
          mapRef.current?.easeTo({ pitch: next ? PITCH_DEGREES : 0, bearing: next ? BEARING_DEGREES : 0, duration: 350 });
        }}
      >{tilted ? '3D' : '2D'}</button>}
    </>
  );
}
