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
