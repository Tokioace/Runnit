import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('main secondary pages share the same visual shell without modifying the approved home page', () => {
  const frame = read('src/components/ui/PageFrame.tsx');
  assert.match(frame, /bg-\[#090b13\]/);
  assert.match(frame, /from-violet-500/);
  assert.match(frame, /text-emerald-300/);
  assert.match(frame, /<BottomNav/);
  for (const file of ['LeaderboardScreen.tsx', 'ProfileScreen.tsx', 'GpsLabScreen.tsx']) {
    const page = read('src/screens/' + file);
    assert.match(page, /import PageFrame from/);
    assert.match(page, /<PageFrame/);
  }
  const home = read('src/screens/HomeScreen.tsx');
  assert.match(home, /RUNNIT – Challenge/);
});

test('mobile sheet appears above the map buttons and has an accessible close control', () => {
  const sheet = read('src/components/ui/BottomSheet.tsx');
  assert.match(sheet, /z-\[1100\]/);
  assert.match(sheet, /aria-modal="true"/);
  assert.match(sheet, /aria-label="Dialog schließen"/);
  assert.match(sheet, /safe-area-inset-bottom/);
});

test('revised map keeps keyless OSM tiles, map state and real GPS controls', () => {
  const map = read('src/screens/MapScreen.tsx');
  assert.match(map, /tile\.openstreetmap\.org/);
  assert.doesNotMatch(map, /basemaps\.cartocdn\.com/);
  assert.match(map, /watchPosition/);
  assert.match(map, /<RaceOverlay/);
  assert.match(map, /submitDuelResult/);
  assert.match(map, /<BottomSheet/);
  assert.match(map, /<BottomNav/);
  const css = read('src/index.css');
  assert.match(css, /\.runnit-map \.leaflet-tile-pane/);
  assert.match(css, /\.leaflet-control-attribution/);
});

test('restyling preserves demo provenance and does not invent real rankings', () => {
  const leaderboard = read('src/screens/LeaderboardScreen.tsx');
  const profile = read('src/screens/ProfileScreen.tsx');
  const sheet = read('src/components/leaderboard/Sheet.tsx');
  assert.match(leaderboard, /source="demo"/);
  assert.match(leaderboard, /Die dargestellten Zeiten und Namen sind erfunden/);
  assert.match(profile, /useSupabaseUser\(\)/);
  assert.doesNotMatch(profile, /<AccountAuthPanel/);
  assert.match(profile, /<AccountDetailsPanel/);
  assert.match(profile, /<AccountDetailsPanel/);
  assert.doesNotMatch(profile, /Runner8|9\\.33 s|Demo-Level|Demo-Profil/);
  assert.match(sheet, /partitionLeaderboard\(entries\)/);
  assert.match(sheet, /keine verifizierten Sprint-Ranglisten/);
});

test('GPS lab separates opt-in walking sensors from synthetic race simulations', () => {
  const source = read('src/screens/GpsLabScreen.tsx');
  assert.match(source, /runGpsSimulation/);
  assert.match(source, /Zwei klar getrennte Testbereiche/);
  assert.match(source, /Sprint-Szenarien darunter verwenden ausschließlich künstliche Daten/);
  assert.match(source, /REAL DATA LAB/);
  assert.match(source, /<WalkingLab\s*\/>/);
  assert.match(source, /watchPosition\s*\(/);
  assert.match(source, /clearWatch\s*\(/);
  assert.match(source, /requestPermission\s*\(/);
  assert.match(source, /Kein Live-Rennen|keine Rangliste/i);
  assert.doesNotMatch(source, /submitDuelResult|saveRaceResult/);
});
