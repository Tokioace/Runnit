import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getMapLibreStyleUrls } from './helpers/mapLibreStyleUrls.mjs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('main secondary pages share the same visual shell without modifying the approved home page', () => {
  const frame = read('src/components/ui/PageFrame.tsx');
  assert.match(frame, /runnit-street/);
  assert.match(frame, /runnit-display--shine/);
  assert.match(frame, /runnit-speedline/);
  assert.match(frame, /runnit-metal/);
  assert.match(frame, /safe-area-inset-top/);
  assert.match(frame, /<BottomNav/);
  const css = read('src/index.css');
  for (const visualToken of ['--runnit-cyan', '--runnit-magenta', '--runnit-violet', '.runnit-panel', '.runnit-arcade-button']) {
    assert.ok(css.includes(visualToken), visualToken);
  }
  const gpsLab = read('src/screens/GpsLabScreen.tsx');
  assert.match(gpsLab, /import PageFrame from/);
  assert.match(gpsLab, /<PageFrame/);
  // Leaderboard now has its own user-reference Y2K shell and existing BottomNav.
  const leaderboard = read('src/screens/LeaderboardScreen.tsx');
  assert.match(leaderboard, /runnit-ranking-screen/);
  assert.match(leaderboard, /<BottomNav/);
  assert.doesNotMatch(leaderboard, /<PageFrame/);
  // Profile now has its own reference-based Arcade shell, like Home/Stats.
  const profile = read('src/screens/ProfileScreen.tsx');
  assert.match(profile, /runnit-profile-master/);
  assert.match(profile, /<BottomNav/);
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

test('revised map keeps keyless OSM vector tiles, map state and real GPS controls', () => {
  const map = read('src/screens/MapScreen.tsx');
  assert.match(map, /<ArcadeMapLibreView/);
  const vector = read('src/components/map/ArcadeMapLibreView.tsx');
  assert.equal(getMapLibreStyleUrls(vector).STYLE_URL, 'https://tiles.openfreemap.org/styles/liberty');
  assert.match(map, /watchPosition/);
  assert.match(map, /<RaceOverlay/);
  assert.match(map, /submitDuelResult/);
  assert.match(map, /<BottomSheet/);
  assert.match(map, /<BottomNav/);
  const css = read('src/styles/maplibreArcade.css');
  assert.match(css, /\.maplibregl-ctrl-attrib/);
  assert.match(css, /safe-area-inset-bottom/);
});

test('Rankings explicitly disclose beta status and use confirmed opt-in RPC', () => {
  const s=read('src/screens/LeaderboardScreen.tsx');const profile=read('src/screens/ProfileScreen.tsx');assert.match(s,/list_beta_duel_leaderboard/);assert.match(s,/Noch keine unabhängige Anti-Cheat-Verifizierung/);assert.match(profile,/leaderboard_opt_in/);assert.doesNotMatch(s,/source: 'demo'|showcase/);
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
