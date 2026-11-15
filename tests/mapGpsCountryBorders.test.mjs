import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCommunityCollections } from '../src/lib/mapCommunityLayers.ts';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('GPS and an overlapping own race stay separately georeferenced at any zoom', () => {
  const gps = { lat: 48.9475, lng: 9.4308 };
  const collections = buildCommunityCollections([
    { id: 'own-open', lat: gps.lat, lng: gps.lng, kind: 'race', isOwn: true },
    { id: 'demo-player', lat: gps.lat, lng: gps.lng, kind: 'demo-player' },
  ], gps);
  assert.equal(collections.real.features.length, 1);
  assert.equal(collections.real.features[0].properties.color, '#c9ff0b');
  assert.equal(collections.gps.features.length, 1);
  assert.deepEqual(collections.gps.features[0].geometry.coordinates, [gps.lng, gps.lat]);
  assert.equal(collections.demo.features.length, 1);
});

test('at country zoom the GPS layer remains a visible blue center with cyan halo', () => {
  const layers = read('src/lib/mapCommunityLayers.ts');
  const gps = layers.slice(layers.indexOf('if (!map.getLayer(COMMUNITY_GPS_AURA_LAYER))'));
  assert.match(gps, /'circle-color': '#09bfff'/);
  assert.match(gps, /'circle-color': '#237bff'/);
  assert.match(gps, /'circle-opacity': \['interpolate', \['linear'\], \['zoom'\], 0, 1, 12\.2, 1, 12\.8, 0\]/);
  assert.match(gps, /'circle-stroke-opacity': \['interpolate', \['linear'\], \['zoom'\], 0, 1, 12\.2, 1, 12\.8, 0\]/);
  assert.doesNotMatch(gps, /11\.5,\s*0,\s*12\.2,\s*0\.78/);
  const view = read('src/components/map/ArcadeMapLibreView.tsx');
  assert.match(view, /syncDistantDots\(map, livePlayersRef\.current, liveRunsRef\.current, userCoords, liveRegionalRef\.current\)/);
  assert.match(view, /gpsMarkerRef\.current = new Marker/);
  assert.match(layers, /COMMUNITY_GPS_SOURCE = 'runnit-community-gps'/);
  assert.match(layers, /cluster: true, clusterMaxZoom: 11, clusterRadius: 52/);
});

test('country borders use the verified Liberty country layer, with a soft cyan edge', () => {
  const renderer = read('src/components/map/ArcadeMapLibreView.tsx');
  assert.match(renderer, /name === 'boundary_2'/);
  assert.match(renderer, /map\.setPaintProperty\(layer\.id, 'line-color', '#27e9ff'\)/);
  assert.match(renderer, /id: COUNTRY_GLOW_LAYER_ID/);
  assert.match(renderer, /'source-layer': 'boundary'/);
  assert.match(renderer, /'admin_level'\], 2/);
  assert.match(renderer, /map\.addLayer\(\{[\s\S]*?'line-blur': 2\.8,[\s\S]*?\}, 'boundary_2'\)/);
  assert.match(renderer, /name === 'boundary_3'/);
  assert.match(renderer, /name === 'boundary_disputed'/);
});

test('bright green park outlines and pale residential/landcover polygons are tuned directly', () => {
  const renderer = read('src/components/map/ArcadeMapLibreView.tsx');
  assert.match(renderer, /name === 'park_outline'/);
  assert.match(renderer, /'line-color', '#285668'/);
  assert.match(renderer, /name === 'park'/);
  assert.match(renderer, /'fill-outline-color', '#285665'/);
  assert.match(renderer, /name\.startsWith\('landuse_'\)/);
  assert.match(renderer, /name\.startsWith\('landcover_'\)/);
  assert.match(renderer, /name === 'natural_earth'/);
  assert.match(renderer, /'raster-opacity'/);
  assert.match(renderer, /if \(wetland\) map\.setPaintProperty\(layer\.id, 'fill-pattern', null\)/);
});

test('3D/2D switch is stacked under locate and never obscures an active popup', () => {
  const css = read('src/styles/maplibreArcade.css');
  const screen = read('src/screens/MapScreen.tsx');
  const view = read('src/components/map/ArcadeMapLibreView.tsx');
  assert.match(css, /top:calc\(9\.4rem \+ env\(safe-area-inset-top,0px\) \+ 56px\)/);
  assert.match(css, /:has\(\.maplibregl-popup\.runnit-gl-race-popup\) \.runnit-gl-tilt-button/);
  assert.match(css, /:has\(\.maplibregl-popup\.runnit-gl-host-popup\) \.runnit-gl-tilt-button/);
  assert.match(css, /opacity:0;visibility:hidden;pointer-events:none/);
  assert.match(screen, /right-4 top-\[calc\(9\.4rem\+env\(safe-area-inset-top\)\)\]/);
  assert.match(view, /aria-pressed=\{tilted\}/);
});
