import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import { getMapLibreStyleUrls } from './helpers/mapLibreStyleUrls.mjs';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('MapLibre replaces only Leaflet rendering; secure race operations stay in MapScreen', () => {
  const map = read('src/screens/MapScreen.tsx');
  assert.match(map, /<ArcadeMapLibreView/);
  assert.doesNotMatch(map, /<MapContainer|<TileLayer|<MapBadgeMarker|<Popup/);
  assert.match(map, /getNearbyDuels\(supabase, \{ userLocation: userCoords, radiusKm: 5 \}\)/);
  assert.match(map, /onJoinRun=\{joinArcadeRun\}/);
  assert.match(map, /onCancelRun=\{cancelArcadeRun\}/);
  assert.match(map, /onGhostClick=\{\(\) => setGhostOpen\(true\)\}/);
  assert.match(map, /onSelectRun=\{setSelectedRunId\}/);
  assert.match(map, /handleJoinRun\(run\)/);
  assert.match(map, /handleCancelHostedRun\(/);
  assert.match(map, /requireRaceAccount/);
  assert.match(map, /<BottomNav/);
  assert.match(map, /<ArcadeMapChrome/);
  assert.match(map, /runnit-arcade-demo-chip/);
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
  assert.match(ml, /if \(userCoords\) createMarker\(userCoords/);
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
  assert.match(ml, /setDOMContent\(detailElement\(run/);
  assert.match(ml, /callbacks\.current\.onSelectRun\(run\.id\)/);
  assert.match(ml, /callbacks\.current\.onJoinRun\(run\.id\)/);
  assert.match(ml, /callbacks\.current\.onCancelRun\(run\.id\)/);
  assert.doesNotMatch(ml, /setArcadeMapView\('list'\)/);
  assert.match(chrome, /type ArcadeMapView = 'map' \| 'list'/);
  assert.match(chrome, /onViewChange\('map'\)/);
  assert.match(chrome, /onViewChange\('list'\)/);
  assert.match(chrome, /aria-pressed/);
  assert.match(chrome, /orderedEntries\.map/);
  assert.match(chrome, /NOCH KEINE RENNEN/);
  assert.match(chrome, /onJoin\(entry\.id\)/);
  assert.match(chrome, /onCancel\(entry\.id\)/);
  assert.match(chrome, /onClick=\{onHost\}>RENNEN VERANSTALTEN/);
  assert.doesNotMatch(chrome, /watchPosition|from ['"][^'"]*supabase/);
});

test('map has no permanent race cards and preserves demo distinction', () => {
  const map = read('src/screens/MapScreen.tsx');
  const chrome = read('src/components/map/ArcadeMapChrome.tsx');
  assert.doesNotMatch(map, /runnit-arcade-controls|runnit-arcade-map-preview/);
  assert.doesNotMatch(chrome, /runnit-arcade-map-preview|is-preview-card/);
  assert.match(map, /DEMO · BEISPIELRENNEN/);
  assert.match(chrome, /DEMO · FIKTIVER GEGNER/);
  assert.match(chrome, /to="\/sprint-lab"/);
  assert.match(read('src/styles/maplibreArcade.css'), /runnit-gl-run-details/);
  assert.match(read('src/styles/arcadeMap.css'), /runnit-arcade-map-switch/);
});
