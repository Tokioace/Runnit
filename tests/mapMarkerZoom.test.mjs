import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PIN_FADE_START_ZOOM, PIN_FADE_END_ZOOM, FULL_PIN_ZOOM,
  markerPinOpacityAtZoom, markerScaleAtZoom,
} from '../src/lib/mapMarkerZoom.ts';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('country zoom shows tiny geo dots; detailed pin art is hidden', () => {
  assert.equal(markerPinOpacityAtZoom(4), 0);
  assert.equal(markerPinOpacityAtZoom(9), 0);
  assert.equal(markerPinOpacityAtZoom(PIN_FADE_START_ZOOM), 0);
  assert.equal(markerPinOpacityAtZoom(PIN_FADE_END_ZOOM), 1);
  assert.equal(markerPinOpacityAtZoom(16), 1);
  assert.equal(markerPinOpacityAtZoom(NaN), 0);
});

test('iOS fractional pinch zoom smoothly enlarges icons only near street level', () => {
  assert.ok(markerScaleAtZoom(4) < 0.25);
  assert.ok(markerScaleAtZoom(12.7) > markerScaleAtZoom(12.2));
  assert.ok(markerScaleAtZoom(13.5) > markerScaleAtZoom(12.7));
  assert.ok(markerScaleAtZoom(15) > markerScaleAtZoom(13.5));
  assert.equal(markerScaleAtZoom(FULL_PIN_ZOOM), 1);
  assert.equal(markerScaleAtZoom(18), 1);
  assert.equal(markerScaleAtZoom(Infinity), markerScaleAtZoom(0));
  assert.ok(markerPinOpacityAtZoom(12.5) > 0 && markerPinOpacityAtZoom(12.5) < 1);
});

test('marker root keeps MapLibre absolute positioning, scale acts only on inner button', () => {
  const renderer = read('src/components/map/ArcadeMapLibreView.tsx');
  const css = read('src/styles/maplibreArcade.css');
  assert.match(renderer, /function markerShell\(button: HTMLButtonElement\)/);
  assert.match(renderer, /new Marker\(\{ element: markerShell\(el\), anchor: 'bottom' \}\)/);
  assert.match(renderer, /new Marker\(\{ element: markerShell\(el\), anchor: 'center' \}\)/);
  assert.match(renderer, /button\.style\.transform = 'scale\(' \+ scale \+ '\)'/);
  assert.match(css, /\.runnit-gl-marker-shell\s*\{\s*position:absolute/);
  assert.doesNotMatch(css, /\.runnit-gl-marker-shell\s*\{\s*position:relative/);
});

test('low zoom uses genuine MapLibre geo clusters and hides HTML markers', () => {
  const renderer = read('src/components/map/ArcadeMapLibreView.tsx');
  const layers = read('src/lib/mapCommunityLayers.ts');
  assert.match(renderer, /installCommunityLayers\(map\)/);
  assert.match(renderer, /syncCommunityLayers\(map, entries, gps\)/);
  assert.match(layers, /id: COMMUNITY_RACE_DOT_LAYER, type: 'circle', source: COMMUNITY_REAL_SOURCE/);
  assert.match(layers, /'circle-radius': \['interpolate', \['linear'\], \['zoom'\]/);
  assert.match(layers, /'circle-opacity': \['interpolate', \['linear'\], \['zoom'\], 12\.2, 1, 12\.8, 0\]/);
  assert.match(layers, /coordinates: \[item\.lng, item\.lat\]/);
  assert.match(renderer, /syncDistantDots\(map, livePlayersRef\.current, liveRunsRef\.current, latestGpsRef\.current, liveRegionalRef\.current\)/);
});


test('popup never follows a runner offscreen or survives continent zoom', () => {
  const renderer = read('src/components/map/ArcadeMapLibreView.tsx');
  assert.match(renderer, /map\.getZoom\(\) < PIN_FADE_END_ZOOM \|\| !markerInViewport/);
  assert.match(renderer, /popup\.remove\(\)/);
  assert.match(renderer, /targetY - clientHeight \/ 2/);
  assert.match(renderer, /const eventPosition = eventPopupLngLat\(selectedRun\)/);
});
