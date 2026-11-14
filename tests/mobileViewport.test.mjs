import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('launch portrait fills narrow iPhone viewport with image-relative hit areas and no forced scroll', () => {
  const home = read('src/screens/HomeScreen.tsx');
  const css = read('src/index.css');
  assert.match(home, /h-\[100dvh\]/);
  assert.match(home, /runnit-launch-art relative aspect-\[941\/1672\]/);
  assert.match(home, /items-center justify-center overflow-hidden/);
  assert.match(css, /@media \(max-width: 640px\) and \(orientation: portrait\)/);
  assert.match(css, /width: max\(100vw, 56\.28dvh\)/);
  assert.doesNotMatch(home, /object-fill/);
});

test('iOS authentication fields do not trigger Safari focus zoom', () => {
  const css = read('src/index.css');
  const panel = read('src/components/profile/AccountAuthPanel.tsx');
  const html = read('index.html');
  assert.match(css, /@supports \(-webkit-touch-callout: none\)/);
  assert.match(css, /font-size: 16px !important/);
  assert.match(panel, /name="email"[\s\S]*?text-base text-white outline-none/);
  assert.match(panel, /name="password"[\s\S]*?text-base text-white outline-none/);
  assert.match(html, /initial-scale=1\.0/);
  assert.doesNotMatch(html, /user-scalable=no|maximum-scale=1/);
});

test('leaderboard header fits without breaking the word on small screens', () => {
  const frame = read('src/components/ui/PageFrame.tsx');
  const board = read('src/screens/LeaderboardScreen.tsx');
  assert.match(frame, /titleClassName\?: string/);
  assert.match(board, /titleClassName="whitespace-nowrap text-\[clamp/);
  assert.match(board, /title="Ranglisten\."/);
});

test('map controls and bottom navigation can shrink instead of widening the viewport', () => {
  const map = read('src/screens/MapScreen.tsx');
  const nav = read('src/components/ui/BottomNav.tsx');
  const css = read('src/index.css');
  assert.equal(map.match(/pointer-events-auto flex min-h-14 min-w-0 flex-1 items-center/g)?.length, 2);
  assert.match(nav, /<li key=\{href\} className="min-w-0">/);
  assert.match(nav, /whitespace-nowrap/);
  assert.match(css, /bottom: calc\(300px \+ env\(safe-area-inset-bottom, 0px\)\)/);
  assert.match(css, /overflow-x: clip/);
});
