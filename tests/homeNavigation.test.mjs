import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getMapLibreStyleUrls } from './helpers/mapLibreStyleUrls.mjs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('launch splash and original app dashboard have separate routes', () => {
  const app = read('src/App.tsx');
  assert.ok(app.includes('<Route path="/" element={<HomeScreen'));
  assert.ok(app.includes('<Route path="/home" element={<DashboardScreen displayName={auth.user?.displayName} />} />'));
  assert.match(app, /<Route path="\/map" element=\{<MapScreen \/>\}/);
  assert.match(app, /navigate\('\/home'\)/);
});

test('original dashboard is preserved and remains independent of geolocation and Supabase', () => {
  const dashboard = read('src/screens/DashboardScreen.tsx');
  assert.match(dashboard, /DEIN LAUF\./);
  assert.match(dashboard, /to="\/map"/);
  assert.match(dashboard, /to="\/gps-lab"/);
  assert.match(dashboard, /<BottomNav/);
  assert.doesNotMatch(dashboard, /navigator\.geolocation|watchPosition\s*\(|getCurrentPosition\s*\(/);
  assert.doesNotMatch(dashboard, /from ['"][^'"]*supabase/i);
});

test('launch screen has no extra feature buttons, geolocation or backend requests', () => {
  const launch = read('src/screens/HomeScreen.tsx');
  assert.match(launch, /src="\/runnit-launch-portrait\.avif"/);
  assert.match(launch, /onClick=\{onStart\}/);
  assert.match(launch, /onClick=\{onContinueAsGuest\}/);
  assert.doesNotMatch(launch, /to="\/map"|to="\/sprint-lab"|<BottomNav/);
  assert.doesNotMatch(launch, /navigator\.geolocation|watchPosition|from ['"][^'"]*supabase/i);
});

test('three bottom destinations point to PLAY, MAP and ARENA', () => {
  const nav = read('src/components/ui/BottomNav.tsx');
  assert.match(nav, /href: '\/home', label: 'PLAY'/);
  assert.match(nav, /href: '\/map', label: 'MAP'/);
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


test('Home and Stats are independent full screens', () => {
  const app = read('src/App.tsx');
  const nav = read('src/components/ui/BottomNav.tsx');
  assert.ok(app.includes('<Route path="/home" element={<DashboardScreen displayName={auth.user?.displayName} />} />'));
  assert.ok(app.includes('<Route path="/stats" element={<StatsScreen />} />'));
  assert.doesNotMatch(nav, /href: '\/stats'/);
  assert.match(nav, /href: '\/leaderboard', label: 'ARENA'/);
});
