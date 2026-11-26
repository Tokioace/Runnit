import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createMeasurementLifetime} from '../src/lib/measurementLifetime.ts';
const source=readFileSync(new URL('../src/screens/GhostRunScreen.tsx',import.meta.url),'utf8');

test('GPS preparation failure retires all request generations and clears stale start evidence',()=>{
 const a=source.indexOf('const failGpsPreparation ='),b=source.indexOf('const onGpsError =',a);
 assert.ok(a>=0&&b>a);
 const fail=source.slice(a,b);
 assert.match(fail,/preparationLifetime.current.close\(\);\s*preparingRef.current = false;\s*stopGps\(\);/);
 assert.match(fail,/countdownAtRef.current = null;\s*readyRef.current = null;\s*setCountdownAt\(null\);/);
 assert.match(fail,/setFixTimestampMs\(null\);\s*setFixIssue\('missing'\);\s*setAccuracyM\(null\);\s*setCurrentPhase\('error'\);\s*setNotice\(message\);/);
 const watch=createMeasurementLifetime(),preparation=createMeasurementLifetime();
 watch.open();preparation.open();
 const oldWatch=watch.capture(),oldPrep=preparation.capture();
 preparation.close();watch.close();preparation.open();watch.open();
 assert.equal(oldWatch(),false);assert.equal(oldPrep(),false);
});
test('GPS errors before GO require new preparation and do not discard a running partial result',()=>{
 const a=source.indexOf('const onGpsError ='),b=source.indexOf('const prepare =',a);
 assert.ok(a>=0&&b>a);
 const error=source.slice(a,b);
 assert.match(error,/if \(phaseRef.current === 'running'\) \{\s*interruptedRef.current = true;\s*setInterrupted\(true\);\s*stopRun\('stopped',/);
 assert.match(error,/else if \(phaseRef.current === 'acquiring' \|\| phaseRef.current === 'ready' \|\| phaseRef.current === 'countdown'\) \{\s*failGpsPreparation\(text\);/);
 assert.match(source,/catch \{\s*failGpsPreparation\('GPS konnte nicht gestartet werden\.'\);/);
 assert.doesNotMatch(error,/setSummary\(null\)|activeRef.current = null/);
});
test('GO refuses a retired GPS watch and new-run reset clears the old displayed fix',()=>{
 const a=source.indexOf('const beginRun ='),b=source.indexOf('useEffect(() =>',a);
 assert.ok(a>=0&&b>a);
 const begin=source.slice(a,b);
 assert.match(begin,/if \(!gpsLifetime.current.isActive\(\)\) \{\s*failGpsPreparation\([^)]*\);\s*return false;/);
 assert.ok(begin.indexOf('!gpsLifetime.current.isActive()')<begin.indexOf('primeGpsSprint('));
 const c=source.indexOf('const reset ='),d=source.indexOf('const elapsedMs =',c);
 assert.ok(c>=0&&d>c);
 assert.match(source.slice(c,d),/setFixTimestampMs\(null\); setFixIssue\('missing'\);\s*setAccuracyM\(null\)/);
});
