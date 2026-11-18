import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const screen=readFileSync(new URL('../src/screens/DashboardScreen.tsx', import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles/homeShowcase.css', import.meta.url),'utf8');
const image=readFileSync(new URL('../public/runnit-home-half-face-v2.avif', import.meta.url));

test('high-resolution runner portrait is a real, independently decoded image asset',()=>{
 assert.ok(image.byteLength >= 15000, 'Hero image should not be a low resolution placeholder');
 assert.equal(image.toString('ascii',4,8), 'ftyp');
 assert.match(css,/runnit-home-half-face-v2\.avif/);
 assert.match(css,/\.runnit-showcase-art \{[\s\S]*?filter: none;/);
});
test('no blur filter on real RUNNIT vector logo',()=>{
 assert.match(css,/\.runnit-showcase-brand img \{\s*filter: none;/);
});
test('solo run remains accessible, but no redundant link pushes personal records under the dock',()=>{
 assert.match(screen,/<Link to="\/ghost-run" className="runnit-showcase-solo">/);
 const cta=screen.indexOf('className="runnit-showcase-cta"');
 const recent=screen.indexOf('className="runnit-showcase-recent"');
 assert.ok(cta>0 && recent>cta);
 assert.doesNotMatch(screen.slice(cta,recent),/GHOST RUN SOLO/);
});
test('compact cards use bounded sizes at 812px and smaller',()=>{
 assert.match(css,/\.runnit-showcase-scoreboard \{\s*min-height: 49px;/);
 assert.match(css,/\.runnit-showcase-recent \{ min-heig¶»§q«^