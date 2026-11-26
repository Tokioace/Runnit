import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createDuelGpsMeasurement,advanceDuelGpsMeasurement,resumeDuelGpsMeasurement} from '../src/lib/duelGpsMeasurement.ts';
import {syntheticPoint} from '../src/lib/sprintGps.ts';
const start=1700000000000;
const fix=(m,t,a=3)=>syntheticPoint(m,start+t,a);
const apply=(s,m,t,received=t,a=3)=>advanceDuelGpsMeasurement(s,fix(m,t,a),start+received);
function beforeCrossing(){
 let s=createDuelGpsMeasurement(50,start,fix(0,0));
 for(let i=1;i<=4;i++)s=apply(s,i*10,i*1000);
 return apply(s,49,5000);
}
test('an interrupted crossing requires two new fixes and never reuses the old crossing time',()=>{
 let s=apply(beforeCrossing(),51,6000);
 assert.equal(s.sprint.beyondTargetCount,1);
 const priorPeak=s.sprint.maxSpeedMps,priorAccel=s.maxAccelMps2;
 s=resumeDuelGpsMeasurement(s,start+7000);
 assert.equal(s.sprint.crossingTimestampMs,null);
 assert.equal(s.sprint.beyondTargetCount,0);
 s=apply(s,55,6500,7200);
 assert.equal(s.sprint.lastDecision,'invalid-sample');
 assert.equal(s.resumeAfterMs,start+7000);
 s=apply(s,57,7500,7500,25);
 assert.equal(s.sprint.lastDecision,'poor-accuracy');
 assert.equal(s.resumeAfterMs,start+7000);
 s=apply(s,59,8000);
 assert.equal(s.sprint.finishTimestampMs,null);
 assert.equal(s.sprint.crossingTimestampMs,start+8000);
 assert.equal(s.sprint.crossingIntervalMs,null);
 assert.equal(s.sprint.maxSpeedMps,priorPeak);
 assert.equal(s.maxAccelMps2,priorAccel);
 s=apply(s,65,9000);
 assert.equal(s.sprint.finishTimestampMs,start+8000);
});
test('a resumed fix below target preserves displacement and restores ordinary crossing interpolation',()=>{
 let s=resumeDuelGpsMeasurement(beforeCrossing(),start+6000);
 s=apply(s,48,6500);
 assert.equal(s.resumeAfterMs,undefined);
 assert.ok(Math.abs(s.sprint.distanceM-48)<0.01);
 assert.equal(s.previousSpeedMps,null);
 s=apply(s,52,7500);
 assert.equal(s.sprint.finishTimestampMs,null);
 s=apply(s,60,8500);
 assert.ok(Math.abs(s.sprint.finishTimestampMs-(start+7000))<=1);
});
test('a finished measurement cannot be reopened and a live abort failure installs a resume boundary',()=>{
 let s=apply(apply(beforeCrossing(),51,6000),60,7000);
 assert.equal(resumeDuelGpsMeasurement(s,start+8000),s);
 const source=readFileSync(new URL('../src/screens/MapScreen.tsx',import.meta.url),'utf8');
 const overlayStart=source.indexOf('function RaceOverlay(');
 const abortStart=source.indexOf('const doAbort =',overlayStart);
 const abortEnd=source.indexOf('const watchIdRef =',abortStart);
 assert.ok(overlayStart>=0 && abortStart>overlayStart && abortEnd>abortStart);
 const abort=source.slice(abortStart,abortEnd);
 assert.match(abort,/if \(!isLive\(\)\) return;\s*finishedRef.current = false;\s*const resumedAtMs = Date.now\(\);\s*measurementRef.current = resumeDuelGpsMeasurement\(measurementRef.current, resumedAtMs\);/);
});
