import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { summarizeRivals } from '../src/lib/competition.ts';
import { raceHistoryFromServer } from '../src/lib/runnerHistory.ts';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const own='me', other='rival';
const duel={id:'one',status:'completed',target_distance_m:50,host_user_id:own,
  challenger_user_id:other,created_at:'2026-11-16T13:00:00Z'};
const result={duel_id:'one',user_id:own,time_ms:42400,steps_count:0,distance_m:51,
  created_at:'2026-11-16T13:00:42Z'};
const pair=new Map([['one',[
  {user_id:own,time_ms:42400,username:'SubZero'},
  {user_id:other,time_ms:42500,username:'Runner B'}]]]);
test('real paired duel contains opponent identity used for private rivals',()=>{
 const records=raceHistoryFromServer(own,[result],[duel],pair);
 assert.equal(records[0].opponentUserId,other);
 assert.equal(records[0].opponentName,'Runner B');
 const rivals=summarizeRivals(records);
 assert.equal(rivals.length,1);
 assert.deepEqual([rivals[0].wins,rivals[0].losses,rivals[0].ties],[1,0,0]);
 assert.equal(rivals[0].name,'Runner B');
});
test('only fully completed, paired opponent races are treated as rivalries',()=>{
 const cases=[
  {...result,duel_id:'two',created_at:'2026-11-17T13:00:42Z',time_ms:50000},
 ];
 const all=raceHistoryFromServer(own,[result,...cases],[duel,
  {...duel,id:'two',status:'cancelled'}],pair);
 assert.equal(summarizeRivals(all).length,1);
 assert.equal(summarizeRivals(all)[0].duels,1);
 assert.deepEqual(summarizeRivals([]),[]);
});
test('repeat matches aggregate by user id, not username',()=>{
 const race={
  id:'r1',occurredAt:'2026-11-16T10:00:00Z',distanceM:50,timeMs:40000,
  stepsCount:0,measuredDistanceM:50,completed:true,outcome:'won',
  opponentTimeMs:41000,opponentUserId:'p1',opponentName:'Rival',
 };
 const other={...race,id:'r2',occurredAt:'2026-11-17T10:00:00Z',
  outcome:'lost',opponentName:'Renamed',timeMs:43000,opponentTimeMs:42000};
 const r=summarizeRivals([race,other]);
 assert.equal(r.length,1);
 assert.equal(r[0].duels,2);
 assert.equal(r[0].name,'Renamed');
 assert.equal(r[0].wins,1);
 assert.equal(r[0].losses,1);
});
test('six record categories rely on opt-in paired duel server RPC only',()=>{
 const sql=read('supabase/migrations/20261118101752_beta_record_categories_20261118.sql');
 const screen=read('src/screens/LeaderboardScreen.tsx');
 for(const metric of ['times','speed','acceleration','wins','streak','duels']){
  assert.ok(sql.includes("'"+metric+"'"),metric);
  assert.ok(screen.includes("id:'"+metric+"'"),metric);
 }
 assert.match(sql,/u.leaderboard_opt_in IS TRUE/);
 assert.match(sql,/d.status = 'completed'/);
 assert.match(sql,/COUNT\(\*\) FROM public.duel_results total/);
 assert.match(sql,/p_distance_m NOT IN \(50, 75, 100\)/);
 assert.match(sql,/REVOKE ALL ON FUNCTION/);
 assert.match(sql,/TO anon, authenticated/);
 assert.doesNotMatch(sql,/random\(\)|fake_data|example_runs/);
});
test('fixed screen is the old visual layout with untouched five-item bottom navigation',()=>{
 const screen=read('src/screens/LeaderboardScreen.tsx');
 const css=read('src/styles/runnitCompetition.css');
 const dock=read('src/components/ui/BottomNav.tsx');
 assert.match(screen,/arena-showdown/);
 assert.match(screen,/arena-ladder-grid/);
 assert.match(screen,/arena-champion/);
 assert.match(screen,/arena-metrics/);
 assert.match(css,/height:100dvh/);
 assert.match(css,/arena-board-list/);
 assert.match(css,/runnit-arena-reference-runner.svg/);
 assert.match(screen,/NOCH NICHT MANIPULATIONSSICHER/);
 assert.match(dock,/grid-cols-5/);
 assert.doesNotMatch(screen,/SpeedKaze|AeroFox|NightRunner|RATING 1250|DESIGNVORSCHAU/);
});
