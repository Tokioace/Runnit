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

test('confirmed abandonment never depends on a result RPC',()=>{
 const s=readFileSync(new URL('../src/components/race/DuelFinishScreen.tsx',import.meta.url),'utf8');
 const abandoned=s.slice(s.indexOf("if (duel.status === 'abandoned')"),s.indexOf('const resultsResponse = await'));
 assert.match(abandoned,/setRows\(\[\]\);/);
 assert.match(abandoned,/setStatus\('abandoned'\);\s*setFetchError\(null\);\s*return;/);
 assert.ok(s.indexOf("if (duel.status === 'abandoned')")<s.indexOf('await getDuelResults(supabase, duelId)'));
});
test('terminal absence and cancellation allow a local exit without retrying or aborting the duel',()=>{
 const s=readFileSync(new URL('../src/components/race/DuelFinishScreen.tsx',import.meta.url),'utf8');
 assert.match(s,/const terminalWithoutResult = status === 'abandoned' \|\| status === 'unavailable' \|\|\s*\(status === 'completed' && !completed\);/);
 assert.match(s,/submissionError && !completed && !terminalWithoutResult/);
 assert.match(s,/!completed && !terminalWithoutResult && \(/);
 assert.match(s,/\) : terminalWithoutResult \? \(\s*<button[^>]*onClick=\{onClose\}/);
 assert.match(s,/status === 'abandoned' \? 'ABGEBROCHEN · ZUR KARTE »' : 'ZUR KARTE »'/);
});
test('an unexpected server status is not treated as confirmed absence',()=>{
 const s=readFileSync(new URL('../src/components/race/DuelFinishScreen.tsx',import.meta.url),'utf8');
 assert.match(s,/duel.status === 'matched' \? 'matched' : 'unexpected'/);
 assert.doesNotMatch(s,/duel.status === 'matched' \? 'matched' : 'unavailable'/);
});

test('a wrong duel ID is rejected before participant, terminal or result processing',()=>{
 const source=readFileSync(new URL('../src/components/race/DuelFinishScreen.tsx',import.meta.url),'utf8');
 const guardStart=source.indexOf('if (duel && duel.id !== duelId)');
 const membership=source.indexOf('if (!duel ||');
 assert.ok(guardStart>=0 && membership>guardStart);
 const guard=source.slice(guardStart,membership);
 assert.match(guard,/if \(duel && duel.id !== duelId\) \{\s*setFetchError\([^;]+\);\s*return;\s*\}/);
 assert.doesNotMatch(guard,/setStatus|setRows|setHostId|setChallengerId|getDuelResults/);
 assert.ok(membership<source.indexOf("if (duel.status === 'abandoned')"));
 assert.ok(membership<source.indexOf("if (duel.status === 'completed')"));
});

test('missing or malformed result lists are read failures and retain prior results',()=>{
 const source=readFileSync(new URL('../src/components/race/DuelFinishScreen.tsx',import.meta.url),'utf8');
 const start=source.indexOf('if (!Array.isArray(resultsResponse.data))');
 const end=source.indexOf('setHostId(duel.host_user_id);',start);
 assert.ok(start>=0&&end>start);
 const guard=source.slice(start,end);
 assert.doesNotMatch(guard,/setRows|setStatus|setHostId|setChallengerId/);
 const check=new Function('resultsResponse','setFetchError',guard+'return true;');
 for(const invalid of [null,undefined,{},'bad',42]){
  let message;
  assert.equal(check({data:invalid},x=>{message=x;}),undefined);
  assert.match(message,/Rennergebnisse konnten nicht eindeutig geladen werden/);
 }
 for(const data of [[],[{user_id:'runner',time_ms:9000}]]) assert.equal(check({data},()=>assert.fail('valid list rejected')),true);
 assert.match(source,/setRows\(resultsResponse.data as DuelResultRow\[\]\);/);
 assert.doesNotMatch(source,/resultsResponse.data \?\? \[\]/);
});
test('malformed optional participant names cannot crash the result display',()=>{
 const source=readFileSync(new URL('../src/components/race/DuelFinishScreen.tsx',import.meta.url),'utf8');
 const name=source.match(/function displayRunnerName\(value: unknown\): string \{\s*return ([^;]+);\s*\}/);
 assert.ok(name);
 const display=new Function('value','return '+name[1]);
 for(const invalid of [undefined,null,42,{},[],false,'','  ']) assert.equal(display(invalid),'RUNNER');
 assert.equal(display(' Runner A '),'Runner A');
 assert.match(source,/displayRunnerName\(mine\?\.username\)/);
 assert.match(source,/displayRunnerName\(other\?\.username\)/);
});
