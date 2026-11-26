import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createMeasurementLifetime} from '../src/lib/measurementLifetime.ts';
const source=readFileSync(new URL('../src/screens/GhostRunScreen.tsx',import.meta.url),'utf8');

test('a pending permission continuation cannot start GPS or clear a replacement preparation',async()=>{
 const screen=createMeasurementLifetime(),preparation=createMeasurementLifetime();
 screen.open();preparation.open();
 const screenLive=screen.capture(),first=preparation.capture();
 let resolve,started=0,busy=true;
 const pending=(async()=>{
  try {
   await new Promise(r=>{resolve=r;});
   if(!screenLive()||!first())return;
   started++;
  }finally{if(screenLive()&&first())busy=false;}
 })();
 preparation.close();preparation.open();
 resolve();await pending;
 assert.equal(started,0);
 assert.equal(busy,true);
 assert.equal(preparation.capture()(),true);
});
test('preparation checks its own foreground lifetime before starting the watch',()=>{
 const a=source.indexOf('const prepare ='),b=source.indexOf('// iOS may keep',a);
 assert.ok(a>=0&&b>a);
 const body=source.slice(a,b);
 assert.match(body,/preparationLifetime.current.open\(\);\s*const isPreparing = preparationLifetime.current.capture\(\);/);
 assert.match(body,/const isLive = \(\) => isScreenLive\(\) && isPreparing\(\) && document.visibilityState === 'visible';/);
 assert.match(body,/\.limit\(1\);\s*if \(!measurementAccountCurrent\(isLive, assertAccount\)\) return;/);
 assert.match(body,/finally \{ if \(isLive\(\)\) preparingRef.current = false; \}/);
 assert.match(source,/if \(!gpsLifetime.current.isActive\(\) \|\| document.visibilityState !== 'visible'\) return;/);
});
test('background and pagehide retire preparation and clear the watch before returning to idle',()=>{
 const a=source.indexOf('const retirePreparation ='),b=source.indexOf('const hidden =',a);
 assert.ok(a>=0&&b>a);
 assert.match(source.slice(a,b),/preparationLifetime.current.close\(\);\s*preparingRef.current = false;\s*stopGps\(\);\s*readyRef.current = null;/);
 assert.match(source.slice(a,b),/setCurrentPhase\('idle'\);/);
 for(const name of ['hidden','pageHide']){
  const start=source.indexOf('const '+name+' =',b),end=source.indexOf('};',start);
  assert.ok(start>=0&&end>start);
  const block=source.slice(start,end);
  assert.match(block,/else if \(preparingRef.current \|\| phaseRef.current === 'acquiring' \|\| phaseRef.current === 'ready'\) \{\s*retirePreparation\(/);
  assert.match(block,/else if \(phaseRef.current === 'countdown'\) \{[\s\S]*?retirePreparation\(/);
 }
 assert.match(source,/gpsLifetime.current.close\(\);[^\n]*\n\s*const id = watchRef.current;\s*watchRef.current = null;[\s\S]*?clearWatch\(id\)/);
});
