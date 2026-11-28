import test from 'node:test';
import assert from 'node:assert/strict';
import {createDuelGpsMeasurement,advanceDuelGpsMeasurement,duelGpsMetrics} from '../src/lib/duelGpsMeasurement.ts';
import {syntheticPoint} from '../src/lib/sprintGps.ts';
const start=1700000000000;
const point=(m,t)=>syntheticPoint(m,start+t);
const advance=(s,m,t)=>advanceDuelGpsMeasurement(s,point(m,t),start+t);
function crossing(target){
 let s=createDuelGpsMeasurement(target,start,point(0,0));
 for(let i=1;i<target/5;i++)s=advance(s,i*5,i*1000);
 return advance(s,target+1,target/5*1000);
}
for(const target of [50,75,100]){
 test(target+' m step length uses the finish cutoff regardless of confirmation overshoot',()=>{
  const before=crossing(target);
  assert.equal(before.sprint.finishTimestampMs,null);
  const near=advance(before,target+2,(target/5+1)*1000);
  const far=advance(before,target+11,(target/5+1)*1000);
  assert.ok(near.sprint.finishTimestampMs!==null);
  assert.equal(near.sprint.finishTimestampMs,far.sprint.finishTimestampMs);
  assert.equal(duelGpsMetrics(near,40).stepLengthAvgM,target/40);
  assert.equal(duelGpsMetrics(far,40).stepLengthAvgM,target/40);
  assert.ok(Math.abs(duelGpsMetrics(far,40).distanceM-(target+11))<.001);
  assert.equal(duelGpsMetrics(far,0).stepLengthAvgM,undefined);
 });
}
test('unfinished measurement retains observed displacement rather than target distance',()=>{
 let s=createDuelGpsMeasurement(50,start,point(0,0));
 s=advance(s,10,1000);
 const metrics=duelGpsMetrics(s,5);
 assert.ok(Math.abs(metrics.stepLengthAvgM-2)<.001);
 assert.ok(Math.abs(metrics.distanceM-10)<.001);
});
