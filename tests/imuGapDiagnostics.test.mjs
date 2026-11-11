import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findImuGaps, splitTraceAtGaps } from '../src/lib/imuGapDiagnostics.ts';

describe('diagnostic IMU gaps, independent of measurement algorithms', () => {
  it('does not misclassify a decimated continuous signal as missing sensor data', () => {
    const full = Array.from({ length: 101 }, (_, i) => ({ timestampMs: i * 20 }));
    const sparse = full.filter((_, i) => i % 20 === 0);
    const gaps = findImuGaps(full);
    assert.deepEqual(gaps, []);
    assert.equal(splitTraceAtGaps(sparse, gaps).length, 1);
  });
  it('marks real gaps based on full-rate samples and splits decimated trace', () => {
    const full = [{ timestampMs: 0 }, { timestampMs: 20 }, { timestampMs: 40 }, { timestampMs: 400 }, { timestampMs: 420 }];
    const gaps = findImuGaps(full);
    assert.deepEqual(gaps, [{ startMs: 40, endMs: 400 }]);
    assert.deepEqual(splitTraceAtGaps([full[0], full[2], full[3], full[4]], gaps).map(s => s.length), [2, 2]);
  });
  it('ignores duplicate and nonfinite timestamps without mutating input', () => {
    const full = [{ timestampMs: 400 }, { timestampMs: NaN }, { timestampMs: 0 }, { timestampMs: 0 }];
    assert.deepEqual(findImuGaps(full), [{ startMs: 0, endMs: 400 }]);
    assert.equal(full[0].timestampMs, 400);
  });
});
