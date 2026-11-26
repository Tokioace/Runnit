import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createMeasurementLifetime} from '../src/lib/measurementLifetime.ts';
const source=readFileSync(new URL('../src/screens/GhostRunScreen.tsx',import.meta.url),'utf8');

test('callbacks from a cleared GPS session stay retired after a new session opens',()=>{
 const gps=createMeasurementLifetime();
 const positions=[],errors=[];
 gps.open();
 const old=gps.capture();
 const oldPosition=pos=>{if(old())positions.push(pos);};
 const oldError=err=>{if(old())errors.push(err);};
 oldPosition('first');
 gps.close();gps.open();
 const current=gps.capture();
 oldPosition('late fix');oldError('late error');
 if(current())positions.push('new fix');
 assert.deepEqual(positions,['first','new fix']);
 assert.deepEqual(errors,[]);
 gps.close();assert.equal(current(),false);
});
test('watch success and error callbacks belong to a GPS lifetime retired before clearWatch',()=>{
 assert.match(source,/const gpsLifetime = useRef\(createMeasurementLifetime\(\)\)/);
 const stop=source.slice(source.indexOf('const stopGps ='),source.indexOf('const refreshSaved ='));
 assert.match(stop,/gpsLifetime.current.close\(\);[\s\S]*clearWatch\(/);
 assert.match(source,/gpsLifetime.current.open\(\);\s*const isGpsLive = gpsLifetime.current.capture\(\);/);
 assert.match(source,/watchPosition\(\s*pos => \{ if \(isGpsLive\(\)\) onGps\(pos\); \},\s*err => \{ if \(isGpsLive\(\)\) onGpsError\(err\); \}/);
});
test('automatic, manual and countdown one-shot GPS callbacks cannot mutate subsequent phases',()=>{
 assert.match(source,/!cancelled && isGpsLive\(\) && phaseRef.current === 'acquiring'/);
 assert.match(source,/const stillPreparing = \(\) => isGpsLive\(\) &&\s*\(phaseRef.current === 'acquiring' \|\| phaseRef.current === 'ready'\)/);
 assert.match(source,/if \(stillPreparing\(\)\) setNotice/);
 assert.match(source,/pos => \{ if \(stillPreparing\(\)\) onGps\(pos\); \}/);
 assert.match(source,/const stillCounting = \(\) => !cancelled && isGpsLive\(\) && phaseRef.current === 'countdown'/);
 assert.match(source,/pos => \{ if \(stillCounting\(\)\) onGps\(pos\); \}/);
});
