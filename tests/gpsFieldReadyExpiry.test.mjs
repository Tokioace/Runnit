import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isFreshStartFix} from '../src/lib/gpsField.ts';
import {inspectGhostGpsFix,ghostFixOrder} from '../src/lib/ghostGpsReadiness.ts';
import {createMeasurementLifetime} from '../src/lib/measurementLifetime.ts';
const source=readFileSync(new URL('../src/screens/GpsFieldTestScreen.tsx',import.meta.url),'utf8');

test('field ready fix expires and only a newer valid observation restores readiness',()=>{
 const fix={latitude:48,longitude:9,accuracyM:4.9,timestampMs:10000};
 assert.equal(isFreshStartFix(fix,13000),true);
 assert.equal(isFreshStartFix(fix,13001),false);
 assert.equal(inspectGhostGpsFix(fix,13001).issue,'stale');
 assert.equal(ghostFixOrder(10000,fix,13001).ignore,true);
 const fresh={...fix,timestampMs:13001};
 assert.equal(ghostFixOrder(10000,fresh,13001).ignore,false);
 assert.equal(isFreshStartFix(fresh,13001),true);
});
test('field readiness expires automatically without stopping or replacing the live watch',()=>{
 const a=source.indexOf('const expireReadyFix ='),b=source.indexOf('const start =',a);
 assert.ok(a>=0&&b>a);
 const block=source.slice(a,b);
 assert.match(block,/if \(isFreshStartFix\(anchor, atMs\)\) return false;/);
 assert.match(block,/readyFixRef.current = null;\s*setCurrentPhase\('acquiring'\);\s*setStatus\(ghostGpsFixNotice\(info\)\);/);
 assert.match(block,/const isWatchLive = watchLifetime.current.capture\(\);/);
 assert.match(block,/if \(!mountedRef.current \|\| !isWatchLive\(\) \|\| document.hidden \|\| phaseRef.current !== 'ready'\) return;/);
 assert.match(block,/window.setInterval\(check, 250\)/);
 assert.doesNotMatch(block,/stopWatching\(|watchLifetime.current.open\(|latestPreparationFixMs.current = null/);
});
test('start guard shares expiry and an old readiness timer cannot affect the replacement watch',()=>{
 const a=source.indexOf('const start ='),b=source.indexOf('const stop =',a);
 assert.ok(a>=0&&b>a);
 assert.match(source.slice(a,b),/if \(!isFreshStartFix\(anchor, atMs\)\) \{\s*expireReadyFix\(atMs\);\s*return;/);
 const watch=createMeasurementLifetime();
 watch.open();const old=watch.capture();
 watch.close();watch.open();
 assert.equal(old(),false);
 assert.equal(watch.capture()(),true);
});
