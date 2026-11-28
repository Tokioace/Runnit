import test from 'node:test';
import assert from 'node:assert/strict';
import {LiveStepPeakCounter} from '../src/lib/liveStepPeaks.ts';
const feed=(counter,points)=>points.map(([timestampMs,accelerationMagnitudeMps2])=>counter.push({timestampMs,accelerationMagnitudeMps2}));
test('late batches cannot seed false steps before the latest accepted sensor timestamp',()=>{
 for(const window of [0,67]){
  const counter=new LiveStepPeakCounter(window);
  feed(counter,[[1000,0],[1050,0],[1100,0]]);
  feed(counter,[[500,0],[550,0],[600,12],[650,12],[700,0],[750,0]]);
  assert.equal(counter.count,0);
  assert.deepEqual(counter.timestampsMs,[]);
 }
});
test('duplicates and out-of-order events do not destroy a valid in-progress crest',()=>{
 const clean=new LiveStepPeakCounter(),noisy=new LiveStepPeakCounter();
 const first=[[0,0],[50,0],[100,7]];
 feed(clean,first);feed(noisy,first);
 assert.deepEqual(feed(noisy,[[100,0],[75,100],[25,10]]),[null,null,null]);
 feed(clean,[[150,0]]);feed(noisy,[[150,0]]);
 assert.equal(clean.count,1);assert.deepEqual(noisy.timestampsMs,clean.timestampsMs);
});
test('late sample after suspension cannot bridge the gap into a false crest',()=>{
 const counter=new LiveStepPeakCounter();
 feed(counter,[[0,0],[50,0],[100,0],[1000,7],[900,0],[950,0],[1000,7],[1050,0]]);
 assert.equal(counter.count,0);
});
test('reset still permits a new sensor timestamp origin',()=>{
 const counter=new LiveStepPeakCounter();
 feed(counter,[[1000,0],[1050,0],[1100,7],[1150,0]]);
 assert.equal(counter.count,1);counter.reset();
 feed(counter,[[0,0],[50,0],[100,7],[150,0]]);
 assert.deepEqual(counter.timestampsMs,[100]);
});
