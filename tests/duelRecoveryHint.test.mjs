import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canReleaseUnconfirmedDuelHint} from '../src/lib/duelRecoveryHint.ts';
const input={activeId:'old',hintId:'old',candidate:{id:'new',status:'matched',host_user_id:'host',challenger_user_id:'runner'},userId:'runner',candidateRetired:false,hasPendingFinish:false};
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
 assert.match(map,/completedDuelIdsRef.current.add\(row.id\);\s*unconfirmedRecoveryHintRef.current = null;/);
 assert.match(map,/if \(!duelStartLatch.current.accept\(row.id, startAt\)\) return;\s*unconfirmedRecoveryHintRef.current = null;/);
 const recover=map.slice(map.indexOf('const queue = createDuelRecoveryQueue'),map.indexOf('const whenVisible ='));
 assert.match(recover,/if \(!current\(\) \|\| statusError \|\| activeDuelIdRef.current !== activeId\) return;[\s\S]*?if \(latest === null &&\s*canReleaseUnconfirmedDuelHint\(/);
 const block=recover.slice(recover.indexOf('if (latest === null &&'),recover.indexOf('// Never infer termination'));
 assert.match(block,/hasPendingFinish: latestFinishPayloadRef.current\?\.duelId === activeId \|\|\s*readPendingFinish\(authUser.id, activeId\) !== null/);
 assert.match(block,/forgetActiveDuelId\(authUser.id, activeId\);\s*applyMatchedDuel\(data\);/);
 assert.doesNotMatch(block,/forgetPendingFinish|endedDuelIdsRef.current.add|clearAbortedDuel/);
});
