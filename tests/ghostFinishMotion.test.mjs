import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ghostFinishMotion} from '../src/lib/ghostRunSummary.ts';
const start=1700000000000;
const trace=(...times)=>times.map(t_ms=>({t_ms,steps:99,ax:1}));
test('finish diagnostics exclude steps, samples and gaps after the interpolated crossing',()=>{
 const original=trace(0,100,450,500,1000,1100);
 const result=ghostFinishMotion(original,[start+100,start+500,start+1000],start,start+500);
 assert.equal(result.steps,2);
 assert.equal(result.gaps,1);
 assert.deepEqual(result.trace.map(s=>s.t_ms),[0,100,450,500]);
 assert.deepEqual(result.trace.map(s=>s.steps),[0,1,1,2]);
 assert.equal(original.length,6);
 assert.equal(original[0].steps,99);
});
test('a peak confirmed after crossing can still count if its own timestamp is within the sprint',()=>{
 const result=ghostFinishMotion(trace(0,90,100,110),[start+100,start+110],start,start+100);
 assert.equal(result.steps,1);
 assert.equal(result.trace.at(-1).steps,1);
});
test('missing motion is not extrapolated and pre-start peaks are excluded',()=>{
 assert.deepEqual(ghostFinishMotion([],[],start,start+500),{trace:[],steps:0,gaps:0});
 const result=ghostFinishMotion(trace(-10,0,50),[start-1,start+50],start,start+50);
 assert.deepEqual(result.trace.map(s=>s.t_ms),[0,50]);
 assert.equal(result.steps,1);
});
test('Ghost Run finalizes motion before saving or exporting its result',()=>{
 const source=readFileSync(new URL('../src/screens/GhostRunScreen.tsx',import.meta.url),'utf8');
 const finish=source.slice(source.indexOf('const stopRun ='),source.indexOf('const onGps ='));
 assert.match(finish,/if \(reason === 'finished' && state.finishTimestampMs !== null\)/);
 assert.match(finish,/ghostFinishMotion\(motionTraceRef.current, stepRef.current.timestampsMs,\s*state.startedAtMs, state.finishTimestampMs\)/);
 assert.match(finish,/motionTraceRef.current = motion.trace;[\s\S]*ghostSummary\(state, finalSteps,/);
});
