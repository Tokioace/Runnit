import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createFinishRefresh} from '../src/lib/finishRefresh.ts';
const source=readFileSync(new URL('../src/screens/GhostRunScreen.tsx',import.meta.url),'utf8');

test('reconnect readback is single-flight and retired reads cannot publish',async()=>{
 let resolve, reads=0, confirmations=0, current=true;
 const refresh=createFinishRefresh(async()=>{
  reads++;
  await new Promise(r=>{resolve=r;});
  if(current)confirmations++;
 },()=>{});
 const pending=refresh.refresh();
 await refresh.refresh();
 assert.equal(reads,1);
 current=false;refresh.close();resolve();await pending;
 await refresh.refresh();
 assert.equal(reads,1);
 assert.equal(confirmations,0);
});
test('unresolved ghost run is rechecked only by exact account and payload identity',()=>{
 const a=source.indexOf('// A lost response can also prevent the initial readback.');
 const b=source.indexOf('const exportJson =',a);
 assert.ok(a>=0&&b>a);
 const effect=source.slice(a,b);
 assert.match(source,/if \(uncertain\) \{\s*uncertainSaveRef.current = payload;\s*setSaveStatus\('unknown'\);/);
 assert.match(effect,/saveStatus !== 'unknown' \|\| !payload \|\| payload.user_id !== user\?\.id/);
 assert.match(effect,/const current = \(\) => active && uncertainSaveRef.current === payload &&\s*measurementAccountCurrent\(isLive, assertAccount\);/);
 assert.match(effect,/\.eq\('user_id', payload.user_id\)\.eq\('id', payload.id\)\.maybeSingle\(\);/);
 assert.match(effect,/if \(!current\(\) \|\| error \|\| !matchesGhostSave\(payload, data\)\) return;\s*uncertainSaveRef.current = null;\s*setSaveStatus\('saved'\);/);
 assert.doesNotMatch(effect,/\.insert\(|\.upsert\(|\.update\(|setSaveStatus\('error'\)/);
});
test('reconnect listeners are visible-only, cleaned up and invalidated on reset',()=>{
 const a=source.indexOf('// A lost response can also prevent the initial readback.');
 const b=source.indexOf('const exportJson =',a);
 assert.ok(a>=0&&b>a);
 const effect=source.slice(a,b);
 assert.match(effect,/document.visibilityState === 'visible' && current\(\)/);
 for(const event of ['online','focus','visibilitychange']){
  assert.ok(effect.includes("addEventListener('"+event+"', whenVisible)"));
  assert.ok(effect.includes("removeEventListener('"+event+"', whenVisible)"));
 }
 assert.match(effect,/active = false;\s*refresh.close\(\);\s*window.clearInterval\(timer\);/);
 const start=source.indexOf('const reset ='),end=source.indexOf('const elapsedMs =',start);
 assert.ok(start>=0&&end>start);
 assert.match(source.slice(start,end),/uncertainSaveRef.current = null;\s*stopGps\(\)/);
});
