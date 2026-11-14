import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('arcade dashboard sections follow the approved master order', () => {
  const src = read('src/screens/DashboardScreen.tsx');
  const sections = ['runnit-game-hero', 'runnit-game-ranks', 'runnit-game-hud', 'runnit-game-modes', 'id="aktivitaet"', 'runnit-game-duel', 'recent-races-title', 'ranking-title', 'runnit-game-start', '<BottomNav'];
  let last = -1;
  for (const section of sections) { const found = src.indexOf(section); assert.ok(found > last, section); last = found; }
  assert.match(src, /DEIN LAUF\./);
  assert.match(src, /displayName/);
  assert.doesNotMatch(src, /from [\'"][^\'"]*supabase/i);
  assert.doesNotMatch(src, /watchPosition|navigator\.geolocation|submitDuelResult/);
});
test('arcade dashboard uses no fictional verified activity or ranking values', () => {
  const src = read('src/screens/DashboardScreen.tsx');
  for (const v of ['76.420','38.420','TurboKai','Stergios_R','4.890','260.320']) assert.ok(!src.includes(v), v);
  assert.match(src, /NICHT VERBUNDEN/);
  assert.match(src, /XP NOCH NICHT VERFÜGBAR/);
  assert.match(src, /NOCH KEINE/);
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

test('Stats is a separate accessible route and does not reuse Home', () => {
  const app = read('src/App.tsx');
  const nav = read('src/components/ui/BottomNav.tsx');
  const home = read('src/screens/DashboardScreen.tsx');
  const stats = read('src/screens/StatsScreen.tsx');
  assert.match(app, /<Route path="\/stats" element=\{<StatsScreen \/>\}/);
  assert.match(app, /APP_PATHS.*'\/stats'/);
  assert.match(nav, /href: '\/stats', label: 'Stats'/);
  assert.match(home, /to: '\/stats'/);
  assert.doesNotMatch(nav, /home#aktivitaet/);
  assert.match(stats, /WOCHENFORTSCHRITT/);
  assert.match(stats, /BESTWERTE/);
  assert.match(stats, /<BottomNav/);
  assert.doesNotMatch(stats, /watchPosition|navigator\.geolocation|submitDuelResult/);
});
