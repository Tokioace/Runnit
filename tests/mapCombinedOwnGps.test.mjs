import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  closestOwnRaceForGps, nearestOwnGpsBadge,
  OWN_GPS_BADGE_RADIUS_METERS, OWN_GPS_MAX_ACCURACY_METERS,
  OWN_GPS_MAX_FIX_AGE_MS, OWN_GPS_RADIUS_MAX_ACCURACY_METERS,
  OWN_GPS_RADIUS_MAX_FIX_AGE_MS,
} from '../src/lib/mapOwnGpsProximity.ts';
import { buildCommunityCollections } from '../src/lib/mapCommunityLayers.ts';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const NOW = 1_000_000;
const own = { id: 'my-race', lat: 48.947, lng: 9.426, isOwn: true };
const gps = {
  lat: 48.947, lng: 9.426,
  accuracyMeters: 12, sampledAtMs: NOW - 800,
};

test('precise own GPS badge requires genuine 30m physical co-location', () => {
  assert.equal(OWN_GPS_BADGE_RADIUS_METERS, 30);
  assert.equal(OWN_GPS_MAX_ACCURACY_METERS, 60);
  assert.equal(OWN_GPS_MAX_FIX_AGE_MS, 30_000);
  assert.deepEqual(nearestOwnGpsBadge(gps, [own], NOW), {
    raceId: 'my-race', state: 'at-event', distanceMeters: 0,
  });
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

test('hollow radius satellite is visible for valid GPS in 500m hosting area, not 30m', () => {
  assert.equal(OWN_GPS_RADIUS_MAX_ACCURACY_METERS, 150);
  assert.equal(OWN_GPS_RADIUS_MAX_FIX_AGE_MS, 120_000);
  const at100m = { ...gps, lat: gps.lat + .0009, accuracyMeters: 82 };
  assert.equal(nearestOwnGpsBadge(at100m, [own], NOW)?.state, 'in-radius');
  assert.equal(nearestOwnGpsBadge(at100m, [own], NOW)?.raceId, 'my-race');
  assert.equal(nearestOwnGpsBadge({ ...gps, accuracyMeters: 90 }, [own], NOW)?.state, 'in-radius');
  assert.equal(nearestOwnGpsBadge({ ...gps, sampledAtMs: NOW - 45_000 }, [own], NOW)?.state, 'in-radius');
  assert.equal(nearestOwnGpsBadge({ ...gps, lat: gps.lat + .004 }, [own], NOW)?.state, 'in-radius');
  assert.equal(nearestOwnGpsBadge({ ...gps, lat: gps.lat + .005 }, [own], NOW), null);
  assert.equal(nearestOwnGpsBadge({ ...gps, accuracyMeters: 151 }, [own], NOW), null);
  assert.equal(nearestOwnGpsBadge({ ...gps, sampledAtMs: NOW - 120_001 }, [own], NOW), null);
  assert.equal(nearestOwnGpsBadge({ ...gps, sampledAtMs: NOW + 6_000 }, [own], NOW), null);
});

test('only nearest OWN race can be decorated, not foreign races or distant homes', () => {
  const races = [
    { id: 'other', lat: gps.lat, lng: gps.lng, isOwn: false },
    { id: 'mine-far', lat: gps.lat + .0006, lng: gps.lng, isOwn: true },
    { id: 'mine-near', lat: gps.lat + .00005, lng: gps.lng, isOwn: true },
    { id: 'mine-next', lat: gps.lat + .00016, lng: gps.lng, isOwn: true },
  ];
  assert.equal(nearestOwnGpsBadge(gps, races, NOW)?.raceId, 'mine-near');
  assert.equal(nearestOwnGpsBadge(gps, races.slice(0, 2), NOW)?.raceId, 'mine-far');
  assert.equal(nearestOwnGpsBadge(gps, [{ id: 'foreign', ...own, isOwn: false }], NOW), null);
  assert.equal(nearestOwnGpsBadge(gps, [
    { id: 'remote-own', lat: gps.lat + .5, lng: gps.lng, isOwn: true },
  ], NOW), null);
});

test('GeoJSON preserves actual GPS coordinate and annotates real own race only', () => {
  const items = [
    { ...own, kind: 'race' },
    { id: 'other', lat: 48.949, lng: 9.426, kind: 'race', isOwn: false },
    { id: 'fake', lat: 48.948, lng: 9.426, kind: 'demo-race' },
    { ...own, isOwn: false, kind: 'race' },
  ];
  const actualFix = { ...gps, sampledAtMs: Date.now() - 800 };
  const atEvent = buildCommunityCollections(items, actualFix);
  assert.equal(atEvent.real.features.length, 2);
  assert.equal(atEvent.demo.features.length, 1);
  assert.equal(atEvent.gps.features.length, 1);
  assert.deepEqual(atEvent.real.features[0].geometry.coordinates, [own.lng, own.lat]);
  assert.deepEqual(atEvent.gps.features[0].geometry.coordinates, [gps.lng, gps.lat]);
  assert.equal(atEvent.real.features[0].properties.own, 1);
  assert.equal(atEvent.real.features[0].properties.nearbyGps, 1);
  assert.equal(atEvent.real.features[0].properties.gpsInRadius, 1);
  assert.equal(atEvent.real.features[1].properties.nearbyGps, 0);
  assert.equal(atEvent.real.features[1].properties.gpsInRadius, 0);

  const awayWithinRadius = buildCommunityCollections(items, { ...actualFix, lat: gps.lat + .001 });
  assert.equal(awayWithinRadius.real.features[0].properties.nearbyGps, 0);
  assert.equal(awayWithinRadius.real.features[0].properties.gpsInRadius, 1);
  assert.deepEqual(awayWithinRadius.gps.features[0].geometry.coordinates, [gps.lng, gps.lat + .001]);

  const outside = buildCommunityCollections(items, { ...actualFix, lat: gps.lat + .006 });
  assert.equal(outside.real.features[0].properties.nearbyGps, 0);
  assert.equal(outside.real.features[0].properties.gpsInRadius, 0);
  assert.equal(outside.gps.features.length, 1);

  const stale = buildCommunityCollections(items, { ...actualFix, sampledAtMs: Date.now() - 130_000 });
  assert.equal(stale.real.features[0].properties.gpsInRadius, 0);
});

test('low zoom gets differentiated filled/hollow cyan satellite and GPS stays geographic', () => {
  const source = read('src/lib/mapCommunityLayers.ts');
  assert.match(source, /COMMUNITY_OWN_GPS_SATELLITE_DOT/);
  assert.match(source, /filter: gpsBadgeFilter as any/);
  assert.match(source, /'gpsInRadius'\], 1/);
  assert.match(source, /'circle-translate': \[-12, 17\]/);
  assert.match(source, /'circle-color': \['case', \['==', \['get', 'nearbyGps'\], 1\]/);
  assert.match(source, /'#238bff', '#0c244d'/);
  assert.match(source, /'#e9fbff', '#30dcff'/);
  assert.match(source, /'circle-opacity': \['interpolate', \['linear'\], \['zoom'\], 0, 1, 12\.2, 1, 12\.8, 0\]/);
  assert.match(source, /map\.moveLayer\(COMMUNITY_GPS_LAYER, COMMUNITY_SINGLE_HALO_LAYER\)/);
});

test('close street view keeps GPS and flag separate; only remote orb gets a blue satellite', () => {
  const screen = read('src/screens/MapScreen.tsx');
  const view = read('src/components/map/ArcadeMapLibreView.tsx');
  const css = read('src/styles/maplibreArcade.css');
  assert.match(screen, /accuracyMeters: pos\.coords\.accuracy/);
  assert.match(screen, /sampledAtMs: pos\.timestamp/);
  assert.match(view, /userCoords\?\.accuracyMeters, userCoords\?\.sampledAtMs/);
  assert.match(view, /if \(gpsMarkerRef.current && gps && validMapPoint\(gps\)\)/);
  assert.match(view, /updateMarker\(gpsMarkerRef.current, gps\)/);
  assert.doesNotMatch(view, /button\.dataset\.gpsInRadius|button\.dataset\.gpsNearby|mergedIntoVisiblePin/);
  assert.match(view, /window\.setInterval\(refreshGpsBadge, 15_000\)/);
  assert.match(view, /document\.addEventListener\('visibilitychange', refreshGpsBadge\)/);
  assert.doesNotMatch(view, /projectedMarkersOverlap\(projectedGps, projectedRun\)/);
  assert.doesNotMatch(css, /\.runnit-gl-marker\.runnit-gl-run\.is-own\[data-gps-in-radius=/);
  assert.doesNotMatch(css, /\.runnit-gl-marker\.runnit-gl-run\.is-own\[data-gps-nearby=/);
});
