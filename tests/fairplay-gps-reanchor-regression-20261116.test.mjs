import test from 'node:test';
import assert from 'node:assert/strict';
import { assessFairPlay } from '../src/lib/fairPlay.ts';

// Synthetic positions only. A discontinuity is a quality warning, never a
// verified cheating decision or evidence of a completed race.
const fix = (timestampMs, longitude, accuracyM = 3) => ({
  timestampMs, latitude: 0, longitude, accuracyM,
});

test('GPS teleport is excluded while plausible movement after re-anchor is measured', () => {
  const positions = [
    fix(0, 0),
    fix(1000, 0.00001),
    fix(2000, 1), // impossible discontinuity
    fix(3000, 1.00001),
    fix(4000, 1.00002),
  ];
  const report = assessFairPlay(positions, []);
  assert.equal(report.verdict, 'uncertain');
  assert.ok(report.reasons.includes('gps-position-jump'));
  assert.ok(!report.reasons.includes('implausible-average-speed'));
  assert.ok(report.gpsDistanceM !== null && report.gpsDistanceM > 2 && report.gpsDistanceM < 5);
  assert.ok(report.gpsSpeedMps !== null && report.gpsSpeedMps < 2);
});

test('inaccurate fixes cannot become distance anchors or hide insufficient GPS', () => {
  const positions = [
    fix(0, 0, 3),
    fix(1000, 1, 250),
    fix(2000, 0.00001, 3),
  ];
  const report = assessFairPlay(positions, []);
  assert.equal(report.verdict, 'uncertain');
  assert.ok(report.reasons.includes('insufficient-gps'));
  assert.ok(!report.reasons.includes('gps-position-jump'));
  assert.ok(report.gpsDistanceM !== null && report.gpsDistanceM > 0 && report.gpsDistanceM < 3);
  assert.ok(!report.reasons.includes('implausible-average-speed'));
});
