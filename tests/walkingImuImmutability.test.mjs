import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Run the real TS implementation without changing production code or importing
// browser-only modules. The type-only import is erased by transpilation.
const source = readFileSync(new URL('../src/lib/walkingImuExport.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
new Function('module', 'exports', compiled)(module, module.exports);
const { createWalkingImuExport } = module.exports;

test('walking IMU export sorts its copy without mutating the captured samples or peaks', () => {
  const later = Object.freeze({ timestampMs: 1500, accelerationMagnitudeMps2: 9.8 });
  const earlier = Object.freeze({ timestampMs: 1000, accelerationMagnitudeMps2: 10.2 });
  const samples = Object.freeze([later, earlier]);
  const smoothedMs = Object.freeze([1400, 1100]);
  const rawMs = Object.freeze([1450, 1050]);
  const peaks = Object.freeze({ smoothedMs, rawMs });

  const exported = createWalkingImuExport(samples, '2', peaks);
  assert.deepEqual(samples, [later, earlier], 'source acquisition order must remain intact');
  assert.deepEqual(smoothedMs, [1400, 1100], 'source smoothed peaks must remain intact');
  assert.deepEqual(rawMs, [1450, 1050], 'source raw peaks must remain intact');
  assert.deepEqual(exported.samples.map(s => s.tMs), [0, 500]);
  assert.deepEqual(exported.peakDiagnostics.smoothedLivePeakMs, [100, 400]);
  assert.deepEqual(exported.peakDiagnostics.rawLivePeakMs, [50, 450]);
});

test('walking IMU export does not leak extra properties from source sensor objects', () => {
  const sample = Object.freeze({
    timestampMs: 1000,
    accelerationMagnitudeMps2: 9.8,
    latitude: 48.94,
    longitude: 9.43,
    sessionToken: 'private',
    accelerationX: Number.NaN,
  });
  const exported = createWalkingImuExport(Object.freeze([sample]), '1');
  assert.deepEqual(Object.keys(exported.samples[0]).sort(), ['magnitude', 'tMs', 'x', 'y', 'z']);
  assert.equal(exported.samples[0].x, null);
  assert.ok(!JSON.stringify(exported).includes('private'));
  assert.ok(!JSON.stringify(exported).includes('latitude'));
});
