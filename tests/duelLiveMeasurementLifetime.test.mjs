import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createMeasurementLifetime} from '../src/lib/measurementLifetime.ts';
const map=readFileSync(new URL('../src/screens/MapScreen.tsx',import.meta.url),'utf8');
const overlay=map.slice(map.indexOf('function RaceOverlay('),map.indexOf('// Haversine distance in meters'));

test('retiring a measurement session rejects queued callbacks even if a new session opens',()=>{
 const lifetime=createMeasurementLifetime();
 lifetime.open();
 const first=lifetime.capture();
 assert.equal(first(),true);
 lifetime.close();
 assert.equal(first(),false);
 lifetime.open();
 assert.equal(first(),false);
 assert.equal(lifetime.capture()(),true);
});
test('live duel retires its session synchronously and guards GPS, motion and timer callbacks',()=>{
 assert.match(overlay,/const measurementLifetime = useRef\(createMeasurementLifetime\(\)\);\s*React.useLayoutEffect\(\(\) => \{\s*const lifetime = measurementLifetime.current;\s*lifetime.open\(\);\s*return \(\) => lifetime.close\(\);\s*\}, \[\]\);/);
 assert.match(overlay,/const isLive = measurementLifetime.current.capture\(\);\s*const id = setInterval\(\(\) => \{\s*if \(!isLive\(\)\) return;\s*setElapsedMs/);
 assert.match(overlay,/const isLive = measurementLifetime.current.capture\(\);\s*const handle = \(pos: GeolocationPosition\) => \{\s*if \(!active \|\| finishedRef.current\) return;\s*if \(!isLive\(\)\) return;\s*const next = advanceDuelGpsMeasurement/);
 assert.match(overlay,/const isLive = measurementLifetime.current.capture\(\);\s*const handler = \(event: DeviceMotionEvent\) => \{\s*if \(finishedRef.current\) return;\s*if \(!isLive\(\)\) return;/);
 assert.match(overlay,/active = false;[\s\S]*?navigator.geolocation.clearWatch/);
 assert.match(overlay,/window.removeEventListener\('devicemotion', handler\)/);
});
test('a rejected abort only resumes measurement in its own live session',()=>{
 const abort=overlay.slice(overlay.indexOf('const doAbort ='),overlay.indexOf('const watchIdRef ='));
 assert.match(abort,/const isLive = measurementLifetime.current.capture\(\);\s*if \(!isLive\(\)\) return;\s*abortBusyRef.current = true;/);
 assert.match(abort,/await onAbort\(\);[^\n]*\n\s*\} catch \{\s*if \(!isLive\(\)\) return;\s*finishedRef.current = false;/);
});
