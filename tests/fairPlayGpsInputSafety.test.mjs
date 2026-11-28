import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assessFairPlay } from '../src/lib/fairPlay.ts';

// GPS fixtures only: no device identifiers or recorded location traces.
const positions = Array.from({ length: 8 }, (_, i) => ({
  timestampMs: i * 1000,
  latitude: 0,
  longitude: (i * 1.45) / 111194.93,
  accuracyM: 3,
}));
const motion = Array.from({ length: 400 }, (_, i) => ({
  timestampMs: i * 20,
  accelerationMagnitudeMps2: i % 30 === 0 ? 4 : 0.3,
}));

describe('GPS input-order and timestamp safety', () => {
  it('does not change walking distance when GPS fixes arrive out of order', () => {
    const expected = assessFairPlay(positions, motion);
    const reordered = [positions[4], positions[1], positions[7], positions[0], positions[6], positions[2], positions[5], positions[3]];
    const actual = assessFairPlay(reordered, motion);
    assert.ok(expected.gpsDistanceM !== null && expected.gpsDistanceM > 9 && expected.gpsDistanceM < 12);
    assert.ok(actual.gpsDistanceM !== null);
    assert.ok(Math.abs(actual.gpsDistanceM - expected.gpsDistanceM) < 0.001);
    assert.equal(actual.verdict, expected.verdict);
    assert.deepEqual(reordered[0], positions[4], 'the input array must not be reordered in place');
  });

  it('does not inflate walking distance from duplicate timestamps or invalid fixes', () => {
    const expected = assessFairPlay(positions, motion);
    const noisy = [
      ...positions,
      { ...positions[3] },
      { ...positions[3], latitude: Number.NaN },
      { ...positions[4], longitude: 181 },
      { ...positions[5], accuracyM: -1 },
      { ...positions[6], timestampMs: Number.POSITIVE_INFINITY },
    ];
    const actual = assessFairPlay(noisy, motion);
    assert.ok(actual.gpsDistanceM !== null && expected.gpsDistanceM !== null);
    assert.ok(Math.abs(actual.gpsDistanceM - expected.gpsDistanceM) < 0.001);
    assert.equal(actual.verdict, expected.verdict);
    assert.equal(noisy.length, 13, 'invalid fixes must not be removed from caller-owned data');
  });
});
