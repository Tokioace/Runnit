import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { groupOverlappingRuns } from '../src/lib/mapRunGrouping.ts';
import { buildCommunityCollections } from '../src/lib/mapCommunityLayers.ts';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('overlapping real races collapse, with own race anchoring a mixed badge', () => {
  const points = [
    { index:0, x: 150, y: 244, isOwn:false, isDemo:true },
    { index:1, x: 154, y: 249, isOwn:true, isDemo:false },
    { index:2, x: 156, y: 243, isOwn:false, isDemo:false },
    { index:3, x: 250, y: 245, isOwn:false, isDemo:true },
  ];
  const copy = JSON.stringify(points);
  const groups = groupOverlappingRuns(points, 42);
  assert.deepEqual(groups[0], { anchor:1, members:[0,1,2], demoCount:1, realCount:2, hasOwn:true });
  assert.deepEqual(groups[1], { anchor:3, members:[3], demoCount:1, realCount:0, hasOwn:false });
  assert.equal(JSON.stringify(points), copy, 'projected positions must never mutate');
});

test('coincident races remain grouped, scattered ones never chain across the map', () => {
  const groups = groupOverlappingRuns([
    {index:0,x:10,y:10,isOwn:false,isDemo:false},
    {index:1,x:40,y:10,isOwn:false,isDemo:false},
    {index:2,x:70,y:10,isOwn:false,isDemo:false},
    {index:3,x:100,y:10,isOwn:false,isDemo:false},
    {index:4,x:200,y:100,isOwn:false,isDemo:false},
    {index:5,x:200,y:100,isOwn:false,isDemo:true},
    {index:6,x:NaN,y:100,isOwn:false,isDemo:false},
  ], 40);
  assert.deepEqual(groups.map(g=>g.members), [[0,1],[2,3],[4,5]]);
  assert.deepEqual(groupOverlappingRuns([], 40), []);
  assert.deepEqual(groupOverlappingRuns([{index:0,x:5,y:5,isOwn:false,isDemo:false}], -1), []);
});

test('group badge zooms in, and identical positions stay accessible in LISTE', () => {
  const map = read('src/components/map/ArcadeMapLibreView.tsx');
  const screen = read('src/screens/MapScreen.tsx');
  const css = read('src/styles/maplibreArcade.css');
  assert.match(map,/groupOverlappingRuns\(eligible/);
  assert.match(map,/button\.classList\.toggle\('is-run-group'/);
  assert.match(map,/item\.marker\.getElement\(\)\.style\.display = 'none'/);
  assert.match(map,/const groupCount = Number\(el\.dataset\.groupCount/);
  assert.match(map,/callbacks\.current\.onOpenRunGroup\(\)/);
  assert.match(map,/zoom: Math\.min\(map\.getZoom\(\) \+ 1\.7, 18\)/);
  assert.match(screen,/onOpenRunGroup=\{\(\) => setArcadeMapView\('list'\)\}/);
  assert.match(css,/runnit-gl-run-group-count/);
  assert.match(css,/is-run-group/);
});

test('mini-host label is clearly proximity, NOT a preselected race distance', () => {
  const map = read('src/components/map/ArcadeMapLibreView.tsx');
  assert.match(map, /'IM RADAR · ' \+ Math\.round\(mapDistanceMeters\(gps, position\)\) \+ ' M VON DIR'/);
  assert.match(map, /create\.textContent = 'WEITER ›'/);
  assert.doesNotMatch(map, /create\.textContent = 'RENNEN HIER ERSTELLEN/);
});

test('global verified challenge remains visible but GPS vanishes at country zoom', () => {
  const layers = read('src/lib/mapCommunityLayers.ts');
  const map = read('src/components/map/ArcadeMapLibreView.tsx');
  assert.match(layers,/COMMUNITY_SINGLE_SIGNAL_RING/);
  assert.match(layers,/COMMUNITY_SINGLE_HALO_LAYER/);
  assert.match(layers,/'circle-opacity': \['interpolate', \['linear'\], \['zoom'\], 11\.5, 0, 12\.2, 0\.78, 12\.8, 0\]/);
  assert.match(layers,/'circle-color': '#2485ff'/);
  assert.match(map,/'background-color',\s*\['interpolate', \['linear'\], \['zoom'\]/);
  assert.match(map,/'fill-color',\s*\['interpolate', \['linear'\], \['zoom'\]/);
});

test('own open race uses smaller mobile popup without weakening cancellation checks', () => {
  const map = read('src/components/map/ArcadeMapLibreView.tsx');
  const screen = read('src/screens/MapScreen.tsx');
  const css = read('src/styles/maplibreArcade.css');
  const arcadeCss = read('src/styles/arcadeMap.css');
  assert.match(map,/selectedRun\.isOwn \? ' is-own-popup' : ''/);
  assert.match(map,/run\.isOwn \? 'DEIN 1V1' : '1v1 DUELL'/);
  assert.match(css,/is-own-popup/);
  assert.match(screen,/result\.status === 'cancelled'/);
  assert.match(screen,/cancelHostedOpenDuel\(supabase, run\.id, authUser\.id\)/);
  assert.match(screen,/runnit-cancel-panel/);
  assert.match(screen,/aria-modal="true" aria-labelledby="cancel-hosted-title"/);
  assert.match(arcadeCss,/runnit-cancel-confirm/);
});


test('community overview never inflates race count with unverified participant locations', () => {
  const collection = buildCommunityCollections([
    {id:'race-1',lat:48.94,lng:9.41,kind:'race',isOwn:true},
    {id:'local-inferred',lat:48.95,lng:9.42,kind:'player'},
    {id:'demo-runner',lat:48.96,lng:9.43,kind:'demo-player'},
    {id:'demo-race',lat:48.97,lng:9.44,kind:'demo-race'},
  ], {lat:48.98,lng:9.4});
  assert.equal(collection.real.features.length, 1);
  assert.equal(collection.demo.features.length, 2);
  assert.equal(collection.gps.features.length, 1);
  assert.deepEqual(collection.real.features[0].geometry.coordinates, [9.41,48.94]);
});
