import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGeographyPoint, toGeographyPoint } from '../src/lib/duelLocation.ts';

// Synthetic coordinates only. No real location traces or persisted user data.
function ewkb({ little = true, srid = 4326, lng = 9.4, lat = 48.9, type = 1 } = {}) {
  const bytes = new Uint8Array(25);
  const view = new DataView(bytes.buffer);
  bytes[0] = little ? 1 : 0;
  view.setUint32(1, type | 0x20000000, little);
  view.setUint32(5, srid, little);
  view.setFloat64(9, lng, little);
  view.setFloat64(17, lat, little);
  return Buffer.from(bytes).toString('hex');
}

test('decodes both EWKB endian formats with longitude before latitude', () => {
  for (const little of [true, false]) {
    const point = parseGeographyPoint(ewkb({ little }));
    assert.deepEqual(point, { lat: 48.9, lng: 9.4 });
    assert.equal(toGeographyPoint(point), 'SRID=4326;POINT(9.4 48.9)');
  }
});

test('rejects wrong SRID, non-point geometry, invalid coordinates and truncated EWKB', () => {
  for (const hex of [
    ewkb({ srid: 3857 }),
    ewkb({ type: 2 }),
    ewkb({ lng: 181 }),
    ewkb({ lat: -91 }),
    ewkb({ lng: Number.NaN }),
    ewkb({ lat: Infinity }),
    ewkb().slice(0, -2),
  ]) {
    assert.equal(parseGeographyPoint(hex), null);
  }
});

test('rejects malformed and non-finite GeoJSON/WKT without throwing', () => {
  for (const value of [
    { type: 'Point', coordinates: [Infinity, 48.9] },
    { type: 'Point', coordinates: [9.4, Number.NaN] },
    { type: 'LineString', coordinates: [9.4, 48.9] },
    '{"type":"Point","coordinates":["9.4",48.9]}',
    'SRID=3857;POINT(9.4 48.9)',
    'POINT(NaN 48.9)',
  ]) assert.equal(parseGeographyPoint(value), null);
});
