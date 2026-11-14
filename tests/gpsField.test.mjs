import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGpsSprint, advanceGpsSprint, syntheticPoint,
} from '../src/lib/sprintGps.ts';
import {
  isFreshStartFix, primeGpsSprint, createExperimentalRunReport, compareWithReferenceSeconds,
} from '../src/lib/gpsField.ts';

const START = 1_800_000_000_000;
const fix = (m, ms, accuracy = 3) => syntheticPoint(m, START + ms, accuracy);

test('fresh accurate fix can prime the start before the race begins', () => {
  const beforeStart = fix(0, -500);
  assert.equal(isFreshStartFix(beforeStart, START), true);
  const state = primeGpsSprint(createGpsSprint(50, START), beforeStart);
  assert.equal(state.acceptedSamples, 1);
  assert.equal(state.origin, beforeStart);
  assert.equal(state.lastAccepted, beforeStart);
  assert.equal(state.finishTimestampMs, null);
});

test('stale, inaccurate, future and invalid fixes are refused as anchors', () => {
  const bad = [
    fix(0, -3001), fix(0, 1), fix(0, -500, 15.1),
    { ...fix(0, -500), latitude: Infinity },
    { ...fix(0, -500), longitude: 200 },
    { ...fix(0, -500), accuracyM: -1 },
    { ...fix(0, -500), timestampMs: NaN },
  ];
  for (const anchor of bad) {
    assert.equal(isFreshStartFix(anchor, START), false);
    assert.throws(() => primeGpsSprint(createGpsSprint(50, START), anchor), /stale/);
  }
  assert.equal(isFreshStartFix(null, START), false);
});

test('already started sprint cannot be primed again', () => {
  const anchor = fix(0, -100);
  const state = primeGpsSprint(createGpsSprint(50, START), anchor);
  assert.throws(() => primeGpsSprint(state, anchor), /already/);
});

test('finish can be estimated using an anchor captured before the start', () => {
  let state = primeGpsSprint(createGpsSprint(50, START), fix(0, -500));
  for (let second = 1; second <= 9; second++) {
    state = advanceGpsSprint(state, fix(second * 8, second * 1000));
  }
  assert.ok(state.finishTimestampMs !== null);
  assert.ok(Math.abs((state.finishTimestampMs - START) / 1000 - 6.25) < 0.05);
  const report = createExperimentalRunReport('device-gps', state);
  assert.equal(report.source, 'device-gps');
  assert.equal(report.eligibility, 'not-eligible');
  assert.ok(report.finished);
  assert.ok(Math.abs(report.durationSeconds - 6.25) < 0.05);
  assert.ok(Math.abs(compareWithReferenceSeconds(report, 6) - 0.25) < 0.05);
});

test('real device GPS results are unverified even after an apparent finish', () => {
  let state = primeGpsSprint(createGpsSprint(50, START), fix(0, -100));
  for (let i = 1; i <= 9; i++) state = advanceGpsSprint(state, fix(i * 8, i * 1000));
  assert.equal(createExperimentalRunReport('device-gps', state).eligibility, 'not-eligible');
});

test('simulation and incomplete real sessions both remain leaderboard-ineligible', () => {
  const simulation = createExperimentalRunReport('simulation', createGpsSprint(100, START));
  const realIncomplete = createExperimentalRunReport('device-gps', createGpsSprint(50, START));
  assert.deepEqual([simulation.eligibility, realIncomplete.eligibility], ['not-eligible', 'not-eligible']);
  assert.equal(realIncomplete.finished, false);
  assert.equal(realIncomplete.durationSeconds, null);
});

test('independent stopwatch comparison rejects missing and impossible reference times', () => {
  let state = primeGpsSprint(createGpsSprint(50, START), fix(0, -100));
  for (let i = 1; i <= 9; i++) state = advanceGpsSprint(state, fix(i * 8, i * 1000));
  const report = createExperimentalRunReport('device-gps', state);
  for (const n of [null, 0, -2, NaN, Infinity, 181]) {
    assert.equal(compareWithReferenceSeconds(report, n), null);
  }
  assert.equal(compareWithReferenceSeconds(createExperimentalRunReport('simulation', createGpsSprint(50, START)), 6.25), null);
});
