import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createMeasurementLifetime} from '../src/lib/measurementLifetime.ts';
const lobby=readFileSync(new URL('../src/components/race/ReadyLobby.tsx',import.meta.url),'utf8');
const map=readFileSync(new URL('../src/screens/MapScreen.tsx',import.meta.url),'utf8');
test('lobby abort claims synchronously and cannot publish after retirement',()=>{
 assert.match(lobby,/useLayoutEffect\(\(\) => \{\s*lifetime.current.open\(\);\s*abortPendingRef.current = false;\s*return \(\) => lifetime.current.close\(\);/);
 const a=lobby.indexOf('const confirmExit ='),b=lobby.indexOf('const mineReady =',a);
 assert.ok(a>=0&&b>a);
 const abort=lobby.slice(a,b);
 assert.match(abort,/if \(!lifetime.current.isActive\(\) \|\| abortPendingRef.current \|\| readyBusy\) return;\s*const isLive = lifetime.current.capture\(\);\s*abortPendingRef.current = true;/);
 assert.ok(abort.indexOf('abortPendingRef.current = true;')<abort.indexOf('await onAbort()'));
 assert.match(abort,/catch \{\s*if \(!isLive\(\)\) return;\s*setAbortError/);
 assert.match(abort,/finally \{\s*if \(isLive\(\)\) \{\s*abortPendingRef.current = false;\s*setAborting\(false\);/);
});
test('lobby replacement and countdown handoff retire previous callbacks',()=>{
 assert.match(map,/<ReadyLobby\s+key=\{matchedDuel.id\}/);
 assert.match(map,/matchedDuel && !matchOverlay && race.status === 'idle'/);
 const life=createMeasurementLifetime();life.open();
 const old=life.capture();
 life.close();life.open();
 assert.equal(old(),false);
 assert.equal(life.capture()(),true);
});
test('a rejected abort permits retry only in the same live lobby',async()=>{
 const life=createMeasurementLifetime();life.open();
 let pending=false,attempts=0,errors=0;
 let reject;
 const attempt=async()=>{
  if(!life.isActive()||pending)return;
  const live=life.capture();pending=true;attempts++;
  try{await new Promise((_,r)=>{reject=r;});}
  catch{if(live())errors++;}
  finally{if(live())pending=false;}
 };
 const first=attempt();await attempt();assert.equal(attempts,1);
 reject(Error('offline'));await first;
 assert.equal(errors,1);assert.equal(pending,false);
 const second=attempt();assert.equal(attempts,2);
 life.close();life.open();pending=false;
 reject(Error('retired'));await second;
 assert.equal(errors,1);assert.equal(pending,false);
});
