import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reconcileOpenRaces } from '../src/lib/reconcileOpenRaces.ts';
import { buildCommunityCollections } from '../src/lib/mapCommunityLayers.ts';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('background race refresh preserves order and keeps own pending race', () => {
  const old = [
    { id: 'a', hostUserId: 'other', distanceMeters: 50 },
    { id: 'mine', hostUserId: 'self', distanceMeters: 75 },
    { id: 'b', hostUserId: 'other', distanceMeters: 100 },
  ];
  const incoming = [
    { id: 'b', hostUserId: 'other', distanceMeters: 100 },
    { id: 'a', hostUserId: 'other', distanceMeters: 75 },
    { id: 'new', hostUserId: 'other', distanceMeters: 50 },
  ];
  const result = reconcileOpenRaces(old, incoming, 'self');
  assert.deepEqual(result.map(x => x.id), ['a', 'mine', 'b', 'new']);
  assert.equal(result[0].distanceMeters, 75);
  assert.deepEqual(old.map(x => x.id), ['a', 'mine', 'b']);
});

test('cancelled or missing foreign races disappear while own demo is not retained', () => {
  const old = [
    { id: 'gone', hostUserId: 'other' },
    { id: 'demo-run-0', hostUserId: 'self' },
    { id: 'my-own', hostUserId: 'self' },
  ];
  assert.deepEqual(reconcileOpenRaces(old, [], 'self').map(x => x.id), ['my-own']);
  assert.deepEqual(reconcileOpenRaces([], [{ id: 'new', hostUserId: 'x' }], 'self').map(x => x.id), ['new']);
});

test('regional clusters cannot count demo players, demo races or the device GPS', () => {
  const collections = buildCommunityCollections([
    { id: 'r1', lat: 48.947, lng: 9.42, kind: 'race', isOwn: true },
    { id: 'r1', lat: 48.947, lng: 9.42, kind: 'race' },
    { id: 'r2', lat: 52.5, lng: 13.4, kind: 'race' },
    { id: 'fake-player', lat: 48.948, lng: 9.423, kind: 'demo-player' },
    { id: 'fake-race', lat: 48.949, lng: 9.427, kind: 'demo-race' },
    { id: 'invalid', lat: NaN, lng: 9.42, kind: 'race' },
  ], { lat: 48.9, lng: 9.4 });
  assert.equal(collections.real.features.length, 2);
  assert.equal(collections.demo.features.length, 2);
  assert.equal(collections.gps.features.length, 1);
  assert.deepEqual(collections.real.features[1].geometry.coordinates, [13.4, 52.5]);
  assert.ok(collections.real.features.every(f => f.geometry.coordinates[0] !== 9.4));
});

test('country map uses MapLibre clustering with real totals and zoom-to-explore', () => {
  const moduleSource = read('src/lib/mapCommunityLayers.ts');
  const mapSource = read('src/components/map/ArcadeMapLibreView.tsx');
  const screen = read('src/screens/MapScreen.tsx');
  assert.match(moduleSource, /cluster: true, clusterMaxZoom: 11, clusterRadius: 52/);
  assert.match(moduleSource, /\['get', 'point_count_abbreviated'\]/);
  assert.match(moduleSource, /'circle-radius': \['step', \['get', 'point_count'\]/);
  assert.match(mapSource, /map\.on\('click', COMMUNITY_CLUSTER_LAYER, onCommunityClusterClick\)/);
  assert.match(mapSource, /map\.easeTo\(\{ center: \[coordinates\[0\], coordinates\[1\]\]/);
  assert.match(screen, /regionalRuns=\{regionalRuns\}/);
  assert.match(screen, /\.eq\('status', 'open'\)/);
  assert.match(screen, /\.select\('id, location'\)/);
  assert.match(screen, /!authUser \|\| !wideMapView/);
  assert.match(screen, /DEMO · BEISPIELRENNEN/);
});

test('automatic refresh cannot inject loading banners, reorder selected card or shift list', () => {
  const screen = read('src/screens/MapScreen.tsx');
  const chrome = read('src/components/map/ArcadeMapChrome.tsx');
  const css = read('src/styles/arcadeMap.css');
  assert.doesNotMatch(screen, /Loading…/);
  assert.doesNotMatch(chrome, /sort\(\(a, b\) => Number\(b\.id === selectedId\)/);
  assert.match(chrome, /const orderedEntries = entries/);
  assert.match(screen, /discoveryLoadedRef\.current/);
  assert.match(screen, /window\.setInterval\(\(\) => setDiscoveryRefreshTick/);
  assert.match(css, /overflow-anchor:none/);
  assert.match(chrome, /runnit-arcade-live-dot/);
});

test('touch popups fit the iPhone viewport and action toasts expire', () => {
  const css = read('src/styles/maplibreArcade.css');
  const screen = read('src/screens/MapScreen.tsx');
  assert.match(css, /position:fixed!important/);
  assert.match(css, /max-width:calc\(100vw - 26px\)!important/);
  assert.match(css, /max-height:min\(50dvh,380px\)/);
  assert.match(screen, /setTimeout\(\(\) => setRaceNotice\(null\), 4200\)/);
});
