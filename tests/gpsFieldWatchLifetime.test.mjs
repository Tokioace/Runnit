import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createMeasurementLifetime} from '../src/lib/measurementLifetime.ts';

test('retiring a field watch rejects its queued success and error even after re-prepare',()=>{
 const life=createMeasurementLifetime();
 const events=[];
 life.open();
 const first=life.capture();
 const oldSuccess=()=>{if(first())events.push('old fix');};
 const oldError=()=>{if(first())events.push('old error');};
 life.close();
 oldSuccess();oldError();
 life.open();
 const second=life.capture();
 oldSuccess();oldError();
 if(second())events.push('new fix');
 assert.deepEqual(events,['new fix']);
 life.close();
 assert.equal(second(),false);
});
test('field watch is retired before native cleanup and on background or page exit',()=>{
 const s=readFileSync(new URL('../src/screens/GpsFieldTestScreen.tsx',import.meta.url),'utf8');
 const stop=s.slice(s.indexOf('const stopWatching ='),s.indexOf('useLayoutEffect(() =>'));
 assert.match(stop,/watchLifetime.current.close\(\);[\s\S]*clearWatch\(id\)/);
 assert.match(stop,/watchId.current = null;[\s\S]*clearWatch\(id\)/);
 assert.match(s,/const pauseIfBackgrounded = \(\) => \{\s*if \(!document.hidden\) return;\s*stopWatching\(\);/);
 assert.match(s,/const stopOnPageHide = \(\) => \{\s*stopWatching\(\);/);
 assert.match(s,/mountedRef.current = false;[\s\S]*stopOnPageHide\(\);/);
});
test('both callbacks require the current watch generation and the new watch opens after retirement',()=>{
 const s=readFileSync(new URL('../src/screens/GpsFieldTestScreen.tsx',import.meta.url),'utf8');
 const prepare=s.slice(s.indexOf('const prepare ='),s.indexOf('const start ='));
 assert.ok(prepare.indexOf('stopWatching();')<prepare.indexOf('watchLifetime.current.open();'));
 assert.match(prepare,/watchLifetime.current.open\(\);\s*const isWatchLive = watchLifetime.current.capture\(\);/);
 assert.match(prepare,/watchPosition\(\(pos\) => \{\s*if \(!mountedRef.current \|\| !isWatchLive\(\)\) return;/);
 assert.match(prepare,/\}, \(err\) => \{\s*if \(!mountedRef.current \|\| !isWatchLive\(\)\) return;/);
});
