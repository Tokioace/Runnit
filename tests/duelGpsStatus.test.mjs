import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {duelGpsLiveNotice,duelGpsErrorNotice} from '../src/lib/duelGpsStatus.ts';
import {createGpsSprint,advanceGpsSprint,syntheticPoint} from '../src/lib/sprintGps.ts';
const start=1700000000000;
test('live GPS status distinguishes missing, fresh and expired fixes',()=>{
 let s=createGpsSprint(50,start);
 assert.match(duelGpsLiveNotice(s,start,null),/ersten gültigen/);
 s=advanceGpsSprint(s,syntheticPoint(0,start));
 assert.equal(duelGpsLiveNotice(s,start+3000,null),null);
 assert.match(duelGpsLiveNotice(s,start+3001,null),/Kein aktueller/);
 assert.match(duelGpsLiveNotice(s,start-1,null),/Kein aktueller/);
 s=advanceGpsSprint(s,syntheticPoint(10,start+4000));
 assert.equal(duelGpsLiveNotice(s,start+4000,null),null);
});
test('explicit GPS errors remain visible even while last fix is fresh',()=>{
 const s=advanceGpsSprint(createGpsSprint(50,start),syntheticPoint(0,start));
 for(const [code,pattern] of [[1,/verweigert/],[2,/nicht verfügbar/],[3,/Zeitüberschreitung/],[99,/GPS-Fehler/]]){
  const message=duelGpsErrorNotice(code);
  assert.match(message,pattern);
  assert.equal(duelGpsLiveNotice(s,start,message),message);
 }
});
test('live race displays GPS errors without aborting and only accepted fixes clear them',()=>{
 const source=readFileSync(new URL('../src/screens/MapScreen.tsx',import.meta.url),'utf8');
 const a=source.indexOf('function RaceOverlay('),b=source.indexOf('// Haversine distance in meters',a);
 assert.ok(a>=0&&b>a);
 const overlay=source.slice(a,b);
 assert.match(overlay,/if \(next.sprint.lastDecision !== 'accepted'\) return;\s*setGpsErrorNotice\(null\);/);
 assert.match(overlay,/const handleError = \(error: GeolocationPositionError\) => \{\s*if \(!active \|\| !isLive\(\) \|\| finishedRef.current\) return;\s*setGpsErrorNotice\(duelGpsErrorNotice\(error.code\)\);/);
 assert.match(overlay,/watchPosition\(handle, handleError,/);
 assert.match(overlay,/GPS wird auf diesem Gerät nicht unterstützt/);
 assert.match(overlay,/GPS konnte nicht gestartet werden/);
 assert.match(overlay,/duelGpsLiveNotice\(measurementRef.current.sprint, startedAt \+ elapsedMs, gpsErrorNotice\)/);
 assert.match(overlay,/GPS-Bewertung experimentell · nicht verifiziert\{gpsNotice/);
 const c=overlay.indexOf('const handleError ='),d=overlay.indexOf('return () =>',c);
 assert.doesNotMatch(overlay.slice(c,d),/onAbort\(|finishCallbackRef.current\(|advanceDuelGpsMeasurement\(/);
});
