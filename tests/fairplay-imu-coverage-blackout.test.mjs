import test from 'node:test';
import assert from 'node:assert/strict';
import { assessFairPlay } from '../src/lib/fairPlay.ts';

// Synthetic monotonic timestamps; no device data or user locations.
const gps = [
  { timestampMs: 0, latitude: 0, longitude: 0, accuracyM: 3 },
  { timestampMs: 5000, latitude: 0, longitude: 0.00005, accuracyM: 3 },
  { timestampMs: 10000, latitude: 0, longitude: 0.0001, accuracyM: 3 },
];
const imuAt = timestampMs => ({ timestampMs, accelerationMagnitudeMps2: 0.5 });
const range = (start, end, step) =>
  Array.from({ length: Math.floor((end - start) / step) + 1 }, (_, i) => imuAt(start + i * step));

test('long sensor blackout is not credited as continuous walking coverage', () => {
  // Two short bursts must not bridge an eight-second iOS background gap.
  const motion = [...range(0, 1000, 100), ...range(9000, 10000, 100)];
  const report = assessFairPlay(gps, motion);
  assert.ok(report.motionCoverage < 0.3, `blackout credited: ${report.motionCoverage}`);
  assert.ok(report.reasons.includes('insufficient-motion-coverage'));
  assert.equal(report.verdict, 'uncertain');
  assert.ok(report.gpsDistanceM !== null && report.gpsDistanceM > 0);
  assert.ok(!report.reasons.includes('implausible-average-speed'));
});

test('continuous IMU observations do not trigger the blackout warning', () => {
  const report = assessFairPlay(gps, range(0, 10000, 100));
  assert.ok(report.motionCoverage >= 0.99);
  assert.ok(!report.reasons.includes('insufficient-motion-coverage'));
  // A lack of detected steps remains an uncertainty, not a cheating verdict.
  assert.equal(report.verdict, 'uncertain');
  assert.ok(!report.reasons.includes('movement-without-detected-steps'));
});
