import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isFreshLiveGpsFix,createGpsSprint,advanceLiveGpsSprint,syntheticPoint} from '../src/lib/sprintGps.ts';
import {createDuelGpsMeasurement,advanceDuelGpsMeasurement} from '../src/lib/duelGpsMeasurement.ts';
const start=1700000000000;
test('all live GPS paths accept the same exact timestamp boundaries',()=>{
 for(const [age,allowed] of [[-1000,false],[-1,false],[0,true],[3000,true],[3001,false],[NaN,false],[Infinity,false]]){
  const sample=syntheticPoint(0,start+4000);
  const received=sample.timestampMs+age;
  assert.equal(isFreshLiveGpsFix(sample,received),allowed);
  const ghost=advanceLiveGpsSprint(createGpsSprint(50,start),sample,received);
  const duel=advanceDuelGpsMeasurement(createDuelGpsMeasurement(50,start,null),sample,received);
  assert.equal(ghost.lastDecision,allowed?'accepted':'invalid-sample');
  assert.deepEqual(duel.sprint,ghost);
  assert.equal(duel.staleFixes,allowed?0:1);
 }
 assert.equal(isFreshLiveGpsFix(syntheticPoint(0,NaN),start),false);
});
test('field test checks shared freshness before preparation and running without counting a rejected fix twice',()=>{
 const source=readFileSync(new URL('../src/screens/GpsFieldTestScreen.tsx',import.meta.url),'utf8');
 assert.match(source,/if \(!isFreshLiveGpsFix\(sample, now\)\) \{\s*setSkippedStale\(\(n\) => n \+ 1\);[\s\S]*?return;\s*\}/);
 assert.ok(source.indexOf('if (!isFreshLiveGpsFix(sample, now))')<source.indexOf('if (phaseNow === \'acquiring\''));
 assert.ok(source.indexOf('if (!isFreshLiveGpsFix(sample, now))')<source.indexOf('advanceGpsSprint(previous, sample)'));
 assert.doesNotMatch(source,/freshnessMs < -1000/);
});
