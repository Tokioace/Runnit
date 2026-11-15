import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceGpsSprint, createGpsSprint, syntheticPoint } from '../src/lib/sprintGps.ts';

// Synthetic equator coordinates only; no real GPS track or device data.
test('implausible GPS jump does not move anchor or inflate distance', () => {
  const start = 1_800_000_000_000;
  const initial = advanceGpsSprint(createGpsSprint(50, start), syntheticPoint(0, start, 3));
  const jumped = advanceGpsSprint(initial, syntheticPoint(100, start + 1000, 3));
  assert.equal(jumped.lastDecision, 'implausible-speed');
  assert.equal(jumped.rejectedSamples, 1);
  assert.equal(jumped.acceptedSamples, 1);
  assert.equal(jumped.lastAccepted, initial.lastAccepted);
  assert.equal(jumped.distanceM, 0);
  assert.equal(jumped.finishTimestampMs, null);

  const recovered = advanceGpsSprint(jumped, syntheticPoint(5, start + 2000, 3));
  assert.equal(recovered.lastDecision, 'accepted');
  assert.equal(recovered.acceptedSamples, 2);
  assert.equal(recovered.rejectedSamples, 1);
  assert.ok(recovered.distanceM > 4.9 && recovered.distanceM < 5.1);
  assert.equal(recovered.finishTimestampMs, null);
});

test('duplicate and pre-start timestamps cannot advance the sprint', () => {
  const start = 1_800_000_000_000;
  const initial = advanceGpsSprint(createGpsSprint(50, start), syntheticPoint(0, start, 3));
  const duplicate = advanceGpsSprint(initial, syntheticPoint(4, start, 3));
  const backwards = advanceGpsSprint(duplicate, syntheticPoint(5, start - 1, 3));
  assert.equal(duplicate.lastDecision, 'out-of-order');
  assert.equal(backwards.lastDecision, 'before-start');
  assert.equal(backwards.acceptedSamples, 1);
  assert.equal(backwards.rejectedSamples, 2);
  assert.equal(backwards.distanceM, 0);
  assert.equal(backwards.lastAccepted, initial.lastAccepted);
});
