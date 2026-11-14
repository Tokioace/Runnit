import test from 'node:test';
import assert from 'node:assert/strict';
import { toGeographyPoint, parseGeographyPoint } from '../src/lib/duelLocation.ts';

test('serializes GPS coordinates into valid PostGIS EWKT in lon/lat order', () => {
  assert.equal(toGeographyPoint({ lat: 48.9, lng: 9.4 }), 'SRID=4326;POINT(9.4 48.9)');
  assert.throws(() => toGeographyPoint({ lat: 200, lng: 9 }), /Ungültige/);
});

test('parses PostgREST EWKB geography points and GeoJSON', () => {
  const hex = '0101000020E6100000CDCCCCCCCCCC22403333333333734840';
  const expected = { lat: 48.9, lng: 9.4 };
  const compare = (actual) => {
    assert.ok(actual);
    assert.ok(Math.abs(actual.lat - expected.lat) < 0.0000001);
    assert.ok(Math.abs(actual.lng - expected.lng) < 0.0000001);
  };
  compare(parseGeographyPoint(hex));
  compare(parseGeographyPoint({ type: 'Point', coordinates: [9.4, 48.9] }));
  compare(parseGeographyPoint('SRID=4326;POINT(9.4 48.9)'));
});

test('rejects invalid or untrusted geometry values', () => {
  for (const value of [null, {}, 'garbage', 'POINT(200 400)', {type:'Point',coordinates:[999,999]}, '0101000020E6100000']) {
    assert.equal(parseGeographyPoint(value), null);
  }
});
