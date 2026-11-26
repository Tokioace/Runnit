import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {motionEventSample} from '../src/lib/duelMotionEvidence.ts';
import {LiveStepPeakCounter} from '../src/lib/liveStepPeaks.ts';

const origin=1700000000000;
const event=(timeStamp,x=1)=>({timeStamp,acceleration:{x,y:0,z:0}});

test('Ghost Run shares the validated sensor event clock with 1v1',()=>{
 assert.deepEqual(motionEventSample(event(100,4),origin,500),{timestampMs:origin+100,accelerationMagnitudeMps2:4});
 for(const [e,now] of [[event(100),1101],[event(501),500],[event(100,NaN),500],[event(100,200),500],[event(-1),500]]){
  assert.equal(motionEventSample(e,origin,now),null);
 }
});
test('batched callback arrival does not collapse distinct sensor sample times',()=>{
 const counter=new LiveStepPeakCounter();
 for(const [stamp,magnitude] of [[100,1],[150,1],[200,5],[250,1],[600,1],[650,1],[700,5],[750,1]]){
  const sample=motionEventSample(event(stamp,magnitude),origin,800);
  assert.ok(sample);
  counter.push(sample);
 }
 assert.equal(counter.count,2);
 assert.deepEqual(counter.timestampsMs,[origin+200,origin+700]);
});
test('Ghost Run rejects pre-start and duplicate events before updating gaps, steps or export',()=>{
 const source=readFileSync(new URL('../src/screens/GhostRunScreen.tsx',import.meta.url),'utf8');
 const handler=source.slice(source.indexOf('const handler = (event: DeviceMotionEvent)'),source.indexOf("window.addEventListener('devicemotion'"));
 assert.match(handler,/motionEventSample\(event, performance.timeOrigin, performance.now\(\)\)/);
 assert.match(handler,/if \(!sample \|\| start === null \|\| sample.timestampMs < start\) return;/);
 assert.match(handler,/if \(last !== null && stamp <= last\) return;[\s\S]*lastMotionAt.current = stamp;/);
 assert.match(handler,/stepRef.current.push\(sample\)/);
 assert.match(handler,/t_ms: stamp - start/);
 assert.doesNotMatch(handler,/Date.now\(\)/);
});
