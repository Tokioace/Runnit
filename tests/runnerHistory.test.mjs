import test from 'node:test';
import assert from 'node:assert/strict';
import {
  raceHistoryFromServer, calculateActivityTotals, currentLocalWeekStart, formatRaceTime
} from '../src/lib/runnerHistory.ts';

const owner = 'runner-A', rival = 'runner-B';
const d = {
  id:'duel-1', status:'completed',target_distance_m:50,host_user_id:owner,
  challenger_user_id:rival,created_at:'2026-11-16T21:04:04Z'
};
const own = {
  duel_id:'duel-1',user_id:owner,time_ms:42396,steps_count:52,
  distance_m:50.8,created_at:'2026-11-16T21:04:47Z'
};
const pair = new Map([['duel-1',[
  {user_id:owner,time_ms:42396},{user_id:rival,time_ms:42456},
]]]);

test('completed 1v1 times appear in own history with the correct winner',()=>{
 const history=raceHistoryFromServer(owner,[own],[d],pair);
 assert.equal(history.length,1);
 assert.equal(history[0].outcome,'won');
 assert.equal(history[0].completed,true);
 assert.equal(history[0].stepsCount,52);
 assert.equal(history[0].distanceM,50);
 assert.equal(history[0].opponentTimeMs,42456);
});

test('rival sees their own defeat, not the owner result',()=>{
 const ownRival={...own,user_id:rival,time_ms:42456};
 const h=raceHistoryFromServer(rival,[ownRival],[d],pair);
 assert.equal(h[0].outcome,'lost');
 assert.equal(h[0].timeMs,42456);
});

test('an unpaired race is never counted as a completed or ranked result',()=>{
 const h=raceHistoryFromServer(owner,[own],[d],new Map());
 assert.equal(h[0].outcome,'pending');
 assert.equal(h[0].completed,false);
 const totals=calculateActivityTotals(h,[],Date.parse('2026-11-16'));
 assert.equal(totals.completedDuels,0);
 assert.equal(totals.weeklySteps,null);
});

test('aborted races with a stored submission never count as wins',()=>{
 const h=raceHistoryFromServer(owner,[own],[{...d,status:'abandoned'}],pair);
 assert.equal(h[0].completed,false);
 assert.equal(h[0].outcome,'pending');
});

test('other users cannot show up as personal results',()=>{
 const h=raceHistoryFromServer(owner,[{...own,user_id:rival}],[d],pair);
 assert.deepEqual(h,[]);
});

test('best times are split by distance, not mixed with 75m and 100m',()=>{
 const h=raceHistoryFromServer(owner,[own,{...own,duel_id:'duel-2',time_ms:71000}],
   [d,{...d,id:'duel-2',target_distance_m:100}],
   new Map([...pair.entries(),['duel-2',[
     {user_id:owner,time_ms:71000},{user_id:rival,time_ms:72000}
   ]]]));
 const stats=calculateActivityTotals(h,[],Date.parse('2026-11-16'));
 assert.equal(stats.best50Ms,42396);
 assert.equal(stats.best100Ms,71000);
 assert.equal(stats.best75Ms,null);
 assert.equal(stats.wins,2);
});

test('weekly running values count actual completed runs and saved finished ghost sessions',()=>{
 const h=raceHistoryFromServer(owner,[own],[d],pair);
 const ghost=[{
  id:'ghost-1',created_at:'2026-11-16T23:10:00Z',target_distance_m:50,
  run_state:'finished',elapsed_ms:30000,observed_distance_m:53,steps_count:40,motion_permission:'granted'
 },{
  id:'ghost-2',created_at:'2026-11-16T23:11:00Z',target_distance_m:50,
  run_state:'stopped',elapsed_ms:10000,observed_distance_m:10,steps_count:12,motion_permission:'unavailable'
 }];
 const stats=calculateActivityTotals(h,ghost,Date.parse('2026-11-16'));
 assert.equal(stats.weeklySteps,92);
 assert.equal(stats.weeklyDistanceM,103.8);
 assert.equal(stats.weeklySessions,2);
 assert.equal(stats.recordedSessions,2);
});

test('when no recordings exist, missing sensor measurements remain missing',()=>{
 const stats=calculateActivityTotals([],[],0);
 assert.equal(stats.weeklySessions,0);
 assert.equal(stats.weeklySteps,null);
 assert.equal(stats.weeklyDistanceM,null);
 assert.equal(stats.best50Ms,null);
});

test('local week begins on Monday and times are readable',()=>{
 assert.equal(new Date(currentLocalWeekStart(new Date(2026,10,18,10))).getDay(),1);
 assert.equal(formatRaceTime(42396),'42,40 s');
 assert.equal(formatRaceTime(null),'—');
});


test('sensor denied ghost run never contributes invented steps',()=>{
 const run={id:'unmeasured',created_at:'2026-11-16T10:00:00Z',target_distance_m:50,
 run_state:'finished',elapsed_ms:40000,observed_distance_m:53,steps_count:0,motion_permission:'unavailable'};
 const totals=calculateActivityTotals([], [run], Date.parse('2026-11-16'));
 assert.equal(totals.weeklySteps,null);
 assert.equal(totals.weeklyDistanceM,53);
});
