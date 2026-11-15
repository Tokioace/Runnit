import test from 'node:test';
import assert from 'node:assert/strict';
import { createGpsSprint, syntheticPoint } from '../src/lib/sprintGps.ts';
import { createExperimentalRunReport } from '../src/lib/gpsField.ts';

// Runtime privacy contract: the export helper must whitelist aggregate fields,
// not spread the GPS engine state (which includes raw coordinates).
test('device GPS report serializes aggregates only, even when state has raw fixes', () => {
  const state = createGpsSprint(50, 1_800_000_000_000);
  const rawFix = syntheticPoint(12, state.startedAtMs + 1000, 4);
  const withPrivateData = {
    ...state,
    origin: rawFix,
    lastAccepted: rawFix,
    acceptedSamples: 1,
    privateSentinel: 'DO_NOT_EXPORT_PRIVATE_GPS',
  };
  const report = createExperimentalRunReport('device-gps', withPrivateData);
  const json = JSON.stringify(report);
  assert.equal(report.eligibility, 'not-eligible');
  assert.equal(report.finished, false);
  assert.equal(report.durationSeconds, null);
  assert.deepEqual(Object.keys(report).sort(), [
    'source', 'eligibility', 'targetMeters', 'observedDistanceMeters',
    'durationSeconds', 'acceptedSamples', 'rejectedSamples',
    'maxSpeedMps', 'finished',
  ].sort());
  assert.ok(!json.includes('DO_NOT_EXPORT_PRIVATE_GPS'));
  assert.ok(!json.includes('latitude'));
  assert.ok(!json.includes('longitude'));
  assert.ok(!json.includes('timestampMs'));
  assert.ok(!json.includes('accuracyM'));
  assert.ok(!json.includes('origin'));
  assert.ok(!json.includes('lastAccepted'));
  assert.equal(withPrivateData.origin, rawFix, 'report creation must not mutate GPS state');
});

test('simulation report has the same restricted shape and is not leaderboard-eligible', () => {
  const state = createGpsSprint(100, 1_800_000_000_000);
  const report = createExperimentalRunReport('simulation', state);
  assert.equal(report.source, 'simulation');
  assert.equal(report.eligibility, 'not-eligible');
  assert.equal(report.observedDistanceMeters, 0);
  assert.equal(report.acceptedSamples, 0);
  assert.equal(report.rejectedSamples, 0);
  assert.equal(report.finished, false);
});
