import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {hasValidGhostHistoryMeasurements} from '../src/lib/runnerHistory.ts';

const valid={id:'g',user_id:'a',created_at:'2026-11-27T18:00:00Z',target_distance_m:50,run_state:'finished',elapsed_ms:9000,steps_count:30,observed_distance_m:51};
test('Ghost Run statistics accepts valid finished and stopped snapshots',()=>{
  assert.equal(hasValidGhostHistoryMeasurements([]),true);
  for(const target of [50,75,100]) assert.equal(hasValidGhostHistoryMeasurements([{...valid,target_distance_m:target}]),true);
  assert.equal(hasValidGhostHistoryMeasurements([{...valid,elapsed_ms:1,steps_count:0,observed_distance_m:0}]),true);
  assert.equal(hasValidGhostHistoryMeasurements([{...valid,elapsed_ms:3600000,steps_count:100000,observed_distance_m:9999.9}]),true);
  assert.equal(hasValidGhostHistoryMeasurements([valid,{...valid,id:'s',run_state:'stopped',elapsed_ms:null}]),true);
});
test('Ghost Run statistics rejects invalid measurements instead of inflating activity',()=>{
  for(const bad of [null,[],{}, {...valid,created_at:'bad'}, {...valid,created_at:42}, {...valid,target_distance_m:60}, {...valid,run_state:'unknown'}, {...valid,elapsed_ms:null}, {...valid,elapsed_ms:0}, {...valid,elapsed_ms:1.5}, {...valid,elapsed_ms:3600001}, {...valid,elapsed_ms:NaN}, {...valid,elapsed_ms:'9000'}, {...valid,run_state:'stopped'}, {...valid,steps_count:-1}, {...valid,steps_count:2.5}, {...valid,steps_count:100001}, {...valid,observed_distance_m:Infinity}, {...valid,observed_distance_m:-1}, {...valid,observed_distance_m:10000}, {...valid,observed_distance_m:'51'}]){
    assert.equal(hasValidGhostHistoryMeasurements([valid,bad]),false);
  }
});
test('statistics validates Ghost Run measurements before starting paired history reads or publishing',()=>{
  const source=readFileSync(new URL('../src/hooks/useRunnerHistory.ts',import.meta.url),'utf8');
  const guard="if (!hasValidGhostHistoryMeasurements(ghostResponse.data)) throw new Error('Invalid Ghost Run measurement history');";
  assert.ok(source.includes(guard));
  assert.ok(source.indexOf(guard)<source.indexOf('const ids ='));
  assert.ok(source.indexOf(guard)<source.indexOf('ghostSessions: ghostResponse.data'));
});
