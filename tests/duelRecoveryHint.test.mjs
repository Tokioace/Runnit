import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canReleaseUnconfirmedDuelHint} from '../src/lib/duelRecoveryHint.ts';
const input={activeId:'old',hintId:'old',candidate:{id:'new',status:'matched',host_user_id:'host',challenger_user_id:'runner',start_at:null,host_ready:false,challenger_ready:false},userId:'runner',candidateRetired:false,hasPendingFinish:false};
test('a missing unconfirmed hint can yield only to another confirmed participant match',()=>{
 assert.equal(canReleaseUnconfirmedDuelHint(input),true);
 for(const candidate of [null,{...input.candidate,id:'old'},{...input.candidate,status:'completed'},{...input.candidate,id:''},{...input.candidate,challenger_user_id:'stranger'}]){
  assert.equal(canReleaseUnconfirmedDuelHint({...input,candidate}),false);
 }
});
test('a confirmed active duel, retired candidate or pending finish never yields',()=>{
 for(const patch of [{hintId:null},{hintId:'other'},{hasPendingFinish:true},{candidateRetired:true}]){
  assert.equal(canReleaseUnconfirmedDuelHint({...input,...patch}),false);
 }
});
test('map retires the hint on authoritative transitions and only releases it after successful missing read',()=>{
 const map=readFileSync(new URL('../src/screens/MapScreen.tsx',import.meta.url),'utf8');
 assert.match(map,/const unconfirmedRecoveryHintRef = useRef<string \| null>\(initialActiveDuelId\);/);
 assert.match(map,/completedDuelIdsRef.current.add\(row.id\);\s*knownNonOpenRunIdsRef.current.add\(row.id\);\s*setRegionalRuns\(previous => previous.filter\(run => run.id !== row.id\)\);\s*setOpenRuns\(previous => previous.filter\(run => run.id !== row.id\)\);\s*setHostedOpenDuels\(previous => previous.filter\(run => run.id !== row.id\)\);\s*unconfirmedRecoveryHintRef.current = null;/);
 assert.match(map,/if \(!duelStartLatch.current.accept\(row.id, startAt\)\) return;\s*unconfirmedRecoveryHintRef.current = null;/);
 const recover=map.slice(map.indexOf('const queue = createDuelRecoveryQueue'),map.indexOf('const whenVisible ='));
 assert.match(recover,/if \(!current\(\) \|\| statusError \|\| activeDuelIdRef.current !== activeId\) return;[\s\S]*?if \(latest === null &&\s*canReleaseUnconfirmedDuelHint\(/);
 const block=recover.slice(recover.indexOf('if (latest === null &&'),recover.indexOf('// Never infer termination'));
 assert.match(block,/hasPendingFinish: latestFinishPayloadRef.current\?\.duelId === activeId \|\|\s*readPendingFinish\(authUser.id, activeId\) !== null/);
 assert.match(block,/forgetActiveDuelId\(authUser.id, activeId\);\s*applyMatchedDuel\(data\);/);
 assert.doesNotMatch(block,/forgetPendingFinish|endedDuelIdsRef.current.add|clearAbortedDuel/);
});

test('a replacement match must have coherent participants and any scheduled start must be fully ready',()=>{
 const c=input.candidate;
 const ready={...c,start_at:'2026-11-27T19:00:00Z',host_ready:true,challenger_ready:true};
 assert.equal(canReleaseUnconfirmedDuelHint({...input,candidate:ready}),true);
 for(const patch of [{host_user_id:'runner'},{host_user_id:null},{host_user_id:''},{host_user_id:42},{start_at:undefined},{start_at:42},{start_at:'invalid'},{start_at:''},{host_ready:false},{challenger_ready:false},{host_ready:'true'},{challenger_ready:1}]){
  assert.equal(canReleaseUnconfirmedDuelHint({...input,candidate:{...ready,...patch}}),false);
 }
 const map=readFileSync(new URL('../src/screens/MapScreen.tsx',import.meta.url),'utf8');
 const block=map.slice(map.indexOf('if (latest === null &&'),map.indexOf('// Never infer termination'));
 assert.match(block,/\}\) && data && duelStartLatch.current.accept\(data.id, data.start_at\)\) \{/);
 assert.ok(block.indexOf('duelStartLatch.current.accept')<block.indexOf('forgetActiveDuelId'));
 assert.ok(block.indexOf('duelStartLatch.current.accept')<block.indexOf('activeDuelIdRef.current = null'));
});
