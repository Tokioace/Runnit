import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ghostTraceDiagnostics} from '../src/lib/ghostRunSummary.ts';
import {createGpsSprint,advanceGpsSprint,syntheticPoint} from '../src/lib/sprintGps.ts';
import {primeGpsSprint} from '../src/lib/gpsField.ts';
const start=1700000000000;
const source=readFileSync(new URL('../src/screens/GhostRunScreen.tsx',import.meta.url),'utf8');

test('local coverage metadata separates primed start age, observed time and crossing bracket',()=>{
 let s=primeGpsSprint(createGpsSprint(50,start),syntheticPoint(0,start-400,4.9));
 assert.deepEqual(ghostTraceDiagnostics(s,0,null),{
  startFixAgeMs:400,startFixAccuracyM:4.9,observationMs:0,crossingIntervalMs:null,
  gpsTraceOmitted:0,motionTraceTruncated:false,motionTraceFirstOmittedMs:null
 });
 s=advanceGpsSprint(s,syntheticPoint(20,start+3000));
 s=advanceGpsSprint(s,syntheticPoint(51,start+7500));
 assert.equal(ghostTraceDiagnostics(s,0,null).crossingIntervalMs,null);
 s=advanceGpsSprint(s,syntheticPoint(55,start+8500));
 const result=ghostTraceDiagnostics(s,2,null);
 assert.equal(result.observationMs,8500);
 assert.equal(result.crossingIntervalMs,4500);
 assert.equal(result.gpsTraceOmitted,2);
 assert.equal(result.motionTraceTruncated,false);
});
test('motion omission after the finish does not truncate the sprint trace',()=>{
 const state={...createGpsSprint(50,start),finishTimestampMs:start+5000};
 assert.equal(ghostTraceDiagnostics(state,0,5001).motionTraceTruncated,false);
 assert.equal(ghostTraceDiagnostics(state,0,5000).motionTraceTruncated,true);
 assert.equal(ghostTraceDiagnostics(state,0,4999).motionTraceFirstOmittedMs,4999);
 const stopped=createGpsSprint(50,start);
 assert.equal(ghostTraceDiagnostics(stopped,0,6000).motionTraceTruncated,true);
 assert.equal(ghostTraceDiagnostics(stopped,0,null).motionTraceTruncated,false);
 assert.equal(ghostTraceDiagnostics(stopped,0,null).startFixAgeMs,null);
});
test('coverage is reset per run, counted at the caps, and exported only locally',()=>{
 assert.match(source,/gpsTraceRef.current = \[\];\s*motionTraceRef.current = \[\];\s*gpsTraceOmittedRef.current = 0;\s*firstMotionOmittedMsRef.current = null;/);
 assert.match(source,/\} else \{\s*gpsTraceOmittedRef.current \+= 1;\s*\}/);
 assert.match(source,/\} else if \(firstMotionOmittedMsRef.current === null\) \{\s*firstMotionOmittedMsRef.current = stamp - start;/);
 const a=source.indexOf('const exportJson ='),b=source.indexOf('const reset =',a);
 assert.ok(a>=0&&b>a);
 const exported=source.slice(a,b);
 assert.match(exported,/diagnostics: ghostTraceDiagnostics\(state, gpsTraceOmittedRef.current, firstMotionOmittedMsRef.current\)/);
 assert.doesNotMatch(exported,/latitude:|longitude:|user_id:|startedAtMs:/);
 const save=source.slice(source.indexOf('const saveSummary ='),source.indexOf('const stopRun ='));
 assert.doesNotMatch(save,/ghostTraceDiagnostics|gpsTraceOmittedRef|firstMotionOmittedMsRef/);
});
