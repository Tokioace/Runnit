import test from 'node:test';
import assert from 'node:assert/strict';
import { LiveStepPeakCounter } from '../src/lib/liveStepPeaks.ts';

const pulse = (t, center) => 0.35 + 7 * Math.exp(-0.5 * ((t - center) / 65) ** 2);

test('one live notification per rhythmic peak; no double counting after replay', () => {
  const detector = new LiveStepPeakCounter();
  const observed = [];
  for (let t = 0; t <= 8000; t += 16) {
    const value = Array.from({ length: 10 }, (_, i) => pulse(t, 650 + i * 660))
      .reduce((acc, amplitude) => acc + amplitude - 0.35, 0.35);
    const next = detector.push({ timestampMs: t, accelerationMagnitudeMps2: value });
    if (next !== null) observed.push(next);
  }
  assert.deepEqual(observed, Array.from({ length: 10 }, (_, i) => i + 1));
  assert.equal(detector.count, 10);
});

test('long sensor gaps never create synthetic steps; first seen count is monotonic', () => {
  const detector = new LiveStepPeakCounter();
  const updates = [];
  for (let t = 0; t <= 2200; t += 16) {
    const n = detector.push({ timestampMs: t, accelerationMagnitudeMps2: pulse(t, 900) });
    if (n !== null) updates.push(n);
  }
  detector.push({ timestampMs: 4000, accelerationMagnitudeMps2: 25 });
  for (let t = 4016; t < 4400; t += 16) {
    const n = detector.push({ timestampMs: t, accelerationMagnitudeMps2: 0.2 });
    if (n !== null) updates.push(n);
  }
  assert.deepEqual(updates, [1]);
  assert.equal(detector.count, 1);
});

test('reset begins a new recording at zero', () => {
  const detector = new LiveStepPeakCounter();
  for (let t = 0; t <= 1600; t += 16)
    detector.push({ timestampMs: t, accelerationMagnitudeMps2: pulse(t, 700) });
  assert.equal(detector.count, 1);
  detector.reset();
  assert.equal(detector.count, 0);
  assert.deepEqual(detector.timestampsMs, []);
});

test('double-crested footfall and low-amplitude pocket motion do not become extra steps', () => {
  const detector = new LiveStepPeakCounter();
  for (let t = 0; t <= 5000; t += 16) {
    const value = 0.25 + [800, 1550, 2300, 3050, 3800].reduce((sum, center) =>
      sum + 6.5 * Math.exp(-0.5 * ((t - center) / 35) ** 2)
          + 4 * Math.exp(-0.5 * ((t - center - 110) / 30) ** 2), 0)
          + 0.15 * Math.abs(Math.sin(t / 33));
    detector.push({ timestampMs: t, accelerationMagnitudeMps2: value });
  }
  assert.equal(detector.count, 5);
});

test('walking smoothing ignores narrow post-footfall shakes without missing real peaks', () => {
  const walking = new LiveStepPeakCounter(67);
  const unfiltered = new LiveStepPeakCounter();
  const centers = Array.from({ length: 25 }, (_, i) => 650 + i * 680);
  for (let t = 0; t <= 18500; t += 16) {
    const value = 0.25 + centers.reduce((sum, center) =>
      sum + 7 * Math.exp(-0.5 * ((t - center) / 60) ** 2)
          + 5 * Math.exp(-0.5 * ((t - center - 510) / 7) ** 2), 0);
    walking.push({ timestampMs: t, accelerationMagnitudeMps2: value });
    unfiltered.push({ timestampMs: t, accelerationMagnitudeMps2: value });
  }
  assert.equal(walking.count, centers.length);
  assert.equal(unfiltered.count, centers.length);
  // Equal totals may hide a false peak that replaced a later real step.
  for (let i = 0; i < centers.length; i++)
    assert.ok(Math.abs(walking.timestampsMs[i] - centers[i]) < 100,
      `walking peak ${i} drifted from the footfall`);
  assert.ok(unfiltered.timestampsMs.some((time, i) => Math.abs(time - centers[i]) >= 100));
});

test('walking smoothing resets its buffer after suspended samples and on reset', () => {
  const walking = new LiveStepPeakCounter(67);
  for (let t = 0; t <= 2400; t += 16)
    walking.push({ timestampMs: t, accelerationMagnitudeMps2: pulse(t, 900) });
  assert.equal(walking.count, 1);
  // A lone high reading after a gap must not inherit an earlier moving average.
  walking.push({ timestampMs: 4500, accelerationMagnitudeMps2: 20 });
  for (let t = 4516; t <= 4900; t += 16)
    walking.push({ timestampMs: t, accelerationMagnitudeMps2: 0.25 });
  assert.equal(walking.count, 1);
  walking.reset();
  assert.equal(walking.count, 0);
  for (let t = 0; t <= 2400; t += 16)
    walking.push({ timestampMs: t, accelerationMagnitudeMps2: pulse(t, 900) });
  assert.equal(walking.count, 1);
});
