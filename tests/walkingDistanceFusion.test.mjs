import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reconcileWalkingDistance } from '../src/lib/walkingDistanceFusion.ts';
import { syntheticPoint } from '../src/lib/sprintGps.ts';

const base = {
  walkingStrideM: 0.72, stepCount: 50,
  startGps: syntheticPoint(0, 0, 2),
  currentGps: syntheticPoint(35.5, 26000, 2),
  nowMs: 26500, sensorContinuous: true, straightRoute: true,
};

test('clean straight walking: compatible GPS and IMU yield explicitly experimental fusion', () => {
  const result = reconcileWalkingDistance(base);
  assert.equal(result.mode, 'combined');
  assert.equal(result.stepDistanceM, 36);
  assert.ok(Math.abs(result.gpsDisplacementM - 35.5) < 0.01);
  assert.ok(result.estimatedDistanceM > 35 && result.estimatedDistanceM <= 36);
});

test('GPS dropouts and poor positional accuracy fall back to steps only', () => {
  const missing = reconcileWalkingDistance({ ...base, currentGps: null });
  assert.equal(missing.mode, 'steps-only');
  assert.equal(missing.estimatedDistanceM, 36);
  assert.equal(missing.gpsDisplacementM, null);
  const poor = reconcileWalkingDistance({ ...base,
    currentGps: syntheticPoint(35.5, 26000, 35) });
  assert.equal(poor.mode, 'steps-only');
  const stale = reconcileWalkingDistance({ ...base, nowMs: 40000 });
  assert.equal(stale.mode, 'steps-only');
});

test('GPS jump is a conflict, not a fictitious fusion or step-count correction', () => {
  const result = reconcileWalkingDistance({ ...base,
    currentGps: syntheticPoint(75, 26000, 2) });
  assert.equal(result.mode, 'conflict');
  assert.equal(result.estimatedDistanceM, null);
  assert.equal(result.stepDistanceM, 36);
  assert.ok(result.disagreementM > 30);
});

test('IMU interruption blocks extrapolation even when GPS looks good', () => {
  const result = reconcileWalkingDistance({ ...base, sensorContinuous: false });
  assert.equal(result.mode, 'paused');
  assert.equal(result.estimatedDistanceM, null);
});

test('curved routes cannot be inferred from straight-line endpoint GPS', () => {
  const result = reconcileWalkingDistance({ ...base, straightRoute: false });
  assert.equal(result.mode, 'steps-only');
  assert.equal(result.estimatedDistanceM, 36);
});

test('unknown stride is distinctly GPS-only, not a valid combined result', () => {
  const result = reconcileWalkingDistance({ ...base, walkingStrideM: null, stepCount: null });
  assert.equal(result.mode, 'gps-only');
  assert.equal(result.stepDistanceM, null);
  assert.ok(result.estimatedDistanceM > 35);
});

test('stationary GPS jitter must not create phantom steps or distance', () => {
  const result = reconcileWalkingDistance({ ...base,
    stepCount: 0, currentGps: syntheticPoint(1.8, 26000, 2) });
  assert.equal(result.mode, 'combined');
  assert.equal(result.estimatedDistanceM, 0);
  const jump = reconcileWalkingDistance({ ...base,
    stepCount: 0, currentGps: syntheticPoint(30, 26000, 2) });
  assert.equal(jump.mode, 'conflict');
  assert.equal(jump.estimatedDistanceM, null);
});

test('invalid samples, out-of-order positions and unsupported stride cannot report fusion', () => {
  assert.equal(reconcileWalkingDistance({ ...base, nowMs: NaN }).mode, 'unavailable');
  assert.equal(reconcileWalkingDistance({ ...base, currentGps: syntheticPoint(40, -1, 2) }).mode, 'steps-only');
  assert.equal(reconcileWalkingDistance({ ...base, walkingStrideM: -0.5 }).mode, 'gps-only');
  assert.equal(reconcileWalkingDistance({ ...base, stepCount: -10, currentGps: null }).mode, 'unavailable');
  assert.equal(reconcileWalkingDistance({ ...base,
    currentGps: { ...base.currentGps, latitude: Infinity } }).mode, 'steps-only');
});

test('demo UI declares fake data and has no writes or calls to race scoring', () => {
  const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const screen = read('src/screens/FusionLabScreen.tsx');
  const app = read('src/App.tsx');
  const profile = read('src/screens/ProfileScreen.tsx');
  const fusion = read('src/lib/walkingDistanceFusion.ts');
  assert.match(screen, /SIMULATION · KEINE ECHTEN GPS-DATEN/);
  assert.match(screen, /syntheticPoint/);
  assert.match(screen, /reconcileWalkingDistance/);
  assert.match(screen, /Sensorlücke/);
  assert.match(screen, /GPS-Sprung/);
  assert.match(profile, /to="\/fusion-lab"/);
  assert.match(app, /<Route path="\/fusion-lab" element=\{<FusionLabScreen \/>\}/);
  for (const prohibited of ['submitDuelResult(', 'readyForDuel(', 'createDuel(', "from '../db/", "from '../lib/supabaseClient"]) {
    assert.equal((screen + fusion).includes(prohibited), false, 'No race or DB integration in simulator');
  }
});
