import { useEffect, useMemo, useRef, useState } from 'react';
import { Map as GLMap, Marker, Popup, setWorkerUrl } from 'maplibre-gl';
import type { GeoJSONSource } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { ArcadeMapEntry } from './ArcadeMapChrome';

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
  players: readonly ArcadeVectorPlayer[];
  runs: readonly ArcadeVectorRun[];
  onSelectRun: (id: string) => void;
  onJoinRun: (id: string) => void;
  onCancelRun: (id: string) => void;
  onGhostClick: () => void;
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

function markerElement(kind: 'gps' | 'runner' | 'run', color: string, isDemo = false) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'runnit-gl-marker runnit-gl-' + kind + (isDemo ? ' is-demo' : '');
  el.style.setProperty('--runnit-pin', color);
  el.setAttribute('aria-label', kind === 'gps' ? 'Dein GPS-Standort' : kind === 'run' ? 'Rennmarker öffnen' : 'Läufer anzeigen');
  el.textContent = kind === 'gps' ? '' : '🏃';
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
  initialCenter, initialZoom, userCoords, ipCoords, recenterTick, retryTick,
  players, runs, onSelectRun, onJoinRun, onCancelRun, onGhostClick,
  onTilesLoaded, onTilesError,
}: ArcadeMapLibreProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GLMap | null>(null);
  const [ready, setReady] = useState(false);
  const [tilted, setTilted] = useState(true);
  const callbacks = useRef({ onSelectRun, onJoinRun, onCancelRun, onGhostClick, onTilesLoaded, onTilesError });
  callbacks.current = { onSelectRun, onJoinRun, onCancelRun, onGhostClick, onTilesLoaded, onTilesError };
  const firstGPS = useRef(false);
  const firstIP = useRef(false);
  const previousRecenter = useRef(recenterTick);
  const dataKey = useMemo(() => JSON.stringify({ userCoords, players, runs }), [userCoords, players, runs]);

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
      antialias: true,
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

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const markers: Marker[] = [];
    const popups: Popup[] = [];
    const createMarker = (position: MapCoordinate, element: HTMLElement, onClick?: () => void) => {
      if (!finiteCoords(position)) return undefined;
      const marker = new Marker({ element, anchor: 'bottom' })
        .setLngLat([position.lng, position.lat])
        .addTo(map);
      if (onClick) element.addEventListener('click', onClick);
      markers.push(marker);
      return marker;
    };
    if (userCoords) createMarker(userCoords, markerElement('gps', '#1b80ff'));
    for (const person of players) {
      // Never draw server-unverified ghosts with invented coordinates.
      if (person.source === 'server-unverified') continue;
      createMarker(person.location, markerElement('runner', person.colorHex, person.source === 'demo'), () => callbacks.current.onGhostClick());
    }
    for (const run of runs) {
      const pin = markerElement('run', run.isOwn ? '#c9ff0b' : '#f13edc', run.isDemo);
      const marker = createMarker(run.location, pin, () => callbacks.current.onSelectRun(run.id));
      if (!marker) continue;
      const popup = new Popup({ className: 'runnit-gl-race-popup', maxWidth: '290px', offset: 23, closeButton: true, closeOnClick: true })
        .setLngLat([run.location.lng, run.location.lat])
        .setDOMContent(detailElement(run,
          () => callbacks.current.onJoinRun(run.id),
          () => callbacks.current.onCancelRun(run.id)));
      marker.setPopup(popup);
      popups.push(popup);
    }
    return () => {
      for (const popup of popups) popup.remove();
      for (const marker of markers) marker.remove();
    };
  }, [ready, dataKey]);

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
