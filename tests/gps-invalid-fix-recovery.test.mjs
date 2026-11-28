import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceGpsSprint, createGpsSprint, syntheticPoint } from '../src/lib/sprintGps.ts';

// Synthetic equatorial coordinates only; no device location or backend access.
test('invalid GPS coordinates and non-finite timestamps never move the accepted anchor', () => {
  const start = 1_700_000_000_000;
  const anchored = advanceGpsSprint(createGpsSprint(50, start), syntheticPoint(0, start));
  for (const bad of [
    { ...syntheticPoint(4, start + 1000), latitude: 91 },
    { ...syntheticPoint(4, start + 1000), longitude: -181 },
    { ...syntheticPoint(4, start + 1000), accuracyM: Number.NaN },
    { ...syntheticPoint(4, start + 1000), timestampMs: Number.POSITIVE_INFINITY },
  ]) {
    const rejected = advanceGpsSprint(anchored, bad);
    assert.equal(rejected.lastDecision, 'invalid-sample');
    assert.equal(rejected.lastAccepted, anchored.lastAccepted);
    assert.equal(rejected.origin, anchored.origin);
    assert.equal(rejected.distanceM, 0);
    assert.equal(rejected.acceptedSamples, 1);
    assert.equal(rejected.rejectedSamples, 1);
    assert.equal(rejected.finishTimestampMs, null);
  }
});

test('a valid walking-speed fix is accepted after invalid and inaccurate fixes', () => {
  const start = 1_700_000_000_000;
  let state = advanceGpsSprint(createGpsSprint(50, start), syntheticPoint(0, start));
  state = advanceGpsSprint(state, { ...syntheticPoint(3, start + 1000), latitude: Number.NaN });
  state = advanceGpsSprint(state, syntheticPoint(3, start + 2000, 40));
  assert.equal(state.rejectedSamples, 2);
  assert.equal(state.acceptedSamples, 1);
  assert.equal(state.distanceM, 0);
  state = advanceGpsSprint(state, syntheticPoint(3, start + 3000));
  assert.equal(state.lastDecision, 'accepted');
  assert.equal(state.acceptedSamples, 2);
  assert.equal(state.rejectedSamples, 2);
  assert.ok(Math.abs(state.distanceM - 3) < 0.01);
  assert.ok(state.maxSpeedMps > 0 && state.maxSpeedMps < 2);
  assert.equal(state.finishTimestampMs, null);
});
