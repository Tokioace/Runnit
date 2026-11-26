import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createFinishRefresh} from '../src/lib/finishRefresh.ts';
const source=readFileSync(new URL('../src/screens/GhostRunScreen.tsx',import.meta.url),'utf8');
test('explicit ghost reconnect queues a follow-up but routine polling does not',()=>{
 const a=source.indexOf('// A lost response can also prevent the initial readback.'),b=source.indexOf('const exportJson =',a);
 assert.ok(a>=0&&b>a);
 const effect=source.slice(a,b);
 assert.match(effect,/const refresh = createFinishRefresh\(async \(\) => \{\s*if \(!current\(\) \|\| document.visibilityState !== 'visible'\) return;/);
 assert.match(effect,/const whenVisible = \(\) => \{\s*if \(document.visibilityState === 'visible' && current\(\)\) void refresh.refresh\(true\);/);
 assert.match(effect,/const timer = window.setInterval\(\(\) => \{\s*if \(document.visibilityState === 'visible' && current\(\)\) void refresh.refresh\(\);\s*\}, 15_000\);/);
 assert.doesNotMatch(effect,/\.insert\(|\.upsert\(|\.update\(/);
});
test('a queued ghost recovery runs promptly after an unresolved read, without overlap',async()=>{
 let reads=0,release,confirmed=false;
 const reader=createFinishRefresh(async()=>{
  if(confirmed)return;
  reads++;
  if(reads===1)await new Promise(resolve=>{release=resolve;});
  else confirmed=true;
 },()=>assert.fail('unexpected error'));
 const first=reader.refresh();
 await Promise.all([reader.refresh(true),reader.refresh(true),reader.refresh()]);
 assert.equal(reads,1);
 release();await first;
 assert.equal(reads,2);
 assert.equal(confirmed,true);
});
test('queued read checks visibility and payload again after the outstanding read settles',async()=>{
 for(const reason of ['hidden','confirmed','reset','account-switch']){
  let reads=0,release,visible=true,current=true;
  const reader=createFinishRefresh(async()=>{
   if(!current||!visible)return;
   reads++;
   await new Promise(resolve=>{release=resolve;});
  },()=>assert.fail('unexpected error'));
  const first=reader.refresh();
  await reader.refresh(true);
  if(reason==='hidden')visible=false;
  else current=false;
  release();await first;
  assert.equal(reads,1,reason);
  reader.close();
 }
});
