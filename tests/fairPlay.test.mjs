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
  it('does not double-count fast repeated motion peaks as steps', () => {
    const report = assessFairPlay(gps(30, 1.45), walkingImu(320));
    assert.ok(report.detectedSteps < 65);
    assert.ok(report.cadenceSpm === null || report.cadenceSpm <= 175);
  });
  it('rejects isolated pocket shakes without a rhythmic sequence', () => {
    const shocks = [0, 470, 1820, 2250, 4100, 5200].flatMap(t => [
      { timestampMs: t, accelerationMagnitudeMps2: 0.2 },
      { timestampMs: t + 20, accelerationMagnitudeMps2: 5 },
      { timestampMs: t + 40, accelerationMagnitudeMps2: 0.2 },
    ]);
    const report = assessFairPlay([], shocks);
    assert.equal(report.detectedSteps, 0);
    assert.ok(report.candidatePeaks.some(p => p.reason === 'irregular-rhythm'));
    assert.equal(report.verdict, 'uncertain');
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
  it('recovers walking distance after an isolated GPS jump without counting the jump', () => {
    const samples = gps(8, 1.5);
    samples[3] = { ...samples[3], longitude: samples[3].longitude + 0.01 };
    const report = assessFairPlay(samples, imu(80));
    assert.equal(report.verdict, 'uncertain');
    assert.ok(report.reasons.includes('gps-position-jump'));
    assert.ok(report.gpsDistanceM !== null && report.gpsDistanceM > 4 && report.gpsDistanceM < 12);
  });
  it('does not count a long locked-screen IMU gap as sensor coverage', () => {
    const positions = gps(30, 1.45);
    const continuous = walkingImu(600);
    const withGap = continuous.filter(s => s.timestampMs <= 5000 || s.timestampMs >= 25000);
    const normal = assessFairPlay(positions, continuous);
    const interrupted = assessFairPlay(positions, withGap);
    assert.ok(normal.motionCoverage > 0.95);
    assert.ok(interrupted.motionCoverage < 0.4);
    assert.equal(interrupted.verdict, 'uncertain');
    assert.ok(interrupted.reasons.includes('insufficient-motion-coverage'));
    assert.ok(!interrupted.reasons.includes('implausible-average-speed'));
  });
  it('does not inflate coverage when IMU timestamps repeat', () => {
    const samples = walkingImu(600);
    const repeated = samples.flatMap(s => [s, { ...s }]);
    const report = assessFairPlay(gps(30, 1.45), repeated);
    assert.ok(report.motionCoverage <= 1);
    assert.ok(report.motionCoverage > 0.95);
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
    assert.equal(report.acceptedStepTimesMs.length, report.detectedSteps);
    assert.equal(report.candidatePeaks.filter(p => p.reason === 'accepted').length, report.detectedSteps);
    assert.ok(report.acceptedStepTimesMs.every((t, i, values) => i === 0 || t > values[i - 1]));
  });
});
