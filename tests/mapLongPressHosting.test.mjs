import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canHostAt, mapDistanceMeters, HOST_PLACEMENT_RADIUS_METERS } from '../src/lib/mapHostPlacement.ts';
import { markerInViewport } from '../src/lib/mapMarkerVisibility.ts';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('hosting radius follows 500m cyan ring, not 5km nearby discovery radius', () => {
  const gps = { lat: 48.947, lng: 9.426 };
  const same = { ...gps };
  const nearby = { lat: 48.950, lng: 9.427 };
  const tooFar = { lat: 48.98, lng: 9.426 };
  assert.equal(HOST_PLACEMENT_RADIUS_METERS, 500);
  assert.equal(canHostAt(gps, same), true);
  assert.equal(canHostAt(gps, nearby), true);
  assert.equal(canHostAt(gps, tooFar), false);
  assert.equal(canHostAt(null, nearby), false);
  assert.equal(canHostAt(gps, { lat: NaN, lng: 9.42 }), false);
  assert.ok(mapDistanceMeters(gps, tooFar) > HOST_PLACEMENT_RADIUS_METERS);
});

test('viewport filter rejects markers outside geographic bounds even when projection lies at screen edge', () => {
  const viewport = { width: 375, height: 735, top: 180, bottom: 650, left: 23, right: 23 };
  assert.equal(markerInViewport(false, { x: 180, y: 380 }, viewport), false);
  assert.equal(markerInViewport(false, { x: 360, y: 360 }, viewport), false);
  assert.equal(markerInViewport(true, { x: 180, y: 380 }, viewport), true);
  assert.equal(markerInViewport(true, { x: 180, y: 179 }, viewport), false);
  assert.equal(markerInViewport(true, { x: 180, y: 650 }, viewport), true);
  assert.equal(markerInViewport(true, { x: 180, y: 651 }, viewport), false);
  assert.equal(markerInViewport(true, { x: 0, y: 400 }, viewport), false);
  assert.equal(markerInViewport(true, { x: 370, y: 400 }, viewport), false);
  assert.equal(markerInViewport(true, { x: NaN, y: 400 }, viewport), false);
  assert.equal(markerInViewport(true, { x: 180, y: Infinity }, viewport), false);
});

test('panned or zoomed viewport shows a pin only when its event position is inside both tests', () => {
  const viewport = { width: 350, height: 720, top: 175, bottom: 615 };
  // Same fixed event; MapLibre can clamp a projected coordinate at the edge.
  assert.equal(markerInViewport(false, { x: 180, y: 400 }, viewport), false);
  // Once camera includes event geographically and on screen, reveal it.
  assert.equal(markerInViewport(true, { x: 180, y: 400 }, viewport), true);
  // Panning away hides the pin again without altering its coordinates.
  assert.equal(markerInViewport(false, { x: 180, y: 400 }, viewport), false);
});

test('long hold on empty map opens anchored host prompt; panning cancels, no list host action', () => {
  const renderer = read('src/components/map/ArcadeMapLibreView.tsx');
  const screen = read('src/screens/MapScreen.tsx');
  const chrome = read('src/components/map/ArcadeMapChrome.tsx');
  assert.match(renderer, /canvas\.addEventListener\('pointerdown', onPointerDown\)/);
  assert.match(renderer, /canvas\.addEventListener\('pointermove', onPointerMove\)/);
  assert.match(renderer, /map\.on\('dragstart', discard\)/);
  assert.match(renderer, /map\.on\('zoomstart', discard\)/);
  assert.match(renderer, /setTimeout\(\(\) => \{[\s\S]{0,150}openAt\(location\);[\s\S]{0,15}\}, 600\)/);
  assert.match(renderer, /map\.on\('contextmenu', onRightClick\)/);
  assert.match(renderer, /canHostAt\(gps, position\)/);
  assert.match(renderer, /title\.textContent = 'HIER RENNEN VERANSTALTEN'/);
  assert.match(renderer, /callbacks\.current\.onHostAt\(position\)/);
  assert.match(screen, /const openHostRunAt = \(point: Coordinates\) =>/);
  assert.match(screen, /setHostLocation\(\{ lat: point\.lat, lng: point\.lng \}\)/);
  assert.match(screen, /onHostAt=\{openHostRunAt\}/);
  assert.match(screen, /onInvalidHostAt=\{setRaceNotice\}/);
  assert.match(screen, /location: hostLocation/);
  assert.doesNotMatch(chrome, /className="runnit-arcade-map-host-action"/);
});

test('no giant own-races overlay: own flag and cancellation in list and marker popup remain', () => {
  const screen = read('src/screens/MapScreen.tsx');
  const renderer = read('src/components/map/ArcadeMapLibreView.tsx');
  const chrome = read('src/components/map/ArcadeMapChrome.tsx');
  assert.doesNotMatch(screen, /aria-label="Meine offenen Rennen"/);
  assert.match(screen, /isOwn: Boolean\(authUser/);
  assert.match(renderer, /originalRun\.isOwn \? '#c9ff0b' : '#f13edc'/);
  assert.match(renderer, /onCancelRun\(selectedRun\.id\)/);
  assert.match(chrome, /onCancel\(entry\.id\)/);
  assert.match(screen, /setCancelConfirmation\(run\)/);
  assert.match(screen, /result\.status === 'cancelled'/);
  assert.match(screen, /createdAt: data\.created_at/);
});

test('MapLibre checks both geo bounds and screen space after every move/zoom', () => {
  const renderer = read('src/components/map/ArcadeMapLibreView.tsx');
  assert.match(renderer, /bounds\.contains\(\[geo\.lng, geo\.lat\]\)/);
  assert.match(renderer, /map\.project\(\[geo\.lng, geo\.lat\]\)/);
  assert.match(renderer, /markerInViewport\(geographicMatch, screen, viewport\)/);
  assert.match(renderer, /map\.on\('move', onCameraMove\)/);
  assert.match(renderer, /map\.on\('moveend', onCameraMove\)/);
  assert.match(renderer, /map\.on\('resize', onCameraMove\)/);
  assert.match(renderer, /style\.display = visible \? '' : 'none'/);
  assert.match(renderer, /visiblePlayersRef\.current = visibleMarkers/);
  assert.match(renderer, /visibleRunsRef\.current = visibleMarkers/);
});
