import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import { getMapLibreStyleUrls } from './helpers/mapLibreStyleUrls.mjs';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('MapLibre replaces only Leaflet rendering; secure race operations stay in MapScreen', () => {
  const map = read('src/screens/MapScreen.tsx');
  assert.match(map, /<ArcadeMapLibreView/);
  assert.doesNotMatch(map, /<MapContainer|<TileLayer|<MapBadgeMarker|<Popup/);
  assert.match(map, /getNearbyDuels\(supabase, \{ userLocation: discoveryCoords, radiusKm: 5 \}\)/);
  assert.match(map, /onJoinRun=\{joinArcadeRun\}/);
  assert.match(map, /onCancelRun=\{cancelArcadeRun\}/);
  assert.match(map, /onGhostClick=\{\(\) => setGhostOpen\(true\)\}/);
  assert.match(map, /onSelectRun=\{setSelectedRunId\}/);
  assert.match(map, /handleJoinRun\(run\)/);
  assert.match(map, /handleCancelHostedRun\(/);
  assert.match(map, /requireRaceAccount/);
  assert.match(map, /<BottomNav/);
  assert.match(map, /<ArcadeMapChrome/);
  assert.doesNotMatch(map, /runnit-arcade-demo-chip|generateDemoRuns/);
});

test('new MapLibre vector renderer has usable iPhone worker, 3D buildings and bright roads', () => {
  const ml = read('src/components/map/ArcadeMapLibreView.tsx');
  const main = read('src/main.tsx');
  const css = read('src/styles/maplibreArcade.css');
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(pkg.dependencies['maplibre-gl'], '6.17.0');
  assert.equal(lock.packages['node_modules/maplibre-gl'].version, '6.17.0');
  assert.match(ml, /import workerUrl from 'maplibre-gl\/dist\/maplibre-gl-worker\.mjs\?worker&url'/);
  assert.match(ml, /setWorkerUrl\(workerUrl\)/);
  assert.deepEqual(getMapLibreStyleUrls(ml), {
    STYLE_URL: 'https://tiles.openfreemap.org/styles/liberty',
    BUILDING_TILES: 'https://tiles.openfreemap.org/planet',
  });
  assert.match(ml, /type: 'fill-extrusion'/);
  assert.match(ml, /'source-layer': 'building'/);
  assert.match(ml, /PITCH_DEGREES = 46/);
  assert.match(ml, /BEARING_DEGREES = -13/);
  assert.match(ml, /'#b9d8e9'/);
  assert.match(ml, /'#779bb9'/);
  assert.match(ml, /'#3d5c77'/);
  assert.match(ml, /aria-pressed=\{tilted\}/);
  assert.match(ml, /map\.setStyle\(STYLE_URL\)/);
  assert.match(main, /import '\.\/styles\/maplibreArcade\.css'/);
  assert.match(css, /\.maplibregl-ctrl-attrib/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.doesNotMatch(ml, /from ['"][^'"]*supabase/);
});

test('GPS radar and pins are based on actual geometry, not fake centroids', () => {
  const map = read('src/screens/MapScreen.tsx');
  const ml = read('src/components/map/ArcadeMapLibreView.tsx');
  assert.match(ml, /radarPolygon\(userCoords\)/);
  assert.match(ml, /radiusMeters = 500/);
  assert.match(ml, /userCoords && finiteCoords\(userCoords\)/);
  assert.match(ml, /gpsMarkerRef\.current\.setLngLat\(\[userCoords\.lng, userCoords\.lat\]\)/);
  assert.match(ml, /person\.source === 'server-unverified'/);
  assert.match(ml, /if \(run\.isDemo\) addLine\('DEMO/);
  assert.match(ml, /document\.createElement\('div'\)/);
  assert.match(ml, /textContent =/);
  assert.doesNotMatch(ml, /setHTML\(|innerHTML\s*=/);
  assert.match(map, /onTilesError=\{\(\) => setMapTilesUnavailable\(true\)\}/);
  assert.match(map, /onTilesLoaded=\{\(\) => setMapTilesUnavailable\(false\)\}/);
});

test('a marker popup shows one exact run; LISTE remains an independent search view', () => {
  const ml = read('src/components/map/ArcadeMapLibreView.tsx');
  const chrome = read('src/components/map/ArcadeMapChrome.tsx');
  assert.match(ml, /const popup = new Popup/);
  assert.match(ml, /const detail = detailElement\(selectedRun,/);
  assert.match(ml, /\.setDOMContent\(detail\)/);
  assert.match(ml, /callbacks\.current\.onSelectRun\(selectedRun\.id\)/);
  assert.match(ml, /callbacks\.current\.onJoinRun\(selectedRun\.id\)/);
  assert.match(ml, /callbacks\.current\.onCancelRun\(selectedRun\.id\)/);
  assert.doesNotMatch(ml, /setArcadeMapView\('list'\)/);
  assert.match(chrome, /type ArcadeMapView = 'map' \| 'list'/);
  assert.match(chrome, /onViewChange\('map'\)/);
  assert.match(chrome, /onViewChange\('list'\)/);
  assert.match(chrome, /aria-pressed/);
  assert.match(chrome, /orderedEntries\.map/);
  assert.match(chrome, /NOCH KEINE RENNEN/);
  assert.match(chrome, /onJoin\(entry\.id\)/);
  assert.match(chrome, /onCancel\(entry\.id\)/);
  assert.doesNotMatch(chrome, /onClick=\{onHost\}>RENNEN VERANSTALTEN/);
  assert.match(chrome, /Halte einen Punkt innerhalb deines 500-m-Radars/);
  assert.doesNotMatch(chrome, /watchPosition|from ['"][^'"]*supabase/);
});

test('map has no permanent race cards and preserves demo distinction', () => {
  const map = read('src/screens/MapScreen.tsx');
  const chrome = read('src/components/map/ArcadeMapChrome.tsx');
  assert.doesNotMatch(map, /runnit-arcade-controls|runnit-arcade-map-preview/);
  assert.doesNotMatch(chrome, /runnit-arcade-map-preview|is-preview-card/);
  assert.doesNotMatch(map, /DEMO · BEISPIELRENNEN/);
  assert.match(chrome, /DEMO · FIKTIVER GEGNER/);
  assert.match(chrome, /to="\/sprint-lab"/);
  assert.match(read('src/styles/maplibreArcade.css'), /runnit-gl-run-details/);
  assert.match(read('src/styles/arcadeMap.css'), /runnit-arcade-map-switch/);
});


test('distant event popup is pinned to its own GPS coordinates, not the viewer GPS point', async () => {
  const { eventPopupLngLat } = await import('../src/lib/mapPopupAnchor.ts');
  const ownGps = { lat: 48.947, lng: 9.426 };
  const pinkEvent = { id: 'pink-300m', location: { lat: 48.949, lng: 9.430 } };
  const fartherEvent = { id: 'pink-5km', location: { lat: 48.977, lng: 9.466 } };
  assert.deepEqual(eventPopupLngLat(pinkEvent), [9.430, 48.949]);
  assert.deepEqual(eventPopupLngLat(fartherEvent), [9.466, 48.977]);
  assert.notDeepEqual(eventPopupLngLat(pinkEvent), [ownGps.lng, ownGps.lat]);
  assert.notDeepEqual(eventPopupLngLat(fartherEvent), eventPopupLngLat(pinkEvent));
  assert.throws(() => eventPopupLngLat({ location: { lat: NaN, lng: 9.4 } }), RangeError);
});

test('race popup persists through GPS updates and map movement, while runner markers keep leaderboard action', () => {
  const ml = read('src/components/map/ArcadeMapLibreView.tsx');
  const screen = read('src/screens/MapScreen.tsx');
  assert.match(ml, /const runMarkerKey = useMemo/);
  assert.match(ml, /const playerMarkerKey = useMemo/);
  assert.doesNotMatch(ml, /dataKey\s*=\s*useMemo/);
  assert.match(ml, /liveRunsRef\.current = runs/);
  assert.match(ml, /const selectedRun = liveRunsRef\.current\.find\(run => run\.id === originalRun\.id\)/);
  assert.match(ml, /const eventPosition = eventPopupLngLat\(selectedRun\)/);
  assert.match(ml, /popup\.addTo\(map\)/);
  assert.match(ml, /activeRunPopupRef\.current = popup/);
  assert.match(ml, /closeOnClick: false/);
  assert.match(ml, /closeOnMove: false/);
  assert.match(ml, /map\.easeTo\(\{ center: eventPosition/);
  assert.match(ml, /\}, \[ready, runMarkerKey\]\)/);
  assert.match(ml, /gpsMarkerRef\.current\.setLngLat/);
  assert.match(ml, /callbacks\.current\.onGhostClick\(\)/);
  assert.match(screen, /view=\{arcadeMapView\}/);
});


test('real challenges stay steady across GPS drift without generated fake map points', () => {
  const screen = read('src/screens/MapScreen.tsx');
  assert.doesNotMatch(screen, /demoOrigin|generateDemoRuns|generateCityPlayers/);
  assert.match(screen, /setDiscoveryCoords\(previous => !previous \|\|/);
  assert.match(screen, /haversineM\(previous\.lat, previous\.lng, userCoords\.lat, userCoords\.lng\) >= 100/);
  assert.match(screen, /setOpenRuns\(\[\]\)/);
});

test('player markers are circular violet people; race markers are checkered flags independent of range', () => {
  const renderer = read('src/components/map/ArcadeMapLibreView.tsx');
  const css = read('src/styles/maplibreArcade.css');
  assert.match(renderer, /function markerGlyph\(kind: 'runner' \| 'run'\)/);
  assert.match(renderer, /kind === 'runner'/);
  assert.match(renderer, /add\('circle', \{ cx: '12', cy: '7', r: '3\.2' \}\)/);
  assert.match(renderer, /Checkered finish flag/);
  assert.match(renderer, /markerElement\('runner', '#a985ff', person\.source === 'demo'\)/);
  assert.match(renderer, /markerElement\('run', originalRun\.isOwn \? '#c9ff0b' : '#f13edc', originalRun\.isDemo\)/);
  assert.match(css, /\.runnit-gl-marker\.runnit-gl-runner \{/);
  assert.match(css, /border-radius:50%/);
  assert.match(css, /\.runnit-gl-marker\.runnit-gl-run \{/);
  assert.doesNotMatch(renderer, /textContent = kind === 'gps' \? '' : '🏃'/);
  assert.doesNotMatch(renderer, /person\.distanceAwayMeters|originalRun\.distanceAwayMeters.*markerElement/);
});

test('person and event markers preserve independent click semantics', () => {
  const renderer = read('src/components/map/ArcadeMapLibreView.tsx');
  assert.match(renderer, /Demo-Spieler – Rangliste öffnen/);
  assert.match(renderer, /Demo-Rennen – Renndetails öffnen/);
  assert.match(renderer, /callbacks\.current\.onGhostClick\(\)/);
  assert.match(renderer, /onSelectRun\(selectedRun\.id\)/);
  assert.match(renderer, /setLngLat\(eventPopupLngLat\(originalRun\)\)/);
  assert.match(renderer, /setLngLat\(eventPosition\)/);
  assert.match(renderer, /new Marker\(\{ element: markerShell\(el\), anchor: 'center' \}\)/);
  assert.match(renderer, /new Marker\(\{ element: markerShell\(el\), anchor: 'bottom' \}\)/);
});
