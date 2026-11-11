import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resetPageScrollToTop } from '../src/lib/pageScroll.ts';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('reset positions the viewport at the top on iOS-style body and documentElement scrollers', () => {
  const calls = [];
  const documentElement = { scrollTop: 630, scrollLeft: 4 };
  const body = { scrollTop: 630, scrollLeft: 7 };
  const view = { scrollTo(x, y) { calls.push([x, y]); } };
  resetPageScrollToTop(view, { scrollingElement: documentElement, documentElement, body });
  assert.deepEqual(calls, [[0, 0]]);
  assert.deepEqual(documentElement, { scrollTop: 0, scrollLeft: 0 });
  assert.deepEqual(body, { scrollTop: 0, scrollLeft: 0 });
});

test('scroll reset touches the root only, not the map, lab and modal internal scrollers', () => {
  const calls = [];
  const documentElement = { scrollTop: 745, scrollLeft: 13 };
  const body = { scrollTop: 745, scrollLeft: 17 };
  const nestedMap = { scrollTop: 280, scrollLeft: 0 };
  const nestedDialog = { scrollTop: 195, scrollLeft: 0 };
  resetPageScrollToTop(
    { scrollTo(x, y) { calls.push([x, y]); } },
    { scrollingElement: body, documentElement, body },
  );
  assert.deepEqual(calls, [[0, 0]]);
  assert.equal(documentElement.scrollTop, 0);
  assert.equal(body.scrollTop, 0);
  assert.equal(nestedMap.scrollTop, 280);
  assert.equal(nestedDialog.scrollTop, 195);
});

test('safe with browser documents that omit optional scroll roots', () => {
  const calls = [];
  resetPageScrollToTop({ scrollTo(x, y) { calls.push([x, y]); } }, {});
  assert.deepEqual(calls, [[0, 0]]);
});

test('route scroll handling is installed once outside conditional App login/loading branches', () => {
  const root = read('src/main.tsx');
  const app = read('src/App.tsx');
  const component = read('src/components/ui/RouteScrollToTop.tsx');
  assert.match(root, /<BrowserRouter>\s*<RouteScrollToTop \/>\s*<App \/>/);
  for (const route of ['/', '/map', '/profile', '/gps-lab', '/calibration', '/fusion-lab', '/sprint-lab', '/leaderboard']) {
    assert.ok(app.includes(`path="${route}"`), route);
  }
  assert.match(component, /useLocation\(\)/);
  assert.match(component, /useLayoutEffect\(\(\) =>/);
  assert.match(component, /\[pathname, key\]/);
  assert.match(component, /requestAnimationFrame\(reset\)/);
  assert.match(component, /history\.scrollRestoration = 'manual'/);
  assert.match(component, /addEventListener\('pageshow', onPageShow\)/);
  assert.match(component, /addEventListener\('visibilitychange', onVisible\)/);
  assert.match(component, /removeEventListener\('visibilitychange', onVisible\)/);
  assert.doesNotMatch(component, /querySelectorAll|\.leaflet-|\.scrollIntoView/);
});
