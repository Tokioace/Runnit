import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceGpsSprint, createGpsSprint, runGpsSimulation, syntheticPoint } from '../src/lib/sprintGps.ts';

// Synthetic equatorial coordinates only. These tests cannot establish real-world GPS accuracy.
const START = 1_800_000_000_000;
const point = (meters, ms, accuracyM = 3) => syntheticPoint(meters, START + ms, accuracyM);

test('accuracy boundary accepts 15 m and rejects values above 15 m', () => {
  const result = runGpsSimulation(50, START, [
    point(0, 0, 15),
    point(1, 1000, 15.001),
    point(2, 1000, 15),
  ]);
  assert.equal(result.acceptedSamples, 2);
  assert.equal(result.rejectedSamples, 1);
  assert.equal(result.lastDecision, 'accepted');
});

test('sample interval boundary accepts 200 ms but rejects 199 ms', () => {
  const result = runGpsSimulation(50, START, [
    point(0, 0),
    point(1, 199),
    point(1, 200),
  ]);
  assert.equal(result.acceptedSamples, 2);
  assert.equal(result.rejectedSamples, 1);
  assert.ok(Math.abs(result.distanceM - 1) < 0.001);
});

test('rejected jump cannot advance finish confirmation or accepted timestamp', () => {
  const before = runGpsSimulation(50, START, [
    point(0, 0), point(10, 1000), point(20, 2000),
    point(30, 3000), point(40, 4000), point(50, 5000),
  ]);
  assert.equal(before.beyondTargetCount, 1);
  const rejected = advanceGpsSprint(before, point(500, 6000));
  assert.equal(rejected.lastDecision, 'implausible-speed');
  assert.equal(rejected.beyondTargetCount, 1);
  assert.equal(rejected.finishTimestampMs, null);
  assert.equal(rejected.lastAccepted.timestampMs, START + 5000);
});

test('invalid numeric samples never become the race origin', () => {
  let state = createGpsSprint(50, START);
  for (const invalid of [
    { ...point(0, 0), latitude: Infinity },
    { ...point(0, 0), longitude: NaN },
    { ...point(0, 0), accuracyM: -1 },
    { ...point(0, 0), timestampMs: Infinity },
  ]) {
    state = advanceGpsSprint(state, invalid);
  }
  assert.equal(state.origin, null);
  assert.equal(state.acceptedSamples, 0);
  assert.equal(state.rejectedSamples, 4);
});
