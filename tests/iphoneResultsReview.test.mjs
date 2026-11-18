import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('ranking and profile updates synchronize the same real nickname',()=>{
 const code=read('src/hooks/useSupabaseUser.ts');
 const sql=read('supabase/migrations/20261118094751_sync_public_display_names_20261118.sql');
 assert.match(code,/supabase\.auth\.updateUser\(\{ data: \{ display_name: nickname \} \}\)/);
 assert.match(code,/\.update\(\{ username: nickname \}\)\.eq\('id', data\.user\.id\)/);
 assert.match(code,/synced\.error/);
 assert.match(sql,/FROM auth\.users AS a/);
 assert.match(sql,/p\.id = a\.id/);
});

test('iPhone distance options and rank filters never rely on implicit minimum widths',()=>{
 const ghost=read('src/styles/ghostRun.css');
 const ranking=read('src/styles/leaderboardArcade.css');
 assert.match(ghost,/\.runnit-ghost-targets button\{min-width:0;width:100%/);
 assert.match(ghost,/\.runnit-ghost-top>span:nth-child\(2\)\{min-width:0/);
 assert.match(ranking,/\.runnit-ranking-points\{flex-direction:column/);
});

test('measured times, kilometer and seconds unit stay together on narrow screens',()=>{
 const stats=read('src/screens/StatsScreen.tsx');
 assert.match(stats,/whitespace-nowrap.*tabular-nums/);
});

test('run history has a distinct home preview and avoids redundant developer notices',()=>{
 const home=read('src/screens/DashboardScreen.tsx');
 const stats=read('src/screens/StatsScreen.tsx');
 const board=read('src/screens/LeaderboardScreen.tsx');
 assert.match(home,/LETZTES DUELL/);
 assert.doesNotMatch(stats,/erfundenen Kalorien|Demo-Punkte/);
 assert.doesNotMatch(board,/Keine Demo-Namen, keine erfundenen Punkte/);
 assert.match(board,/races_count/);
});

test('Profile does not duplicate permanent Stats or Ranking tabs',()=>{
 const p=read('src/screens/ProfileScreen.tsx');
 assert.doesNotMatch(p,/id="profile-links"|DEIN RUNNIT/);
 assert.match(p,/<AccountDetailsPanel/);
 assert.ok(p.indexOf('id="konto"') < p.indexOf('id="visibility-title"'));
});
