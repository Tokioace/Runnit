import test from 'node:test';
import assert from 'node:assert/strict';
import { assessFairPlay } from '../src/lib/fairPlay.ts';

// Synthetic 20 Hz pocket-motion signal: a deliberate walking cadence.
// This is a regression contract, not a device calibration.
const motion = Array.from({ length: 1500 }, (_, i) => ({
  timestampMs: i * 20,
  accelerationMagnitudeMps2: i % 30 === 15 ? 4 : 0.3,
}));
const positions = (speed) => Array.from({ length: 30 }, (_, i) => ({
  timestampMs: i * 1000,
  latitude: 0,
  longitude: i * speed / 111194.93,
  accuracyM: 3,
}));

test('slow but rhythmic walking is not categorized as suspicious', () => {
  const report = assessFairPlay(positions(0.35), motion);
  assert.notEqual(report.verdict, 'suspicious');
  assert.ok(!report.reasons.includes('implausible-average-speed'));
  assert.ok(!report.reasons.includes('movement-without-detected-steps'));
  assert.ok(report.detectedSteps > 20);
  assert.ok(report.gpsSpeedMps !== null && report.gpsSpeedMps < 0.5);
});

test('stationary GPS drift is not proof of cheating or a completed sprint', () => {
  const report = assessFairPlay(positions(0), motion);
  assert.notEqual(report.verdict, 'suspicious');
  assert.equal(report.gpsDistanceM, 0);
  assert.equal(report.gpsSpeedMps, 0);
  assert.ok(!report.reasons.includes('implausible-average-speed'));
});

test('slow walking with a locked-screen sensor gap remains uncertain, not suspicious', () => {
  const interrupted = motion.filter(s => s.timestampMs <= 4000 || s.timestampMs >= 26000);
  const report = assessFairPlay(positions(0.35), interrupted);
  assert.equal(report.verdict, 'uncertain');
  assert.ok(report.reasons.includes('insufficient-motion-coverage'));
  assert.ok(report.motionCoverage < 0.35);
  assert.ok(!report.reasons.includes('implausible-average-speed'));
});
