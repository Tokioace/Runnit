import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createWalkingImuExport } from '../src/lib/walkingImuExport.ts';

describe('local walking IMU export', () => {
  it('contains only relative sensor time and no GPS or epoch timestamps', () => {
    const result = createWalkingImuExport([
      { timestampMs: 1589123456789, accelerationMagnitudeMps2: 2.5, accelerationX: 1, accelerationY: -2, accelerationZ: 0.5, latitude: 48.95, longitude: 9.43 },
      { timestampMs: 1589123456810, accelerationMagnitudeMps2: 3.5, accelerationX: 2, accelerationY: 1, accelerationZ: 2.7 },
    ], '100');
    assert.equal(result.referenceSteps, 100);
    assert.deepEqual(result.samples.map(s => s.tMs), [0, 21]);
    const json = JSON.stringify(result);
    assert.ok(!json.includes('latitude') && !json.includes('longitude'));
    assert.ok(!json.includes('1589123456'));
  });
  it('drops malformed readings and invalid manual references', () => {
    const result = createWalkingImuExport([
      { timestampMs: 0, accelerationMagnitudeMps2: Infinity },
      { timestampMs: 123, accelerationMagnitudeMps2: 1.2, accelerationX: NaN },
    ], '');
    assert.equal(result.referenceSteps, null);
    assert.equal(result.samples.length, 1);
    assert.equal(result.samples[0].x, null);
    assert.equal(result.samples[0].tMs, 0);
  });
});
