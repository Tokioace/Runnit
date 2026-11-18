import test from 'node:test';
import assert from 'node:assert/strict';
import { canHostAt, mapDistanceMeters, validMapPoint, HOST_PLACEMENT_RADIUS_METERS } from '../src/lib/mapHostPlacement.ts';

test('invalid GPS coordinates cannot produce a finite host-placement distance', () => {
  const origin = { lat: 48.946, lng: 9.43 };
  for (const invalid of [
    { lat: NaN, lng: 9.43 },
    { lat: Infinity, lng: 9.43 },
    { lat: 91, lng: 9.43 },
    { lat: 48.946, lng: -181 },
  ]) {
    assert.equal(validMapPoint(invalid), false);
    assert.equal(mapDistanceMeters(origin, invalid), Infinity);
    assert.equal(mapDistanceMeters(invalid, origin), Infinity);
    assert.equal(canHostAt(origin, invalid), false);
    assert.equal(canHostAt(invalid, origin), false);
  }
});

test('valid positions preserve zero distance and 500 m hosting limit', () => {
  const origin = { lat: 0, lng: 0 };
  const near = { lat: 0, lng: 0.004 };
  const far = { lat: 0, lng: 0.005 };
  assert.equal(mapDistanceMeters(origin, origin), 0);
  assert.ok(mapDistanceMeters(origin, near) < HOST_PLACEMENT_RADIUS_METERS);
  assert.ok(mapDistanceMeters(origin, far) > HOST_PLACEMENT_RADIUS_METERS);
  assert.equal(canHostAt(origin, near), true);
  assert.equal(canHostAt(origin, far), false);
});

test('antimeridian crossing uses the short geographic distance', () => {
  const a = { lat: 0, lng: 179.999 };
  const b = { lat: 0, lng: -179.999 };
  assert.ok(mapDistanceMeters(a, b) > 200);
  assert.ok(mapDistanceMeters(a, b) < HOST_PLACEMENT_RADIUS_METERS);
  assert.equal(canHostAt(a, b), true);
});
