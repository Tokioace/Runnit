import test from 'node:test';
import assert from 'node:assert/strict';
import {createDuelGpsMeasurement,advanceDuelGpsMeasurement,duelGpsMetrics} from '../src/lib/duelGpsMeasurement.ts';
import {ghostSummary} from '../src/lib/ghostRunSummary.ts';
import {syntheticPoint} from '../src/lib/sprintGps.ts';
const start=1700000000000;
const fix=(m,t)=>syntheticPoint(m,start+t);
const advance=(state,m,t)=>advanceDuelGpsMeasurement(state,fix(m,t),start+t);
function crossing(){
 let s=createDuelGpsMeasurement(50,start,fix(0,0));
 for(let i=1;i<=9;i++)s=advance(s,i*5,i*1000);
 return advance(s,51,10000);
}
test('the final confirmation interval cannot inflate Ghost Run and duel peak speed or acceleration',()=>{
 const before=crossing();
 const finished=advance(before,62,11000);
 assert.ok(finished.sprint.finishTimestampMs!==null);
 assert.equal(finished.sprint.finishTimestampMs,before.sprint.crossingTimestampMs);
 assert.equal(finished.sprint.maxSpeedMps,before.sprint.maxSpeedMps);
 assert.equal(finished.maxAccelMps2,before.maxAccelMps2);
 assert.ok(Math.abs(finished.sprint.maxSpeedMps-6)<.001);
 assert.ok(Math.abs(finished.maxAccelMps2-1)<.001);
 assert.equal(ghostSummary(finished.sprint,20,0,0,'unavailable',false,true).max_speed_mps,6);
 assert.equal(duelGpsMetrics(finished,20).maxSpeedMps,before.sprint.maxSpeedMps);
 assert.equal(finished.sprint.acceptedSamples,before.sprint.acceptedSamples+1);
 assert.ok(Math.abs(finished.sprint.distanceM-62)<.001);
});
test('an unconfirmed crossing followed by a return below target remains part of the run',()=>{
 const before=crossing();
 const returned=advance(before,40,11000);
 assert.equal(returned.sprint.finishTimestampMs,null);
 assert.equal(returned.sprint.crossingTimestampMs,null);
 assert.ok(Math.abs(returned.sprint.maxSpeedMps-11)<.001);
 assert.ok(returned.maxAccelMps2>before.maxAccelMps2);
 const crossingAgain=advance(returned,51,12000);
 const finished=advance(crossingAgain,60,13000);
 assert.ok(finished.sprint.finishTimestampMs!==null);
 assert.equal(finished.sprint.maxSpeedMps,crossingAgain.sprint.maxSpeedMps);
 assert.equal(finished.maxAccelMps2,crossingAgain.maxAccelMps2);
});
