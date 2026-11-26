import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGpsSprint,advanceLiveGpsSprint,syntheticPoint} from '../src/lib/sprintGps.ts';
import {primeGpsSprint,createExperimentalRunReport,gpsFieldObservationMs} from '../src/lib/gpsField.ts';
const start=1700000000000;
const source=readFileSync(new URL('../src/screens/GpsFieldTestScreen.tsx',import.meta.url),'utf8');
const apply=(state,m,t,a=3)=>advanceLiveGpsSprint(state,syntheticPoint(m,start+t,a),start+t);
function approach(){
 let s=primeGpsSprint(createGpsSprint(50,start),syntheticPoint(0,start-200));
 for(let i=1;i<=4;i++)s=apply(s,i*10,i*1000);
 return s;
}
test('field report after a silent gap contains an observed finish, not an interpolated bracket',()=>{
 const prior=approach();
 const gap=apply(prior,62,7500);
 assert.equal(gap.finishTimestampMs,null);
 assert.equal(gap.crossingTimestampMs,start+7500);
 assert.equal(gap.crossingIntervalMs,null);
 assert.equal(gap.maxSpeedMps,prior.maxSpeedMps);
 const final=apply(gap,68,8500);
 const report=createExperimentalRunReport('device-gps',final);
 assert.equal(report.finished,true);
 assert.equal(report.durationSeconds,7.5);
 assert.equal(final.crossingIntervalMs,null);
 assert.equal(gpsFieldObservationMs(final),8500);
});
test('field test does not confirm an earlier crossing after a gap or a rejected fix',()=>{
 const crossing=apply(approach(),51,5000);
 const rejected=apply(crossing,54,7500,30);
 assert.equal(rejected.lastDecision,'poor-accuracy');
 const recovered=apply(rejected,60,8001);
 assert.equal(recovered.finishTimestampMs,null);
 assert.equal(recovered.beyondTargetCount,1);
 assert.equal(recovered.crossingTimestampMs,start+8001);
 const final=apply(recovered,65,9001);
 assert.equal(final.finishTimestampMs,start+8001);
 assert.equal(final.crossingIntervalMs,null);
});
test('field callback routes fresh running observations through shared live evaluator and exports null brackets',()=>{
 const a=source.indexOf('watchId.current = navigator.geolocation.watchPosition('),b=source.indexOf('}, (err) => {',a);
 assert.ok(a>=0&&b>a);
 const callback=source.slice(a,b);
 const freshness=callback.indexOf('if (!isFreshLiveGpsFix(sample, now))');
 const advance=callback.indexOf('advanceLiveGpsSprint(previous, sample, now)');
 assert.ok(freshness>=0&&advance>freshness);
 assert.doesNotMatch(callback,/advanceGpsSprint\(/);
 assert.match(callback,/stateRef.current = next;\s*setMeasurement\(next\);/);
 assert.match(source,/crossingIntervalMs: measurement\?\.finishTimestampMs != null \? measurement.crossingIntervalMs : null/);
});
