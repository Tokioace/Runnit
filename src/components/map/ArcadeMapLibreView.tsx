import { useEffect, useMemo, useRef, useState } from 'react';
import { Map as GLMap, Marker, Popup, setWorkerUrl } from 'maplibre-gl';
import type { GeoJSONSource } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { ArcadeMapEntry, ArcadeMapView } from './ArcadeMapChrome';
import { eventPopupLngLat } from '../../lib/mapPopupAnchor';
import { canHostAt, HOST_PLACEMENT_RADIUS_METERS, mapDistanceMeters, validMapPoint } from '../../lib/mapHostPlacement';
import { markerInViewport } from '../../lib/mapMarkerVisibility';

// Required by MapLibre v6 and Vite 8: ship the real same-origin WebGL worker.
// Without ?worker&url, production may show a blank map without a build failure.
setWorkerUrl(workerUrl);

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const BUILDING_TILES = 'https://tiles.openfreemap.org/planet';
const RADAR_ID = 'runnit-gps-radar';
const BUILDING_LAYER_ID = 'runnit-3d-buildings';
const PITCH_DEGREES = 46;
const BEARING_DEGREES = -13;

export type MapCoordinate = { lat: number; lng: number };
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
  onSelectRun: (id: string) => void;
  onJoinRun: (id: string) => void;
  onCancelRun: (id: string) => void;
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
      if (layer.type === 'background') {
        map.setPaintProperty(layer.id, 'background-color', '#10243d');
      } else if (layer.type === 'fill' && /building/.test(name)) {
        map.setPaintProperty(layer.id, 'fill-color', '#3d5c77');
        map.setPaintProperty(layer.id, 'fill-opacity', 0.94);
      } else if (layer.type === 'line' && /road|street|highway|transportation/.test(name)) {
        const main = /motorway|trunk|primary|main/.test(name);
        map.setPaintProperty(layer.id, 'line-color', main ? '#b9d8e9' : '#779bb9');
        map.setPaintProperty(layer.id, 'line-opacity', main ? 1 : 0.94);
      } else if (layer.type === 'fill' && /water/.test(name)) {
        map.setPaintProperty(layer.id, 'fill-color', '#123852');
      } else if (layer.type === 'fill' && /park|wood|forest|landcover|grass/.test(name)) {
        map.setPaintProperty(layer.id, 'fill-color', '#193b49');
      } else if (layer.type === 'symbol' && /label|place|road/.test(name)) {
        map.setPaintProperty(layer.id, 'text-color', '#bed6e9');
        map.setPaintProperty(layer.id, 'text-halo-color', '#081a30');
        map.setPaintProperty(layer.id, 'text-halo-width', 1.4);
      }
    } catch {
      // Optional style layers can have data-driven paint; never break base-map load.
    }
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
  if (kind !== 'gps') el.appendChild(markerGlyph(kind));
  return el;
}

function detailElement(run: ArcadeVectorRun, onJoin: () => void, onCancel: () => void) {
  const root = document.createElement('div');
  root.className = 'runnit-gl-run-details';
  const title = document.createElement('strong');
  title.className = 'runnit-gl-run-title';
  title.textContent = '1v1 DUELL';
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
  players, runs, onSelectRun, onJoinRun, onCancelRun, onGhostClick, onHostAt, onInvalidHostAt,
  onTilesLoaded, onTilesError,
}: ArcadeMapLibreProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GLMap | null>(null);
  const gpsMarkerRef = useRef<Marker | null>(null);
  const activeRunPopupRef = useRef<Popup | null>(null);
  const hostPopupRef = useRef<Popup | null>(null);
  const ignoreMapClickUntilRef = useRef(0);
  const visiblePlayersRef = useRef<Array<{ marker: Marker; point: MapCoordinate }>>([]);
  const visibleRunsRef = useRef<Array<{ marker: Marker; point: MapCoordinate }>>([]);
  const latestGpsRef = useRef(userCoords);
  latestGpsRef.current = userCoords;
  const liveRunsRef = useRef(runs);
  liveRunsRef.current = runs;
  const [ready, setReady] = useState(false);
  const [tilted, setTilted] = useState(true);
  const callbacks = useRef({ onSelectRun, onJoinRun, onCancelRun, onGhostClick, onHostAt, onInvalidHostAt, onTilesLoaded, onTilesError });
  callbacks.current = { onSelectRun, onJoinRun, onCancelRun, onGhostClick, onHostAt, onInvalidHostAt, onTilesLoaded, onTilesError };
  const firstGPS = useRef(false);
  const firstIP = useRef(false);
  const previousRecenter = useRef(recenterTick);
  // A GPS fix may change every second. It must NEVER tear down an open race
  // popup or recreate distant race pins. The popup has its own event location.
  const playerMarkerKey = useMemo(() => JSON.stringify(players.map(person => [
    person.id, person.location.lat, person.location.lng, person.colorHex, person.source,
  ])), [players]);
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
        callbacks.current.onTilesLoaded();
        setReady(true);
      } catch {
        callbacks.current.onTilesError();
      }
    };
    const onFailure = () => {
      // A tile or style load failure is not an invented GPS fix.
      callbacks.current.onTilesError();
    };
    map.on('style.load', onStyle);
    map.on('error', onFailure);
    return () => {
      map.off('style.load', onStyle);
      map.off('error', onFailure);
      activeRunPopupRef.current?.remove();
      activeRunPopupRef.current = null;
      hostPopupRef.current?.remove();
      hostPopupRef.current = null;
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
          element: markerElement('gps', '#1b80ff'),
          anchor: 'center',
        }).setLngLat([userCoords.lng, userCoords.lat]).addTo(map);
      } else {
        gpsMarkerRef.current.setLngLat([userCoords.lng, userCoords.lat]);
      }
    } else {
      gpsMarkerRef.current?.remove();
      gpsMarkerRef.current = null;
    }
  }, [ready, userCoords?.lat, userCoords?.lng]);

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
    for (const item of [...visiblePlayersRef.current, ...visibleRunsRef.current]) {
      const geo = item.point;
      const geographicMatch = validMapPoint(geo) && bounds.contains([geo.lng, geo.lat]);
      const screen = geographicMatch ? map.project([geo.lng, geo.lat]) : { x: NaN, y: NaN };
      const visible = markerInViewport(geographicMatch, screen, viewport);
      // An inline style wins over the decorative CSS display:grid rule.
      item.marker.getElement().style.display = visible ? '' : 'none';
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
    const closeHostPopup = () => {
      hostPopupRef.current?.remove();
      hostPopupRef.current = null;
    };
    const openAt = (position: MapCoordinate) => {
      if (Date.now() - lastOpened < 900) return;
      lastOpened = Date.now();
      ignoreMapClickUntilRef.current = Date.now() + 900;
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
      closeHostPopup();

      const root = document.createElement('div');
      root.className = 'runnit-gl-host-details';
      const title = document.createElement('strong');
      title.textContent = 'HIER RENNEN VERANSTALTEN';
      root.appendChild(title);
      const info = document.createElement('p');
      info.textContent = Math.round(mapDistanceMeters(gps, position)) + ' m von deinem GPS-Standort · innerhalb des ' + HOST_PLACEMENT_RADIUS_METERS + '-m-Radars';
      root.appendChild(info);
      const create = document.createElement('button');
      create.type = 'button';
      create.className = 'runnit-gl-host-cta';
      create.textContent = 'RENNEN HIER ERSTELLEN »';
      create.addEventListener('click', (event) => {
        event.stopPropagation();
        closeHostPopup();
        callbacks.current.onHostAt(position);
      });
      root.appendChild(create);
      const popup = new Popup({
        className: 'runnit-gl-host-popup',
        closeButton: true,
        closeOnClick: false,
        closeOnMove: false,
        maxWidth: '300px',
        offset: 12,
      }).setLngLat([position.lng, position.lat]).setDOMContent(root);
      popup.setPadding({ top: 185, right: 16, bottom: 150, left: 16 });
      popup.on('close', () => {
        if (hostPopupRef.current === popup) hostPopupRef.current = null;
      });
      popup.addTo(map);
      hostPopupRef.current = popup;
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
      const marker = new Marker({ element: el, anchor: 'center' })
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
    const visibleMarkers: Array<{ marker: Marker; point: MapCoordinate }> = [];
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
      const marker = new Marker({ element: el, anchor: 'bottom' })
        .setLngLat(eventPopupLngLat(originalRun))
        .addTo(map);
      markers.push(marker);
      visibleMarkers.push({ marker, point: originalRun.location });

      el.addEventListener('click', (event) => {
        // Prevent MapLibre's background-click handler from instantly closing it.
        event.preventDefault();
        event.stopPropagation();

        const selectedRun = liveRunsRef.current.find(run => run.id === originalRun.id);
        if (!selectedRun || !finiteCoords(selectedRun.location)) return;
        const eventPosition = eventPopupLngLat(selectedRun);
        closePopup();
        hostPopupRef.current?.remove();
        hostPopupRef.current = null;
        const popup = new Popup({
          className: 'runnit-gl-race-popup',
          maxWidth: '290px',
          offset: 23,
          closeButton: true,
          closeOnClick: false,
          closeOnMove: false,
        })
          .setLngLat(eventPosition)
          .setDOMContent(detailElement(selectedRun,
            () => callbacks.current.onJoinRun(selectedRun.id),
            () => callbacks.current.onCancelRun(selectedRun.id)));
        popup.setPadding({ top: 190, right: 18, bottom: 155, left: 18 });
        popup.on('close', () => {
          if (activeRunPopupRef.current === popup) activeRunPopupRef.current = null;
        });
        popup.addTo(map);
        activeRunPopupRef.current = popup;
        callbacks.current.onSelectRun(selectedRun.id);

        // If the tapped event is underneath the top tabs or bottom dock,
        // move the camera to THIS event, never to the runner's GPS location.
        const point = map.project(eventPosition);
        const { clientWidth, clientHeight } = map.getContainer();
        if (point.y < 330 || point.y > clientHeight - 235 ||
            point.x < 25 || point.x > clientWidth - 25) {
          map.easeTo({ center: eventPosition, offset: [0, 90], duration: 260 });
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
      <div ref={canvasRef} className="runnit-gl-canvas" role="application" aria-label="Dreidimensionale Karte mit Rennen in deiner Nähe" />
      <button
        type="button"
        className="runnit-gl-tilt-button"
        aria-label={tilted ? 'Zur flachen 2D-Karte wechseln' : 'Zur schrägen 3D-Karte wechseln'}
        aria-pressed={tilted}
        onClick={() => {
          const next = !tilted;
          setTilted(next);
          mapRef.current?.easeTo({ pitch: next ? PITCH_DEGREES : 0, bearing: next ? BEARING_DEGREES : 0, duration: 350 });
        }}
      >{tilted ? '3D' : '2D'}</button>
    </>
  );
}
