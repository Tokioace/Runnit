import test from 'node:test';
import assert from 'node:assert/strict';
import {assessNativeConsistency} from '../src/lib/nativeSensorConsistency.ts';
const report={runId:'00000000-0000-4000-8000-000000000001',status:'completed',elapsedMs:12000,gpsFixes:12,rejectedFixes:0,accuracyM:3,motionSamples:500,motionGaps:0,motionAvailable:true,
 sprint:{targetM:50,distanceM:54,accepted:10,rejected:0,invalid:false,finishMs:8000},
 motionAnalysis:{candidates:26,samples:390,gaps:0,coverage:.97,cadenceSpm:200,state:'sprint-like',window:'sprint'}};
test('compatible sensor summaries remain unverified',()=>{
 const r=assessNativeConsistency(report);
 assert.equal(r.status,'compatible');assert.equal(r.verification,'unverified');
 assert.equal(r.averageSpeedMps,6.25);assert.equal(r.candidatesPerMinute,195);
 assert.equal(r.metersPerCandidate,50/26);
});
test('unfinished, interrupted, missing and poorly covered sensor data are not evidence of cheating',()=>{
 for(const r of [{...report,status:'running'},{...report,status:'interrupted'},{...report,sprint:undefined},{...report,sprint:{...report.sprint,finishMs:null}},{...report,motionAnalysis:undefined},{...report,motionAvailable:false},{...report,motionAnalysis:{...report.motionAnalysis,gaps:1}},{...report,motionAnalysis:{...report.motionAnalysis,coverage:.5}},{...report,motionAnalysis:{...report.motionAnalysis,window:'probe'}}]){
  const out=assessNativeConsistency(r);assert.equal(out.status,'insufficient');assert.equal(out.verification,'unverified');
 }
});
test('contradictions are diagnostic flags only',()=>{
 for(const [changes,reason] of [
 [{motionAnalysis:{...report.motionAnalysis,candidates:0,cadenceSpm:null,state:'insufficient'}},'movement-without-peaks'],
 [{motionAnalysis:{...report.motionAnalysis,candidates:10,cadenceSpm:200}},'distance-per-candidate'],
 [{sprint:{...report.sprint,finishMs:3000}},'speed-outside-range'],
 [{motionAnalysis:{...report.motionAnalysis,candidates:19,cadenceSpm:100,state:'other-rhythm'}},'rhythm-outside-sprint-window'],
 [{motionAnalysis:{...report.motionAnalysis,candidates:19,cadenceSpm:300}},'cadence-count-difference']
 ]){
  const r=assessNativeConsistency({...report,...changes});
  assert.equal(r.status,'discrepancy');assert.ok(r.reasons.includes(reason));assert.equal(r.verification,'unverified');
 }
});
test('walking pace and irregular peaks are not automatic fraud',()=>{
 assert.equal(assessNativeConsistency({...report,sprint:{...report.sprint,finishMs:25000}}).status,'insufficient');
 assert.equal(assessNativeConsistency({...report,motionAnalysis:{...report.motionAnalysis,state:'irregular',cadenceSpm:null}}).status,'insufficient');
});
