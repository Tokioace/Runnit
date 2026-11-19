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