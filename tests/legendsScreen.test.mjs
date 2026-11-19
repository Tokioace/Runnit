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


test('LEGENDS renders the approved wordmark, banner, Zak, Zoe and VS as real WebP artwork',()=>{
 const css=read('src/styles/legendsShowcase.css');
 const pass=css.slice(css.lastIndexOf('EXACT REFERENCE PHOTO PASS'));
 const assets=[
  'runnit-legends-wordmark-photo.webp',
  'runnit-legends-rivals-photo.webp',
  'runnit-legends-zak-photo.webp',
  'runnit-legends-zoe-photo.webp',
  'runnit-legends-versus-photo.webp'
 ];
 for(const asset of assets){
  const binary=readFileSync(new URL('../public/'+asset,import.meta.url));
  assert.equal(binary.toString('ascii',0,4),'RIFF');
  assert.equal(binary.toString('ascii',8,12),'WEBP');
  assert.ok(binary.length>1000,'real image bytes present: '+asset);
  assert.ok(pass.includes("url('/"+asset+"')"),'actual photo crop used in final layer: '+asset);
 }
 assert.match(pass,/mask-image:none/);
 assert.match(pass,/background-size:100% 100%/);
});
test('LEGENDS precise picture layers never change the shared menu or hardcode race scores',()=>{
 const css=read('src/styles/legendsShowcase.css');
 const pass=css.slice(css.lastIndexOf('EXACT REFERENCE PHOTO PASS'));
 const screen=read('src/screens/LeaderboardScreen.tsx');
 assert.doesNotMatch(pass,/\.runnit-(?:competition\.runnit-)?legends\s+\.runnit-(?:game-dock|dock-item|dock-caption)/);
 assert.doesNotMatch(pass,/runnit-showcase-home|runnit-game-home/);
 assert.match(screen,/rival\.wins/);
 assert.match(screen,/rival\.losses/);
 assert.match(screen,/history\.totals\.completedDuels/);
 assert.match(screen,/<BottomNav\/>/);
 assert.match(pass,/arena-rematch/);
});

test('LEGENDS polish places compact laurels outside live statistic labels',()=>{
 const css=read('src/styles/legendsShowcase.css');
 const pass=css.slice(css.lastIndexOf('FINAL REFERENCE CLEANUP'));
 const laurels=read('public/runnit-legends-laurels-compact.svg');
 assert.match(pass,/url\('\/runnit-legends-laurels-compact\.svg'\)/);
 assert.match(pass,/\.arena-self-strip::before,[\s\S]*?\.arena-self-strip::after\s*\{\s*content:none;/);
 assert.match(laurels,/viewBox="0 0 708 105"/);
 assert.doesNotMatch(laurels,/<text\b/);
 const screen=read('src/screens/LeaderboardScreen.tsx');
 assert.match(screen,/history\.totals\.completedDuels/);
 assert.match(screen,/history\.totals\.wins/);
 assert.match(screen,/history\.totals\.losses/);
});
test('LEGENDS artwork polish cannot cover real VS results or change the shared dock',()=>{
 const css=read('src/styles/legendsShowcase.css');
 const pass=css.slice(css.lastIndexOf('FINAL REFERENCE CLEANUP'));
 const grit=read('public/runnit-legends-duel-grit.svg');
 const brush=read('public/runnit-legends-street-brush.svg');
 assert.match(pass,/url\('\/runnit-legends-duel-grit\.svg'\)/);
 assert.match(pass,/z-index:2/);
 assert.match(pass,/pointer-events:none/);
 assert.match(pass,/url\('\/runnit-legends-street-brush\.svg'\)/);
 assert.match(pass,/\.arena-rematch/);
 assert.match(grit,/<svg[\s\S]*<mask/);
 assert.match(brush,/viewBox="0 0 708 390"/);
 assert.doesNotMatch(pass,/\.runnit-(?:competition\.runnit-)?legends\s+\.runnit-(?:game-dock|dock-item|dock-caption)/);
 assert.doesNotMatch(pass,/runnit-showcase-home|runnit-game-home/);
});

test('LEGENDS final graphic pass uses reference-traced VS instead of skewed type',()=>{
 const css=read('src/styles/legendsShowcase.css');
 const layer=css.slice(css.lastIndexOf('LEGENDS FINAL GRAPHIC PARITY'));
 const vs=read('public/runnit-legends-vs-refined.svg');
 assert.match(layer,/runnit-legends-vs-refined\.svg/);
 assert.match(vs,/Two paint silhouettes traced from the approved reference/);
 assert.match(layer,/\.arena-versus strong\s*\{[\s\S]*?transform:none/);
 assert.match(layer,/\.arena-versus b/);
 const screen=read('src/screens/LeaderboardScreen.tsx');
 assert.match(screen,/rival\.wins/);
 assert.match(screen,/rival\.losses/);
});
test('LEGENDS NEUES DUELL remains an actual map link with the angled graphic CTA',()=>{
 const css=read('src/styles/legendsShowcase.css');
 const layer=css.slice(css.lastIndexOf('LEGENDS FINAL GRAPHIC PARITY'));
 const art=read('public/runnit-legends-cta-plate.svg');
 const screen=read('src/screens/LeaderboardScreen.tsx');
 assert.match(art,/Entire angular|Correct angular board/);
 assert.match(art,/<path d="M53 8L619 8L584 87L8 87Z"/);
 assert.match(layer,/url\('\/runnit-legends-cta-plate\.svg'\)/);
 assert.match(layer,/\.arena-rematch::after\s*\{\s*content:none/);
 assert.match(screen,/<Link className="arena-rematch" to="\/map">/);
});
test('LEGENDS metallic scorecard keeps metrics live and excludes shared navigation',()=>{
 const css=read('src/styles/legendsShowcase.css');
 const layer=css.slice(css.lastIndexOf('LEGENDS FINAL GRAPHIC PARITY'));
 const metal=read('public/runnit-legends-stats-metal.svg');
 const screen=read('src/screens/LeaderboardScreen.tsx');
 assert.match(layer,/url\('\/runnit-legends-stats-metal\.svg'\)/);
 assert.match(layer,/url\('\/runnit-legends-laurels-compact\.svg'\)/);
 assert.match(metal,/id="engrave"/);
 assert.match(metal,/id="scratch"/);
 for(const key of ['completedDuels','wins','losses'])assert.ok(screen.includes('history.totals.'+key));
 assert.doesNotMatch(layer,/\.runnit-(?:competition\.runnit-)?legends\s+\.runnit-(?:game-dock|dock-item|dock-caption)/);
 assert.doesNotMatch(layer,/runnit-showcase-home|runnit-game-home/);
});
