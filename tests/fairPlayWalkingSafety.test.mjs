import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assessFairPlay } from '../src/lib/fairPlay.ts';

// Synthetic safety regressions only; not an iPhone GPS/IMU accuracy claim.
// No coordinates from a person or device are included in these fixtures.
const gps = (speedMps, count = 30) => Array.from({ length: count }, (_, i) => ({
  timestampMs: i * 1000,
  latitude: 0,
  longitude: i * speedMps / 111194.93,
  accuracyM: 3,
}));
const walkingImu = () => Array.from({ length: 1500 }, (_, i) => ({
  timestampMs: i * 20,
  accelerationMagnitudeMps2: i % 30 === 0 ? 4 : 0.3,
}));

describe('walking lab: uncertainty is not an accusation', () => {
  it('does not classify slow ordinary walking as suspicious', () => {
    const report = assessFairPlay(gps(0.35), walkingImu());
    assert.notEqual(report.verdict, 'suspicious');
    assert.ok(!report.reasons.includes('implausible-average-speed'));
  });

  it('treats absent IMU evidence as uncertain, not as zero verified steps', () => {
    const report = assessFairPlay(gps(1.4), []);
    assert.equal(report.verdict, 'uncertain');
    assert.ok(report.reasons.includes('insufficient-motion-coverage'));
    assert.equal(report.motionCoverage, 0);
  });

  it('does not promote unreliable GPS to a verified plausible result', () => {
    const positions = gps(1.4).map(p => ({ ...p, accuracyM: 50 }));
    const report = assessFairPlay(positions, walkingImu());
    assert.equal(report.verdict, 'uncertain');
    assert.ok(report.reasons.includes('poor-gps-accuracy'));
    assert.ok(report.reasons.includes('insufficient-gps'));
  });

  it('filters invalid motion samples without modifying caller data', () => {
    const positions = gps(1.4);
    const samples = walkingImu();
    const invalid = { timestampMs: Number.NaN, accelerationMagnitudeMps2: 4 };
    const motion = Object.freeze([...samples, invalid]);
    const report = assessFairPlay(positions, motion);
    assert.notEqual(report.verdict, 'suspicious');
    assert.equal(motion.length, samples.length + 1);
    assert.equal(motion[motion.length - 1], invalid);
    assert.ok(report.motionCoverage >= 0 && report.motionCoverage <= 1);
  });
});
