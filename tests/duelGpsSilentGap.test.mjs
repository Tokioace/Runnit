import test from 'node:test';
import assert from 'node:assert/strict';
import {createDuelGpsMeasurement,advanceDuelGpsMeasurement} from '../src/lib/duelGpsMeasurement.ts';
import {syntheticPoint} from '../src/lib/sprintGps.ts';
const start=1700000000000;
const fix=(m,t,a=3)=>syntheticPoint(m,start+t,a);
const apply=(s,m,t,a=3)=>advanceDuelGpsMeasurement(s,fix(m,t,a),start+t);
function approaching(){
 let s=createDuelGpsMeasurement(50,start,fix(0,0));
 for(let i=1;i<=4;i++)s=apply(s,i*5,i*1000);
 return apply(s,25,5000);
}
test('silent gap before first crossing uses a new observed timestamp instead of interpolating',()=>{
 const before=approaching();
 const gap=apply(before,54,9000);
 assert.equal(gap.sprint.lastDecision,'accepted');
 assert.equal(gap.sprint.finishTimestampMs,null);
 assert.equal(gap.sprint.crossingTimestampMs,start+9000);
 assert.equal(gap.sprint.crossingIntervalMs,null);
 assert.equal(gap.sprint.maxSpeedMps,before.sprint.maxSpeedMps);
 assert.equal(gap.maxAccelMps2,before.maxAccelMps2);
 assert.equal(gap.previousSpeedMps,null);
 assert.ok(Math.abs(gap.sprint.distanceM-54)<0.001);
 assert.equal(apply(gap,60,10000).sprint.finishTimestampMs,start+9000);
});
test('a delayed confirmation cannot reuse an earlier unconfirmed crossing',()=>{
 let s=approaching();
 s=apply(s,35,6000);
 s=apply(s,46,7000);
 s=apply(s,52,8000);
 const crossing=s.sprint.crossingTimestampMs;
 assert.ok(crossing!==null && crossing<start+8000);
 const exact=apply(s,60,11000);
 assert.equal(exact.sprint.finishTimestampMs,crossing);
 const late=apply(s,60,11001);
 assert.equal(late.sprint.finishTimestampMs,null);
 assert.equal(late.sprint.beyondTargetCount,1);
 assert.equal(late.sprint.crossingTimestampMs,start+11001);
 assert.equal(apply(late,65,12001).sprint.finishTimestampMs,start+11001);
});
test('rejected fixes cannot close a silent observation gap and a below-target recovery permits normal interpolation',()=>{
 let s=approaching();
 const rejected=apply(s,40,8000,25);
 assert.equal(rejected.sprint.lastDecision,'poor-accuracy');
 assert.equal(rejected.sprint.lastAccepted.timestampMs,start+5000);
 s=apply(rejected,45,8001);
 assert.equal(s.sprint.lastDecision,'accepted');
 assert.equal(s.sprint.crossingTimestampMs,null);
 assert.equal(s.previousSpeedMps,null);
 s=apply(s,55,9001);
 assert.ok(Math.abs(s.sprint.crossingTimestampMs-(start+8501))<=1);
 assert.equal(s.sprint.crossingIntervalMs,1000);
 assert.equal(apply(s,60,10001).sprint.finishTimestampMs,s.sprint.crossingTimestampMs);
});
