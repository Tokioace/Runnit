import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findImuGaps, splitTraceAtGaps, summarizeImuGaps } from '../src/lib/imuGapDiagnostics.ts';

describe('IMU diagnostic invariants (synthetic, not device accuracy)', () => {
  it('matches an independent chronological-gap oracle across deterministic irregular traces', () => {
    let seed = 0x13579bdf;
    const next = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed;
    };

    for (let run = 0; run < 64; run++) {
      const chronological = [{ timestampMs: 0, axis: 0 }];
      for (let i = 1; i < 120; i++) {
        const interval = next() % 9 === 0 ? 251 + (next() % 600) : 5 + (next() % 30);
        chronological.push({ timestampMs: chronological[i - 1].timestampMs + interval, axis: i });
      }

      const expected = [];
      for (let i = 1; i < chronological.length; i++) {
        if (chronological[i].timestampMs - chronological[i - 1].timestampMs > 250) {
          expected.push({ startMs: chronological[i - 1].timestampMs, endMs: chronological[i].timestampMs });
        }
      }
      const shuffled = [...chronological].reverse();
      const originalOrder = shuffled.map(sample => sample.timestampMs);
      const actual = findImuGaps(shuffled);

      assert.deepEqual(actual, expected, `run ${run}: full-rate gaps`);
      assert.deepEqual(shuffled.map(sample => sample.timestampMs), originalOrder, 'input must remain unchanged');

      const summary = summarizeImuGaps(actual);
      const durations = expected.map(gap => gap.endMs - gap.startMs);
      assert.equal(summary.count, expected.length);
      assert.equal(summary.totalGapMs, durations.reduce((total, value) => total + value, 0));
      assert.equal(summary.longestGapMs, Math.max(0, ...durations));

      const segments = splitTraceAtGaps(chronological, actual);
      assert.deepEqual(segments.flat(), chronological, 'diagnostic segments must retain every sample and axis value');
      assert.equal(segments.length, expected.length + 1);
    }
  });
});
