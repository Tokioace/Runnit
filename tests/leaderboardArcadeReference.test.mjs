import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('Leaderboard keeps arcade shell and normal navigation, without generic PageFrame', () => {
  const s=read('src/screens/LeaderboardScreen.tsx');assert.match(s,/arena-screen runnit-competition/);assert.match(s,/arena-board-list/);assert.match(s,/<BottomNav/);assert.doesNotMatch(s,/<PageFrame/);
});

test('Leaderboard removes all fictional names, levels and fantasy points', () => {
  const s=read('src/screens/LeaderboardScreen.tsx');assert.doesNotMatch(s,/SpeedKaze|NightRunner|AeroFox|RunHikari|showcase|Demo-Punkte|Demo-Level/);assert.match(s,/list_beta_duel_leaderboard/);
});

test('Leaderboard uses meaningful wins and independent distance rankings', () => {
  const s=read('src/screens/LeaderboardScreen.tsx');for(const x of ['RIVALEN','RANGLISTE','REKORDE','50,75,100'])assert.ok(s.includes(x),x);assert.match(s,/role="tablist"/);assert.match(s,/aria-selected/);assert.doesNotMatch(s,/friends|region|Freunde|FRIENDS/);
});

test('avatar art and skyline are local static assets, no remote profile data or photo permissions', () => {
  const avatar = read('src/components/leaderboard/ArcadeAvatar.tsx');
  const screen = read('src/screens/LeaderboardScreen.tsx');
  const css = read('src/styles/leaderboardArcade.css');
  for (const variant of ['speed','night','aero','player','hikari']) {
    assert.match(avatar, new RegExp('\\b' + variant + ':'));
  }
  assert.match(avatar, /viewBox="0 0 88 88"/);
  assert.match(css, /background:url\('\/runnit-ranking-city\.svg'\)/);
  assert.doesNotMatch(avatar, /fetch\(|https?:\/\//);
  assert.doesNotMatch(screen, /Date\.now\(\)|Math\.random\(\)/);
});

test('Leaderboard and Stats reuse the five-slot navigation dock', () => {
  const dock=read('src/components/ui/BottomNav.tsx');assert.match(dock,/grid-cols-5/);assert.match(dock,/aria-current/);for(const page of ['LeaderboardScreen','StatsScreen','ProfileScreen','DashboardScreen'])assert.match(read('src/screens/'+page+'.tsx'),/<BottomNav/);
});

test('guests can browse only opted-in public results without an account', () => {
  const page=read('src/screens/LeaderboardScreen.tsx');
  const sql=read('supabase/migrations/20261118092642_runnit_public_opt_in_beta_ranking_20261118.sql');
  assert.match(page,/list_beta_duel_leaderboard/);
  assert.doesNotMatch(page,/if \(!userId\) \{[^\n]*return;/);
  assert.match(sql,/u\.leaderboard_opt_in IS TRUE/);
  assert.match(sql,/TO authenticated, anon/);
});

test('three live competition tabs retain the five-slot dock without an internal Arena route', () => {
  const css=read('src/styles/runnitCompetition.css');
  const screen=read('src/screens/LeaderboardScreen.tsx');
  const app=read('src/App.tsx');
  assert.match(screen,/RIVALEN/);assert.match(screen,/RANGLISTE/);assert.match(screen,/REKORDE/);
  assert.match(screen,/list_beta_runnit_records/);assert.match(screen,/summarizeRivals/);
  assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(screen,/aria-selected/);assert.match(screen,/<BottomNav/);
  assert.doesNotMatch(screen,/>ARENA</);
  assert.match(app,/displayName=\{auth.user\?\.displayName\}/);
});
