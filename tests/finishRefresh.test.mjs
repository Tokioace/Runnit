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
 assert.match(source,/getDuelResults\(supabase, duelId\),\s*\]\);\s*if \(!active\) return;/);
 assert.match(source,/const refresh = request.refresh;/);
 assert.match(source,/active = false;\s*request.close\(\);/);
 assert.match(source,/window.clearInterval\(timer\)/);
});
