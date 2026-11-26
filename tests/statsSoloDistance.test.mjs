import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculateStatsOverview,formatStatsDistance} from '../src/lib/statsDashboard.ts';

const now=new Date(2026,10,26,12);
const base={id:'g',created_at:new Date(2026,10,25,12).toISOString(),target_distance_m:50,run_state:'finished',elapsed_ms:9000,observed_distance_m:51,steps_count:20};
const stats=rows=>calculateStatsOverview([],rows,now);
test('solo distance uses the same eligible sessions as the solo training count',()=>{
 const result=stats([base,
  {...base,id:'future',created_at:new Date(now.getTime()+1).toISOString(),observed_distance_m:1000},
  {...base,id:'bad-date',created_at:'invalid',observed_distance_m:1000},
  {...base,id:'bad-time',elapsed_ms:Infinity,observed_distance_m:1000},
  {...base,id:'stopped',run_state:'stopped',observed_distance_m:1000}]);
 assert.equal(result.soloTrainings,1);
 assert.equal(result.soloMeasuredDistanceM,51);
 assert.equal(result.totalRecordedDistanceM,51);
});
test('missing GPS is unknown, not a measured zero or the selected target',()=>{
 for(const distance of [null,undefined,NaN,Infinity,-1]){
  const result=stats([{...base,observed_distance_m:distance}]);
  assert.equal(result.soloTrainings,1);
  assert.equal(result.soloMeasuredDistanceM,null);
  assert.equal(formatStatsDistance(result.soloMeasuredDistanceM),'—');
 }
 assert.equal(stats([]).soloMeasuredDistanceM,null);
 assert.equal(stats([{...base,observed_distance_m:0}]).soloMeasuredDistanceM,0);
 assert.equal(stats([base,{...base,id:'missing',observed_distance_m:null}]).soloMeasuredDistanceM,51);
});
test('Stats uses the shared aggregate rather than separately counting ghost rows',()=>{
 const source=readFileSync(new URL('../src/screens/StatsScreen.tsx',import.meta.url),'utf8');
 assert.match(source,/formatStatsDistance\(stats.soloMeasuredDistanceM\)/);
 assert.doesNotMatch(source,/const soloSessions=ghostSessions.filter/);
});
