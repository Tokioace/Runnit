import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createDuelGpsMeasurement,advanceDuelGpsMeasurement,resumeDuelGpsMeasurement} from '../src/lib/duelGpsMeasurement.ts';
import {syntheticPoint} from '../src/lib/sprintGps.ts';
const start=1700000000000;
const fix=(m,t,a=3)=>syntheticPoint(m,start+t,a);
const apply=(s,m,t,received=t,a=3)=>advanceDuelGpsMeasurement(s,fix(m,t,a),start+received);
function approaching(){
 let s=createDuelGpsMeasurement(50,start,fix(0,0));
 for(let i=1;i<=4;i++)s=apply(s,i*10,i*1000);
 return apply(s,49,5000);
}
test('reported GPS outage discards an unconfirmed crossing, not existing distance or peaks',()=>{
 let s=apply(approaching(),51,6000);
 assert.equal(s.sprint.beyondTargetCount,1);
 const before=s;
 s=resumeDuelGpsMeasurement(s,start+6200);
 assert.equal(s.sprint.crossingTimestampMs,null);
 assert.equal(s.sprint.beyondTargetCount,0);
 assert.equal(s.sprint.distanceM,before.sprint.distanceM);
 assert.equal(s.sprint.maxSpeedMps,before.sprint.maxSpeedMps);
 assert.equal(s.maxAccelMps2,before.maxAccelMps2);
 assert.equal(s.sprint.startedAtMs,start);
 s=apply(s,52,6100,6500);
 assert.equal(s.sprint.lastDecision,'invalid-sample');
 s=apply(s,54,6700);
 assert.equal(s.sprint.finishTimestampMs,null);
 assert.equal(s.sprint.crossingTimestampMs,start+6700);
 assert.equal(s.sprint.crossingIntervalMs,null);
 s=apply(s,60,7700);
 assert.equal(s.sprint.finishTimestampMs,start+6700);
});
test('repeated GPS errors advance the recovery boundary and require fresh evidence',()=>{
 let s=resumeDuelGpsMeasurement(approaching(),start+5200);
 s=resumeDuelGpsMeasurement(s,start+6000);
 s=resumeDuelGpsMeasurement(s,start+5700);
 assert.equal(s.resumeAfterMs,start+6000);
 s=apply(s,52,6000,6200);
 assert.equal(s.sprint.lastDecision,'invalid-sample');
 s=apply(s,53,6400,6400,30);
 assert.equal(s.sprint.lastDecision,'poor-accuracy');
 assert.equal(s.resumeAfterMs,start+6000);
 s=apply(s,54,6600);
 assert.equal(s.resumeAfterMs,undefined);
 assert.equal(s.sprint.beyondTargetCount,1);
 assert.equal(s.sprint.finishTimestampMs,null);
});
test('live error callback installs a GPS boundary but does not abort or discard motion',()=>{
 const source=readFileSync(new URL('../src/screens/MapScreen.tsx',import.meta.url),'utf8');
 const a=source.indexOf('const handleError = (error: GeolocationPositionError)',source.indexOf('function RaceOverlay('));
 const b=source.indexOf('    try {',a);
 assert.ok(a>=0&&b>a);
 const error=source.slice(a,b);
 assert.match(error,/if \(!active \|\| !isLive\(\) \|\| finishedRef.current\) return;/);
 assert.match(error,/measurementRef.current = resumeDuelGpsMeasurement\(measurementRef.current, Date.now\(\)\);/);
 assert.doesNotMatch(error,/onAbort\(|finishCallbackRef.current\(|motionCapture.current.resumeAfter|liveStepCounter.current.resumeAfter/);
});
