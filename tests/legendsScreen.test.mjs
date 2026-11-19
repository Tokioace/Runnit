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

test('LEGENDS uses dedicated image layers without touching Home',()=>{
 const source=read('src/screens/LeaderboardScreen.tsx');
 const home=read('src/screens/DashboardScreen.tsx');
 const css=read('src/styles/legendsShowcase.css');
 assert.ok(source.includes('className="legends-hero-image" src="/runnit-legends-hero.webp"'));
 assert.ok(source.includes('className="legends-showdown-art legends-showdown-art--left"'));
 assert.ok(source.includes('className="legends-showdown-art legends-showdown-art--right"'));
 assert.ok(css.includes('grid-column:2'));
 assert.ok(css.includes('.arena-showdown-person:last-child {grid-column:3'));
 assert.ok(home.includes('runnit-showcase-home'));
});
