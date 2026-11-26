import test from 'node:test';
import assert from 'node:assert/strict';
import {createGpsSprint,advanceGpsSprint,advanceLiveGpsSprint,syntheticPoint} from '../src/lib/sprintGps.ts';
import {createDuelGpsMeasurement,advanceDuelGpsMeasurement} from '../src/lib/duelGpsMeasurement.ts';
const start=1700000000000;
const fix=(m,t,a=3)=>syntheticPoint(m,start+t,a);
function pair(points) {
 let solo=createGpsSprint(50,start), duel=createDuelGpsMeasurement(50,start,null);
 for(const sample of points){
  solo=advanceLiveGpsSprint(solo,sample,sample.timestampMs);
  duel=advanceDuelGpsMeasurement(duel,sample,sample.timestampMs);
  assert.deepEqual(solo,duel.sprint);
 }
 return solo;
}
const base=[fix(0,0),fix(10,1000),fix(20,2000),fix(30,3000),fix(40,4000)];
test('live solo and duel preserve previous peak and require a new crossing after a silent gap',()=>{
 const prior=pair(base);
 const recovered=pair([...base,fix(72,7500)]);
 assert.equal(recovered.finishTimestampMs,null);
 assert.equal(recovered.crossingTimestampMs,start+7500);
 assert.equal(recovered.crossingIntervalMs,null);
 assert.equal(recovered.maxSpeedMps,prior.maxSpeedMps);
 assert.ok(Math.abs(recovered.distanceM-72)<0.001);
 assert.equal(pair([...base,fix(72,7500),fix(76,8500)]).finishTimestampMs,start+7500);
});
test('late confirmations reset crossing evidence while the exact three second boundary remains valid',()=>{
 const crossing=[...base,fix(51,5000)];
 const candidate=pair(crossing).crossingTimestampMs;
 assert.ok(candidate!==null && candidate<start+5000);
 assert.equal(pair([...crossing,fix(60,8000)]).finishTimestampMs,candidate);
 const late=pair([...crossing,fix(60,8001)]);
 assert.equal(late.finishTimestampMs,null);
 assert.equal(late.beyondTargetCount,1);
 assert.equal(late.crossingTimestampMs,start+8001);
 assert.equal(pair([...crossing,fix(60,8001),fix(65,9001)]).finishTimestampMs,start+8001);
});
test('rejected observations do not bridge a gap and deterministic simulations retain old semantics',()=>{
 const points=[...base,fix(45,6500,25),fix(60,7500),fix(65,8500)];
 const live=pair(points);
 assert.equal(live.rejectedSamples,1);
 assert.equal(live.finishTimestampMs,start+7500);
 const simulation=points.reduce(advanceGpsSprint,createGpsSprint(50,start));
 assert.ok(simulation.finishTimestampMs<live.finishTimestampMs);
 assert.equal(simulation.crossingIntervalMs,3500);
});
