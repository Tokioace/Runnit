import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LiveStepPeakCounter} from '../src/lib/liveStepPeaks.ts';
import {DuelMotionCapture} from '../src/lib/duelMotionEvidence.ts';
const sample=(timestampMs,accelerationMagnitudeMps2=0)=>({timestampMs,accelerationMagnitudeMps2});
const peak=(counter,start)=>[0,0,5,0].forEach((v,i)=>counter.push(sample(start+i*50,v)));

test('resume retains confirmed steps and prevents a crest across the interrupted window',()=>{
 const counter=new LiveStepPeakCounter();
 peak(counter,1000);
 assert.equal(counter.count,1);
 for(const [t,v] of [[1600,0],[1650,0],[1700,5]])counter.push(sample(t,v));
 counter.resumeAfter(1750);
 assert.equal(counter.push(sample(1725,0)),null);
 assert.equal(counter.push(sample(1750,0)),null);
 assert.equal(counter.push(sample(1800,0)),null);
 assert.deepEqual(counter.timestampsMs,[1100]);
 peak(counter,2100);
 assert.deepEqual(counter.timestampsMs,[1100,2200]);
});
test('explicit short motion gaps are excluded from coverage and cannot certify continuity',()=>{
 const capture=new DuelMotionCapture(1000);
 for(let t=1000;t<=1500;t+=50)assert.equal(capture.push(sample(t,1)),true);
 capture.resumeAfter(1550);
 assert.equal(capture.push(sample(1525,1)),false);
 assert.equal(capture.push(sample(1550,1)),false);
 for(let t=1600;t<=2000;t+=50)assert.equal(capture.push(sample(t,1)),true);
 const evidence=capture.summarize(2000,5);
 assert.equal(evidence.motionGapCount,1);
 assert.equal(evidence.motionEvidence,'incomplete');
 assert.equal(evidence.motionSamples,20);
 assert.ok(Math.abs(evidence.motionCoverage-0.9)<1e-9);
 assert.equal(capture.summarize(1500,2).motionGapCount,0);
});
test('a resume without later samples still reports incomplete motion evidence',()=>{
 const capture=new DuelMotionCapture(1000);
 for(let t=1000;t<=1950;t+=50)capture.push(sample(t,1));
 capture.resumeAfter(1960);
 assert.equal(capture.summarize(2000,5).motionEvidence,'incomplete');
 assert.equal(capture.summarize(2000,5).motionSamples,20);
});
test('live abort failure applies one timestamp to GPS and both motion observers',()=>{
 const source=readFileSync(new URL('../src/screens/MapScreen.tsx',import.meta.url),'utf8');
 const a=source.indexOf('function RaceOverlay(');
 const b=source.indexOf('const doAbort =',a),c=source.indexOf('const watchIdRef =',b);
 assert.ok(a>=0&&b>a&&c>b);
 assert.match(source.slice(b,c),/if \(!isLive\(\)\) return;\s*finishedRef.current = false;\s*const resumedAtMs = Date.now\(\);\s*measurementRef.current = resumeDuelGpsMeasurement\(measurementRef.current, resumedAtMs\);\s*liveStepCounter.current.resumeAfter\(resumedAtMs\);\s*motionCapture.current.resumeAfter\(resumedAtMs\);/);
});
