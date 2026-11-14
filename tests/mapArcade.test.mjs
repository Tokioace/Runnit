import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('map styling preserves live Leaflet tiles, radar and secure original race handlers', () => {
  const map = read('src/screens/MapScreen.tsx');
  assert.match(map, /<MapContainer/);
  assert.match(map, /url="https:\/\/tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png"/);
  assert.match(map, /radius=\{500\}/);
  assert.match(map, /center=\{\[userCoords\.lat, userCoords\.lng\]\}/);
  assert.match(map, /getNearbyDuels\(supabase, \{ userLocation: userCoords, radiusKm: 5 \}\)/);
  assert.match(map, /<ArcadeMapChrome/);
  assert.match(map, /handleJoinRun\(run\)/);
  assert.match(map, /handleCancelHostedRun\(/);
  assert.match(map, /requireRaceAccount/);
  assert.match(map, /openRuns\.map/);
  assert.match(map, /<BottomNav/);
  assert.match(map, /<Popup>/);
  assert.match(map, /Demo-Modus: einige Spieler oder Rennen sind frei erfunden/);
});
test('map and list share one source and show explicit provenance', () => {
  const chrome = read('src/components/map/ArcadeMapChrome.tsx');
  assert.match(chrome, /type ArcadeMapView = 'map' \| 'list'/);
  assert.match(chrome, /onViewChange\('map'\)/);
  assert.match(chrome, /onViewChange\('list'\)/);
  assert.match(chrome, /aria-pressed/);
  assert.match(chrome, /entries\.find\(\(entry\) => entry\.id === selectedId\)/);
  assert.match(chrome, /entries\.map/);
  assert.match(chrome, /DEMO · FIKTIVER GEGNER/);
  assert.match(chrome, /Abstand nicht verfügbar/);
  assert.match(chrome, /NOCH KEIN DUELL/);
  assert.match(chrome, /NOCH KEINE RENNEN/);
  assert.match(chrome, /onCancel\(entry\.id\)/);
  assert.match(chrome, /onJoin\(entry\.id\)/);
  assert.doesNotMatch(chrome, /watchPosition|from ['"][^'"]*supabase/);
});
test('arcade map design respects attribution, safe areas and real controls', () => {
  const css = read('src/styles/arcadeMap.css');
  assert.match(read('src/main.tsx'), /import '\.\/styles\/arcadeMap\.css'/);
  assert.match(css, /\.runnit-map-arcade \.leaflet-tile-pane/);
  assert.match(css, /\.runnit-map-arcade \.leaflet-control-attribution/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /runnit-arcade-map-preview/);
  assert.match(css, /runnit-arcade-map-switch/);
  assert.doesNotMatch(css, /display:\s*none[^}]*leaflet-control-attribution/);
});
