import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assessFairPlay } from '../src/lib/fairPlay.ts';

const gps = (count, speed = 5, accuracy = 3) => Array.from({ length: count }, (_, i) => ({
  timestampMs: i * 1000, latitude: 0, longitude: i * speed / 111194.93, accuracyM: accuracy,
}));
const imu = (count, start = 0) => Array.from({ length: count }, (_, i) => ({
  timestampMs: start + i * 100, accelerationMagnitudeMps2: i % 5 === 2 ? 4 : 0.3,
}));
const walkingImu = (intervalMs, durationMs = 30000) => Array.from({ length: Math.floor(durationMs / 20) }, (_, i) => ({
  timestampMs: i * 20,
  accelerationMagnitudeMps2: i * 20 % intervalMs === 0 ? 4 : 0.3,
}));
describe('FairPlay experimental evidence', () => {
  it('flags fast step peaks during ordinary walking as uncertainty, not fraud', () => {
    const report = assessFairPlay(gps(30, 1.45), walkingImu(320));
    assert.equal(report.verdict, 'uncertain');
    assert.ok(report.reasons.includes('walking-cadence-needs-calibration'));
    assert.ok(report.cadenceSpm > 175);
  });
  it('does not flag ordinary walking cadence', () => {
    const report = assessFairPlay(gps(30, 1.45), walkingImu(600));
    assert.equal(report.verdict, 'plausible');
    assert.ok(!report.reasons.includes('walking-cadence-needs-calibration'));
  });
  it('returns uncertain with no data, never automatically verified', () => {
    const report = assessFairPlay([], []);
    assert.equal(report.verdict, 'uncertain');
    assert.ok(report.reasons.includes('insufficient-gps'));
  });
  it('treats impossible GPS jumps as uncertain rather than accusing a walker', () => {
    const report = assessFairPlay(gps(8, 30), imu(80));
    assert.equal(report.verdict, 'uncertain');
    assert.ok(report.reasons.includes('gps-position-jump'));
  });
  it('does not accuse when IMU is unavailable', () => {
    const report = assessFairPlay(gps(8), []);
    assert.equal(report.verdict, 'uncertain');
    assert.ok(report.reasons.includes('insufficient-motion-coverage'));
  });
  it('does not mistake poor GPS for validated running', () => {
    const report = assessFairPlay(gps(8, 5, 45), imu(80));
    assert.equal(report.verdict, 'uncertain');
    assert.ok(report.reasons.includes('insufficient-gps'));
  });
  it('accepts compatible synthetic sensor evidence only as plausible', () => {
    const report = assessFairPlay(gps(8), imu(80));
    assert.equal(report.verdict, 'plausible');
    assert.ok(report.detectedSteps > 2);
  });
});
