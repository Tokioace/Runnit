import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../src/components/map/ArcadeMapLibreView.tsx', import.meta.url), 'utf8',
);

const luminance = hex => {
  const s = hex.replace('#', '');
  const channels = [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16) / 255);
  const linear = channels.map(x => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
};

test('world and Europe land are distinctly lighter than sea on the exact openmaptiles layers', () => {
  assert.match(source, /layer\.type === 'background'/);
  assert.match(source, /0, '#1c3e53', 2, '#1b3b51', 4, '#1b3c50'/);
  assert.match(source, /layer\.type === 'fill' && name === 'water'/);
  assert.match(source, /0, '#05101f', 2, '#061425', 4, '#071728'/);
  const landWorld = luminance('#1b3b51');
  const seaWorld = luminance('#061425');
  const landEurope = luminance('#1b3c50');
  const seaEurope = luminance('#071728');
  assert.ok(landWorld > seaWorld * 3, 'world land needs materially brighter luminance');
  assert.ok(landEurope > seaEurope * 3, 'European coastlines need clear land/sea separation');
});

test('coastline uses the actual Liberty water fill outline, not a fictitious line layer', () => {
  const start = source.indexOf("layer.type === 'fill' && name === 'water'");
  const end = source.indexOf("layer.type === 'fill' && /water/.test(name)", start);
  assert.ok(start >= 0 && end > start);
  const coastal = source.slice(start, end);
  assert.match(coastal, /setPaintProperty\(layer\.id, 'fill-outline-color'/);
  assert.match(coastal, /3, 'rgba\(112,226,250,0\.72\)'/);
  assert.match(coastal, /5, 'rgba\(113,232,254,0\.78\)'/);
  assert.match(coastal, /11, 'rgba\(80,205,238,0\.08\)'/);
  assert.match(coastal, /13, 'rgba\(80,205,238,0\)'/);
  assert.doesNotMatch(coastal, /addLayer\(\{/);
  assert.ok(source.indexOf("layer.type === 'fill' && name === 'water'") <
            source.indexOf("layer.type === 'fill' && /water/.test(name)"));
});

test('distant relief and landuse overlays stop drowning out Greece and islands', () => {
  assert.match(source, /0, 0\.035, 3, 0\.03, 6, 0\.01, 7, 0/);
  assert.match(source, /3, 0\.012, 7, 0\.04, 10, 0\.15, 15, 0\.56/);
  assert.match(source, /2, ice \? 0\.08 : 0\.018, 7, 0\.045, 10, 0\.15/);
  assert.match(source, /3, 0\.012, 7, 0\.045, 10, 0\.14, 14, 0\.56/);
});

test('near-city colors and existing true race signals remain intact', () => {
  assert.match(source, /13, '#10243d'/);
  assert.match(source, /13, '#123852'/);
  assert.match(source, /function syncDistantDots\(/);
  assert.match(source, /installCommunityLayers\(map\)/);
  assert.match(source, /map\.setPaintProperty\(layer\.id, 'line-opacity',/);
});
