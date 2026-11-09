import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceGpsSprint, createGpsSprint, runGpsSimulation, syntheticPoint } from '../src/lib/sprintGps.ts';

// Deterministic synthetic equatorial points only; not evidence of field accuracy.
const START = 1_800_000_000_000;
const point = (meters, ms, accuracyM = 3) => syntheticPoint(meters, START + ms, accuracyM);

test('pre-start sample cannot establish the origin or affect the next valid sample', () => {
  const state = runGpsSimulation(50, START, [
    point(10, -1),
    point(0, 0),
  ]);
  assert.equal(state.rejectedSamples, 1);
  assert.equal(state.acceptedSamples, 1);
  assert.equal(state.origin?.timestampMs, START);
  assert.equal(state.distanceM, 0);
});

test('duplicate and reversed timestamps do not replace the last accepted fix', () => {
  const initial = runGpsSimulation(50, START, [point(0, 0), point(10, 1000)]);
  const duplicate = advanceGpsSprint(initial, point(20, 1000));
  const reversed = advanceGpsSprint(duplicate, point(20, 999));
  assert.equal(duplicate.lastDecision, 'out-of-order');
  assert.equal(reversed.lastDecision, 'out-of-order');
  assert.equal(reversed.lastAccepted?.timestampMs, START + 1000);
  assert.equal(reversed.distanceM, initial.distanceM);
  assert.equal(reversed.acceptedSamples, 2);
  assert.equal(reversed.rejectedSamples, 2);
});

test('bad accuracy between two finish fixes cannot confirm a finish', () => {
  const initial = runGpsSimulation(50, START, [
    point(0, 0), point(10, 1000), point(20, 2000),
    point(30, 3000), point(40, 4000), point(50, 5000),
  ]);
  const rejected = advanceGpsSprint(initial, point(51, 6000, 15.1));
  assert.equal(rejected.lastDecision, 'poor-accuracy');
  assert.equal(rejected.beyondTargetCount, 1);
  assert.equal(rejected.finishTimestampMs, null);
  const confirmed = advanceGpsSprint(rejected, point(51, 7000));
  assert.equal(confirmed.beyondTargetCount, 2);
  assert.equal(confirmed.finishTimestampMs, initial.crossingTimestampMs);
});

test('finished sprint cannot be extended by later samples', () => {
  const finished = runGpsSimulation(50, START, [
    point(0, 0), point(10, 1000), point(20, 2000),
    point(30, 3000), point(40, 4000), point(50, 5000), point(51, 6000),
  ]);
  assert.notEqual(finished.finishTimestampMs, null);
  const after = advanceGpsSprint(finished, point(60, 7000));
  assert.equal(after.lastDecision, 'already-finished');
  assert.equal(after.finishTimestampMs, finished.finishTimestampMs);
  assert.equal(after.acceptedSamples, finished.acceptedSamples);
  assert.equal(after.distanceM, finished.distanceM);
});
