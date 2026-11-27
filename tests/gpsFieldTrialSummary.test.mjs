import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeFieldTrials } from '../scripts/summarize-gps-field-trials.mjs';

function plan() {
 return Array.from({length:30},(_,i)=>({id:'T'+String(i+1).padStart(2,'0'),distanceMeters:[50,75,100][Math.floor(i/10)],outcome:'not-run',report:null}));
}
function finished(distance,duration=10,reference=9) {
 return {schema:'runnit-gps-field-v1',source:'device-gps',eligibility:'not-eligible',
 targetMeters:distance,finished:true,stopReason:'finish',durationSeconds:duration,
 observedDistanceMeters:distance+3,maxSpeedMps:8,acceptedSamples:12,rejectedSamples:0,staleFixesIgnored:0,
 observationMs:12000,crossingIntervalMs:1000,gpsObservationGapCount:0,gpsLongestObservationGapMs:null,finishTimingMethod:'interpolated',
 disclaimer:'Experimental device GPS data. Not valid for leaderboards or verified races.',
 referenceSeconds:reference,differenceSeconds:reference===null?null:duration-reference};
}
function attach(trial,report) { trial.outcome='report';trial.report=report; }
test('planned but unrun trials are not treated as successes or failures',()=>{
 const r=summarizeFieldTrials(plan());
 assert.equal(r.acceptance,'not-assessed');
 assert.ok(r.distances.every(g=>g.planned===10&&g.notRun===10&&g.attempted===0&&g.unevaluableRate===null));
});
test('includes aborted and missing-export attempts in denominator and distinguishes missing reference',()=>{
 const trials=plan();
 attach(trials[0],finished(50,10,9));
 attach(trials[1],finished(50,8,9));
 attach(trials[2],finished(50,10,null));
 attach(trials[3],{...finished(50),finished:false,stopReason:'background',durationSeconds:null,referenceSeconds:null,differenceSeconds:null,finishTimingMethod:null,crossingIntervalMs:null});
 trials[4].outcome='failed-no-export';
 const g=summarizeFieldTrials(trials).distances[0];
 assert.equal(g.attempted,5);assert.equal(g.finished,3);assert.equal(g.compared,2);
 assert.equal(g.withoutReference,1);assert.equal(g.unconfirmedFinishRate,.4);
 assert.equal(g.unevaluableRate,.6);assert.equal(g.meanSignedErrorSeconds,0);
 assert.equal(g.meanAbsoluteErrorSeconds,1);assert.equal(g.maxAbsoluteErrorSeconds,1);
});
test('rejects duplicate IDs and unbalanced or incomplete plans',()=>{
 const trials=plan();trials[1].id=trials[0].id;
 assert.throws(()=>summarizeFieldTrials(trials),/repeated trial/);
 assert.throws(()=>summarizeFieldTrials(plan().slice(1)),/30–50/);
 const other=plan();other[0].distanceMeters=75;
 assert.throws(()=>summarizeFieldTrials(other),/ten slots/);
});
test('rejects simulated, mismatched, contradictory or coordinate-containing reports',()=>{
 for(const changes of [{source:'simulation'},{targetMeters:100},{eligibility:'verified'},{differenceSeconds:8},{latitude:50},{durationSeconds:-1},{stopReason:'manual'}]){
  const trials=plan();attach(trials[0],{...finished(50),...changes});
  assert.throws(()=>summarizeFieldTrials(trials));
 }
});


test('requires complete consistent aggregate evidence from real export shape',()=>{
 for(const changes of [{observedDistanceMeters:49},{acceptedSamples:2},{rejectedSamples:-1},
  {observationMs:undefined},{crossingIntervalMs:4000},{gpsObservationGapCount:1},
  {finishTimingMethod:'observed-after-gap',crossingIntervalMs:null},{disclaimer:'verified'}]){
  const trials=plan();attach(trials[0],{...finished(50),...changes});
  assert.throws(()=>summarizeFieldTrials(trials));
 }
 const trials=plan();const missing=finished(50);delete missing.observationMs;
 attach(trials[0],missing);assert.throws(()=>summarizeFieldTrials(trials),/report fields/);
 const afterGap=plan();attach(afterGap[0],{...finished(50),finishTimingMethod:'observed-after-gap',
  crossingIntervalMs:null,gpsObservationGapCount:1,gpsLongestObservationGapMs:4000});
 assert.equal(summarizeFieldTrials(afterGap).distances[0].compared,1);
});
test('rejects IDs outside documented trial slots',()=>{
 for(const id of ['T00','T51','T99']){
  const trials=plan();trials[0].id=id;
  assert.throws(()=>summarizeFieldTrials(trials),/trial slot/);
 }
});
