import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { syntheticPoint, createGpsSprint, advanceGpsSprint } from '../src/lib/sprintGps.ts';
import { primeGpsSprint } from '../src/lib/gpsField.ts';
import { ghostSummary } from '../src/lib/ghostRunSummary.ts';
import { determineDuelOutcome } from '../src/lib/duelOutcome.ts';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const start = 100000;
const sample = (m,t) => syntheticPoint(m,t,3);

test('solo GPS run finishes only when two independent accepted fixes cross target', () => {
  let state = primeGpsSprint(createGpsSprint(50,start), sample(0,start-100));
  state = advanceGpsSprint(state,sample(20,start+3000));
  state = advanceGpsSprint(state,sample(51,start+7500));
  assert.equal(state.finishTimestampMs,null);
  state = advanceGpsSprint(state,sample(55,start+8500));
  assert.ok(state.finishTimestampMs !== null);
  const summary = ghostSummary(state,53,200,1,'granted',false,true);
  assert.equal(summary.run_state,'finished');
  assert.equal(summary.target_distance_m,50);
  assert.equal(summary.steps_count,53);
  assert.equal(summary.motion_samples,200);
  assert.equal(summary.gps_accepted,4);
  assert.ok(summary.elapsed_ms>0);
});

test('stopped GPS run never fabricates finish time or a win even with movement', () => {
  let state = primeGpsSprint(createGpsSprint(100,start),sample(0,start-100));
  state = advanceGpsSprint(state,sample(30,start+5000));
  const summary = ghostSummary(state,0,0,0,'unavailable',true,false);
  assert.equal(summary.run_state,'stopped');
  assert.equal(summary.elapsed_ms,null);
  assert.equal(summary.motion_permission,'unavailable');
  assert.equal(summary.interrupted,true);
  assert.equal(determineDuelOutcome([], 'any', 'completed'),'pending');
});

test('Ghost Run is accessible from Home and saved solo sessions appear in Stats', () => {
  const app=source('src/App.tsx');const home=source('src/screens/DashboardScreen.tsx');const stats=source('src/screens/StatsScreen.tsx');assert.match(app,/path="\/ghost-run"/);assert.match(home,/to="\/ghost-run"/);assert.match(stats,/ghostSessions/);assert.match(stats,/\/login\?next=%2Fstats/);
});

test('solo run reuses real GPS evaluator and same live IMU peak detector as 1v1', () => {
  const ghost = source('src/screens/GhostRunScreen.tsx');
  const map = source('src/screens/MapScreen.tsx');
  assert.match(ghost,/advanceLiveGpsSprint\(prior, sample, observedNow\)/);
  const gps = source('src/lib/sprintGps.ts');
  const live = gps.slice(gps.indexOf('export function advanceLiveGpsSprint('), gps.indexOf('export function runGpsSimulation('));
  assert.match(live,/if \(!isFreshLiveGpsFix\(sample, receivedAtMs\)\)/);
  const freshness = gps.slice(gps.indexOf('export function isFreshLiveGpsFix('), gps.indexOf('export function advanceLiveGpsSprint('));
  assert.match(freshness,/Number\.isFinite\(receivedAtMs\) && Number\.isFinite\(sample\.timestampMs\)/);
  assert.match(freshness,/sample\.timestampMs <= receivedAtMs && receivedAtMs - sample\.timestampMs <= 3000/);
  assert.match(live,/return advanceGpsSprint\(state, sample\);/);
  assert.match(ghost,/new LiveStepPeakCounter\(\)/);
  assert.match(map,/new LiveStepPeakCounter\(\)/);
  assert.match(ghost,/isFreshStartFix\(anchor, Date\.now\(\)\)/);
  assert.match(ghost,/primeGpsSprint\(createGpsSprint\(target, startMs\), anchor\)/);
  assert.match(ghost,/motionTraceRef\.current\.push\(/);
  assert.match(ghost,/gpsTraceRef\.current\.push\(/);
  assert.match(ghost,/event\.acceleration/);
  assert.match(ghost,/onDone=\{beginRun\}/);
  assert.match(ghost,/startsAt=\{countdownAt\}/);
  assert.match(ghost,/stopRun\('finished'/);
  assert.match(ghost,/stopRun\('stopped'/);
});

test('privacy: relative GPS/IMU export does not contain raw latitude longitude user identity', () => {
  const ghost = source('src/screens/GhostRunScreen.tsx');
  const sql = source('supabase/migrations/20261117_001_private_ghost_run_sessions.sql');
  assert.match(ghost,/east_m:/);
  assert.match(ghost,/north_m:/);
  assert.match(ghost,/raw_location_included: false/);
  assert.match(ghost,/GPS \+ LIVE IMU/);
  assert.match(ghost,/JSON\.stringify\(report\)/);
  assert.match(ghost,/\.from\('ghost_run_sessions'\)\.insert\(/);
  assert.doesNotMatch(ghost,/\.from\('ghost_runs'\)\.insert\(/);
  assert.doesNotMatch(sql,/latitude|longitude|raw_imu|trace_json|gps_trace/i);
  assert.match(sql,/ALTER TABLE public\.ghost_run_sessions ENABLE ROW LEVEL SECURITY/);
  assert.match(sql,/FOR SELECT TO authenticated USING \(\(select auth\.uid\(\)\) = user_id\)/);
  assert.match(sql,/FOR INSERT TO authenticated WITH CHECK \(\(select auth\.uid\(\)\) = user_id\)/);
  assert.match(sql,/REVOKE ALL ON public\.ghost_run_sessions FROM PUBLIC, anon, authenticated/);
});

test('no simultaneous solo session when user has an active 1v1 and no rank credit', () => {
  const ghost = source('src/screens/GhostRunScreen.tsx');
  assert.match(ghost,/\.in\('status', \['open', 'matched'\]\)/);
  assert.match(ghost,/Du hast noch ein aktives 1v1-Duell/);
  assert.match(ghost,/Keine Ranglistenwertung/);
  assert.match(ghost,/source: 'ios-web-beta'/);
  assert.match(ghost,/saveEnabledRef\.current/);
});

test('2 player result screen persists after finishing until each player closes independently', () => {
  const map = source('src/screens/MapScreen.tsx');
  const finish = source('src/components/race/DuelFinishScreen.tsx');
  assert.match(map,/const closeCompletedDuel = React\.useCallback/);
  assert.match(map,/endedDuelIdsRef\.current\.add\(duelId\)/);
  assert.match(map,/forgetActiveDuelId\(authUser\.id, duelId\)/);
  assert.match(map,/onClose=\{\(\) => closeCompletedDuel\(race\.duelId\)\}/);
  assert.match(finish,/outcome === 'won'/);
  assert.match(finish,/outcome === 'lost'/);
  assert.match(finish,/outcome === 'tie'/);
  assert.match(finish,/status === 'completed'/);
  assert.match(finish,/window\.setInterval/);
});
