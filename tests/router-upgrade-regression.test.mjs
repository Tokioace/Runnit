import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Source-level route contract after React Router 6 -> 7 migration.
// These assertions do not replace interactive Safari navigation tests.
const source = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('App.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function jsxAttributes(tag) {
  const result = new Map();
  for (const attr of tag.attributes.properties) {
    if (ts.isJsxAttribute(attr)) {
      const value = attr.initializer;
      if (value && ts.isStringLiteral(value)) result.set(attr.name.text, value.text);
      else result.set(attr.name.text, value?.getText(ast) ?? '');
    }
  }
  return result;
}

function collectRoutes() {
  const routes = [];
  const visit = (node) => {
    if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) &&
        node.tagName.getText(ast) === 'Route') {
      routes.push(jsxAttributes(node));
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return routes;
}

test('router upgrade retains the walking field-test and distinct home/map routes', () => {
  const routes = collectRoutes();
  const paths = routes.map(r => r.get('path'));
  assert.equal(new Set(paths).size, paths.length, 'duplicate route paths');
  for (const path of ['/', '/home', '/map', '/gps-lab', '/gps-field-test']) {
    assert.ok(paths.includes(path), `missing route ${path}`);
  }
  assert.match(routes.find(r => r.get('path') === '/gps-field-test').get('element'), /GpsFieldTestScreen/);
  assert.match(routes.find(r => r.get('path') === '/home').get('element'), /DashboardScreen/);
  assert.match(routes.find(r => r.get('path') === '/map').get('element'), /MapScreen/);
});

test('router upgrade retains dedicated login/register and callback handling', () => {
  assert.match(source, /location\.pathname === '\/login'/);
  assert.match(source, /location\.pathname === '\/register'/);
  assert.match(source, /location\.pathname === AUTH_CALLBACK_PATH/);
  assert.match(source, /APP_PATHS\.has\(next\)/);
  assert.match(source, /<Navigate to=\{safeLoginReturnPath\(location\.search\)\} replace/);
});

test('unknown routes fall back to welcome rather than an external destination', () => {
  const fallback = collectRoutes().find(r => r.get('path') === '*');
  assert.ok(fallback);
  assert.match(fallback.get('element'), /<Navigate to="\/" replace/);
});
