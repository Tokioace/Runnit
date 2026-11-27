import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {withRequestDeadline} from '../src/lib/requestDeadline.ts';

test('successful requests and synchronous or asynchronous failures settle normally',async()=>{
 let signal;
 assert.equal(await withRequestDeadline(s=>{signal=s;return Promise.resolve('saved');},1000),'saved');
 assert.equal(signal.aborted,false);
 await assert.rejects(withRequestDeadline(()=>{throw Error('sync failure');},1000),/sync failure/);
 await assert.rejects(withRequestDeadline(()=>Promise.reject(Error('async failure')),1000),/async failure/);
});
test('timeout aborts transport and releases caller even when transport ignores abort',async()=>{
 let signal,resolve;
 const pending=withRequestDeadline(s=>{signal=s;return new Promise(r=>resolve=r);},5);
 await assert.rejects(pending,/deadline exceeded/);
 assert.equal(signal.aborted,true);
 resolve('late commit');
 await Promise.resolve();
});
test('late rejection after timeout is handled without an unhandled rejection',async()=>{
 let reject;
 const pending=withRequestDeadline(()=>new Promise((_,r)=>reject=r),5);
 await assert.rejects(pending,/deadline exceeded/);
 reject(Error('late network failure'));
 await new Promise(resolve=>setImmediate(resolve));
});
test('invalid deadline does not invoke transport',async()=>{
 let calls=0;
 for(const n of [0,-1,NaN,Infinity,1.5,2147483648]){
  await assert.rejects(withRequestDeadline(()=>{calls++;return Promise.resolve();},n),/Invalid request deadline/);
 }
 assert.equal(calls,0);
});
test('every Ghost network boundary is bounded and timeout cannot authorize another insert',()=>{
 const source=readFileSync(new URL('../src/screens/GhostRunScreen.tsx',import.meta.url),'utf8');
 assert.equal((source.match(/await withRequestDeadline\(/g)||[]).length,5);
 assert.equal((source.match(/\.abortSignal\(signal\)/g)||[]).length,5);
 const save=source.slice(source.indexOf('const saveSummary ='),source.indexOf('const stopRun ='));
 assert.match(save,/catch \{\s*uncertain = true;/);
 assert.match(save,/if \(uncertain\) \{\s*uncertainSaveRef.current = payload;\s*setSaveStatus\('unknown'\);/);
 assert.equal((save.match(/\.insert\(/g)||[]).length,1);
 const recovery=source.slice(source.indexOf('// A lost response can also prevent the initial readback.'),source.indexOf('const exportJson ='));
 assert.doesNotMatch(recovery,/\.insert\(|\.upsert\(|\.update\(/);
});
