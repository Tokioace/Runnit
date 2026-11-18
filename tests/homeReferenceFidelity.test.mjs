import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const screen=readFileSync(new URL('../src/screens/DashboardScreen.tsx', import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles/homeShowcase.css', import.meta.url),'utf8');
const image=readFileSync(new URL('../public/runnit-home-half-face-v2.avif', import.meta.url));
test('the sharp background is a real AVIF asset',()=>{
 assert.ok(image.byteLength>=15000);
 assert.equal(image.toString('ascii',4,8),'ftyp');
 assert.match(css,/runnit-home-half-face-v2\.avif/);
 assert.match(css,/\.runnit-showcase-art \{[\s\S]*?filter:none;/);
});
test('logo remains sharp and does not use the earlier blur filter',()=>{
 assert.match(css,/\.runnit-showcase-brand img \{ filter:none; \}/);
});
test('solo training stays accessible but never pushes best times below the dock',()=>{
 assert.match(screen,/<Link to="\/ghost-run" className="runnit-showcase-solo">/);
 const a=screen.indexOf('className="runnit-showcase-cta"');
 const b=screen.indexOf('className="runnit-showcase-recent"');
 assert.ok(a>0&&b>a);
 assert.doesNotMatch(screen.slice(a,b),/GHOST RUN SOLO/);
});
test('compact sections fit on a normal mobile screen',()=>{
 assert.match(css,/\.runnit-showcase-scoreboard \{ min-height:49px/);
 assert.match(css,/\.runnit-showcase-cta \{ min-height:56px/);
 assert.match(css,/\.runnit-showcase-record \{ min-height:53px/);
 assert.match(css,/@media \(max-height:740px\)/);
});
test('real race data and five-tab navigation are preserved',()=>{
 assert.match(screen,/useRunnerHistory\(userId\)/);
 assert.match(screen,/races\.find\(race => race\.completed\)/);
 assert.match(screen,/totals\.best50Ms/);
 assert.match(screen,/<BottomNav\s*\/>/);
 assert.match(screen,/to="\/map"/);
 assert.match(screen,/to="\/leaderboard\?tab=records"/);
});
