import test from 'node:test';
import assert from 'node:assert/strict';
import {createFinishRefresh} from '../src/lib/finishRefresh.ts';

test('explicit recovery queues one follow-up after an in-flight read, while polls coalesce',async()=>{
 let calls=0,release;
 const reader=createFinishRefresh(()=>{calls++;return new Promise(resolve=>{release=resolve;});},()=>assert.fail('unexpected error'));
 const first=reader.refresh();
 await Promise.all([reader.refresh(true),reader.refresh(true),reader.refresh(),reader.refresh()]);
 assert.equal(calls,1);
 release();await Promise.resolve();
 assert.equal(calls,2);
 await reader.refresh();
 release();await first;
 assert.equal(calls,2);
});
test('a failed outstanding request still drains the queued recovery read',async()=>{
 let calls=0,fail,errors=0;
 const reader=createFinishRefresh(()=>{calls++;return calls===1?new Promise((_,reject)=>{fail=reject;}):Promise.resolve();},()=>{errors++;});
 const first=reader.refresh();
 await reader.refresh(true);
 fail(new Error('offline'));
 await first;
 assert.equal(calls,2);
 assert.equal(errors,1);
});
test('retirement discards queued recovery and suppresses a late error',async()=>{
 let calls=0,fail,errors=0;
 const reader=createFinishRefresh(()=>{calls++;return new Promise((_,reject)=>{fail=reject;});},()=>{errors++;});
 const first=reader.refresh();
 await reader.refresh(true);
 reader.close();
 fail(new Error('retired'));
 await first;
 await reader.refresh(true);
 assert.equal(calls,1);
 assert.equal(errors,0);
});
