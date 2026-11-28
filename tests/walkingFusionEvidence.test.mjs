import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectWalkingFusionEvidence } from '../src/lib/walkingFusionEvidence.ts';

const motion = (from = 1000, to = 10000, interval = 20) =>
  Array.from({ length: Math.floor((to - from) / interval) + 1 }, (_, i) =>
    ({ timestampMs: from + i * interval, accelerationMagnitudeMps2: 2.2 }));
const fix = (timestampMs, accuracyM = 3) => ({
  timestampMs, latitude: 48.8, longitude: 9.4 + timestampMs / 10000000, accuracyM,
});
const defaults = () => ({
  motion: motion(),
  gps: [fix(1900), fix(3000), fix(5100), fix(7800), fix(8200)],
  peakTimesMs: [1000, 2100, 3200, 4300, 5400, 6500, 7600, 9000],
  walkingPhase: { startMs: 1000, endMs: 7000 },
  backgroundInterrupted: false,
});

test('relative walking phase is translated onto the same monotonic clock as GPS and steps', () => {
  const result = selectWalkingFusionEvidence(defaults());
  assert.equal(result.usable, true);
  assert.equal(result.phaseStartMs, 2000);
  assert.equal(result.phaseEndMs, 8000);
  assert.equal(result.durationSeconds, 6);
  assert.equal(result.alignedSteps, 6);
  assert.equal(result.startGps?.timestampMs, 1900);
  assert.equal(result.endGps?.timestampMs, 7800);
  assert.equal(result.sensorContinuous, true);
});

test('unrelated pre- and post-walk peak counts are excluded', () => {
  const a = defaults();
  a.peakTimesMs = [-50, 1900, ...a.peakTimesMs, 8200, 16000, NaN];
  const result = selectWalkingFusionEvidence(a);
  assert.equal(result.alignedSteps, 6);
});

test('missing GPS at either endpoint does not invent route distance', () => {
  const result = selectWalkingFusionEvidence({ ...defaults(), gps: [fix(5100)] });
  assert.equal(result.usable, true);
  assert.equal(result.startGps, null);
  assert.equal(result.endGps, null);
  assert.match(result.reason, /GPS-Fixes/);
});

test('GPS fixes with insufficient accuracy and invalid coordinates are excluded', () => {
  const a = defaults();
  const result = selectWalkingFusionEvidence({
    ...a,
    gps: a.gps.map(p => ({ ...p, accuracyM: 40 })).concat([{
      ...fix(1900), latitude: NaN, accuracyM: 2,
    }]),
  });
  assert.equal(result.usable, true);
  assert.equal(result.startGps, null);
  assert.equal(result.endGps, null);
});

test('background and real IMU gaps prevent a fused distance report', () => {
  const input = defaults();
  const hidden = selectWalkingFusionEvidence({ ...input, backgroundInterrupted: true });
  assert.equal(hidden.usable, false);
  assert.equal(hidden.sensorContinuous, false);
  const gapped = selectWalkingFusionEvidence({
    ...input,
    motion: input.motion.filter(m => m.timestampMs < 4000 || m.timestampMs > 5200),
  });
  assert.equal(gapped.usable, false);
  assert.match(gapped.reason, /IMU-Unterbrechung/);
});

test('too few detected peaks or no walking phase cannot be treated as evidence', () => {
  const short = selectWalkingFusionEvidence({ ...defaults(), peakTimesMs: [2100, 3100] });
  assert.equal(short.usable, false);
  assert.match(short.reason, /Zu wenige/);
  const missing = selectWalkingFusionEvidence({ ...defaults(), walkingPhase: null });
  assert.equal(missing.usable, false);
  assert.equal(missing.phaseStartMs, null);
});

test('out-of-order samples are sorted locally; inputs are left unchanged', () => {
  const a = defaults();
  const reversed = [...a.motion].reverse();
  const reversedGps = [...a.gps].reverse();
  const result = selectWalkingFusionEvidence({ ...a, motion: reversed, gps: reversedGps });
  assert.equal(result.usable, true);
  assert.equal(result.phaseStartMs, 2000);
  assert.equal(reversed[0].timestampMs, 10000);
  assert.equal(reversedGps[0].timestampMs, 8200);
});

test('real-data card stays in walking lab and uses existing counter without touching race pipeline', () => {
  const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const screen = read('src/screens/GpsLabScreen.tsx');
  const evidence = read('src/lib/walkingFusionEvidence.ts');
  const fusion = read('src/lib/walkingDistanceFusion.ts');
  assert.match(screen, /REAL DATA LAB/);
  assert.match(screen, /selectWalkingFusionEvidence/);
  assert.match(screen, /livePeakCounter\.current\.timestampsMs/);
  assert.match(screen, /walkingCalibration\?\.walkingStrideM/);
  assert.match(screen, /straightRouteConfirmed/);
  assert.match(screen, /reconcileWalkingDistance/);
  assert.match(screen, /!active && report && \(/);
  assert.doesNotMatch(evidence + fusion, /createDuel\s*\(|submitDuelResult\s*\(|supabase\.from\s*\(/);
});
