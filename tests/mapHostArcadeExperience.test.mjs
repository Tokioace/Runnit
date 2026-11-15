import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('host prompt is small, geographically anchored and never the fixed mobile race card', () => {
  const renderer = read('src/components/map/ArcadeMapLibreView.tsx');
  const style = read('src/styles/maplibreArcade.css');
  assert.match(renderer, /const popup = new Popup\(\{/);
  assert.match(renderer, /maxWidth: '188px'/);
  assert.match(renderer, /setLngLat\(\[position\.lng, position\.lat\]\)\.setDOMContent\(root\)/);
  assert.match(renderer, /title\.textContent = 'RENNEN HIER'/);
  assert.match(renderer, /create\.textContent = 'WEITER ›'/);
  assert.match(style, /\.maplibregl-popup\.runnit-gl-host-popup \{\s*position:absolute!important/);
  assert.match(style, /\.runnit-gl-host-details \{\s*width:164px!important/);
  const fixedSection = style.slice(style.indexOf('/* iPhone-safe race'));
  assert.doesNotMatch(fixedSection, /\.runnit-gl-race-popup,\s*\.runnit-map-arcade \.maplibregl-popup\.runnit-gl-host-popup \{\s*position:fixed/);
});

test('long-pressed geographic marker pulses through the hosting dialog and stops only on close', () => {
  const renderer = read('src/components/map/ArcadeMapLibreView.tsx');
  const screen = read('src/screens/MapScreen.tsx');
  const style = read('src/styles/maplibreArcade.css');
  assert.match(renderer, /hostSelectionMarkerRef\.current = new Marker\(\{ element: anchor, anchor: 'center' \}\)/);
  assert.match(renderer, /setLngLat\(\[position\.lng, position\.lat\]\)\.addTo\(map\)/);
  assert.match(renderer, /hostCreatingRef\.current = true;\s*closeHostPopup\(\);\s*callbacks\.current\.onHostAt\(position\)/);
  assert.match(renderer, /if \(hostDialogOpen \|\| hostLocation \|\| !hostCreatingRef\.current\) return/);
  assert.match(renderer, /hostSelectionMarkerRef\.current\?\.remove\(\)/);
  assert.match(screen, /hostDialogOpen=\{hostOpen\}/);
  assert.match(screen, /hostLocation=\{hostLocation\}/);
  assert.match(screen, /onClose=\{\(\) => \{ setHostOpen\(false\); setHostLocation\(null\); \}\}/);
  assert.match(style, /@keyframes runnit-host-target-wave/);
  assert.match(style, /prefers-reduced-motion:reduce/);
});

test('duel settings are a compact arcade choice rather than an old dropdown', () => {
  const screen = read('src/screens/MapScreen.tsx');
  const styles = read('src/styles/arcadeMap.css');
  const dialog = screen.slice(screen.indexOf('function HostRunDialog('), screen.indexOf('// Authentication modal'));
  assert.match(dialog, /role="dialog" aria-modal="true"/);
  assert.match(dialog, /runnit-host-setup-panel/);
  assert.match(dialog, /\[50, 75, 100\]\.map\(value =>/);
  assert.match(dialog, /aria-pressed=\{distance === value\}/);
  assert.match(dialog, /await onHost\(distance\);\s*onClose\(\);/);
  assert.match(dialog, /disabled=\{submitting\}/);
  assert.doesNotMatch(dialog, /<select/);
  assert.match(styles, /runnit-host-setup-distances/);
  assert.match(styles, /runnit-host-setup-create/);
  assert.match(styles, /max-height:min\(86dvh,640px\)/);
});

test('wide zoom mood is decorative, zoom-limited, reduced-motion aware and never invents a hub', () => {
  const renderer = read('src/components/map/ArcadeMapLibreView.tsx');
  const layers = read('src/lib/mapCommunityLayers.ts');
  const css = read('src/styles/maplibreArcade.css');
  assert.match(renderer, /const zoom = map\.getZoom\(\)/);
  assert.match(renderer, /\(13\.3 - zoom\) \/ 5\.8/);
  assert.match(renderer, /className=\{'runnit-gl-distance-atmosphere'/);
  assert.match(renderer, /map\.on\('zoom', updateAtmosphere\)/);
  assert.match(css, /pointer-events:none/);
  assert.match(css, /@keyframes runnit-map-signal-sweep/);
  assert.match(layers, /COMMUNITY_SINGLE_SIGNAL_RING/);
  assert.match(layers, /COMMUNITY_REAL_SOURCE/);
  assert.match(layers, /filter: \['!', \['has', 'point_count'\]\]/);
});

test('when viewing LISTE, map-only location and tilt controls are absent', () => {
  const renderer = read('src/components/map/ArcadeMapLibreView.tsx');
  const screen = read('src/screens/MapScreen.tsx');
  assert.match(renderer, /\{view === 'map' && <button/);
  assert.match(screen, /arcadeMapView === 'map' && <div className="runnit-map-locate-slot pointer-events-auto absolute/);
  assert.match(screen, /LIVE SIGNAL/);
  assert.match(screen, /regionalRuns\.length === 1 \? 'CHALLENGE' : 'CHALLENGES'/);
});
