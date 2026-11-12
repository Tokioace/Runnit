import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findImuGaps, splitTraceAtGaps, summarizeImuGaps } from '../src/lib/imuGapDiagnostics.ts';

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


describe('descriptive IMU dropout summary', () => {
  it('reports number, total duration and longest actual full-rate gap', () => {
    const samples = [0, 20, 40, 400, 420, 1020, 1040].map(timestampMs => ({ timestampMs }));
    const gaps = findImuGaps(samples);
    assert.deepEqual(summarizeImuGaps(gaps), { count: 2, totalGapMs: 960, longestGapMs: 600 });
  });
  it('returns zeros for continuous samples and ignores malformed intervals', () => {
    assert.deepEqual(summarizeImuGaps(findImuGaps([{ timestampMs: 0 }, { timestampMs: 20 }])), { count: 0, totalGapMs: 0, longestGapMs: 0 });
    assert.deepEqual(summarizeImuGaps([{ startMs: 10, endMs: 0 }, { startMs: NaN, endMs: 100 }]), { count: 0, totalGapMs: 0, longestGapMs: 0 });
  });
});


describe('XYZ trace segmentation', () => {
  it('retains axis values while splitting all diagnostic traces on real IMU gaps', () => {
    const full = [
      { timestampMs: 0, accelerationX: 1, accelerationY: 2, accelerationZ: 3 },
      { timestampMs: 20, accelerationX: 4, accelerationY: 5, accelerationZ: 6 },
      { timestampMs: 400, accelerationX: 7, accelerationY: 8, accelerationZ: 9 },
      { timestampMs: 420, accelerationX: 10, accelerationY: 11, accelerationZ: 12 },
    ];
    const segments = splitTraceAtGaps(full, findImuGaps(full));
    assert.deepEqual(segments.map(segment => segment.map(s => s.accelerationX)), [[1, 4], [7, 10]]);
    assert.deepEqual(segments.flatMap(segment => segment.map(s => s.accelerationY)), [2, 5, 8, 11]);
    assert.deepEqual(segments.flatMap(segment => segment.map(s => s.accelerationZ)), [3, 6, 9, 12]);
  });
});
