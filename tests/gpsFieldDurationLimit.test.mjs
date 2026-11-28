import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MAX_GPS_FIELD_RUN_MS,gpsFieldDurationReached,createExperimentalRunReport} from '../src/lib/gpsField.ts';
import {createGpsSprint,advanceGpsSprint,syntheticPoint} from '../src/lib/sprintGps.ts';
const source=readFileSync(new URL('../src/screens/GpsFieldTestScreen.tsx',import.meta.url),'utf8');

test('field duration limit is five minutes with an exact boundary',()=>{
 const start=1700000000000;
 assert.equal(MAX_GPS_FIELD_RUN_MS,300000);
 for(const dt of [-1,0,299999])assert.equal(gpsFieldDurationReached(start,start+dt),false);
 for(const dt of [300000,300001,900000])assert.equal(gpsFieldDurationReached(start,start+dt),true);
 assert.equal(gpsFieldDurationReached(start,NaN),false);
 assert.equal(gpsFieldDurationReached(NaN,start),false);
});
test('duration stop preserves partial report without fabricating a finish',()=>{
 const start=1700000000000;
 let state=createGpsSprint(100,start);
 state=advanceGpsSprint(state,syntheticPoint(0,start));
 state=advanceGpsSprint(state,syntheticPoint(8,start+1000));
 assert.equal(gpsFieldDurationReached(start,start+300000),true);
 const report=createExperimentalRunReport('device-gps',state);
 assert.equal(report.finished,false);
 assert.equal(report.durationSeconds,null);
 assert.ok(Math.abs(report.observedDistanceMeters-8)<0.01);
 const a=source.indexOf('const stopAtDurationLimit ='),b=source.indexOf('useEffect(() =>',a);
 assert.ok(a>=0&&b>a);
 const stop=source.slice(a,b);
 assert.match(stop,/stopReasonRef.current = 'duration-limit';\s*setCurrentPhase\('stopped'\);/);
 assert.match(stop,/stopWatching\(\);\s*return true;/);
 assert.doesNotMatch(stop,/setMeasurement\(|stateRef.current =|finishTimestampMs/);
});
test('both the live timer and GPS callback enforce the limit and retire stale timers',()=>{
 const a=source.indexOf('const stopAtDurationLimit ='),b=source.indexOf('const prepare =',a);
 assert.ok(a>=0&&b>a);
 const timer=source.slice(a,b);
 assert.match(timer,/const isWatchLive = watchLifetime.current.capture\(\);/);
 assert.match(timer,/if \(!mountedRef.current \|\| !isWatchLive\(\) \|\| phaseRef.current !== 'running'\) return;/);
 assert.match(timer,/if \(!stopAtDurationLimit\(now\)\) setTick\(now\);/);
 const c=source.indexOf('watchId.current = navigator.geolocation.watchPosition('),e=source.indexOf('}, (err) => {',c);
 assert.ok(c>=0&&e>c);
 const callback=source.slice(c,e);
 const limit=callback.indexOf("if (phaseNow === 'running' && stopAtDurationLimit(now)) return;");
 const advance=callback.indexOf('advanceLiveGpsSprint(previous, sample, now)');
 assert.ok(limit>=0&&advance>limit);
 assert.match(source,/stopReason: stopReasonRef.current/);
});
