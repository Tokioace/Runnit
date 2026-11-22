import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGeographyPoint, toGeographyPoint } from '../src/lib/duelLocation.ts';

// Security regression: untrusted location payloads must not become race pins.
test('duel coordinates reject non-finite and out-of-range values at both boundaries', () => {
  for (const [lat, lng] of [
    [NaN, 9], [48, Infinity], [-Infinity, 9], [90.000001, 0],
    [-90.000001, 0], [0, 180.000001], [0, -180.000001],
  ]) {
    assert.equal(parseGeographyPoint({ type: 'Point', coordinates: [lng, lat] }), null);
    assert.throws(() => toGeographyPoint({ lat, lng }), /Ungültige GPS-Koordinaten/);
  }
});

test('duel location parser rejects malformed and misleading GeoJSON', () => {
  for (const input of [
    { type: 'LineString', coordinates: [9, 48] },
    { type: 'Point', coordinates: ['9', 48] },
    { type: 'Point', coordinates: [9, '48'] },
    { type: 'Point', coordinates: [9] },
    { type: 'Point', coordinates: null },
    '{"type":"Point","coordinates":[9,48',
    '{"type":"Point","coordinates":[999,48]}',
  ]) {
    assert.equal(parseGeographyPoint(input), null);
  }
});

test('duel location parser rejects EWKB with an unexpected spatial reference', () => {
  // Little-endian EWKB point, SRID 3857 (Web Mercator), coordinates 9/48.
  const bytes = new Uint8Array(25);
  const view = new DataView(bytes.buffer);
  bytes[0] = 1;
  view.setUint32(1, 0x20000001, true);
  view.setUint32(5, 3857, true);
  view.setFloat64(9, 9, true);
  view.setFloat64(17, 48, true);
  const hex = Buffer.from(bytes).toString('hex');
  assert.equal(parseGeographyPoint(hex), null);
});
