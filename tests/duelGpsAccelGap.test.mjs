import test from 'node:test';
import assert from 'node:assert/strict';
import {createDuelGpsMeasurement,advanceDuelGpsMeasurement,duelGpsMetrics} from '../src/lib/duelGpsMeasurement.ts';
import {syntheticPoint} from '../src/lib/sprintGps.ts';
const start=1700000000000;
const fix=(m,t)=>syntheticPoint(m,start+t);
const advance=(s,m,t)=>advanceDuelGpsMeasurement(s,fix(m,t),start+t);
function initial(){
 let s=createDuelGpsMeasurement(50,start,fix(0,0));
 s=advance(s,4,1000);
 return advance(s,10,2000);
}
test('a gap resets the acceleration baseline but preserves distance and prior peak',()=>{
 const before=initial();
 const gap=advance(before,14,6000);
 assert.equal(gap.sprint.lastDecision,'accepted');
 assert.ok(Math.abs(gap.sprint.distanceM-14)<.001);
 assert.equal(gap.previousSpeedMps,null);
 assert.equal(gap.maxAccelMps2,before.maxAccelMps2);
 const first=advance(gap,16,6200);
 assert.ok(Math.abs(first.previousSpeedMps-10)<.001);
 assert.equal(first.maxAccelMps2,before.maxAccelMps2);
 const second=advance(first,18.2,6400);
 assert.ok(Math.abs(second.maxAccelMps2-5)<.001);
 assert.equal(duelGpsMetrics(second,10).maxAccelMps2,second.maxAccelMps2);
});
test('the three second boundary remains eligible for acceleration comparison',()=>{
 const before=initial();
 const exact=advance(before,10,5000);
 assert.equal(exact.previousSpeedMps,0);
 assert.ok(exact.maxAccelMps2>=before.maxAccelMps2);
 const longer=advance(before,10,5001);
 assert.equal(longer.previousSpeedMps,null);
 assert.equal(longer.maxAccelMps2,before.maxAccelMps2);
});
test('a rejected GPS fix does not reset the last accepted baseline',()=>{
 const before=initial();
 const rejected=advanceDuelGpsMeasurement(before,fix(15,3000),start+7000);
 assert.equal(rejected.sprint.lastDecision,'invalid-sample');
 assert.equal(rejected.previousSpeedMps,before.previousSpeedMps);
 assert.equal(rejected.maxAccelMps2,before.maxAccelMps2);
 const next=advance(rejected,18,3000);
 assert.ok(Math.abs(next.previousSpeedMps-8)<.001);
 assert.ok(Math.abs(next.maxAccelMps2-2)<.001);
});
