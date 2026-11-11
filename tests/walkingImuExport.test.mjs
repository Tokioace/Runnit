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

describe('live peak diagnostics', () => {
  it('exports only relative peak times and keeps the old export compatible', () => {
    const origin = 1589123456789;
    const samples = [
      { timestampMs: origin, accelerationMagnitudeMps2: 1 },
      { timestampMs: origin + 1200, accelerationMagnitudeMps2: 2 },
    ];
    const raw = createWalkingImuExport(samples, '100');
    assert.equal(raw.peakDiagnostics, undefined);
    const withPeaks = createWalkingImuExport(samples, '100', {
      smoothedMs: [origin + 200, origin + 700, origin - 1, Infinity],
      rawMs: [origin + 180, origin + 690, origin + 2000],
    });
    assert.deepEqual(withPeaks.peakDiagnostics.smoothedLivePeakMs, [200, 700]);
    assert.deepEqual(withPeaks.peakDiagnostics.rawLivePeakMs, [180, 690]);
    assert.ok(!JSON.stringify(withPeaks).includes(String(origin)));
  });
});


describe('out-of-order IMU export', () => {
  it('sorts valid samples before relative normalization and retains peak diagnostics', () => {
    const origin = 1589123456789;
    const result = createWalkingImuExport([
      { timestampMs: origin + 80, accelerationMagnitudeMps2: 3 },
      { timestampMs: origin, accelerationMagnitudeMps2: 1 },
      { timestampMs: origin + 40, accelerationMagnitudeMps2: 2 },
    ], '3', { smoothedMs: [origin + 40], rawMs: [origin + 80] });
    assert.deepEqual(result.samples.map(s => s.tMs), [0, 40, 80]);
    assert.deepEqual(result.samples.map(s => s.magnitude), [1, 2, 3]);
    assert.deepEqual(result.peakDiagnostics.smoothedLivePeakMs, [40]);
    assert.ok(!JSON.stringify(result).includes(String(origin)));
  });
});


describe('out-of-order peak diagnostics', () => {
  it('sorts relative peak timestamps without exporting epoch timestamps', () => {
    const origin = 1589123456789;
    const result = createWalkingImuExport([
      { timestampMs: origin + 1000, accelerationMagnitudeMps2: 2 },
      { timestampMs: origin, accelerationMagnitudeMps2: 1 },
    ], '2', {
      smoothedMs: [origin + 900, origin + 100, origin + 500],
      rawMs: [origin + 800, origin + 200],
    });
    assert.deepEqual(result.peakDiagnostics.smoothedLivePeakMs, [100, 500, 900]);
    assert.deepEqual(result.peakDiagnostics.rawLivePeakMs, [200, 800]);
    assert.ok(!JSON.stringify(result).includes(String(origin)));
  });
});
