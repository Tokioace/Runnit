import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Home has one visual hero and no duplicate navigation grid', () => {
  const src = read('src/screens/DashboardScreen.tsx');
  const order = [
    'runnit-home-v2__hero', 'runnit-home-v2__score',
    'runnit-home-v2__start', 'runnit-home-v2__last',
    'runnit-home-v2__goal', 'runnit-home-v2__records', '<BottomNav'
  ];
  let position=-1;
  for (const term of order) {
    const next=src.indexOf(term);
    assert.ok(next > position, 'Correct layout ordering: '+term);
    position=next;
  }
  assert.doesNotMatch(src, /runnit-game-modes|runnit-game-mode|modes\.map/);
});

test('Home uses a reusable original clean portrait asset, not a screenshot with fake stats', () => {
  const src = read('src/screens/DashboardScreen.tsx');
  const css = read('src/styles/runnitHomeV2.css');
  assert.match(src, /src="\/runnit-home-half-face\.avif"/);
  assert.match(src, /runnit-metal-logo\.svg/);
  assert.match(css, /runnit-home-v2__portrait/);
  assert.match(css, /object-fit:\s*cover/);
  assert.doesNotMatch(src, /SubZero|Suiiilas|42,40 s|16\.11\.2026/);
});

test('Every Home number comes from authenticated server history, no fake stats', () => {
  const src = read('src/screens/DashboardScreen.tsx');
  assert.match(src, /useRunnerHistory\(userId\)/);
  assert.match(src, /totals\.wins/);
  assert.match(src, /totals\.completedDuels/);
  assert.match(src, /totals\.best50Ms/);
  assert.match(src, /totals\.best75Ms/);
  assert.match(src, /totals\.best100Ms/);
  assert.match(src, /races\.find\(race => race\.completed\)/);
  assert.match(src, /opponentName/);
  assert.match(src, /validData/);
  assert.doesNotMatch(src, /KALORIEN|SCHRITTE|XP NOCH NICHT|verifiedRanks/);
});

test('Guest and error states do not pretend to show recorded times', () => {
  const src = read('src/screens/DashboardScreen.tsx');
  assert.match(src, /\/login\?next=%2Fhome/);
  assert.match(src, /!userId \?/);
  assert.match(src, /loading \?/);
  assert.match(src, /error \?/);
  assert.match(src, /onClick=\{refresh\}/);
  assert.match(src, /validData \? showTime/);
});

test('The large start button and solo training use existing routes, not mocked functionality', () => {
  const src = read('src/screens/DashboardScreen.tsx');
  const app = read('src/App.tsx');
  assert.match(src, /to="\/map" className="runnit-home-v2__start"/);
  assert.match(src, /DUELL STARTEN/);
  assert.match(src, /to="\/ghost-run"/);
  assert.match(app, /path="\/ghost-run"/);
  assert.doesNotMatch(src, /navigator\.geolocation|submitDuelResult|\.insert\(/);
});

test('The personal goal is a milestone derived from real wins with an accessible bar', () => {
  const src = read('src/screens/DashboardScreen.tsx');
  assert.match(src, /Math\.floor\(wins \/ 5\)/);
  assert.match(src, /aria-valuenow=\{validData \? wins : 0\}/);
  assert.match(src, /role="progressbar"/);
  assert.match(src, /milestone \+ ' Siege erreichen'/);
});

test('All records link deep-links to the actual Records tab', () => {
  const src = read('src/screens/DashboardScreen.tsx');
  const board = read('src/screens/LeaderboardScreen.tsx');
  assert.match(src, /to="\/leaderboard\?tab=records"/);
  assert.match(board, /useSearchParams/);
  assert.match(board, /requestedTab==='records'/);
  assert.match(board, /list_beta_runnit_records/);
});

test('Home still has exactly one permanent five-destination bottom dock', () => {
  const src=read('src/screens/DashboardScreen.tsx');
  const nav=read('src/components/ui/BottomNav.tsx');
  assert.equal((src.match(/<BottomNav \/>/g)??[]).length,1);
  assert.match(nav, /grid-cols-5/);
  for(const path of ['/home','/map','/stats','/leaderboard','/profile'])
    assert.ok(nav.includes("href: '"+path+"'"),path);
  assert.match(nav,/aria-current/);
});

test('Hero, CTA, record strip and bottom navigation support compact mobile sizes', () => {
  const css=read('src/styles/runnitHomeV2.css');
  assert.match(css, /safe-area-inset-top/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /@media \(max-height: 720px\)/);
  assert.match(css, /@media \(max-width: 355px\)/);
  assert.match(css, /grid-template-columns: repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /runnit-home-v2__start:focus-visible/);
});

test('Home refreshes persisted results on request without altering races', () => {
  const src=read('src/screens/DashboardScreen.tsx');
  assert.match(src,/refresh \} = useRunnerHistory\(userId\)/);
  assert.match(src,/onClick=\{refresh\}/);
  assert.doesNotMatch(src,/supabase\.from|supabase\.rpc|setItem\(/);
});
