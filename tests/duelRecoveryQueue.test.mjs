import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createDuelRecoveryQueue,isCurrentRecovery} from '../src/lib/duelRecovery.ts';
const turn=()=>new Promise(resolve=>setImmediate(resolve));
test('focus, visibility and interval triggers never overlap requests',async()=>{
 let calls=0,concurrent=0,peak=0;
 const releases=[];
 const queue=createDuelRecoveryQueue(async()=>{
  calls++;concurrent++;peak=Math.max(peak,concurrent);
  await new Promise(resolve=>releases.push(resolve));concurrent--;
 });
 queue.request();queue.request();queue.request();queue.request();
 assert.equal(calls,1);
 releases.shift()();await turn();assert.equal(calls,2);
 releases.shift()();await turn();assert.equal(calls,2);assert.equal(peak,1);
 queue.close();
});
test('closing recovery cancels queued retries; network rejection allows later retry',async()=>{
 let calls=0,release;
 const queue=createDuelRecoveryQueue(async()=>{
  calls++;
  if(calls===1)throw Error('offline');
  await new Promise(resolve=>{release=resolve;});
 });
 queue.request();await turn();queue.request();queue.request();
 assert.equal(calls,2);queue.close();release();await turn();queue.request();
 assert.equal(calls,2);
});
test('newer confirmed transition or changed account invalidates an old response',()=>{
 assert.equal(isCurrentRecovery(true,'a','a',3,3),true);
 for(const args of [[false,'a','a',3,3],[true,'b','a',3,3],[true,null,'a',3,3],[true,'a','a',4,3]]){
  assert.equal(isCurrentRecovery(...args),false);
 }
});
test('map checks account and revision after both reads and closes the queue',()=>{
 const screen=readFileSync(new URL('../src/screens/MapScreen.tsx',import.meta.url),'utf8');
 const recovery=screen.slice(screen.indexOf('// Mobile Safari may suspend Realtime'),screen.indexOf('// No Realtime subscription'));
 assert.match(recovery,/createDuelRecoveryQueue\(async/);
 assert.match(recovery,/isCurrentRecovery\(active, finishAccountRef.current, authUser.id/);
 assert.match(recovery,/if \(!current\(\) \|\| error\) return/);
 assert.match(recovery,/if \(!current\(\) \|\| statusError \|\| activeDuelIdRef.current !== activeId\) return/);
 assert.match(recovery,/active = false;\s*queue.close\(\)/);
 for(const name of ['clearAbortedDuel','showCompletedDuel','closeCompletedDuel','applyMatchedDuel']){
  const start=screen.indexOf('const '+name+' = React.useCallback');
  const end=screen.indexOf('}, [authUser?.id]);',start);
  assert.match(screen.slice(start,end),/recoveryRevisionRef.current \+= 1/);
 }
});

test('routine polls skip a slow recovery without scheduling an extra read',async()=>{
 let calls=0;
 const releases=[];
 const queue=createDuelRecoveryQueue(async()=>{
  calls++;
  await new Promise(resolve=>releases.push(resolve));
 });
 queue.poll();queue.poll();queue.poll();
 assert.equal(calls,1);
 releases.shift()();await turn();assert.equal(calls,1);
 queue.poll();assert.equal(calls,2);
 releases.shift()();await turn();queue.close();
});
test('explicit reconnect still schedules one follow-up while routine polls are skipped',async()=>{
 let calls=0;
 const releases=[];
 const queue=createDuelRecoveryQueue(async()=>{
  calls++;
  await new Promise(resolve=>releases.push(resolve));
 });
 queue.poll();queue.request();queue.request();queue.poll();
 assert.equal(calls,1);
 releases.shift()();await turn();assert.equal(calls,2);
 queue.poll();queue.poll();
 releases.shift()();await turn();assert.equal(calls,2);
 queue.close();queue.poll();queue.request();assert.equal(calls,2);
});
test('map uses routine polls only for the interval and explicit requests for visible reconnect',()=>{
 const screen=readFileSync(new URL('../src/screens/MapScreen.tsx',import.meta.url),'utf8');
 const recovery=screen.slice(screen.indexOf('// Mobile Safari may suspend Realtime'),screen.indexOf('// No Realtime subscription'));
 assert.match(recovery,/setInterval\(\(\) => \{ if \(document.visibilityState === 'visible'\) queue.poll\(\); \}, 4_000\)/);
 assert.match(recovery,/const whenVisible = \(\) => \{\s*if \(document.visibilityState === 'visible'\) \{\s*queue.request\(\)/);
});

test('a rejected candidate does not suppress the exact active-duel status read',()=>{
 const screen=readFileSync(new URL('../src/screens/MapScreen.tsx',import.meta.url),'utf8');
 const recover=screen.slice(screen.indexOf('const queue = createDuelRecoveryQueue'),screen.indexOf('const whenVisible ='));
 const start=recover.indexOf('const activeBeforeRecovery =');
 const end=recover.indexOf('// A different match',start);
 assert.ok(start>=0&&end>start);
 const check=new Function('data','activeDuelIdRef','endedDuelIdsRef','completedDuelIdsRef','applyMatchedDuel','current',recover.slice(start,end)+'return "fallback";');
 for(const accepted of [true,false]){
  let revision=0,calls=0;
  const result=check({id:'active'},{current:'active'},{current:new Set()},{current:new Set()},()=>{calls++;if(accepted)revision++;},()=>revision===0);
  assert.equal(calls,1);
  assert.equal(result,accepted?undefined:'fallback');
 }
 assert.match(recover,/\.eq\('id', activeId\)\.maybeSingle\(\)/);
 const transition=screen.slice(screen.indexOf('const applyMatchedDuel ='),screen.indexOf('// Display only profile nicknames'));
 assert.ok(transition.indexOf('duelStartLatch.current.accept')<transition.indexOf('recoveryRevisionRef.current += 1'));
});
