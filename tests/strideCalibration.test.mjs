import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  assessWalkingCalibration, distanceBetweenFixes, estimateWalkingStrideFromHeight,
  makeWalkingCalibration, getWalkingCalibration,
} from '../src/lib/strideCalibration.ts';

const radPerMeter = 1 / (6371000 * Math.PI / 180);
function group(meters, startTimeMs, accuracyM = 2, offsets = [0, 0.2, -0.2, 0.1]) {
  return offsets.map((offset, index) => ({
    latitude: 0, longitude: (meters + offset) * radPerMeter,
    accuracyM, timestampMs: startTimeMs + index * 1000,
  }));
}
function sample(overrides = {}) {
  return { heightCm: 175, stepCount: 50,
    startFixes: group(0, 0), endFixes: group(35, 60000), ...overrides };
}

test('height affects only the plausibility reference, not the calibrated stride', () => {
  assert.equal(estimateWalkingStrideFromHeight(175), 0.72625);
  assert.equal(estimateWalkingStrideFromHeight(0), null);
  const a = assessWalkingCalibration(sample());
  const b = assessWalkingCalibration(sample({ heightCm: 185 }));
  assert.equal(a.accepted, true);
  assert.equal(b.accepted, true);
  assert.ok(Math.abs(a.walkingStrideM - 0.7) < 0.02);
  assert.equal(a.walkingStrideM, b.walkingStrideM);
  assert.notEqual(a.heightReferenceM, b.heightReferenceM);
});

test('distance uses stationary endpoints rather than summing jittery GPS segments', () => {
  const distance = distanceBetweenFixes(group(0, 0)[0], group(35, 60000)[0]);
  assert.ok(Math.abs(distance - 35) < 1e-7);
});

test('10 steps are rejected because endpoint GPS error dominates short routes', () => {
  assert.match(assessWalkingCalibration(sample({ stepCount: 10 })).reason, /40 bis 90/);
});

test('rejects interruptions, invalid height, stale readings, and overlapping endpoints', () => {
  assert.equal(assessWalkingCalibration(sample({ sensorInterrupted: true })).accepted, false);
  assert.equal(assessWalkingCalibration(sample({ heightCm: NaN })).accepted, false);
  assert.equal(assessWalkingCalibration(sample({ startFixes: group(0, 0).map(p => ({ ...p, timestampMs: 1000 })) })).accepted, false);
  assert.equal(assessWalkingCalibration(sample({ endFixes: group(35, 1000) })).accepted, false);
});

test('rejects poor GPS uncertainty and positions that drift at rest', () => {
  assert.match(assessWalkingCalibration(sample({
    startFixes: group(0, 0, 7), endFixes: group(35, 60000, 7),
  })).reason, /zu schwach/);
  assert.match(assessWalkingCalibration(sample({
    startFixes: group(0, 0, 2, [0, 0.1, 20, 0.2]),
  })).reason, /schwankt/);
  assert.equal(assessWalkingCalibration(sample({
    endFixes: group(35, 60000, 30),
  })).accepted, false);
});

test('rejects non-straight, implausibly short or long endpoint displacements', () => {
  assert.equal(assessWalkingCalibration(sample({ endFixes: group(12, 60000) })).accepted, false);
  assert.equal(assessWalkingCalibration(sample({ endFixes: group(140, 60000) })).accepted, false);
});

test('only a plausible derived calibration can be saved; no raw GPS coordinates in metadata', () => {
  const assessment = assessWalkingCalibration(sample());
  const saved = makeWalkingCalibration({
    assessment, heightCm: 175, stepCount: 50, nowIso: '2026-11-11T12:00:00.000Z',
  });
  assert.equal(saved.method, 'gps-endpoints-imu');
  assert.equal(saved.stepCount, 50);
  assert.ok(saved.walkingStrideM > 0.65 && saved.walkingStrideM < 0.75);
  assert.doesNotMatch(JSON.stringify(saved), /latitude|longitude|startFixes|endFixes/);
  assert.deepEqual(getWalkingCalibration({ walking_calibration: saved }), saved);
  assert.equal(getWalkingCalibration({ walking_calibration: { ...saved, walkingStrideM: 100 } }), null);
  assert.throws(() => makeWalkingCalibration({
    assessment: assessWalkingCalibration(sample({ stepCount: 10 })),
    heightCm: 175, stepCount: 10, nowIso: '2026-11-11T12:00:00Z',
  }), /Keine gültige/);
});

test('experimental feature is separate from established step detection and race ranking', () => {
  const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const screen = read('src/screens/StrideCalibrationScreen.tsx');
  const app = read('src/App.tsx');
  const profile = read('src/screens/ProfileScreen.tsx');
  assert.match(screen, /new LiveStepPeakCounter\(67\)/);
  assert.match(screen, /supabase\.auth\.updateUser/);
  assert.match(screen, /assessWalkingCalibration/);
  assert.doesNotMatch(screen, /submitDuelResult|leaderboard|createDuel/);
  assert.match(app, /<Route path="\/calibration" element=\{<StrideCalibrationScreen \/>\}/);
  assert.match(profile, /to="\/calibration"/);
});
