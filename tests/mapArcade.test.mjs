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
  assert.match(map, /<Popup/);
  assert.match(map, /setSelectedRunId\(r\.id\)/);
  assert.match(map, /<ArcadeRunCard/);
  assert.match(map, /runnit-arcade-demo-chip/);
  assert.match(map, /Demo-Modus: einige Spieler oder Rennen sind frei erfunden/);
});
test('map and list share one source and show explicit provenance', () => {
  const chrome = read('src/components/map/ArcadeMapChrome.tsx');
  assert.match(chrome, /type ArcadeMapView = 'map' \| 'list'/);
  assert.match(chrome, /onViewChange\('map'\)/);
  assert.match(chrome, /onViewChange\('list'\)/);
  assert.match(chrome, /aria-pressed/);
  assert.match(chrome, /const orderedEntries = selectedId/);
  assert.match(chrome, /orderedEntries\.map/);
  assert.match(chrome, /DEMO · FIKTIVER GEGNER/);
  assert.match(chrome, /Abstand nicht verfügbar/);
  assert.doesNotMatch(chrome, /NOCH KEIN DUELL/);
  assert.doesNotMatch(chrome, /runnit-arcade-map-preview/);
  assert.match(chrome, /runnit-arcade-map-host-action/);
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
  assert.doesNotMatch(css, /runnit-arcade-map-preview/);
  assert.match(css, /runnit-arcade-map-switch/);
  assert.doesNotMatch(css, /display:\s*none[^}]*leaflet-control-attribution/);
});

test('mobile map has one event detail card, compact provenance and no separate floating simulation CTA', () => {
  const map = read('src/screens/MapScreen.tsx');
  const chrome = read('src/components/map/ArcadeMapChrome.tsx');
  const styles = read('src/styles/arcadeMap.css');
  assert.match(map, /<Popup/);
  assert.doesNotMatch(map, /runnit-map-demo-link/);
  assert.match(map, /runnit-arcade-demo-chip/);
  assert.match(map, /DEMO · BEISPIELRENNEN/);
  assert.match(chrome, /to="\/sprint-lab"/);
  assert.match(chrome, /Renn-Grafik testen · Nur Simulation/);
  assert.doesNotMatch(map, /runnit-arcade-controls/);
  assert.doesNotMatch(styles, /runnit-arcade-controls/);
  assert.match(styles, /\.runnit-map-arcade \.runnit-arcade-demo-chip/);
});

test('map is free of three removed cards; buttons remain reachable via the list and dock', () => {
  const map = read('src/screens/MapScreen.tsx');
  const chrome = read('src/components/map/ArcadeMapChrome.tsx');
  const dock = read('src/components/ui/BottomNav.tsx');
  assert.doesNotMatch(map, /runnit-arcade-controls|runnit-arcade-map-preview/);
  assert.doesNotMatch(chrome, /runnit-arcade-map-preview|is-preview-card/);
  assert.match(chrome, /onClick=\{onHost\}>RENNEN VERANSTALTEN/);
  assert.match(chrome, /onJoin\(entry\.id\)/);
  assert.match(chrome, /onCancel\(entry\.id\)/);
  assert.match(map, /onHost=\{openHostRun\}/);
  assert.match(map, /onClick=\{\(\) => setSelectedRunId\(r\.id\)\}/);
  assert.match(dock, /Rangliste|RANGLISTE|leaderboard/);
});


test('tapping a race marker opens its own anchored popup, not the list', () => {
  const map = read('src/screens/MapScreen.tsx');
  const chrome = read('src/components/map/ArcadeMapChrome.tsx');
  const styles = read('src/styles/arcadeMap.css');
  const markerBlock = map.split('/* Marker details are an anchored Leaflet popup')[1]?.split('</MapContainer>')[0] || '';
  assert.match(markerBlock, /openRuns\.map\(\(r, index\) =>/);
  assert.match(markerBlock, /onClick=\{\(\) => setSelectedRunId\(r\.id\)\}/);
  assert.match(markerBlock, /<Popup/);
  assert.match(markerBlock, /<ArcadeRunCard/);
  assert.match(markerBlock, /entry=\{arcadeRuns\[index\]\}/);
  assert.doesNotMatch(markerBlock, /setArcadeMapView\('list'\)/);
  assert.match(markerBlock, /autoPanPaddingTopLeft/);
  assert.match(markerBlock, /autoPanPaddingBottomRight/);
  assert.match(chrome, /variant\?: 'list' \| 'popup'/);
  assert.match(chrome, /entries\.length\} angezeigt/);
  assert.match(chrome, /orderedEntries\.map/);
  assert.match(styles, /\.leaflet-popup\.runnit-arcade-marker-popup/);
  assert.doesNotMatch(chrome, /runnit-arcade-map-preview/);
  assert.match(map, /onJoin=\{joinArcadeRun\}/);
  assert.match(map, /onCancel=\{cancelArcadeRun\}/);
});
