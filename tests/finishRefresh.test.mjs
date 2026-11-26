import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createFinishRefresh} from '../src/lib/finishRefresh.ts';

test('poll, focus and visibility triggers cannot overlap a pending result read',async()=>{
 let calls=0,release;
 const refresh=createFinishRefresh(()=>{calls++;return new Promise(resolve=>{release=resolve;});},()=>assert.fail('unexpected error'));
 const first=refresh.refresh();
 await Promise.all([refresh.refresh(),refresh.refresh(),refresh.refresh()]);
 assert.equal(calls,1);
 release();await first;
 const second=refresh.refresh();assert.equal(calls,2);
 release();await second;
});
test('a rejected read reports an error and permits a later retry',async()=>{
 let calls=0,errors=0;
 const refresh=createFinishRefresh(async()=>{if(++calls===1)throw Error('offline');},()=>{errors++;});
 await refresh.refresh();assert.equal(errors,1);
 await refresh.refresh();assert.equal(calls,2);assert.equal(errors,1);
});
test('closing a result screen ignores late failure and refuses further reads',async()=>{
 let calls=0,errors=0,reject;
 const refresh=createFinishRefresh(()=>{calls++;return new Promise((_,r)=>{reject=r;});},()=>{errors++;});
 const first=refresh.refresh();refresh.close();
 reject(Error('late network failure'));await first;await refresh.refresh();
 assert.equal(calls,1);assert.equal(errors,0);
});
test('finish screen owns its polling lifetime and guards successful responses',()=>{
 const source=readFileSync(new URL('../src/components/race/DuelFinishScreen.tsx',import.meta.url),'utf8');
 assert.match(source,/const request = createFinishRefresh\(async \(\) =>/);
 assert.match(source,/\.eq\('id', duelId\)\.maybeSingle\(\);\s*if \(!active\) return;/);
 assert.match(source,/const resultsResponse = await getDuelResults\(supabase, duelId\);\s*if \(!active\) return;/);
 assert.match(source,/const refresh = request.refresh;/);
 assert.match(source,/active = false;\s*request.close\(\);/);
 assert.match(source,/window.clearInterval\(timer\)/);
});

test('confirmed absence or nonmembership clears all previously displayed result data',()=>{
 const source=readFileSync(new URL('../src/components/race/DuelFinishScreen.tsx',import.meta.url),'utf8');
 const denied=source.slice(source.indexOf('if (!duel ||'),source.indexOf('const resultsResponse = await'));
 assert.match(denied,/duel.host_user_id !== userId && duel.challenger_user_id !== userId/);
 assert.match(denied,/setRows\(\[\]\);\s*setHostId\(null\);\s*setChallengerId\(null\);\s*setStatus\('unavailable'\);/);
 assert.match(denied,/return;/);
 assert.ok(source.indexOf('if (!duel ||') < source.indexOf('await getDuelResults(supabase, duelId)'));
});
test('temporary query errors remain distinct from confirmed access loss',()=>{
 const source=readFileSync(new URL('../src/components/race/DuelFinishScreen.tsx',import.meta.url),'utf8');
 const transient=source.slice(source.indexOf('if (duelResponse.error)'),source.indexOf('const duel = duelResponse.data'));
 assert.match(transient,/setFetchError\(/);
 assert.doesNotMatch(transient,/setRows|setStatus/);
});
test('a different duel cannot inherit the previous finish screen state',()=>{
 const source=readFileSync(new URL('../src/screens/MapScreen.tsx',import.meta.url),'utf8');
 assert.match(source,/<DuelFinishScreen\s+key=\{race.duelId\}/);
});
