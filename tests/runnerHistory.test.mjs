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

test('missing GPS distance never silently becomes the selected target distance',()=>{
 const a = raceHistoryFromServer(owner,[{...own, distance_m:null}],[d],pair);
 assert.equal(a[0].distanceM,50);
 assert.equal(a[0].measuredDistanceM,null);
 const totals=calculateActivityTotals(a,[],Date.parse('2026-11-16'));
 assert.equal(totals.weeklyDistanceM,null);
});

test('a paired RPC time inconsistent with the stored own result cannot award a win', () => {
 const inconsistent = new Map([['duel-1', [
  { user_id: owner, time_ms: 41000 },
  { user_id: rival, time_ms: 42456 },
 ]]]);
 const history = raceHistoryFromServer(owner, [own], [d], inconsistent);
 assert.equal(history.length, 1);
 assert.equal(history[0].completed, false);
 assert.equal(history[0].outcome, 'pending');
 assert.equal(calculateActivityTotals(history, [], Date.parse('2026-11-16')).wins, 0);
});

test('consistent paired times still allow ties and losses', () => {
 const tied = raceHistoryFromServer(owner, [own], [d],
  new Map([['duel-1', [{user_id:owner,time_ms:42396},{user_id:rival,time_ms:42396}]]]));
 assert.equal(tied[0].completed, true);
 assert.equal(tied[0].outcome, 'tie');
 const lost = raceHistoryFromServer(owner, [own], [d],
  new Map([['duel-1', [{user_id:owner,time_ms:42396},{user_id:rival,time_ms:42000}]]]));
 assert.equal(lost[0].completed, true);
 assert.equal(lost[0].outcome, 'lost');
});

test('weekly activity excludes later-week and future-dated finished sessions',()=>{
 const monday = currentLocalWeekStart(new Date(2026, 10, 16, 12));
 const nextMonday = new Date(monday);
 nextMonday.setDate(nextMonday.getDate() + 7);
 const ghost = (id, date) => ({
  id, created_at:date.toISOString(), target_distance_m:50,
  run_state:'finished', elapsed_ms:30000, observed_distance_m:51,
  steps_count:40, motion_permission:'granted'
 });
 const inside = ghost('inside',new Date(monday + 60_000));
 const later = ghost('later',nextMonday);
 const totals = calculateActivityTotals([], [inside,later], monday);
 assert.equal(totals.recordedSessions,2);
 assert.equal(totals.weeklySessions,1);
 assert.equal(totals.weeklySteps,40);
 assert.equal(totals.weeklyDistanceM,51);
});

test('weekly boundary uses local calendar days across daylight-saving changes',()=>{
 const monday = currentLocalWeekStart(new Date(2026, 9, 19, 12));
 const nextMonday = new Date(monday);
 nextMonday.setDate(nextMonday.getDate() + 7);
 const run = {
  id:'next-week',created_at:nextMonday.toISOString(),target_distance_m:50,
  run_state:'finished',elapsed_ms:30000,observed_distance_m:51,
  steps_count:40,motion_permission:'granted'
 };
 const totals = calculateActivityTotals([], [run], monday);
 assert.equal(totals.weeklySessions,0);
});
