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
  assert.match(src, /KEINE DATEN/);
  assert.match(src, /XP NOCH NICHT VERFÜGBAR/);
  assert.match(src, /NOCH KEINE/);
});
test('three arcade dock destinations remain real and accessible', () => {
  const src = read('src/components/ui/BottomNav.tsx');
  assert.match(src, /arena-global-dock/);
  assert.match(src, /href: '\/home', label: 'PLAY'/);
  assert.match(src, /href: '\/map', label: 'MAP'/);
  assert.match(src, /href: '\/leaderboard', label: 'ARENA'/);
  assert.match(src, /aria-current/);
  assert.match(src, /aria-label=\{label\}/);
  assert.match(read('src/styles/arenaArcade.css'), /\.arena-global-dock li\{min-width:0\}/);
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
  assert.doesNotMatch(nav, /href: '\/stats'/);
  assert.match(home, /to: '\/stats'/);
  assert.doesNotMatch(nav, /home#aktivitaet/);
  assert.match(stats, /WOCHENFORTSCHRITT/);
  assert.match(stats, /BESTWERTE/);
  assert.match(stats, /<BottomNav/);
  assert.doesNotMatch(stats, /watchPosition|navigator\.geolocation|submitDuelResult/);
});


test('art pass uses separate illustration layers instead of embedding fake scores', () => {
  const home = read('src/screens/DashboardScreen.tsx');
  const css = read('src/index.css');
  for (const asset of ['runnit-metal-logo.svg','runnit-runner-mark.svg']) {
    assert.ok(home.includes(asset));
    assert.match(read('public/' + asset), /<svg/);
  }
  for (const asset of ['runnit-arcade-city.svg','runnit-duel-art.svg']) {
    assert.ok(css.includes(asset));
    assert.match(read('public/' + asset), /viewBox/);
  }
  assert.match(home, /runnit-hero-portrait/);
  assert.match(home, /runnit-stat-glyph/);
  assert.match(css, /20dvh/);
  assert.doesNotMatch(read('public/runnit-duel-art.svg'), /76\.420|38\.420|TurboKai/);
});


test('real iPhone screenshot follow-up keeps full dock names and fixes artwork duplication', () => {
  const nav = read('src/components/ui/BottomNav.tsx');
  const home = read('src/screens/DashboardScreen.tsx');
  const css = read('src/index.css');
  assert.match(nav, /arena-global-dock/);
  assert.doesNotMatch(nav, /className="block max-w-full truncate"/);
  assert.match(nav, /label: 'ARENA'/);
  assert.match(home, /KEINE DATEN/);
  assert.match(css, /background-position: 63% 29%/);
  assert.match(css, /\.runnit-stats-screen::before/);
  assert.match(css, /url\('\/runnit-arcade-city\.svg'\)/);
  assert.match(css, /\.runnit-stats-hero h1 span/);
  assert.match(css, /\.runnit-stats-gauge \{/);
  assert.match(css, /#46638d 0deg 360deg/);
});


test('master reference layout is compact without flattened UI and preserves safe controls', () => {
  const main = read('src/main.tsx');
  const css = read('src/styles/runnitMaster.css');
  const home = read('src/screens/DashboardScreen.tsx');
  const nav = read('src/components/ui/BottomNav.tsx');
  assert.match(main, /import '\.\/styles\/runnitMaster\.css'/);
  assert.match(home, /runnit-dash-master/);
  assert.match(css, /max-width:540px/);
  assert.match(css, /min-height: 126px/); // compact hero
  assert.match(css, /min-height:64px/); // live player HUD
  assert.match(css, /min-height:54px/); // real mode links
  assert.match(css, /min-height:69px/); // stat instruments
  assert.match(css, /min-height:72px/); // original art-backed duel
  assert.match(css, /min-height:60px/); // real start CTA
  assert.match(css, /min-height:55px/); // five-label dock
  assert.match(nav, /label: 'ARENA'/);
  assert.doesNotMatch(home, /<canvas|<map name=/);
  assert.match(home, /runnit-game-start group/);
  assert.match(home, /XP NOCH NICHT VERFÜGBAR/);
});


test('three preview slots preserve the master composition with no invented records', () => {
  const home = read('src/screens/DashboardScreen.tsx');
  const css = read('src/styles/runnitMaster.css');
  assert.match(home, /type VerifiedRacePreview/);
  assert.match(home, /type VerifiedRankPreview/);
  assert.match(home, /recentRaces = \[\], rankings = \[\]/);
  assert.match(home, /source === 'verified'/);
  assert.match(home, /runnit-arcade-races/);
  assert.match(home, /runnit-arcade-ranking/);
  assert.match(home, /NOCH KEINE VERIFIZIERTEN RENNEN/);
  assert.match(home, /NOCH KEINE OFFIZIELLEN PLÄTZE/);
  assert.match(home, /aria-hidden="true"/);
  assert.match(css, /\.runnit-arcade-ghost/);
  assert.match(css, /\.runnit-game-start::before/);
  assert.match(css, /runnit-game-duel/);
  assert.match(read('public/runnit-arcade-city.svg'), /<text/);
  assert.match(read('public/runnit-duel-art.svg'), /<text/);
  assert.doesNotMatch(home, /TurboKai|Stergios_R|76\.420|5\.420/);
});
