import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createMeasurementLifetime,measurementAccountCurrent} from '../src/lib/measurementLifetime.ts';
import {createAccountMutationGuard} from '../src/lib/accountMutationGuard.ts';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('permission continuation cannot survive screen retirement or effect replacement',async()=>{
 const life=createMeasurementLifetime();life.open();
 let resolve,started=0;
 const current=life.capture();
 const pending=(async()=>{await new Promise(r=>{resolve=r});if(current())started++;})();
 life.close();life.open();resolve();await pending;
 assert.equal(started,0);assert.equal(current(),false);assert.equal(life.capture()(),true);
});
test('measurement continuation is retired on account change even before unmount',()=>{
 const life=createMeasurementLifetime();life.open();
 const accounts=createAccountMutationGuard();accounts.setAccount('A');
 const live=life.capture(),account=accounts.begin('A');
 assert.equal(measurementAccountCurrent(live,account),true);
 accounts.setAccount('B');assert.equal(measurementAccountCurrent(live,account),false);
 accounts.setAccount('A');assert.equal(measurementAccountCurrent(live,account),false);
 life.close();assert.equal(measurementAccountCurrent(live,accounts.begin('A')),false);
});
test('private dashboard, stats and ghost measurement remount by account identity',()=>{
 const app=read('src/App.tsx');
 for(const screen of ['DashboardScreen','StatsScreen','GhostRunScreen']){
  assert.ok(app.includes("<"+screen+" key={auth.user?.id ?? 'guest'}"));
 }
 const ghost=read('src/screens/GhostRunScreen.tsx');
 assert.match(ghost,/const \{ user, loading, beginAccountMutation \} = auth;/);
 assert.doesNotMatch(ghost,/useSupabaseUser\(\)/);
});
test('ghost preparation checks both asynchronous boundaries before starting GPS',()=>{
 const ghost=read('src/screens/GhostRunScreen.tsx');
 const prepare=ghost.slice(ghost.indexOf('const prepare ='),ghost.indexOf('// iOS may keep'));
 assert.match(prepare,/preparingRef.current \|\| !lifetime.current.isActive\(\)/);
 assert.match(prepare,/catch \{ motion = 'denied'; \}\s*if \(!measurementAccountCurrent\(isLive, assertAccount\)\) return;/);
 assert.match(prepare,/\.limit\(1\);\s*if \(!measurementAccountCurrent\(isLive, assertAccount\)\) return;/);
 assert.match(prepare,/finally \{ if \(isLive\(\)\) preparingRef.current = false; \}/);
});
test('ghost retirement stops sensors and drops in-memory measurements, not saved account rows',()=>{
 const ghost=read('src/screens/GhostRunScreen.tsx');
 const start=ghost.indexOf('useLayoutEffect(() => {\n    lifetime.current.open();');
 const end=ghost.indexOf('}, [stopGps]);',start);
 assert.ok(start>=0 && end>start,'measurement lifetime effect must exist');
 const block=ghost.slice(start,end);
 assert.match(block,/lifetime.current.close\(\);\s*unmountedRef.current = true;\s*phaseRef.current = 'idle';\s*stopGps\(\)/);
 assert.match(block,/gpsTraceRef.current = \[\];\s*motionTraceRef.current = \[\]/);
 assert.doesNotMatch(block,/supabase|localStorage/);
 const save=ghost.slice(ghost.indexOf('const saveSummary'),ghost.indexOf('const stopRun'));
 assert.match(save,/beginAccountMutation\(\)/);
 assert.equal((save.match(/if \(!measurementAccountCurrent\(isLive, assertAccount\)\) return;/g)||[]).length,2);
});

test('Ghost Run only proceeds after a successful empty active-duel list',()=>{
 const ghost=read('src/screens/GhostRunScreen.tsx');
 const prepare=ghost.slice(ghost.indexOf('const prepare ='),ghost.indexOf('// iOS may keep'));
 assert.match(prepare,/if \(duelsError \|\| !Array.isArray\(activeDuels\)\) \{\s*setCurrentPhase\('error'\);\s*setNotice\([^;]+\);\s*return;\s*\}/);
 assert.match(prepare,/if \(activeDuels.length\) \{\s*setCurrentPhase\('error'\);\s*setNotice\([^;]+\);\s*return;\s*\}/);
 const guard=prepare.indexOf('if (duelsError || !Array.isArray(activeDuels))');
 const existing=prepare.indexOf('if (activeDuels.length)');
 const watch=prepare.indexOf('navigator.geolocation.watchPosition(');
 assert.ok(guard>=0 && guard<existing && existing<watch);
 // Exercise the actual guard block with malformed and valid response shapes.
 const block=prepare.slice(guard,prepare.indexOf('readyRef.current = null;',existing));
 const check=new Function('duelsError','activeDuels','setCurrentPhase','setNotice',block+'return true;');
 for(const rows of [null,undefined,{},'',false,42,[{}],[{id:'existing'}]]){
  const phases=[];
  assert.equal(check(null,rows,x=>phases.push(x),()=>{}),undefined);
  assert.deepEqual(phases,['error']);
 }
 assert.equal(check({message:'offline'},[],()=>{},()=>{}),undefined);
 assert.equal(check(null,[],()=>assert.fail('valid empty list rejected'),()=>{}),true);
});
