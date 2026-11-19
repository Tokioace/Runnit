import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('LEGENDS keeps real Supabase data and the shared dock',()=>{
 const source=read('src/screens/LeaderboardScreen.tsx');
 const dock=read('src/components/ui/BottomNav.tsx');
 const css=read('src/styles/legendsShowcase.css');
 assert.match(source,/<h1>LEGENDS<\/h1>/);
 assert.match(source,/list_beta_duel_leaderboard/);
 assert.match(source,/list_beta_runnit_records/);
 assert.match(source,/summarizeRivals/);
 assert.match(source,/history\.totals\.wins/);
 assert.match(source,/<BottomNav\/>/);
 assert.match(dock,/display: 'RANGLISTE'/);
 assert.match(css,/runnit-legends-hero\.webp/);
 assert.doesNotMatch(source,/Math\.random\(|#482/);
});
test('LEGENDS screenshot art stays visible and the route keeps real data',()=>{
 const css=read('src/styles/legendsShowcase.css');
 const screen=read('src/screens/LeaderboardScreen.tsx');
 assert.match(css,/url\('\/runnit-legends-hero\.webp'\)/);
 assert.match(css,/background-size:100% 100%/);
 assert.match(css,/runnit-legends-duel-left\.webp/);
 assert.match(css,/runnit-legends-duel-right\.webp/);
 assert.match(css,/mask-image:linear-gradient/);
 assert.match(css,/\.arena-showdown-person \.arena-avatar--large/);
 assert.match(css,/safe-area-inset-bottom|--arena-dock-reserve/);
 assert.match(screen,/rival\.wins/);
 assert.match(screen,/rival\.losses/);
});
test('LEGENDS dock caption appears only on leaderboard and other slots stay unchanged',()=>{
 const dock=read('src/components/ui/BottomNav.tsx');
 assert.match(dock,/active && href === '\/leaderboard' \? 'LEGENDS' : display/);
 for (const slot of ['HOME','KARTE','STATS','PROFIL']) assert.ok(dock.includes("display: '"+slot+"'"));
});

test('LEGENDS image composition keeps the three-column VS and opponent in column 3',()=>{
 const css=read('src/styles/legendsShowcase.css');
 const screen=read('src/screens/LeaderboardScreen.tsx');
 const title=read('public/runnit-legends-title.svg');
 const vs=read('public/runnit-legends-vs.svg');
 assert.match(css,/url\('\/runnit-legends-title\.svg'\)/);
 assert.match(css,/url\('\/runnit-legends-vs\.svg'\)/);
 assert.match(css,/\.arena-showdown-person:last-child\s*\{grid-column:3\}/);
 assert.match(css,/grid-template-columns:29% 42% 29%/);
 assert.match(css,/\.legends-showdown-art--left/);
 assert.match(css,/\.legends-showdown-art--right/);
 assert.match(title,/<svg[\s\S]*LEGENDS/);
 assert.match(vs,/<svg[\s\S]*VS/);
 assert.match(screen,/<strong>VS<\/strong>/);
 assert.match(screen,/rival\.wins/);
 assert.match(screen,/rival\.losses/);
});
test('LEGENDS changes do not import or style the Home screen',()=>{
 const css=read('src/styles/legendsShowcase.css');
 assert.doesNotMatch(css,/\.runnit-showcase-home|\.runnit-game-home/);
});

test('LEGENDS compact iPhone layout keeps the summary visible before the dock',()=>{
 const css=read('src/styles/legendsShowcase.css');
 assert.match(css,/iPhone 13 mini visual acceptance/);
 assert.match(css,/\.arena-rivals \.arena-duel-grid \{[\s\S]*?height:46px/);
 assert.match(css,/\.arena-rivals \.arena-self-strip \{[\s\S]*?height:47px/);
 assert.match(css,/\.arena-rivals \.arena-showdown \{[\s\S]*?17\.2dvh/);
 assert.match(css,/\.arena-hero h1 \{\s*bottom:-28px/);
});

test('LEGENDS final iPhone fix preserves complete totals above dock',()=>{
  const css=read('src/styles/legendsShowcase.css');
  const last=css.slice(css.lastIndexOf('Final LEGENDS iPhone layout fix'));
  assert.match(last,/\.arena-rivals \.arena-showdown \{[\s\S]*?15\.7dvh/);
  assert.match(last,/\.arena-rivals \.arena-duel-grid \{[\s\S]*?height: 42px/);
  assert.match(last,/\.arena-rivals \.arena-self-strip \{[\s\S]*?height: 40px/);
  assert.doesNotMatch(last,/\.runnit-game-dock\s*\{/); // shared dock owns its own sizing
  assert.match(last,/safe-area-inset-bottom/);
  const screen=read('src/screens/LeaderboardScreen.tsx');
  assert.match(screen,/history\.totals\.completedDuels/);
  assert.match(screen,/history\.totals\.wins/);
  assert.match(screen,/history\.totals\.losses/);
  assert.doesNotMatch(last,/runnit-showcase|runnit-game-home/);
});

test('LEGENDS reuses the global bottom dock appearance without route-specific overrides',()=>{
 const css=read('src/styles/legendsShowcase.css');
 const nav=read('src/components/ui/BottomNav.tsx');
 const screen=read('src/screens/LeaderboardScreen.tsx');
 assert.doesNotMatch(css,/\.runnit-(?:competition\.runnit-)?legends\s+\.runnit-(?:game-dock|dock-item|dock-caption)/);
 assert.match(screen,/<BottomNav\s*\/>/);
 assert.match(nav,/runnit-game-dock fixed inset-x-0 bottom-0/);
 assert.match(nav,/runnit-dock-active text-cyan-100/);
 assert.match(nav,/active && href === '\/leaderboard' \? 'LEGENDS' : display/);
});


test('LEGENDS approved imagery is sourced from image assets, not rebuilt CSS text',()=>{
 const css=read('src/styles/legendsShowcase.css');
 const last=css.slice(css.lastIndexOf('ARTWORK PARITY PASS'));
 const wordmark=read('public/runnit-legends-reference-wordmark.svg');
 const banner=read('public/runnit-legends-reference-rivals.svg');
 const versus=read('public/runnit-legends-reference-versus.svg');
 const laurels=read('public/runnit-legends-laurels.svg');
 assert.match(last,/runnit-legends-reference-wordmark\.svg/);
 assert.match(last,/runnit-legends-reference-rivals\.svg/);
 assert.match(last,/runnit-legends-reference-versus\.svg/);
 assert.match(last,/runnit-legends-duel-left\.webp/);
 assert.match(last,/runnit-legends-duel-right\.webp/);
 assert.match(last,/runnit-legends-laurels\.svg/);
 assert.match(wordmark,/viewBox="0 0 708 142"/);
 assert.match(banner,/viewBox="0 0 708 64"/);
 assert.match(versus,/viewBox="0 0 175 119"/);
 assert.match(laurels,/viewBox="0 0 708 105"/);
 assert.doesNotMatch(last,/\.runnit-(?:competition\.runnit-)?legends\s+\.runnit-(?:game-dock|dock-item|dock-caption)/);
});
test('LEGENDS live match data and shared dock are not replaced by background artwork',()=>{
 const screen=read('src/screens/LeaderboardScreen.tsx');
 const dock=read('src/components/ui/BottomNav.tsx');
 const css=read('src/styles/legendsShowcase.css');
 assert.match(screen,/rival\.wins/);
 assert.match(screen,/rival\.losses/);
 assert.match(screen,/history\.totals\.completedDuels/);
 assert.match(screen,/history\.totals\.wins/);
 assert.match(screen,/history\.totals\.losses/);
 assert.match(screen,/to="\/map"/);
 assert.match(screen,/<BottomNav\/>/);
 assert.match(dock,/runnit-dock-active text-cyan-100/);
 assert.doesNotMatch(css,/\.runnit-showcase-home|\.runnit-game-home/);
});
