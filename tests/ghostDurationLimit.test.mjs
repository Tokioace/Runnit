import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gpsFieldDurationReached,gpsFieldClockChanged} from '../src/lib/gpsField.ts';
import {createGpsSprint,advanceGpsSprint,syntheticPoint} from '../src/lib/sprintGps.ts';
import {ghostSummary} from '../src/lib/ghostRunSummary.ts';
import {createMeasurementLifetime} from '../src/lib/measurementLifetime.ts';
const source=readFileSync(new URL('../src/screens/GhostRunScreen.tsx',import.meta.url),'utf8');

test('solo uses the shared five-minute cutoff and preserves incomplete summary',()=>{
 const start=1700000000000;
 let state=createGpsSprint(50,start);
 state=advanceGpsSprint(state,syntheticPoint(0,start));
 state=advanceGpsSprint(state,syntheticPoint(10,start+2000));
 assert.equal(gpsFieldDurationReached(start,start+299999),false);
 assert.equal(gpsFieldDurationReached(start,start+300000),true);
 const summary=ghostSummary(state,8,100,0,'granted',false,false);
 assert.equal(summary.run_state,'stopped');
 assert.equal(summary.elapsed_ms,null);
 assert.equal(summary.observed_distance_m,10);
 const a=source.indexOf('const stopAtDurationLimit ='),b=source.indexOf('const onGps =',a);
 assert.ok(a>=0&&b>a);
 assert.match(source.slice(a,b),/!gpsFieldDurationReached\(monoStart, monoNow\)\) return false;\s*stopRun\('stopped',/);
});
test('GPS and motion callbacks enforce the cutoff before collecting measurements',()=>{
 const a=source.indexOf('const onGps ='),b=source.indexOf('const onGpsError =',a);
 assert.ok(a>=0&&b>a);
 const gps=source.slice(a,b);
 assert.match(gps,/if \(stopAtDurationLimit\(observedNow\)\) return;\s*const prior = activeRef.current;\s*const next = advanceLiveGpsSprint/);
 const c=source.indexOf('const handler = (event: DeviceMotionEvent)'),d=source.indexOf("window.addEventListener('devicemotion'",c);
 assert.ok(c>=0&&d>c);
 const motion=source.slice(c,d);
 assert.match(motion,/if \(stopAtDurationLimit\(\)\) return;\s*const a = event.acceleration;/);
 assert.ok(motion.indexOf('stopAtDurationLimit()')<motion.indexOf('stepRef.current.push(sample)'));
});
test('late timer or motion callback cannot continue a replacement run',()=>{
 const gps=createMeasurementLifetime();
 gps.open();const old=gps.capture();
 gps.close();gps.open();const current=gps.capture();
 assert.equal(old(),false);assert.equal(current(),true);
 assert.match(source,/const isGpsLive = gpsLifetime.current.capture\(\);\s*const handler = \(event: DeviceMotionEvent\) => \{\s*if \(!lifetime.current.isActive\(\) \|\| phaseRef.current !== 'running' \|\| !isGpsLive\(\)\) return;/);
 assert.match(source,/const isGpsLive = gpsLifetime.current.capture\(\);\s*const timer = window.setInterval\(\(\) => \{\s*if \(!isGpsLive\(\) \|\| phaseRef.current !== 'running'\) return;\s*const moment = Date.now\(\);\s*if \(!stopAtDurationLimit\(moment\)\) setNow\(moment\);/);
});


test('clock or visibility interruption retires a Ghost run before GPS or motion evidence is processed',()=>{
 const a=source.indexOf('const stopAtDurationLimit ='),b=source.indexOf('const onGps =',a);
 const block=source.slice(a,b);
 assert.match(block,/document.visibilityState !== 'visible' \|\| monoStart === null \|\|/);
 assert.match(block,/gpsFieldClockChanged\(state.startedAtMs, monoStart, nowMs, monoNow\)/);
 assert.ok(block.indexOf('gpsFieldClockChanged(')<block.indexOf('gpsFieldDurationReached('));
 assert.match(block,/interruptedRef.current = true;\s*setInterrupted\(true\);\s*stopRun\('stopped',/);
 assert.match(source,/monotonicStartRef.current = startMono;/);
 assert.equal(gpsFieldClockChanged(100000,500,99000,1500),true);
 assert.equal(gpsFieldClockChanged(100000,500,102000,2500),false);
});
