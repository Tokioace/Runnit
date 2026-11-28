import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGpsSprint,advanceGpsSprint,syntheticPoint} from '../src/lib/sprintGps.ts';
import {createExperimentalRunReport,compareWithReferenceSeconds} from '../src/lib/gpsField.ts';
const source=readFileSync(new URL('../src/screens/GpsFieldTestScreen.tsx',import.meta.url),'utf8');

test('GPS errors during a run preserve its incomplete report and retire the watch',()=>{
 const a=source.indexOf('}, (err) => {'),b=source.indexOf('}, GPS_OPTIONS);',a);
 assert.ok(a>=0&&b>a);
 const error=source.slice(a,b);
 assert.match(error,/if \(!mountedRef.current \|\| !isWatchLive\(\)\) return;/);
 assert.match(error,/const wasRunning = phaseRef.current === 'running';/);
 assert.match(error,/setCurrentPhase\(wasRunning \? 'stopped' : 'error'\);\s*stopWatching\(\);/);
 assert.doesNotMatch(error,/setMeasurement\(null\)|stateRef.current = null/);
 assert.match(source,/\(phase === 'finished' \|\| phase === 'stopped'\) && report &&/);
});
test('pagehide stops GPS but preserves terminal report phase for cached page restoration',()=>{
 const a=source.indexOf('const stopOnPageHide ='),b=source.indexOf("document.addEventListener('visibilitychange'",a);
 assert.ok(a>=0&&b>a);
 const hide=source.slice(a,b);
 assert.match(hide,/stopWatching\(\);\s*const previous = phaseRef.current;/);
 assert.match(hide,/if \(mountedRef.current && previous === 'running'\)/);
 assert.match(hide,/else if \(mountedRef.current && \(previous === 'acquiring' \|\| previous === 'ready'\)\)/);
 assert.doesNotMatch(hide,/\} else \{/);
 assert.doesNotMatch(hide,/setMeasurement\(null\)|stateRef.current = null/);
});
test('interrupted report preserves partial distance without inventing time or eligibility',()=>{
 let s=createGpsSprint(50,1000);
 s=advanceGpsSprint(s,syntheticPoint(0,1000));
 s=advanceGpsSprint(s,syntheticPoint(8,2000));
 const report=createExperimentalRunReport('device-gps',s);
 assert.equal(report.finished,false);
 assert.equal(report.durationSeconds,null);
 assert.equal(report.eligibility,'not-eligible');
 assert.ok(Math.abs(report.observedDistanceMeters-8)<0.01);
 assert.equal(compareWithReferenceSeconds(report,6),null);
 assert.match(source,/if \(!report \|\| \(phaseRef.current !== 'finished' && phaseRef.current !== 'stopped'\)\) return;/);
});
