import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceGpsSprint, createGpsSprint, syntheticPoint } from '../src/lib/sprintGps.ts';

test('a rejected GPS jump never counts as finish confirmation', () => {
  let state = createGpsSprint(50, 1_000);
  state = advanceGpsSprint(state, syntheticPoint(0, 1_000));
  state = advanceGpsSprint(state, syntheticPoint(40, 11_000));
  const acceptedBeforeJump = state.acceptedSamples;
  state = advanceGpsSprint(state, syntheticPoint(500, 12_000));
  assert.equal(state.lastDecision, 'implausible-speed');
  assert.equal(state.acceptedSamples, acceptedBeforeJump);
  assert.equal(state.distanceM < 50, true);
  assert.equal(state.finishTimestampMs, null);

  state = advanceGpsSprint(state, syntheticPoint(51, 14_000));
  assert.equal(state.lastDecision, 'accepted');
  assert.equal(state.beyondTargetCount, 1);
  assert.equal(state.finishTimestampMs, null);
  state = advanceGpsSprint(state, syntheticPoint(52, 15_000));
  assert.equal(state.beyondTargetCount, 2);
  assert.ok(state.finishTimestampMs !== null);
  assert.ok(state.finishTimestampMs >= 11_000 && state.finishTimestampMs <= 14_000);
});

test('a return inside the target resets finish confirmation', () => {
  let state = createGpsSprint(50, 0);
  for (const [distance, at] of [[0, 0], [49, 10_000], [51, 11_000], [49, 12_000], [51, 13_000]]) {
    state = advanceGpsSprint(state, syntheticPoint(distance, at));
  }
  assert.equal(state.beyondTargetCount, 1);
  assert.equal(state.finishTimestampMs, null);
  state = advanceGpsSprint(state, syntheticPoint(52, 14_000));
  assert.equal(state.beyondTargetCount, 2);
  assert.ok(state.finishTimestampMs !== null);
});

test('late GPS fixes cannot alter a completed sprint result', () => {
  let state = createGpsSprint(50, 0);
  for (const [distance, at] of [[0, 0], [49, 10_000], [51, 11_000], [52, 12_000]]) {
    state = advanceGpsSprint(state, syntheticPoint(distance, at));
  }
  assert.ok(state.finishTimestampMs !== null);
  const finishedAt = state.finishTimestampMs;
  const accepted = state.acceptedSamples;
  state = advanceGpsSprint(state, syntheticPoint(80, 20_000));
  assert.equal(state.lastDecision, 'already-finished');
  assert.equal(state.finishTimestampMs, finishedAt);
  assert.equal(state.acceptedSamples, accepted);
});
