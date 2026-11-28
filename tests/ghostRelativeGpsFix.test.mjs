import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ghostRelativeGpsFix} from '../src/lib/ghostRunSummary.ts';
const start=1700000000000;
const fix={latitude:48,longitude:9,accuracyM:4,timestampMs:start};
test('invalid diagnostic coordinates, accuracy and time are null, not fabricated zeros',()=>{
 for(const bad of [NaN,Infinity,-Infinity,91]){
  const result=ghostRelativeGpsFix({...fix,latitude:bad},fix,start);
  assert.equal(result.east_m,null);assert.equal(result.north_m,null);
 }
 for(const bad of [NaN,Infinity,-1])assert.equal(ghostRelativeGpsFix({...fix,accuracyM:bad},fix,start).accuracy_m,null);
 for(const bad of [NaN,Infinity,start-1])assert.equal(ghostRelativeGpsFix({...fix,timestampMs:bad},fix,start).t_ms,null);
 assert.equal(ghostRelativeGpsFix(fix,null,start).east_m,null);
 assert.equal(ghostRelativeGpsFix(fix,{...fix,longitude:181},start).north_m,null);
 assert.deepEqual(ghostRelativeGpsFix({...fix,accuracyM:0},fix,start),{t_ms:0,east_m:0,north_m:0,accuracy_m:0});
});
test('relative longitude wraps across the antimeridian without a world-scale jump',()=>{
 const origin={...fix,latitude:0,longitude:179.9999};
 const result=ghostRelativeGpsFix({...origin,longitude:-179.9999,timestampMs:start+500},origin,start);
 assert.equal(result.t_ms,500);
 assert.ok(result.east_m>22&&result.east_m<23);
 assert.equal(result.north_m,0);
});
test('local GPS export uses the validated diagnostic values while keeping its decision',()=>{
 const s=readFileSync(new URL('../src/screens/GhostRunScreen.tsx',import.meta.url),'utf8');
 const a=s.indexOf('const fix = ghostRelativeGpsFix('),b=s.indexOf('});',a);
 assert.ok(a>=0&&b>a);
 const block=s.slice(a,b);
 for(const field of ['t_ms','east_m','north_m','accuracy_m'])assert.ok(block.includes(field+': fix.'+field));
 assert.match(block,/decision: next.lastDecision/);
 assert.doesNotMatch(block,/latitude:|longitude:|user_id:/);
 assert.match(s,/raw_location_included: false/);
});
