import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculateStatsOverview,formatStatsDistance,formatStatsTime,clampProgress} from '../src/lib/statsDashboard.ts';

const when=new Date(2026,10,19,13,0,0); // Thursday, in the viewer's local timezone
const owner={id:'duel-1',occurredAt:new Date(2026,10,17,12,0).toISOString(),distanceM:50,
 timeMs:14521,stepsCount:52,measuredDistanceM:53.5,completed:true,
 outcome:'won',opponentTimeMs:15000};
const ghost={id:'ghost-1',created_at:new Date(2026,10,19,9,0).toISOString(),target_distance_m:75,
 run_state:'finished',elapsed_ms:20000,observed_distance_m:74.8,steps_count:60,motion_permission:'granted'};
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('daily stats chart shows only finished server-recorded runs (no stopped ghost or unpaired duel)',()=>{
 const data=calculateStatsOverview(
  [owner,{...owner,id:'invalid',completed:false,outcome:'pending',measuredDistanceM:900}],
  [ghost,{...ghost,id:'stopped',run_state:'stopped',observed_distance_m:1000}],when);
 assert.deepEqual(data.days.map(d=>d.label),['MO','DI','MI','DO','FR','SA','SO']);
 assert.deepEqual(data.days.map(d=>d.sessions),[0,1,0,1,0,0,0]);
 assert.equal(data.completedDuels,1);
 assert.equal(data.ghostTrainings,1);
 assert.equal(data.soloTrainings,1);
 assert.equal(data.wins,1);
 assert.equal(data.losses,0);
 assert.equal(data.activeDaysThisWeek,2);
 assert.equal(Math.round(data.weeklyMeasuredDistanceM*10),1283);
 assert.equal(Math.round(data.totalRecordedDistanceM*10),1283);
 assert.equal(data.bestTimes[50],14521);
});
test('missing GPS readings remain unknown; track target distance is never substituted',()=>{
 const data=calculateStatsOverview([{...owner,measuredDistanceM:null}],[],when);
 assert.equal(data.weeklyMeasuredDistanceM,null);
 assert.equal(data.totalRecordedDistanceM,null);
 assert.equal(data.days[1].sessions,1);
});
test('weekly activity excludes last week and streak is based on distinct local dates',()=>{
 const lastWeek={...owner,id:'last',occurredAt:new Date(2026,10,14,8).toISOString()};
 const yesterday={...owner,id:'yesterday',occurredAt:new Date(2026,10,18,8).toISOString()};
 const data=calculateStatsOverview([owner,yesterday,lastWeek],[],when);
 assert.equal(data.currentStreak,2); // Tuesday and Wednesday; no run yet Thursday
 assert.equal(data.activeDaysThisWeek,2);
 assert.equal(data.days.reduce((a,d)=>a+d.sessions,0),2);
});
test('records and formats are honest in empty and solo-only accounts',()=>{
 const data=calculateStatsOverview([],[],when);
 assert.equal(data.completedDuels,0);
 assert.equal(data.currentStreak,0);
 assert.equal(data.weeklyMeasuredDistanceM,null);
 assert.equal(data.bestTimes[75],null);
 assert.equal(formatStatsDistance(null),'—');
 assert.equal(formatStatsDistance(50),'0,05 km');
 assert.equal(formatStatsTime(13420),'00:13,42');
 assert.equal(formatStatsTime(125678),'02:05,68');
 assert.equal(formatStatsTime(null),'—');
 assert.equal(clampProgress(-1),0);
 assert.equal(clampProgress(1.3),1);
});
test('stats UI uses real image, dynamic Supabase data, and on-entry animated bars/gauge',()=>{
 const screen=read('src/screens/StatsScreen.tsx');
 const css=read('src/styles/statsPerformance.css');
 const goals=read('src/hooks/useStatsGoal.ts');
 const migration=read('supabase/migrations/20261119_001_runner_stats_preferences.sql');
 const art=readFileSync(new URL('../public/runnit-stats-stadium.webp',import.meta.url));
 assert.equal(art.toString('ascii',0,4),'RIFF');
 assert.equal(art.toString('ascii',8,12),'WEBP');
 assert.ok(art.length>20000);
 assert.match(css,/url\('\/runnit-stats-stadium\.webp'\)/);
 assert.match(css,/\.stats-v2-bar-fill[\s\S]*?transform:scaleY\(0\)/);
 assert.match(css,/\.stats-v2-stage\[data-active="true"\] \.stats-v2-bar-fill/);
 assert.match(css,/stats-v2-speed-needle[\s\S]*?transition:transform/);
 assert.match(screen,/requestAnimationFrame\(\(\)=>setActive\(true\)\)/);
 assert.match(screen,/strokeDashoffset/);
 assert.match(screen,/useRunnerHistory/);
 assert.match(screen,/history.totals|totals\.weeklySessions/);
 assert.match(screen,/<BottomNav\/>/);
 assert.match(goals,/from\('runner_stats_preferences'\)/);
 assert.match(goals,/\.upsert\(\{user_id:userId,weekly_distance_goal_m:next\}/);
 assert.match(migration,/enable row level security/i);
 assert.match(migration,/using \(user_id=\(select auth\.uid\(\)\)\)/);
 assert.doesNotMatch(css,/runnit-dock|runnit-showcase-home|runnit-legends/);
});

test('iPhone-mini STATS uses compact image-backed cards without touching other screens or shared dock',()=>{
 const css=read('src/styles/statsPerformance.css');
 const screen=read('src/screens/StatsScreen.tsx');
 const mobile=css.slice(css.lastIndexOf('iPhone mini / small-phone visual parity'));
 assert.match(mobile,/@media \(max-width:480px\)/);
 assert.match(mobile,/\.runnit-stats-v2 \.stats-v2-hero\s*\{[\s\S]*?17\.2dvh/);
 assert.match(mobile,/\.runnit-stats-v2 \.stats-v2-chart\s*\{[\s\S]*?height:69px/);
 assert.match(mobile,/\.runnit-stats-v2 \.stats-v2-tile\s*\{[\s\S]*?min-height:55px/);
 assert.match(mobile,/\.runnit-stats-v2 \.stats-v2-speed\s*\{max-width:111px/);
 assert.match(css,/runnit-stats-stadium\.webp/);
 assert.match(screen,/stats-v2-bar-fill/);
 assert.match(screen,/strokeDashoffset/);
 assert.match(screen,/<BottomNav\/>/);
 assert.doesNotMatch(mobile,/runnit-game-dock|runnit-dock-item|runnit-showcase-home|runnit-legends/);
});
test('goal editing and run archive remain accessible after compacting mobile STATS',()=>{
 const screen=read('src/screens/StatsScreen.tsx');
 assert.match(screen,/<details className="stats-v2-goal-details">/);
 assert.match(screen,/<summary>WOCHENZIEL ANPASSEN/);
 assert.match(screen,/await goal\.save\(goalDraft\)/);
 assert.match(screen,/stats-v2-goal-controls/);
 assert.match(screen,/<details className="stats-v2-panel stats-v2-history"/);
 assert.match(screen,/entries\.map\(e=>/);
 assert.match(screen,/useRunnerHistory\(userId\)/);
 assert.match(screen,/useStatsGoal\(userId\)/);
});

test('STATS short mobile viewport keeps five dashboard panels in compact hierarchy',()=>{
 const css=read('src/styles/statsPerformance.css');
 const pass=css.slice(css.lastIndexOf('RUNNIT MINI DENSE PASS'));
 const screen=read('src/screens/StatsScreen.tsx');
 assert.match(pass,/@media \(max-width:480px\) and \(max-height:900px\)/);
 assert.match(pass,/\.runnit-stats-v2 \.stats-v2-hero\s*\{[\s\S]*?height:clamp\(92px,12dvh,103px\)/);
 assert.match(pass,/\.runnit-stats-v2 \.stats-v2-tile\s*\{[\s\S]*?min-height:46px/);
 assert.match(pass,/\.runnit-stats-v2 \.stats-v2-chart\s*\{[\s\S]*?height:52px/);
 assert.match(pass,/\.runnit-stats-v2 \.stats-v2-compare-card\s*\{[\s\S]*?min-height:54px/);
 assert.match(pass,/\.runnit-stats-v2 \.stats-v2-record\s*\{[\s\S]*?min-height:38px/);
 assert.match(pass,/\.runnit-stats-v2 \.stats-v2-speed\s*\{max-width:92px/);
 for (const title of ['DIESE <span>WOCHE</span>','AKTIVITÄT','DUELLE <em>VS</em> SOLO','PERSÖNLICHE BESTZEITEN','AKTUELLE <em>FORM</em>']) {
   assert.ok(screen.includes(title), title+' remains in the main dashboard');
 }
});
test('STATS mini density preserves animated charts, server numbers, goal form, and shared dock',()=>{
 const css=read('src/styles/statsPerformance.css');
 const pass=css.slice(css.lastIndexOf('RUNNIT MINI DENSE PASS'));
 const screen=read('src/screens/StatsScreen.tsx');
 assert.doesNotMatch(pass,/runnit-(?:game-dock|dock-item|legends|showcase-home)/);
 assert.match(css,/stats-v2-stage\[data-active="true"\] \.stats-v2-bar-fill/);
 assert.match(css,/stats-v2-speed-needle[\s\S]*?transition:transform/);
 assert.match(screen,/useRunnerHistory\(userId\)/);
 assert.match(screen,/useStatsGoal\(userId\)/);
 assert.match(screen,/requestAnimationFrame\(\(\)=>setActive\(true\)\)/);
 assert.match(screen,/await goal\.save\(goalDraft\)/);
 assert.match(screen,/<details className="stats-v2-goal-details">/);
 assert.match(screen,/<details className="stats-v2-panel stats-v2-history"/);
 assert.match(screen,/<BottomNav\/>/);
});

test('STATS final iPhone mini pass keeps the form and animated gauge above the dock',()=>{
 const css=read('src/styles/statsPerformance.css');
 const pass=css.slice(css.lastIndexOf('FINAL MINI VERTICAL FIT'));
 const screen=read('src/screens/StatsScreen.tsx');
 assert.match(pass,/@media \(max-width:480px\) and \(max-height:900px\)/);
 assert.match(pass,/\.stats-v2-hero\s*\{[\s\S]*?height:clamp\(78px,9\.95dvh,86px\)/);
 assert.match(pass,/\.stats-v2-speed\s*\{\s*max-width:85px/);
 assert.match(pass,/\.stats-v2-goal-details:not\(\[open\]\)\s*\{[\s\S]*?position:absolute/);
 assert.match(pass,/\.stats-v2-goal-details\[open\]\s*\{[\s\S]*?position:static/);
 assert.match(screen,/stats-v2-speed-needle/);
 assert.match(screen,/strokeDashoffset/);
 assert.match(screen,/stats-v2-progress/);
 assert.match(screen,/<details className="stats-v2-goal-details">/);
 assert.match(screen,/await goal\.save\(goalDraft\)/);
 assert.match(screen,/<BottomNav\/>/);
 assert.doesNotMatch(pass,/runnit-game-dock|runnit-dock-item|runnit-showcase-home|runnit-legends/);
});

test('compact duel win-rate gains space without enlarging any STATS card',()=>{
 const css=read('src/styles/statsPerformance.css');
 const pass=css.slice(css.lastIndexOf('Mini STATS: read the four real duel results'));
 const screen=read('src/screens/StatsScreen.tsx');
 assert.match(pass,/@media \(max-width:480px\) and \(max-height:900px\)/);
 assert.match(pass,/\.stats-v2-compare-card:not\(\.stats-v2-compare-card--solo\) \.stats-v2-compare-values/);
 assert.match(pass,/minmax\(0,1\.49fr\)/);
 assert.match(pass,/padding-left:3px/);
 assert.match(pass,/font-size:clamp\(10px,2\.75vw,12px\)/);
 assert.match(pass,/white-space:nowrap/);
 assert.doesNotMatch(pass,/min-height|\.stats-v2-stage|\.stats-v2-panel\s*\{|\.stats-v2-hero\s*\{|\.stats-v2-speed\s*\{/);
 assert.doesNotMatch(pass,/BottomNav|runnit-game-dock|runnit-dock-item|runnit-legends|runnit-showcase-home/);
 assert.match(screen,/stats\.completedDuels/);
 assert.match(screen,/stats\.wins/);
 assert.match(screen,/stats\.losses/);
 assert.match(screen,/winRate\+'%'/);
});
