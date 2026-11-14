import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('iPhone portrait launch fills viewport without stretching or moving its hotspots', () => {
  const screen = read('src/screens/HomeScreen.tsx');
  const css = read('src/index.css');
  assert.match(screen, /runnit-launch-screen/);
  assert.match(screen, /h-\[100dvh\]/);
  assert.match(screen, /runnit-launch-art/);
  assert.match(screen, /aspect-\[941\/1672\]/);
  assert.match(screen, /object-contain/);
  assert.doesNotMatch(screen, /object-fill/);
  assert.match(css, /@media \(max-width: 640px\) and \(orientation: portrait\)/);
  assert.match(css, /width: max\(100vw, calc\(100dvh \* 0\.5628\)\)/);
  assert.match(css, /transform: translateX\(-50%\)/);
});

test('focused iOS form fields avoid automatic zoom while pinch zoom remains available', () => {
  const html = read('index.html');
  const css = read('src/index.css');
  assert.match(html, /initial-scale=1\.0/);
  assert.doesNotMatch(html, /user-scalable=no|maximum-scale=1/);
  assert.match(css, /pointer: coarse/);
  assert.match(css, /#root input:not/);
  assert.match(css, /font-size: 16px !important/);
});

test('page titles, navigation and map CTAs respect narrow mobile widths', () => {
  const css = read('src/index.css');
  const frame = read('src/components/ui/PageFrame.tsx');
  const nav = read('src/components/ui/BottomNav.tsx');
  const map = read('src/screens/MapScreen.tsx');
  const app = read('src/App.tsx');
  assert.match(css, /overflow-x: clip/);
  assert.match(frame, /break-normal/);
  assert.doesNotMatch(frame, /break-words/);
  assert.match(nav, /max-w-full overflow-hidden/);
  assert.match(nav, /min-w-0/);
  assert.match(map, /basis-0 flex-1/);
  assert.match(app, /window\.scrollTo\(0, 0\)/);
});


test('account form fonts remain 16px without depending only on focus CSS', () => {
  const panel = read('src/components/profile/AccountAuthPanel.tsx');
  assert.equal(panel.match(/px-4 py-3 text-base text-white outline-none/g)?.length, 3);
  assert.match(panel, /id="account-email"/);
  assert.match(panel, /id="account-password"/);
  assert.match(panel, /id="account-nickname"/);
});

test('the unmodified portrait launch remains viewport-filling while wide art is centered', () => {
  const launch = read('src/screens/HomeScreen.tsx');
  const css = read('src/index.css');
  assert.match(launch, /h-full w-full flex-col items-center justify-center overflow-hidden/);
  assert.match(css, /\.runnit-launch-art/);
  assert.match(css, /height: 100dvh/);
});

test('map status messages respect iOS top safe area and race icon stays legible', () => {
  const map = read('src/screens/MapScreen.tsx');
  assert.equal(map.match(/top-\[calc\(5\.5rem\+env\(safe-area-inset-top\)\)\]/g)?.length, 2);
  assert.equal(map.match(/max-w-\[calc\(100%-2rem\)\]/g)?.length, 2);
  assert.match(map, /<Trophy className="h-5 w-5 shrink-0"/);
  assert.match(map, /basis-0 flex-1 items-center/);
});
