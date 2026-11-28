import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceGpsSprint, createGpsSprint, haversineMeters,
  runGpsSimulation, syntheticPoint,
} from '../src/lib/sprintGps.ts';

const START = 1_800_000_000_000;
const pt = (meters, seconds, accuracy = 3) => syntheticPoint(meters, START + seconds * 1000, accuracy);

for (const [target, speed] of [[50, 8], [75, 7.5], [100, 10]]) {
  test(target + ' m constant-speed synthetic sprint produces interpolated finish', () => {
    const count = Math.ceil(target / speed) + 2;
    const samples = Array.from({length: count}, (_, n) => pt(n * speed, n));
    const result = runGpsSimulation(target, START, samples);
    assert.notEqual(result.finishTimestampMs, null);
    assert.ok(Math.abs((result.finishTimestampMs - START) / 1000 - target / speed) < 0.05);
    assert.ok(result.maxSpeedMps <= 12.001);
    assert.equal(result.rejectedSamples, 0);
  });
}

test('stationary GPS jitter does not accumulate to a 50 m sprint', () => {
  const fixes = Array.from({ length: 90 }, (_, i) => pt((i % 2 ? 1.8 : -1.8), i));
  const result = runGpsSimulation(50, START, fixes);
  assert.equal(result.finishTimestampMs, null);
  assert.ok(result.distanceM < 5);
});

test('teleport spike is rejected without replacing the last accepted fix', () => {
  const steps = [pt(0, 0), pt(8, 1), pt(80, 2), pt(16, 2), pt(24, 3)];
  const result = runGpsSimulation(50, START, steps);
  assert.equal(result.rejectedSamples, 1);
  assert.equal(result.acceptedSamples, 4);
  assert.ok(Math.abs(result.distanceM - 24) < 0.05);
  assert.equal(result.finishTimestampMs, null);
});

test('poor accuracy and invalid coordinates are rejected', () => {
  const state = runGpsSimulation(50, START, [pt(0, 0), pt(5, 1, 30), { ...pt(5, 1), latitude: 300 }, pt(6, 1)]);
  assert.equal(state.acceptedSamples, 2);
  assert.equal(state.rejectedSamples, 2);
  assert.equal(state.distanceM > 5, true);
});

test('stale and non-monotonic timestamps are ignored', () => {
  let state = createGpsSprint(50, START);
  state = advanceGpsSprint(state, pt(0, -1));
  state = advanceGpsSprint(state, pt(0, 0));
  state = advanceGpsSprint(state, pt(5, 1));
  state = advanceGpsSprint(state, pt(8, 0.5));
  state = advanceGpsSprint(state, pt(8, 1.1));
  assert.equal(state.acceptedSamples, 2);
  assert.equal(state.rejectedSamples, 3);
  assert.equal(state.lastAccepted.timestampMs, START + 1000);
});

test('a single threshold crossing must not finish the sprint', () => {
  const state = runGpsSimulation(50, START, [pt(0, 0), pt(10, 1), pt(20, 2), pt(30, 3), pt(40, 4), pt(50, 5)]);
  assert.equal(state.finishTimestampMs, null);
  assert.equal(state.beyondTargetCount, 1);
});

test('drop below finish threshold resets the confirmation counter', () => {
  const state = runGpsSimulation(50, START, [pt(0, 0), pt(10, 1), pt(20, 2), pt(30, 3), pt(40, 4), pt(50, 5), pt(49, 6)]);
  assert.equal(state.finishTimestampMs, null);
  assert.equal(state.beyondTargetCount, 0);
  assert.equal(state.crossingTimestampMs, null);
});

test('finished result is immutable for any subsequent samples', () => {
  const samples = Array.from({length: 9}, (_, n) => pt(n * 9, n));
  const finished = runGpsSimulation(50, START, samples);
  const after = advanceGpsSprint(finished, pt(100, 50));
  assert.equal(after.finishTimestampMs, finished.finishTimestampMs);
  assert.equal(after.distanceM, finished.distanceM);
});

test('Haversine distances are symmetric and exactly zero for identical points', () => {
  const a = pt(0, 0), b = pt(10, 1);
  assert.equal(haversineMeters(a, a), 0);
  assert.ok(Math.abs(haversineMeters(a, b) - 10) < 0.001);
  assert.equal(haversineMeters(a, b), haversineMeters(b, a));
});

test('invalid sprint configurations fail instead of silently corrupting rankings', () => {
  assert.throws(() => createGpsSprint(42, START), /Unsupported/);
  assert.throws(() => createGpsSprint(50, NaN), /Unsupported/);
});
