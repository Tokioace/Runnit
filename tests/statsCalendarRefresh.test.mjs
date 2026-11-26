import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculateActivityTotals,currentLocalWeekStart} from '../src/lib/runnerHistory.ts';
import {calculateStatsOverview} from '../src/lib/statsDashboard.ts';

const sunday=new Date(2026,10,22,23,59,59);
const monday=new Date(2026,10,23,0,0,0);
const race={id:'race',occurredAt:sunday.toISOString(),distanceM:50,timeMs:8000,stepsCount:22,measuredDistanceM:51,completed:true,outcome:'won',opponentTimeMs:9000};
const aggregate=now=>({totals:calculateActivityTotals([race],[],currentLocalWeekStart(now),now.getTime()),stats:calculateStatsOverview([race],[],now)});
test('unchanged records roll into a fresh local week without losing lifetime results',()=>{
 const before=aggregate(sunday);
 const after=aggregate(monday);
 assert.equal(before.totals.weeklySessions,1);
 assert.equal(before.stats.activeDaysThisWeek,1);
 assert.equal(after.totals.weeklySessions,0);
 assert.equal(after.totals.weeklySteps,null);
 assert.equal(after.stats.weeklyMeasuredDistanceM,null);
 assert.equal(after.stats.activeDaysThisWeek,0);
 assert.equal(after.stats.currentStreak,1);
 assert.equal(after.totals.wins,1);
 assert.equal(after.stats.bestTimes[50],8000);
 assert.equal(after.stats.days[0].key,'2026-11-23');
 assert.equal(aggregate(new Date(2026,10,24,0)).stats.currentStreak,0);
});
test('history clock is local-only, refreshes on visibility and disposes its timer',()=>{
 const s=readFileSync(new URL('../src/hooks/useRunnerHistory.ts',import.meta.url),'utf8');
 const clock=s.slice(s.indexOf('// Calendar boundaries'),s.indexOf('const totals = useMemo'));
 assert.match(clock,/if \(!userId\) return;/);
 assert.match(clock,/document.visibilityState === 'visible'/);
 assert.match(clock,/setInterval\(tick, 60_000\)/);
 assert.match(clock,/addEventListener\('visibilitychange', tick\)/);
 assert.match(clock,/clearInterval\(timer\)/);
 assert.match(clock,/removeEventListener\('focus', tick\)/);
 assert.match(clock,/removeEventListener\('visibilitychange', tick\)/);
 assert.match(clock,/new Date\(\), \[state.races, state.ghostSessions, clockRevision\]/);
 assert.doesNotMatch(clock,/supabase|refresh\(\)/);
});
test('Stats chart and weekly totals consume the same observation time',()=>{
 const s=readFileSync(new URL('../src/hooks/useRunnerHistory.ts',import.meta.url),'utf8');
 const stats=readFileSync(new URL('../src/screens/StatsScreen.tsx',import.meta.url),'utf8');
 assert.match(s,/return \{ ...state, totals, refresh, now \}/);
 assert.match(s,/calculateActivityTotals\(state.races, state.ghostSessions, currentLocalWeekStart\(now\), now.getTime\(\)\)/);
 assert.match(stats,/calculateStatsOverview\(races,ghostSessions,now\),\[races,ghostSessions,now\]/);
});
