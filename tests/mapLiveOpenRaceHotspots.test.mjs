import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCommunityCollections, COMMUNITY_SINGLE_SIGNAL_RING } from '../src/lib/mapCommunityLayers.ts';
import { energyOrbId } from '../src/lib/mapEnergyOrb.ts';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('real 01 orb represents precisely one authenticated open race, not the demo or a device location', () => {
  const map = read('src/lib/mapCommunityLayers.ts');
  const renderer = read('src/components/map/ArcadeMapLibreView.tsx');
  assert.equal(COMMUNITY_SINGLE_SIGNAL_RING, 'runnit-community-single-signal-ring');
  assert.equal(energyOrbId('open-race', 1), 'runnit-energy-orb-open-race-1');
  assert.match(map, /id: COMMUNITY_SINGLE_SIGNAL_RING, type: 'symbol', source: COMMUNITY_REAL_SOURCE/);
  assert.match(map, /filter: \['!', \['has', 'point_count'\]\]/);
  assert.match(map, /'icon-image': \['case', \['==', \['get', 'own'\], 1\]/);
  assert.match(map, /'-own-race-1'/);
  assert.match(map, /'-open-race-1'/);
  assert.match(map, /'icon-opacity': \['interpolate', \['linear'\], \['zoom'\],\s*0, 1, 12\.2, 1, 12\.8, 0\]/);
  assert.match(renderer, /map\.on\('click', COMMUNITY_SINGLE_SIGNAL_RING, onCommunityClusterClick\)/);
  assert.match(renderer, /map\.off\('click', COMMUNITY_SINGLE_SIGNAL_RING, onCommunityClusterClick\)/);
});

test('open duel counts must never include user GPS, unverified player locations, or fake examples', () => {
  const collections = buildCommunityCollections([
    { id: 'open-race-1', lat: 48.94, lng: 9.43, kind: 'race' },
    { id: 'open-race-1', lat: 48.94, lng: 9.43, kind: 'race', isOwn: true },
    { id: 'ghost', lat: 48.95, lng: 9.43, kind: 'player' },
    { id: 'sample', lat: 48.96, lng: 9.43, kind: 'demo-race' },
    { id: 'sample-player', lat: 48.97, lng: 9.43, kind: 'demo-player' },
  ], { lat: 48.98, lng: 9.43 });
  assert.equal(collections.real.features.length, 1);
  assert.equal(collections.demo.features.length, 2);
  assert.equal(collections.gps.features.length, 1);
  assert.deepEqual(collections.real.features[0].geometry.coordinates, [9.43, 48.94]);
  assert.equal(collections.real.features[0].properties.own, 1);
  assert.equal(energyOrbId('own-race', 1), 'runnit-energy-orb-own-race-1');
  const screen = read('src/screens/MapScreen.tsx');
  assert.match(screen, /\.eq\('status', 'open'\)/);
  assert.match(screen, /\.select\('id, location, expires_at'\)/);
  assert.match(screen, /new URLSearchParams\(window\.location\.search\)\.get\('hotspotDemo'\) === '1'/);
});

test('one race and multi-race hubs use the same sprite family and show no redundant bright second ring', () => {
  const map = read('src/lib/mapCommunityLayers.ts');
  assert.match(map, /installOnDemandRealEnergyOrbs\(map\)/);
  assert.match(map, /id: COMMUNITY_CLUSTER_LAYER, type: 'symbol', source: COMMUNITY_REAL_SOURCE/);
  assert.match(map, /'icon-image': \['concat', ENERGY_ORB_PREFIX, '-open-race-'/);
  assert.match(map, /'circle-opacity': \['interpolate', \['linear'\], \['zoom'\], 0, \.25, 11, \.25, 12\.2, \.25, 12\.8, 0\]/);
  assert.doesNotMatch(map, /id: COMMUNITY_SINGLE_SIGNAL_RING, type: 'circle'/);
});
