import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { syntheticPoint } from '../src/lib/sprintGps.ts';
import { createDuelGpsMeasurement, advanceDuelGpsMeasurement, duelGpsMetrics } from '../src/lib/duelGpsMeasurement.ts';

const start = 1700000000000;
const fix = (m, ms, accuracy = 3) => syntheticPoint(m, start + ms, accuracy);
const apply = (s, m, ms, delay = 0) => advanceDuelGpsMeasurement(s, fix(m, ms), start + ms + delay);

test('fresh start anchor is used; stale and post-start anchors are not', () => {
  assert.equal(createDuelGpsMeasurement(50,start,fix(0,-1000)).usedPrestartFix,true);
  for (const anchor of [fix(0,-3001),fix(0,1),fix(0,-1,16)]) {
    const state = createDuelGpsMeasurement(50,start,anchor);
    assert.equal(state.usedPrestartFix,false);
    assert.equal(state.sprint.origin,null);
  }
});

test('out of order, stale, future, poor accuracy and impossible jumps cannot advance distance', () => {
  let state = createDuelGpsMeasurement(50,start,fix(0,0));
  state = apply(state, 5,1000);
  const distance = state.sprint.distanceM;
  for (const [sample,received] of [[fix(10,900),start+1200],[fix(10,2000),start+5001],
    [fix(10,3000),start+2999],[fix(10,2000,30),start+2000],[fix(100,2000),start+2000],
    [{...fix(10,2000),latitude:NaN},start+2000]]) {
    state = advanceDuelGpsMeasurement(state,sample,received);
    assert.equal(state.sprint.distanceM,distance);
    assert.equal(state.sprint.lastAccepted.timestampMs,start+1000);
  }
  assert.equal(state.sprint.rejectedSamples,6);
  assert.equal(state.staleFixes,2);
});

test('back-and-forth displacement cannot accumulate a false 50 m finish', () => {
  let s = createDuelGpsMeasurement(50,start,fix(0,0));
  for(let i=1;i<=30;i++) s=apply(s,i%2?5:0,i*1000);
  assert.equal(s.sprint.finishTimestampMs,null);
  assert.ok(s.sprint.distanceM < 0.001);
});

test('confirmed finish uses interpolated fix timestamps, not arrival or confirmation time', () => {
  let s=createDuelGpsMeasurement(50,start,fix(0,0));
  for(let i=1;i<=4;i++) s=apply(s,i*10,i*1000,500);
  s=apply(s,49,5000,500);
  s=apply(s,51,6000,500);
  assert.equal(s.sprint.finishTimestampMs,null);
  s=apply(s,60,7000,900);
  assert.ok(Math.abs(s.sprint.finishTimestampMs-(start+5500))<=1);
  const metrics=duelGpsMetrics(s,25);
  assert.equal(metrics.metricsJson.verification,'unverified');
  assert.equal(metrics.metricsJson.samplesUsed,8);
  assert.equal(metrics.metricsJson.avgAccuracyM,3);
  assert.ok(metrics.maxSpeedMps>=9.9);
  assert.doesNotMatch(JSON.stringify(metrics),/latitude|longitude|timestampMs/);
  const after=apply(s,70,8000);
  assert.equal(after.sprint.finishTimestampMs,s.sprint.finishTimestampMs);
  assert.equal(after.sprint.lastDecision,'already-finished');
});

test('live overlay uses the shared measurement and completes outside the state updater', () => {
  const source=readFileSync(new URL('../src/screens/MapScreen.tsx',import.meta.url),'utf8');
  const overlay=source.slice(source.indexOf('function RaceOverlay('));
  assert.match(overlay,/timestampMs: pos\.timestamp/);
  assert.match(overlay,/finishCallbackRef\.current\(next\.sprint\.finishTimestampMs/);
  assert.doesNotMatch(overlay,/onFinish\(Date\.now\(\)/);
  assert.doesNotMatch(overlay,/setAcceptedDistanceM/);
});
