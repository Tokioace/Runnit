import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildHotspotTestData, HOTSPOT_TEST_SCENARIOS } from '../src/lib/mapHotspotSignals.ts';
import { buildCommunityCollections } from '../src/lib/mapCommunityLayers.ts';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('demo has exactly 3 open races, 10 runners and 25 running matches in three cities', () => {
  assert.deepEqual(HOTSPOT_TEST_SCENARIOS.map(s => [s.city, s.count, s.kind]), [
    ['Backnang', 3, 'open-race'],
    ['Stuttgart', 10, 'visible-runner'],
    ['München', 25, 'running-match'],
  ]);
  const { points, centers } = buildHotspotTestData(true);
  assert.equal(points.features.length, 38);
  assert.equal(centers.features.length, 3);
  for(const scenario of HOTSPOT_TEST_SCENARIOS) {
    const matches = points.features.filter(p => p.properties.cityId === scenario.cityId);
    assert.equal(matches.length, scenario.count);
    assert.ok(matches.every(p=>p.properties.kind === scenario.kind && p.properties.simulated === 1));
    assert.ok(matches.every(p => Number.isFinite(p.geometry.coordinates[0]) &&
      Number.isFinite(p.geometry.coordinates[1])));
  }
  assert.deepEqual(buildHotspotTestData(true), buildHotspotTestData(true), 'stable refresh should never shift the demo');
});

test('simulation is empty until explicitly enabled and never leaks to genuine community counts', () => {
  const empty = buildHotspotTestData(false);
  assert.equal(empty.points.features.length, 0);
  assert.equal(empty.centers.features.length, 0);
  const real = buildCommunityCollections([
    { id: 'confirmed-race', lat: 48.945, lng: 9.431, kind: 'race' },
    { id: 'confirmed-race', lat: 48.945, lng: 9.431, kind: 'race' },
    { id: 'some-player', lat: 48.945, lng: 9.431, kind: 'player' },
    { id: 'fake-1', lat: 48.945, lng: 9.431, kind: 'demo-race' },
    { id: 'fake-2', lat: 48.945, lng: 9.431, kind: 'demo-player' },
  ], { lat: 48.945, lng: 9.43 });
  assert.equal(real.real.features.length, 1, 'real open race only');
  assert.equal(real.demo.features.length, 2, 'existing demo content isolated');
  assert.equal(real.gps.features.length, 1, 'viewer GPS is not an active runner');
});

test('real heatmap reads ONLY verified open-race source and is density-sensitive', () => {
  const heat = read('src/lib/mapHotspotSignals.ts');
  const real = read('src/lib/mapCommunityLayers.ts');
  const renderer = read('src/components/map/ArcadeMapLibreView.tsx');
  assert.match(renderer, /installRealHotspotHeat\(map, COMMUNITY_REAL_SOURCE, 'runnit-community-single-glows'\)/);
  assert.match(heat, /id: REAL_HEAT_LAYER,\s*type: 'heatmap',\s*source: realSourceId/);
  assert.match(heat, /'heatmap-weight': \['interpolate', \['linear'\], \['coalesce', \['get', 'point_count'\], 1\]/);
  assert.match(heat, /1, \.14, 3, \.3, 10, \.62, 25, 1/);
  assert.match(heat, /'heatmap-opacity': \['interpolate', \['linear'\], \['zoom'\], 0, \.30/);
  assert.match(real, /else if \(item\.kind === 'race'\)/);
  assert.doesNotMatch(heat.slice(heat.indexOf('export function installRealHotspotHeat'), heat.indexOf('function addSimulationHeat')), /HOTSPOT_TEST_SOURCE/);
});

test('simulation has separate GeoJSON sources and color-coded player/match/race thermal lanes', () => {
  const layer = read('src/lib/mapHotspotSignals.ts');
  assert.match(layer, /HOTSPOT_TEST_SOURCE = 'runnit-hotspot-test-points'/);
  assert.match(layer, /HOTSPOT_TEST_CENTERS_SOURCE = 'runnit-hotspot-test-centers'/);
  assert.match(layer, /filter: \['==', \['get', 'kind'\], kind\]/);
  assert.match(layer, /'open-race', 'runnit-test-open-heat'/);
  assert.match(layer, /'visible-runner', 'runnit-test-runner-heat'/);
  assert.match(layer, /'running-match', 'runnit-test-running-heat'/);
  assert.match(layer, /'circle-stroke-color': \['case', \['has', 'point_count'\], '#73edff'/);
  assert.match(layer, /'text-field': \['to-string', \['coalesce', \['get', 'total'\], \['get', 'count'\]\]\]/);
  assert.match(layer, /'text-offset': \[0, 0\], 'text-anchor': 'center'/);
  assert.match(layer, /id: 'runnit-test-detail-dots', type: 'circle', source: HOTSPOT_TEST_SOURCE/);
  assert.match(layer, /minzoom: 12\.2/);
  assert.match(layer, /12\.2, 0, 12\.8, \.8, 14, 1/);
  assert.match(layer, /syncHotspotTestLayers\(map: GLMap, enabled: boolean\)/);
});

test('demo control needs explicit ?hotspotDemo=1 and cannot create Supabase events', () => {
  const screen = read('src/screens/MapScreen.tsx');
  const renderer = read('src/components/map/ArcadeMapLibreView.tsx');
  const module = read('src/lib/mapHotspotSignals.ts');
  assert.match(screen, /new URLSearchParams\(window\.location\.search\)\.get\('hotspotDemo'\) === '1'/);
  assert.match(screen, /hotspotDemoEnabled=\{hotspotDemoEnabled\}/);
  assert.match(screen, /hotspotFocus=\{hotspotFocus\}/);
  assert.match(screen, /SIMULATION · KEINE ECHTEN SPIELER ODER MATCHES/);
  assert.match(screen, /hotspotTestAvailable && arcadeMapView === 'map'/);
  assert.match(screen, /wideMapView && !hotspotDemoEnabled/);
  assert.match(renderer, /syncHotspotTestLayers\(map, hotspotEnabledRef\.current\)/);
  assert.match(renderer, /syncHotspotTestLayers\(map, hotspotDemoEnabled\)/);
  assert.match(renderer, /hotspotFocus\.tick/);
  assert.match(renderer, /map\.on\('click', HOTSPOT_TEST_CIRCLES, onTestHotspotClick\)/);
  assert.doesNotMatch(module, /\bsupabase\s*\.|\bcreateDuel\s*\(|\blocalStorage\s*\.|\bsessionStorage\s*\.|\bfrom\s*\(['\"]duels['\"]/i);
  assert.doesNotMatch(screen.slice(screen.indexOf('hotspotTestAvailable && arcadeMapView'), screen.indexOf('{mapTilesUnavailable &&')), /createDuel|setOpenRuns|setRegionalRuns/);
});

test('Hotspot Lab remains legible on iPhone without hiding normal map markers', () => {
  const css = read('src/styles/arcadeMap.css');
  const renderer = read('src/components/map/ArcadeMapLibreView.tsx');
  assert.match(css, /\.runnit-hotspot-test-console\{/);
  assert.match(css, /bottom:calc\(154px \+ env\(safe-area-inset-bottom,0px\)\)/);
  assert.match(css, /overscroll-behavior:contain/);
  assert.match(css, /\.runnit-hotspot-test-cities button\[aria-pressed="true"\]/);
  assert.match(renderer, /installHotspotTestLayers\(map\)/);
  assert.match(renderer, /installCommunityLayers\(map\)/);
  assert.match(renderer, /map\.easeTo\(\{\s*center: seed \? \[seed\.lng, seed\.lat\] : \[10\.43, 48\.58\]/);
});


test('global hotspot center aggregation sums actual scenario activity, not three city anchors', () => {
  const map = read('src/lib/mapHotspotSignals.ts');
  const scenarios = buildHotspotTestData(true).centers.features;
  assert.equal(scenarios.length, 3);
  assert.equal(scenarios.reduce((count, center) => count + center.properties.count, 0), 38);
  assert.match(map, /cluster: true, clusterMaxZoom: 10, clusterRadius: 72/);
  assert.match(map, /clusterProperties: \{ total: \['\+', \['get', 'count'\]\] \}/);
  assert.match(map, /'circle-radius': \['interpolate', \['linear'\],\s*\['coalesce', \['get', 'total'\], \['get', 'count'\]\]/);
  assert.match(map, /'circle-color': \['case', \['has', 'point_count'\], '#8761ff'/);
  assert.doesNotMatch(map, /'text-field': \['concat', \['to-string', \['get','count'\]\]/);
});

test('city clicks resolve genuine cluster expansion zoom before opening demo detail points', () => {
  const renderer = read('src/components/map/ArcadeMapLibreView.tsx');
  assert.match(renderer, /const clusterId = feature\?\.properties\?\.cluster_id/);
  assert.match(renderer, /getSource\(HOTSPOT_TEST_CENTERS_SOURCE\) as GeoJSONSource/);
  assert.match(renderer, /source\.getClusterExpansionZoom\(clusterId\)/);
  assert.match(renderer, /Math\.max\(13\.2, map\.getZoom\(\)\)/);
  assert.match(renderer, /map\.off\('click', HOTSPOT_TEST_CIRCLES, onTestHotspotClick\)/);
});

test('Hotspot Lab starts collapsed and selecting a city hides the menu while keeping the test running', () => {
  const screen = read('src/screens/MapScreen.tsx');
  const css = read('src/styles/arcadeMap.css');
  assert.match(screen, /const \[hotspotLabExpanded, setHotspotLabExpanded\] = useState\(false\)/);
  assert.match(screen, /'runnit-hotspot-test-console' \+ \(hotspotLabExpanded \? ' is-expanded' : ''\)/);
  assert.match(screen, /aria-expanded=\{hotspotLabExpanded\}/);
  assert.match(screen, /aria-controls="runnit-hotspot-test-details"/);
  assert.match(screen, /setHotspotFocus\(previous => \(\{ city, tick: previous\.tick \+ 1 \}\)\);\s*setHotspotLabExpanded\(false\)/);
  assert.match(css, /\.runnit-hotspot-test-console\.is-expanded\{/);
  assert.match(css, /\.runnit-hotspot-test-expander\{/);
  assert.match(css, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(screen, /!hotspotDemoEnabled && \(players\.some/);
});

test('test heat glows are visually quieter while the real challenge heat source is unchanged', () => {
  const map = read('src/lib/mapHotspotSignals.ts');
  assert.match(map, /'heatmap-radius': \['interpolate', \['linear'\], \['zoom'\], 0, 27, 4, 34, 7, 43, 11, 50/);
  assert.match(map, /'heatmap-opacity': \['interpolate', \['linear'\], \['zoom'\], 0, \.48, 7, \.63, 11, \.60/);
  assert.match(map, /'rgba\(167,63,29,\.12\)', 'rgba\(255,136,38,\.43\)', 'rgba\(255,211,82,\.72\)'/);
  assert.match(map, /'heatmap-opacity': \['interpolate', \['linear'\], \['zoom'\], 0, \.30, 5, \.42, 10, \.45/);
});
