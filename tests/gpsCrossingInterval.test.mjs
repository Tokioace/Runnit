import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGpsSprint,advanceGpsSprint,syntheticPoint} from '../src/lib/sprintGps.ts';
const start=1700000000000;
const advance=(s,m,t)=>advanceGpsSprint(s,syntheticPoint(m,start+t));
function approach(){
 let s=createGpsSprint(50,start);
 for(let i=0;i<=9;i++)s=advance(s,i*5,i*1000);
 return s;
}
test('long crossing bracket is preserved independently of confirmation delay',()=>{
 const before=approach();
 const crossing=advance(before,55,13000);
 assert.equal(crossing.crossingIntervalMs,4000);
 assert.equal(crossing.finishTimestampMs,null);
 const finished=advance(crossing,60,15000);
 assert.equal(finished.crossingIntervalMs,4000);
 assert.equal(finished.finishTimestampMs,crossing.crossingTimestampMs);
 assert.equal(advance(finished,70,17000).crossingIntervalMs,4000);
});
test('an unconfirmed crossing loses its bracket when returning below the target',()=>{
 const crossing=advance(approach(),51,10000);
 assert.equal(crossing.crossingIntervalMs,1000);
 const returned=advance(crossing,45,11000);
 assert.equal(returned.crossingIntervalMs,null);
 const recrossed=advance(returned,51,13000);
 assert.equal(recrossed.crossingIntervalMs,2000);
 const finished=advance(recrossed,55,14000);
 assert.equal(finished.crossingIntervalMs,2000);
});
test('field export includes only confirmed crossing interval without raw coordinates',()=>{
 const source=readFileSync(new URL('../src/screens/GpsFieldTestScreen.tsx',import.meta.url),'utf8');
 assert.match(source,/crossingIntervalMs: measurement\?\.finishTimestampMs != null \? measurement.crossingIntervalMs : null/);
 const block=source.slice(source.indexOf('const exported ='),source.indexOf('disclaimer:',source.indexOf('const exported =')));
 assert.doesNotMatch(block,/latitude|longitude|lastAccepted|\.origin/);
});
