import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getMapLibreStyleUrls } from './helpers/mapLibreStyleUrls.mjs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Splash, Home, Stats and Leaderboard remain separate routes', () => {
  const s=read('src/App.tsx');for(const p of ['/','/home','/stats','/leaderboard'])assert.ok(s.includes('path="'+p+'"'),p);assert.match(s,/<HomeScreen/);assert.match(s,/<DashboardScreen/);
});

test('Home uses read-only persisted race history with no sensor or mutation side effects', () => {
  const s=read('src/screens/DashboardScreen.tsx');assert.match(s,/useRunnerHistory/);assert.doesNotMatch(s,/watchPosition|navigator\.geolocation|submitDuelResult|\.insert\(/);
});

test('launch screen has no extra feature buttons, geolocation or backend requests', () => {
  const launch = read('src/screens/HomeScreen.tsx');
  assert.match(launch, /src="\/runnit-launch-portrait\.avif"/);
  assert.match(launch, /onClick=\{onStart\}/);
  assert.match(launch, /onClick=\{onContinueAsGuest\}/);
  assert.doesNotMatch(launch, /to="\/map"|to="\/sprint-lab"|<BottomNav/);
  assert.doesNotMatch(launch, /navigator\.geolocation|watchPosition|from ['"][^'"]*supabase/i);
});

test('bottom navigation Start leads to the old dashboard, Karte remains separate', () => {
  const nav = read('src/components/ui/BottomNav.tsx');
  assert.match(nav, /href: '\/home', label: 'Start'/);
  assert.match(nav, /href: '\/map', label: 'Karte'/);
});

test('map has a neutral initial center and explicit tile failure handling', () => {
  const map = read('src/screens/MapScreen.tsx');
  assert.match(map, /lat: 22, lng: 0/);
  assert.match(map, /onTilesError/);
  const vector = read('src/components/map/ArcadeMapLibreView.tsx');
  assert.equal(getMapLibreStyleUrls(vector).STYLE_URL, 'https://tiles.openfreemap.org/styles/liberty');
  assert.match(vector, /map\.setStyle\(STYLE_URL\)/);
  assert.doesNotMatch(map, /setTileProvider|tileProvider/);
  assert.match(map, /setTileRetryCount/);
  assert.match(map, /mapTilesUnavailable/);
  assert.match(map, /Noch kein Standort ermittelt/);
});


test('Stats is the sole personal weekly steps and distance screen', () => {
  const home=read('src/screens/DashboardScreen.tsx');const stats=read('src/screens/StatsScreen.tsx');assert.match(stats,/SCHRITTE/);assert.match(stats,/STRECKE/);assert.doesNotMatch(home,/SCHRITTE|KALORIEN|runnit-game-activity/);
});
