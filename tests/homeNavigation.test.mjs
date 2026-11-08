import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('start route is a real home page and map lives at /map', () => {
  const app = read('src/App.tsx');
  assert.match(app, /<Route path="\/" element=\{<HomeScreen \/>\}/);
  assert.match(app, /<Route path="\/map" element=\{<MapScreen \/>\}/);
});

test('home page does not request geolocation or import Supabase', () => {
  const home = read('src/screens/HomeScreen.tsx');
  assert.doesNotMatch(home, /navigator\.geolocation|useUserLocation|watchPosition\s*\(|getCurrentPosition\s*\(/);
  assert.doesNotMatch(home, /from ['"][^'"]*supabase/i);
  assert.match(home, /to="\/map"/);
  assert.match(home, /to="\/gps-lab"/);
});

test('bottom navigation has independent Home and Map tabs', () => {
  const nav = read('src/components/ui/BottomNav.tsx');
  assert.match(nav, /href: '\/', label: 'Start'/);
  assert.match(nav, /href: '\/map', label: 'Karte'/);
});

test('map has a neutral initial center and explicit tile failure handling', () => {
  const map = read('src/screens/MapScreen.tsx');
  assert.match(map, /lat: 22, lng: 0/);
  assert.match(map, /tileerror:/);
  assert.match(map, /setTileProvider\('osm'\)/);
  assert.match(map, /mapTilesUnavailable/);
  assert.match(map, /Noch kein Standort ermittelt/);
});
