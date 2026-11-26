import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGpsSprint,advanceLiveGpsSprint,syntheticPoint} from '../src/lib/sprintGps.ts';
import {primeGpsSprint} from '../src/lib/gpsField.ts';
const start=1700000000000;
const initial=()=>primeGpsSprint(createGpsSprint(50,start),syntheticPoint(0,start));
const point=(m,offset)=>syntheticPoint(m,start+offset);
test('late and future live GPS fixes never advance Ghost Run distance or finish',()=>{
 let s=initial();
 s=advanceLiveGpsSprint(s,point(10,1000),start+1000);
 const before=s;
 for(const [sample,received] of [[point(50,5000),start+8001],[point(60,6000),start+5999],[point(20,2000),NaN]]){
  s=advanceLiveGpsSprint(s,sample,received);
  assert.equal(s.lastDecision,'invalid-sample');
  assert.equal(s.lastAccepted,before.lastAccepted);
  assert.equal(s.distanceM,before.distanceM);
  assert.equal(s.finishTimestampMs,null);
 }
 assert.equal(s.rejectedSamples,3);
});
test('fresh fixes at the age boundary preserve existing interpolation and finish confirmation',()=>{
 let s=initial();
 for(let i=1;i<=4;i++)s=advanceLiveGpsSprint(s,point(i*10,i*1000),start+i*1000+3000);
 s=advanceLiveGpsSprint(s,point(49,5000),start+5000);
 s=advanceLiveGpsSprint(s,point(51,6000),start+6000);
 assert.equal(s.finishTimestampMs,null);
 s=advanceLiveGpsSprint(s,point(60,7000),start+7000);
 assert.ok(Math.abs(s.finishTimestampMs-(start+5500))<=1);
 const after=advanceLiveGpsSprint(s,point(70,8000),NaN);
 assert.equal(after.lastDecision,'already-finished');
 assert.equal(after.rejectedSamples,s.rejectedSamples);
});
test('Ghost Run validates callback age on the epoch clock without rewriting GPS timestamps',()=>{
 const source=readFileSync(new URL('../src/screens/GhostRunScreen.tsx',import.meta.url),'utf8');
 assert.match(source,/timestampMs: pos.timestamp/);
 assert.match(source,/const observedNow = Date.now\(\)/);
 assert.match(source,/advanceLiveGpsSprint\(prior, sample, observedNow\)/);
});
