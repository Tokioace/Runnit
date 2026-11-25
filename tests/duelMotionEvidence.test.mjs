import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DuelMotionCapture, motionEventSample } from '../src/lib/duelMotionEvidence.ts';
import { syntheticSprintTrace } from '../src/lib/sprintCadence.ts';
import { createDuelGpsMeasurement, duelGpsMetrics } from '../src/lib/duelGpsMeasurement.ts';
const start=1700000000000;
const capture=(mode)=>{const c=new DuelMotionCapture(start); for(const s of syntheticSprintTrace(mode)) c.push({...s,timestampMs:start+s.timestampMs}); return c;};
test('synthetic sprint rhythm agrees with plausible GPS pace, but remains diagnostic',()=>{
  const e=capture('running-225').summarize(start+8000,50);
  assert.equal(e.motionEvidence,'consistent'); assert.ok(e.motionCoverage>.95);
  assert.ok(e.sprintCadenceSpm>210&&e.sprintCadenceSpm<240);
  const metrics=duelGpsMetrics(createDuelGpsMeasurement(50,start,null),0,e);
  assert.equal(metrics.metricsJson.verification,'unverified');
  assert.doesNotMatch(JSON.stringify(metrics),/timestampMs|accelerationMagnitude|latitude|longitude/);
});
test('no samples or sensor interruptions are incomplete, never cheating',()=>{
  assert.equal(new DuelMotionCapture(start).summarize(start+8000,50).motionEvidence,'incomplete');
  const e=capture('motion-gap').summarize(start+8000,50);
  assert.equal(e.motionEvidence,'incomplete');assert.ok(e.motionGapCount>0);assert.equal(e.sprintCadenceSpm,null);
});
test('walking rhythm or stationary motion cannot establish consistent sprint evidence',()=>{
  assert.equal(capture('walking-110').summarize(start+8000,50).motionEvidence,'uncertain');
  assert.equal(capture('running-225').summarize(start+8000,0).motionEvidence,'uncertain');
});
test('finish cutoff, prestart, duplicate, nonfinite and stale events',()=>{
  const c=new DuelMotionCapture(start);
  assert.equal(c.push({timestampMs:start-1,accelerationMagnitudeMps2:1}),false);
  assert.equal(c.push({timestampMs:start,accelerationMagnitudeMps2:1}),true);
  assert.equal(c.push({timestampMs:start,accelerationMagnitudeMps2:2}),false);
  assert.equal(c.push({timestampMs:start+50,accelerationMagnitudeMps2:NaN}),false);
  assert.equal(c.push({timestampMs:start+100,accelerationMagnitudeMps2:1}),true);
  assert.equal(c.push({timestampMs:start+200,accelerationMagnitudeMps2:1}),true);
  assert.equal(c.summarize(start+100,50).motionSamples,2);
  const e={timeStamp:100,acceleration:{x:3,y:4,z:0}};
  assert.deepEqual(motionEventSample(e,start,110),{timestampMs:start+100,accelerationMagnitudeMps2:5});
  assert.equal(motionEventSample(e,start,1200),null);
  assert.equal(motionEventSample(e,start,90),null);
});
test('capture is bounded and untrusted signals do not gate the race',()=>{
  const c=new DuelMotionCapture(start);
  for(let i=0;i<30001;i++) c.push({timestampMs:start+i*10,accelerationMagnitudeMps2:1});
  assert.equal(c.summarize(start+300010,50).motionEvidence,'incomplete');
  const source=readFileSync(new URL('../src/screens/MapScreen.tsx',import.meta.url),'utf8');
  assert.match(source,/void requestDuelMotionPermission\(\);\s*void confirmMatchReady\(\);/);
  assert.match(source,/motionCapture.current.summarize\(next.sprint.finishTimestampMs/);
});
