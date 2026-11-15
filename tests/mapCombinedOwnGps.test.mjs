import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  closestOwnRaceForGps, OWN_GPS_BADGE_RADIUS_METERS,
  OWN_GPS_MAX_ACCURACY_METERS, OWN_GPS_MAX_FIX_AGE_MS,
} from '../src/lib/mapOwnGpsProximity.ts';
import { buildCommunityCollections } from '../src/lib/mapCommunityLayers.ts';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const NOW = 1_000_000;
const own = { id: 'my-race', lat: 48.947, lng: 9.426, isOwn: true };
const gps = {
  lat: 48.947, lng: 9.426,
  accuracyMeters: 12, sampledAtMs: NOW - 800,
};

test('own GPS badge requires a recent, accurate, physically nearby location fix', () => {
  assert.equal(OWN_GPS_BADGE_RADIUS_METERS, 30);
  assert.equal(OWN_GPS_MAX_ACCURACY_METERS, 60);
  assert.equal(OWN_GPS_MAX_FIX_AGE_MS, 30_000);
  assert.equal(closestOwnRaceForGps(gps, [own], NOW), 'my-race');
  assert.equal(closestOwnRaceForGps({ ...gps, lat: gps.lat + .0001 }, [own], NOW), 'my-race');
  assert.equal(closestOwnRaceForGps({ ...gps, lat: gps.lat + .0004 }, [own], NOW), null);
  assert.equal(closestOwnRaceForGps({ ...gps, accuracyMeters: 90 }, [own], NOW), null);
  assert.equal(closestOwnRaceForGps({ ...gps, accuracyMeters: 0 }, [own], NOW), null);
  assert.equal(closestOwnRaceForGps({ ...gps, accuracyMeters: undefined }, [own], NOW), null);
  assert.equal(closestOwnRaceForGps({ ...gps, sampledAtMs: NOW - 30_001 }, [own], NOW), null);
  assert.equal(closestOwnRaceForGps({ ...gps, sampledAtMs: NOW + 6_000 }, [own], NOW), null);
  assert.equal(closestOwnRaceForGps(null, [own], NOW), null);
});

test('only the nearest OWN real race gets the badge, never unrelated players or foreign events', () => {
  const races = [
    { id: 'other', lat: gps.lat, lng: gps.lng, isOwn: false },
    { id: 'mine-far', lat: gps.lat + .0006, lng: gps.lng, isOwn: true },
    { id: 'mine-near', lat: gps.lat + .00005, lng: gps.lng, isOwn: true },
    { id: 'mine-next', lat: gps.lat + .00016, lng: gps.lng, isOwn: true },
  ];
  assert.equal(closestOwnRaceForGps(gps, races, NOW), 'mine-near');
  assert.equal(closestOwnRaceForGps(gps, races.slice(0, 2), NOW), null);
  // Screen-pixel coincidence does not override geographic distance.
  assert.equal(closestOwnRaceForGps(gps, [
    { id: 'remote-own', lat: gps.lat + .5, lng: gps.lng, isOwn: true },
  ], NOW), null);
});

test('GeoJSON combines the visual identity while maintaining independent GPS and real-event geography', () => {
  const items = [
    { ...own, kind: 'race' },
    { id: 'other', lat: 48.949, lng: 9.426, kind: 'race', isOwn: false },
    { id: 'fake', lat: 48.948, lng: 9.426, kind: 'demo-race' },
    { ...own, isOwn: false, kind: 'race' },
  ];
  // Source calculation compares against Date.now() so use an actual fresh fix.
  const actualFix = { ...gps, sampledAtMs: Date.now() - 800 };
  const result = buildCommunityCollections(items, actualFix);
  assert.equal(result.real.features.length, 2);
  assert.equal(result.demo.features.length, 1);
  assert.equal(result.gps.features.length, 1);
  assert.deepEqual(result.real.features[0].geometry.coordinates, [own.lng, own.lat]);
  assert.deepEqual(result.gps.features[0].geometry.coordinates, [gps.lng, gps.lat]);
  assert.equal(result.real.features[0].properties.own, 1);
  assert.equal(result.real.features[0].properties.nearbyGps, 1);
  assert.equal(result.real.features[1].properties.nearbyGps, 0);

  const away = buildCommunityCollections(items, { ...actualFix, lat: actualFix.lat + .001 });
  assert.equal(away.real.features[0].properties.nearbyGps, 0);
  assert.equal(away.gps.features.length, 1);
});

test('regional own 01 orb has a subtle cyan satellite and both layers fade on street zoom', () => {
  const source = read('src/lib/mapCommunityLayers.ts');
  assert.match(source, /COMMUNITY_OWN_GPS_SATELLITE_DOT/);
  assert.match(source, /filter: gpsBadgeFilter as any/);
  assert.match(source, /'nearbyGps'\], 1/);
  assert.match(source, /'circle-translate': \[-12, 17\]/);
  assert.match(source, /'circle-color': '#238bff'/);
  assert.match(source, /'circle-stroke-color': '#e9fbff'/);
  assert.match(source, /'circle-opacity': \['interpolate', \['linear'\], \['zoom'\], 0, 1, 12\.2, 1, 12\.8, 0\]/);
  assert.match(source, /map\.moveLayer\(COMMUNITY_GPS_LAYER, COMMUNITY_SINGLE_HALO_LAYER\)/);
});

test('street-level own pin has the blue satellite only when GPS proximity qualifies', () => {
  const screen = read('src/screens/MapScreen.tsx');
  const view = read('src/components/map/ArcadeMapLibreView.tsx');
  const css = read('src/styles/maplibreArcade.css');
  assert.match(screen, /accuracyMeters: pos\.coords\.accuracy/);
  assert.match(screen, /sampledAtMs: pos\.timestamp/);
  assert.match(view, /userCoords\?\.accuracyMeters, userCoords\?\.sampledAtMs/);
  assert.match(view, /const nearbyOwnId = closestOwnRaceForGps\(gps,/);
  assert.match(view, /button\.dataset\.gpsNearby = nearby \? 'true' : 'false'/);
  assert.match(view, /if \(mergedIntoVisiblePin\)/);
  assert.match(view, /gpsMarkerRef\.current\.getElement\(\)\.style\.display = 'none'/);
  assert.doesNotMatch(view, /projectedMarkersOverlap\(projectedGps, projectedRun\)/);
  assert.match(css, /\.runnit-gl-marker\.runnit-gl-run\.is-own\[data-gps-nearby="true"\]::before/);
  assert.match(css, /pointer-events:none/);
});
