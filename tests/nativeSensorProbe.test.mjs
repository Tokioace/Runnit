import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseProbeReport,createNativeProbe,nativeReferenceDifference} from '../src/lib/nativeSensorProbe.ts';
const id='00000000-0000-4000-8000-000000000001';
const report={runId:id,status:'running',elapsedMs:1000,gpsFixes:1,rejectedFixes:0,accuracyM:3,motionSamples:50,motionGaps:0,motionAvailable:true};
test('only bounded aggregate diagnostics cross JS bridge',()=>{
 assert.deepEqual(parseProbeReport({...report,latitude:42,motionRaw:[1]}),report);
 for(const invalid of [{...report,elapsedMs:31000},{...report,accuracyM:NaN},{...report,gpsFixes:1.2},{...report,motionGaps:51},{...report,status:'verified'}])assert.equal(parseProbeReport(invalid),null);
 assert.equal(parseProbeReport(report,'other'),null);
});
test('permission status is distinct from actual capture',async()=>{
 for(const status of ['permission-requested','permission-denied']){
  const api=createNativeProbe({nativePromise:async()=>({status})});assert.equal(await api.start(),status);
 }
});
test('probe commands scoped to native run ID and reject cross-run data',async()=>{
 const calls=[];
 const api=createNativeProbe({nativePromise:async(plugin,method,options)=>{
  assert.equal(plugin,'RunnitSensorProbe');calls.push([method,options]);
  return method==='stopProbe'?{...report,status:'stopped'}:report;
 }});
 assert.deepEqual(await api.start(),report);
 assert.deepEqual(await api.read(id),report);
 assert.equal((await api.stop(id)).status,'stopped');
 await assert.rejects(api.read('bad'));
 assert.deepEqual(calls,[['startProbe',{}],['readProbe',{runId:id}],['stopProbe',{runId:id}]]);
});
test('native hard stop, foreground lifecycle and no upload in diagnostic',()=>{
 const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
 const swift=read('native/ios-preview/RunnitSensorProbe.swift');
 assert.match(swift,/willResignActiveNotification/);
 assert.match(swift,/timeInterval: 30/);
 assert.match(swift,/allowsBackgroundLocationUpdates = false/);
 assert.match(swift,/stopUpdatingLocation/);
 assert.match(swift,/stopDeviceMotionUpdates/);
 assert.doesNotMatch(swift,/\.coordinate|URLSession|UserDefaults/);
 assert.doesNotMatch(read('src/screens/NativeSensorScreen.tsx'),/supabase|localStorage|fetch\(/);
 assert.match(read('src/App.tsx'),/isNativeAuthRuntime\(\) && <Route path="\/native-sensors"/);
});

test('sprint bridge accepts only consistent experimental finish aggregates',()=>{
 const sprint={targetM:50,distanceM:53,accepted:12,rejected:2,invalid:false,finishMs:7000};
 const completed={...report,status:'completed',elapsedMs:9000,sprint};
 assert.deepEqual(parseProbeReport({...completed,sprint:{...sprint,anchor:[1,2]}}),completed);
 for(const bad of [{...sprint,targetM:10},{...sprint,finishMs:10000},{...sprint,invalid:true},{...sprint,accepted:1},{...sprint,distanceM:49}])assert.equal(parseProbeReport({...completed,sprint:bad}),null);
 assert.equal(parseProbeReport({...completed,status:'running'}),null);
});
test('reference comparison validates decimal input and never invents a finish',()=>{
 assert.ok(Math.abs(nativeReferenceDifference(7250,'7,00')-.25)<.00001);
 for(const value of ['', '0','abc','31','1e1'])assert.equal(nativeReferenceDifference(7000,value),null);
 assert.equal(nativeReferenceDifference(null,'7'),null);
});
test('arm command is explicit and scoped to supported distance and run',async()=>{
 const api=createNativeProbe({nativePromise:async(plugin,method,options)=>{
  assert.equal(method,'armSprint');assert.deepEqual(options,{runId:id,targetM:'50'});return report;
 }});
 await api.arm(id,50);await assert.rejects(api.arm(id,10));await assert.rejects(api.arm('bad',50));
});
