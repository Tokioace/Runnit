import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGpsSprint,advanceGpsSprint,syntheticPoint} from '../src/lib/sprintGps.ts';
import {gpsFieldErrorReason,gpsFieldObservationMs,primeGpsSprint,createExperimentalRunReport} from '../src/lib/gpsField.ts';

test('field sensor errors have stable non-identifying diagnostic categories',()=>{
 assert.deepEqual([1,2,3,0,NaN].map(gpsFieldErrorReason),
  ['permission-denied','position-unavailable','timeout','gps-error','gps-error']);
});
test('observation duration is relative to the start and never invents a finish',()=>{
 const start=1700000000000;
 let state=createGpsSprint(50,start);
 assert.equal(gpsFieldObservationMs(state),null);
 state=primeGpsSprint(state,syntheticPoint(0,start-500));
 assert.equal(gpsFieldObservationMs(state),0);
 state=advanceGpsSprint(state,syntheticPoint(5,start+1000));
 assert.equal(gpsFieldObservationMs(state),1000);
 state=advanceGpsSprint(state,syntheticPoint(100,start+2000));
 assert.equal(gpsFieldObservationMs(state),1000);
 assert.equal(createExperimentalRunReport('device-gps',state).durationSeconds,null);
});
test('all terminal field paths record a cause and the local export contains only relative diagnostics',()=>{
 const source=readFileSync(new URL('../src/screens/GpsFieldTestScreen.tsx',import.meta.url),'utf8');
 assert.match(source,/stopReasonRef.current = 'background';\s*phaseRef.current = 'stopped';/);
 assert.match(source,/stopReasonRef.current = 'pagehide';\s*phaseRef.current = 'stopped';/);
 assert.match(source,/stopReasonRef.current = 'finish';\s*setCurrentPhase\('finished'\);/);
 assert.match(source,/stopReasonRef.current = 'manual';\s*setCurrentPhase\('stopped'\);/);
 assert.match(source,/if \(wasRunning\) stopReasonRef.current = gpsFieldErrorReason\(err.code\);/);
 for(const name of ['prepare','reset']){
  const a=source.indexOf('const '+name+' ='),b=source.indexOf('stopReasonRef.current = null;',a);
  assert.ok(a>=0&&b>a&&b<source.indexOf('stateRef.current = null;',a));
 }
 const a=source.indexOf('const exported = {'),b=source.indexOf('};',a);
 assert.ok(a>=0&&b>a);
 const exported=source.slice(a,b);
 assert.match(exported,/stopReason: stopReasonRef.current/);
 assert.match(exported,/observationMs: measurement \? gpsFieldObservationMs\(measurement\) : null/);
 assert.doesNotMatch(exported,/latitude:|longitude:|timestampMs:|startedAtMs:|userId:/);
});
