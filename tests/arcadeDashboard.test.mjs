import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('Home has the exact reference-led hierarchy without duplicate navigation boxes', () => {
 const s=read('src/screens/DashboardScreen.tsx');
 const order=['runnit-showcase-hero','runnit-showcase-scoreboard','runnit-showcase-cta','recent-race-title','runnit-showcase-goal','home-records-title','<BottomNav'];
 let last=-1;
 for(const token of order){const n=s.indexOf(token);assert.ok(n>last,token);last=n;}
 assert.doesNotMatch(s,/runnit-game-modes|modes\.map|AKTIVITÄT/);
});
test('Home uses only persisted completed duels and no fake steps, calories or points', () => {
 const s=read('src/screens/DashboardScreen.tsx');
 assert.match(s,/useRunnerHistory\(userId\)/);
 assert.match(s,/races\.find\(race => race\.completed\)/);
 assert.match(s,/totals\.completedDuels/);
 assert.match(s,/totals\.wins/);
 assert.match(s,/totals\.best50Ms/);
 assert.doesNotMatch(s,/KALORIEN|SCHRITTE|XP NOCH NICHT VERFÜGBAR|TurboKai|Stergios_R|SpeedKaze|Suiiilas|42,40/);
});
test('Home shows error, loading, guest and real data states instead of fake zeros', () => {
 const s=read('src/screens/DashboardScreen.tsx');
 assert.match(s,/ready = Boolean\(userId\) && !loading && !error/);
 assert.match(s,/onClick=\{refresh\}/);
 assert.match(s,/!userId \?/);
 assert.match(s,/SERVERGESPEICHERT/);
 assert.match(s,/completed\.opponentName/);
 assert.match(s,/completed\.timeMs/);
});
test('The only primary CTA leads to the real map, and records opens the records tab', () => {
 const s=read('src/screens/DashboardScreen.tsx');
 const board=read('src/screens/LeaderboardScreen.tsx');
 assert.match(s,/<Link to="\/map" className="runnit-showcase-cta"/);
 assert.match(s,/\/leaderboard\?tab=records/);
 assert.match(board,/new URLSearchParams\(location\.search\)\.get\('tab'\) === 'records'/);
 assert.match(s,/<BottomNav/);
 assert.match(read('src/components/ui/BottomNav.tsx'),/grid-cols-5/);
});
test('The half-face hero is one decorative asset, with editable live DOM and safe-area spacing', () => {
 const s=read('src/screens/DashboardScreen.tsx');
 const css=read('src/styles/homeShowcase.css');
 assert.match(s,/runnit-showcase-art/);
 assert.match(s,/runnit-metal-logo\.svg/);
 assert.match(css,/runnit-home-half-face\.avif/);
 assert.match(css,/safe-area-inset-top/);
 assert.match(css,/safe-area-inset-bottom/);
 assert.match(s,/aria-expanded=\{messagesOpen\}/);
});
test('Stats still owns personal weekly steps, and five bottom navigation links remain', () => {
 const home=read('src/screens/DashboardScreen.tsx');
 const stats=read('src/screens/StatsScreen.tsx');
 const app=read('src/App.tsx');
 assert.match(home,/LETZTES DUELL/);
 assert.match(stats,/DIESE <span>WOCHE/);
 assert.match(stats,/DUELL-<span>BILANZ/);
 assert.match(app,/<StatsScreen userId=\{auth.user\?\.id\}/);
 assert.doesNotMatch(home,/SCHRITTE|KALORIEN|runnit-game-activity/);
});
