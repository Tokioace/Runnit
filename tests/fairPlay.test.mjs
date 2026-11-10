import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assessFairPlay } from '../src/lib/fairPlay.ts';

const gps = (count, speed = 5, accuracy = 3) => Array.from({ length: count }, (_, i) => ({
  timestampMs: i * 1000, latitude: 0, longitude: i * speed / 111194.93, accuracyM: accuracy,
}));
const imu = (count, start = 0) => Array.from({ length: count }, (_, i) => ({
  timestampMs: start + i * 100, accelerationMagnitudeMps2: i % 5 === 2 ? 4 : 0.3,
}));
describe('FairPlay experimental evidence', () => {
  it('returns uncertain with no data, never automatically verified', () => {
    const report = assessFairPlay([], []);
    assert.equal(report.verdict, 'uncertain');
    assert.ok(report.reasons.includes('insufficient-gps'));
  });
  it('flags impossible average travel speed', () => {
    const report = assessFairPlay(gps(8, 30), imu(80));
    assert.equal(report.verdict, 'suspicious');
    assert.ok(report.reasons.includes('implausible-average-speed'));
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
