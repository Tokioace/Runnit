import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('Home keeps a focused order: hero, account, actions, recent persisted race', () => {
  const s=read('src/screens/DashboardScreen.tsx'); const a=['runnit-game-hero','runnit-game-hud','runnit-game-modes','runnit-game-duel','recent-race-title','runnit-game-start','<BottomNav']; let last=-1; for(const token of a){const n=s.indexOf(token);assert.ok(n>last,token);last=n;}
});
test('Home displays no simulated scores, repeat steps, calories or XP', () => {
  const s=read('src/screens/DashboardScreen.tsx'); assert.match(s,/useRunnerHistory\(userId\)/); assert.doesNotMatch(s,/KALORIEN|SCHRITTE|XP NOCH NICHT VERFÜGBAR|TurboKai|Stergios_R|SpeedKaze/);
});
test('five arcade dock destinations remain real and accessible', () => {
  const src = read('src/components/ui/BottomNav.tsx');
  assert.match(src, /grid-cols-5/);
  assert.match(src, /href: '\/home', label: 'Start'/);
  assert.match(src, /href: '\/map', label: 'Karte'/);
  assert.match(src, /href: '\/stats', label: 'Stats'/);
  assert.match(src, /aria-current/);
  assert.match(src, /aria-label=\{label\}/);
  assert.match(src, /min-w-0/);
});
test('dashboard theme is separate from preserved launch artwork', () => {
  const css = read('src/index.css');
  assert.match(css, /\.runnit-game-home/);
  assert.match(css, /\.runnit-game-mode\.is-lime/);
  assert.match(css, /\.runnit-game-dock/);
  assert.match(css, /overflow-x: clip/);
  assert.match(read('src/screens/HomeScreen.tsx'), /runnit-launch-portrait\.avif/);
});

test('Stats owns personal recorded metrics while Home only shows the last race', () => {
  const home=read('src/screens/DashboardScreen.tsx');const stats=read('src/screens/StatsScreen.tsx');const app=read('src/App.tsx');assert.match(home,/LETZTER LAUF/);assert.match(stats,/DIESE <span>WOCHE/);assert.match(stats,/DUELL-<span>BILANZ/);assert.match(app,/<StatsScreen userId=\{auth.user\?\.id\}/);
});


test('Home retains visual hero and artwork without fabricated rankings', () => {
  const s=read('src/screens/DashboardScreen.tsx');assert.match(s,/runnit-hero-portrait/);assert.match(s,/runnit-hero-glow/);assert.match(s,/runnit-metal-logo.svg/);assert.doesNotMatch(s,/runnit-game-ranks/);
});


test('Home maintains five real destinations and safe-area mobile spacing', () => {
  const s=read('src/screens/DashboardScreen.tsx');const dock=read('src/components/ui/BottomNav.tsx');assert.match(s,/safe-area-inset-top/);assert.match(s,/<BottomNav/);assert.match(dock,/grid-cols-5/);assert.doesNotMatch(s,/backgroundImage.*runnit-metal-logo/);
});


test('Home preserves an arcade layout with accessible race navigation', () => {
  const s=read('src/screens/DashboardScreen.tsx');assert.match(s,/runnit-game-duel/);assert.match(s,/runnit-game-hero/);assert.match(s,/aria-label="Auf der Karte ein 1v1 Duell suchen"/);assert.match(s,/runnit-game-start/);
});


test('Home shows one real recent race instead of empty ghost rows or fake positions', () => {
  const s=read('src/screens/DashboardScreen.tsx');assert.match(s,/last\.timeMs/);assert.match(s,/last\.completed/);assert.match(s,/SERVERGESPEICHERT/);assert.doesNotMatch(s,/runnit-arcade-ghost|verifiedRanks|verifiedRaces/);
});
