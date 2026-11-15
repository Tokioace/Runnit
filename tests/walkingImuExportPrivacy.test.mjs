import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Exercise the real, dependency-free export helper rather than inspecting its source.
const source = readFileSync(new URL('../src/lib/walkingImuExport.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source.replace(/^import type .*;\s*/m, ''), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
new Function('module', 'exports', js)(module, module.exports);
const { createWalkingImuExport } = module.exports;

test('walking IMU export uses relative monotonic times and never exports GPS fields', () => {
  const origin = 1800000000123;
  const samples = [
    { timestampMs: origin + 300, accelerationMagnitudeMps2: 9, accelerationX: 1, latitude: 48.9, longitude: 9.4 },
    { timestampMs: origin, accelerationMagnitudeMps2: 8, accelerationY: 2, accuracyM: 3 },
    { timestampMs: origin + 150, accelerationMagnitudeMps2: 10, accelerationZ: 3 },
  ];
  const result = createWalkingImuExport(samples, '100', {
    smoothedMs: [origin - 10, origin + 200, origin + 50, origin + 999],
    rawMs: [origin + 300, Number.NaN],
  });
  assert.equal(result.schema, 'runnit-walking-imu-v1');
  assert.equal(result.referenceSteps, 100);
  assert.deepEqual(result.samples.map(s => s.tMs), [0, 150, 300]);
  assert.deepEqual(result.peakDiagnostics.smoothedLivePeakMs, [50, 200]);
  assert.deepEqual(result.peakDiagnostics.rawLivePeakMs, [300]);
  for (const sample of result.samples) {
    assert.deepEqual(Object.keys(sample).sort(), ['magnitude', 'tMs', 'x', 'y', 'z']);
  }
  const json = JSON.stringify(result);
  for (const forbidden of ['latitude', 'longitude', 'accuracyM', String(origin)]) {
    assert.ok(!json.includes(forbidden), 'private GPS or epoch field leaked: ' + forbidden);
  }
});

test('walking IMU export rejects invalid motion samples and empty peak intervals', () => {
  const result = createWalkingImuExport([
    { timestampMs: 5, accelerationMagnitudeMps2: -1 },
    { timestampMs: Number.NaN, accelerationMagnitudeMps2: 2 },
    { timestampMs: 10, accelerationMagnitudeMps2: 200 },
  ], '999999999', { smoothedMs: [5], rawMs: [10] });
  assert.deepEqual(result.samples, []);
  assert.deepEqual(result.peakDiagnostics, { smoothedLivePeakMs: [], rawLivePeakMs: [] });
  assert.equal(result.referenceSteps, null);
});
