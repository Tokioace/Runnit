import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseProbeReport,createNativeProbe,nativeReferenceDifference,nativeStepDifference} from '../src/lib/nativeSensorProbe.ts';
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
  assert.equal(method,'armSprint');assert.deepEqual(options,{runId:id,targetM:'50'});return {...report,sprint:{targetM:50,distanceM:0,accepted:0,rejected:0,invalid:false,finishMs:null}};
 }});
 await api.arm(id,50);await assert.rejects(api.arm(id,10));await assert.rejects(api.arm('bad',50));
});

test('motion summary validates cadence, window and coverage, discards raw data',()=>{
 const motionAnalysis={candidates:20,samples:50,gaps:0,coverage:.9,cadenceSpm:200,state:'sprint-like',window:'probe'};
 assert.deepEqual(parseProbeReport({...report,motionAnalysis:{...motionAnalysis,raw:[1]}}),{...report,motionAnalysis});
 for(const bad of [{...motionAnalysis,samples:51},{...motionAnalysis,candidates:51},{...motionAnalysis,gaps:1},{...motionAnalysis,coverage:.2},{...motionAnalysis,cadenceSpm:100},{...motionAnalysis,window:'sprint'},{...motionAnalysis,state:'verified'}])assert.equal(parseProbeReport({...report,motionAnalysis:bad}),null);
});
test('manual step count is a separate diagnostic comparison',()=>{
 assert.equal(nativeStepDifference(26,'25'),1);
 assert.equal(nativeStepDifference(0,'0'),0);
 for(const value of ['', '-1','25.2','1e2','301'])assert.equal(nativeStepDifference(25,value),null);
});

test('arm rejects missing, wrong-distance, invalid or terminal sprint acknowledgement',async()=>{
 const sprint={targetM:50,distanceM:0,accepted:0,rejected:0,invalid:false,finishMs:null};
 for(const raw of [report,{...report,sprint:{...sprint,targetM:75}},
  {...report,sprint:{...sprint,invalid:true}},{...report,status:'stopped',sprint}]){
  const api=createNativeProbe({nativePromise:async()=>raw});
  await assert.rejects(api.arm(id,50),/Invalid sprint start confirmation/);
 }
});
test('start requires a fresh running probe without an armed sprint',async()=>{
 const sprint={targetM:50,distanceM:0,accepted:0,rejected:0,invalid:false,finishMs:null};
 for(const raw of [{...report,status:'completed'},{...report,sprint}]){
  const api=createNativeProbe({nativePromise:async()=>raw});
  await assert.rejects(api.start(),/Invalid sensor start confirmation/);
 }
});
test('stop cannot acknowledge an ongoing probe and accepts an already completed probe',async()=>{
 const running=createNativeProbe({nativePromise:async()=>report});
 await assert.rejects(running.stop(id),/Invalid sensor stop confirmation/);
 const completed=createNativeProbe({nativePromise:async()=>({...report,status:'completed'})});
 assert.equal((await completed.stop(id)).status,'completed');
});


test('native diagnostic releases the pending start lock independently of visibility and generation',()=>{
 const screen=readFileSync(new URL('../src/screens/NativeSensorScreen.tsx',import.meta.url),'utf8');
 const start=screen.slice(screen.indexOf('const start=async'),screen.indexOf('const arm=async'));
 assert.match(start,/finally\s*\{\s*starting\.current=false;[\s\S]*?if\(mounted\.current\)setBusy\(false\);/);
 assert.doesNotMatch(start,/else if\(!document\.hidden\)setBusy/);
 assert.match(start,/if\(ticket!==generation\.current\|\|document\.hidden\)\{\s*if\(typeof result!=='string'\)await bridge\.stop\(result\.runId\)/);
 assert.match(screen,/mounted\.current=true;/);
 assert.match(screen,/return \(\)=>\{\s*mounted\.current=false;\s*\+\+generation\.current;/);
});

test('failed native stop does not leave a stale running report visible',()=>{
 const screen=readFileSync(new URL('../src/screens/NativeSensorScreen.tsx',import.meta.url),'utf8');
 const stop=screen.slice(screen.indexOf('const stop=async'),screen.indexOf('useEffect(()=>'));
 assert.match(stop,/catch\{if\(ticket===generation\.current&&mounted\.current\)\{setReport\(null\);setNotice\('Stopp nicht bestätigt/);
});


test('arming retires earlier polling responses and errors without cancelling the new sprint',()=>{
 const screen=readFileSync(new URL('../src/screens/NativeSensorScreen.tsx',import.meta.url),'utf8');
 const arm=screen.slice(screen.indexOf('const arm=async'),screen.indexOf('const sprint=report'));
 assert.match(arm,/const ticket=\+\+generation\.current;\s*arming\.current=true;/);
 assert.match(screen,/if\(ticket!==generation\.current\|\|id!==run\.current\|\|arming\.current\)return;/);
 assert.match(screen,/if\(ticket===generation\.current&&id===run\.current\)\{setNotice\('Sensorverbindung unterbrochen\.'/);
});
test('repeated background or stop events do not discard a pending stop confirmation',()=>{
 const screen=readFileSync(new URL('../src/screens/NativeSensorScreen.tsx',import.meta.url),'utf8');
 const stop=screen.slice(screen.indexOf('const stop=async'),screen.indexOf('useEffect(()=>'));
 assert.match(stop,/if\(!run\.current&&!starting\.current\)return;\s*const ticket=\+\+generation\.current;/);
});
