import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGpsSprint,advanceGpsSprint,syntheticPoint} from '../src/lib/sprintGps.ts';
import {ownsGpsFieldReport} from '../src/lib/gpsField.ts';
const start=1700000000000;
const source=readFileSync(new URL('../src/screens/GpsFieldTestScreen.tsx',import.meta.url),'utf8');
test('only the exact current terminal field measurement may be exported',()=>{
 const a=createGpsSprint(50,start),b=createGpsSprint(50,start);
 assert.deepEqual(a,b);
 for(const phase of ['finished','stopped']){
  assert.equal(ownsGpsFieldReport(a,a,phase,phase),true);
  assert.equal(ownsGpsFieldReport(a,b,phase,phase),false);
  assert.equal(ownsGpsFieldReport(a,null,phase,phase),false);
  assert.equal(ownsGpsFieldReport(null,null,phase,phase),false);
 }
 for(const phase of ['idle','acquiring','ready','running','error'])
  assert.equal(ownsGpsFieldReport(a,a,phase,phase),false);
});
test('an unrendered update or terminal transition cannot mix old measurement data with a new stop cause',()=>{
 let a=createGpsSprint(50,start);
 a=advanceGpsSprint(a,syntheticPoint(0,start));
 const b=advanceGpsSprint(a,syntheticPoint(5,start+1000));
 assert.equal(ownsGpsFieldReport(a,b,'stopped','stopped'),false);
 assert.equal(ownsGpsFieldReport(b,b,'running','stopped'),false);
 assert.equal(ownsGpsFieldReport(b,b,'finished','stopped'),false);
 assert.equal(ownsGpsFieldReport(b,b,'stopped','stopped'),true);
});
test('field export guard precedes report metadata and download; preparation and reset retire identity',()=>{
 const a=source.indexOf('const downloadReport ='),b=source.indexOf('  return (\n    <main',a);
 assert.ok(a>=0&&b>a);
 const exported=source.slice(a,b);
 const guard=exported.indexOf('if (!mountedRef.current || !ownsGpsFieldReport(measurement, stateRef.current, phase, phaseRef.current)) return;');
 assert.ok(guard>=0);
 for(const marker of ['const exported = {','stopReason: stopReasonRef.current','new Blob','a.click()'])
  assert.ok(exported.indexOf(marker)>guard,marker);
 for(const name of ['prepare','reset']){
  const begin=source.indexOf('const '+name+' =');
  assert.ok(begin>=0);
  assert.match(source.slice(begin,source.indexOf('setMeasurement(null);',begin)),/stateRef.current = null;/);
 }
 assert.doesNotMatch(exported,/latitude:|longitude:|userId:|localStorage|supabase/);
});
