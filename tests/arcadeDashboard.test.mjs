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
  assert.match(src, /href: '\/home#aktivitaet'/);
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

test('Stats dock hash scrolls to actual activity panel', () => {
  const src = read('src/screens/DashboardScreen.tsx');
  assert.match(src, /useLocation\(\)/);
  assert.match(src, /location\.hash !== '#aktivitaet'/);
  assert.match(src, /scrollIntoView/);
});
