import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectWalkingPhase } from '../src/lib/walkingPhase.ts';

const samples = (from, to, magnitude, interval = 20) =>
  Array.from({ length: Math.floor((to - from) / interval) }, (_, i) => ({
    timestampMs: from + i * interval,
    accelerationMagnitudeMps2: magnitude,
  }));

describe('walking phase diagnostic', () => {
  it('finds a sustained movement interval between stationary periods', () => {
    const trace = [...samples(0, 2000, 0.2), ...samples(2000, 7000, 2.1), ...samples(7000, 9000, 0.2)];
    assert.deepEqual(detectWalkingPhase(trace), { startMs: 2000, endMs: 7000 });
  });
  it('does not join two walking periods across a missing sensor window', () => {
    const trace = [...samples(0, 4000, 2), ...samples(5000, 8000, 2)];
    assert.deepEqual(detectWalkingPhase(trace), { startMs: 0, endMs: 4000 });
  });
  it('handles a malformed first sample without poisoning all time bins', () => {
    const trace = [{ timestampMs: NaN, accelerationMagnitudeMps2: 2 }, ...samples(1000, 5000, 2)];
    assert.deepEqual(detectWalkingPhase(trace), { startMs: 0, endMs: 4000 });
  });
  it('uses earliest valid timestamp even if IMU samples arrive out of order', () => {
    const trace = [...samples(3000, 6500, 2), ...samples(0, 3000, 0.2)];
    assert.deepEqual(detectWalkingPhase(trace), { startMs: 3000, endMs: 6500 });
  });
  it('ignores negative acceleration magnitudes instead of treating them as walking', () => {
    const trace = [...samples(0, 5000, -5), ...samples(5000, 6500, 0.2)];
    assert.equal(detectWalkingPhase(trace), null);
  });
  it('rejects stationary jitter and short phone handling', () => {
    assert.equal(detectWalkingPhase(samples(0, 5000, 0.3)), null);
    assert.equal(detectWalkingPhase([...samples(0, 6000, 0.2), ...samples(6000, 7000, 4)]), null);
  });
});
