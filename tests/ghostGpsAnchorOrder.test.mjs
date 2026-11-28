import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ghostFixOrder,inspectGhostGpsFix} from '../src/lib/ghostGpsReadiness.ts';
const sample=(timestampMs,accuracyM=4)=>({timestampMs,accuracyM,latitude:48,longitude:9});
test('a newer inaccurate fix retires old readiness even if an older accurate fix arrives later',()=>{
 const now=10000;
 const first=ghostFixOrder(null,sample(9000),now);
 assert.equal(first.ignore,false);
 const poor=sample(9500,25);
 const second=ghostFixOrder(first.timestampMs,poor,now);
 assert.equal(second.timestampMs,9500);
 assert.equal(inspectGhostGpsFix(poor,now).issue,'poor-accuracy');
 assert.equal(ghostFixOrder(second.timestampMs,sample(9200),now).ignore,true);
 assert.equal(ghostFixOrder(second.timestampMs,sample(9500),now).ignore,true);
 const fresh=sample(9800);
 assert.equal(ghostFixOrder(second.timestampMs,fresh,now).ignore,false);
 assert.equal(inspectGhostGpsFix(fresh,now).issue,'ready');
});
test('invalid and future timestamps cannot poison the ordering watermark',()=>{
 for(const t of [NaN,Infinity,11000]){
  assert.deepEqual(ghostFixOrder(9000,sample(t),10000),{ignore:false,timestampMs:9000});
 }
 assert.deepEqual(ghostFixOrder(9000,sample(9500),10000),{ignore:false,timestampMs:9500});
});
test('countdown anchor is cleared on invalid observations and ordering resets with GPS lifetime',()=>{
 const source=readFileSync(new URL('../src/screens/GhostRunScreen.tsx',import.meta.url),'utf8');
 const a=source.indexOf('const onGps ='),b=source.indexOf('const onGpsError =',a);
 assert.ok(a>=0&&b>a);
 const gps=source.slice(a,b);
 assert.match(gps,/const order = ghostFixOrder\(latestPreparationFixMs.current, sample, observedNow\);\s*if \(order.ignore\) return;\s*latestPreparationFixMs.current = order.timestampMs;/);
 assert.match(gps,/\} else \{\s*\/\/[^\n]*\n\s*\/\/[^\n]*\n\s*readyRef.current = null;\s*if \(current !== 'countdown'\)/);
 assert.match(source,/gpsLifetime.current.close\(\);[^\n]*\n\s*latestPreparationFixMs.current = null;/);
});
