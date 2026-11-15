import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { projectedMarkersOverlap } from '../src/lib/mapMarkerVisibility.ts';
import { buildCommunityCollections } from '../src/lib/mapCommunityLayers.ts';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('normal Runnit map has no synthetic racing events, runner pins or example-race banner', () => {
  const screen = read('src/screens/MapScreen.tsx');
  assert.match(screen, /if \(!authUser\) \{\s*discoveryLoadedRef\.current = false;\s*setOpenRuns\(\[\]\)/);
  assert.match(screen, /if \(!authUser\) \{\s*setPlayers\(\[\]\)/);
  assert.doesNotMatch(screen, /generateDemoRuns|generateCityPlayers|DEMO · BEISPIELRENNEN/);
  assert.doesNotMatch(screen, /newPlayers = generateCityPlayers|mapped = generateDemoRuns/);
  // Explicit opt-in synthetic hotspot lab remains available only via its URL switch.
  assert.match(screen, /new URLSearchParams\(window\.location\.search\)\.get\('hotspotDemo'\) === '1'/);
  assert.match(screen, /hotspotTestAvailable && arcadeMapView === 'map'/);
  assert.match(screen, /\.from\('duels'\)\s*\.select\('id, location, expires_at'\)\s*\.eq\('status', 'open'\)/);
});

test('GPS source stays independent of real/demos and is layered behind event orbs', () => {
  const source = read('src/lib/mapCommunityLayers.ts');
  assert.match(source, /map\.moveLayer\(COMMUNITY_GPS_AURA_LAYER, COMMUNITY_SINGLE_HALO_LAYER\)/);
  assert.match(source, /map\.moveLayer\(COMMUNITY_GPS_LAYER, COMMUNITY_SINGLE_HALO_LAYER\)/);
  const collections = buildCommunityCollections([
    { id: 'open-1', lat: 48.95, lng: 9.44, kind: 'race', isOwn: true },
    { id: 'open-1', lat: 48.95, lng: 9.44, kind: 'race' },
    { id: 'mock', lat: 48.951, lng: 9.44, kind: 'demo-race' },
  ], { lat: 48.95, lng: 9.44 });
  assert.equal(collections.real.features.length, 1);
  assert.equal(collections.demo.features.length, 1);
  assert.equal(collections.gps.features.length, 1);
});

test('GPS is combined only with a geographically near own event, never for mere pixel overlap', () => {
  assert.equal(projectedMarkersOverlap({ x: 150, y: 210 }, { x: 150, y: 210 }), true);
  assert.equal(projectedMarkersOverlap({ x: 150, y: 210 }, { x: 188, y: 210 }), false);
  const renderer = read('src/components/map/ArcadeMapLibreView.tsx');
  assert.match(renderer, /const gpsBadge = nearestOwnGpsBadge\(gps,/);
  assert.match(renderer, /button\.dataset\.gpsNearby = nearby \? 'true' : 'false'/);
  assert.match(renderer, /button\.dataset\.gpsInRadius = inRadius \? 'true' : 'false'/);
  assert.match(renderer, /if \(mergedIntoVisiblePin\)/);
  assert.doesNotMatch(renderer, /projectedMarkersOverlap\(projectedGps, projectedRun\)/);
});


test('2D/3D and recenter are horizontally aligned with full-size touch targets', () => {
  const screen = read('src/screens/MapScreen.tsx');
  const css = read('src/styles/maplibreArcade.css');
  assert.match(screen, /className="runnit-map-locate-slot pointer-events-auto absolute z-\[950\]"/);
  assert.match(screen, /aria-label="Meinen Standort anzeigen"/);
  // Header: 7px top + 54px title + 6px gap + 52px tabs => 119px.
  // Rail at 7.75rem (124px) leaves only ~5px below the LISTE tab.
  assert.match(css, /--runnit-map-tools-top:calc\(7\.75rem \+ env\(safe-area-inset-top,0px\)\)/);
  assert.match(css, /--runnit-map-tools-right:calc\(15px \+ 2\.5vw\)/);
  assert.match(css, /\.runnit-map-arcade \.runnit-map-locate-slot\{\s*right:calc\(var\(--runnit-map-tools-right\) \+ 56px\);\s*top:var\(--runnit-map-tools-top\)/);
  assert.match(css, /\.runnit-map-arcade \.runnit-gl-tilt-button\{\s*right:var\(--runnit-map-tools-right\);\s*top:var\(--runnit-map-tools-top\);\s*width:48px;min-width:48px;height:48px/);
  assert.doesNotMatch(css, /top:calc\(9\.4rem \+ env\(safe-area-inset-top,0px\)\)/);
});
