import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('host selection marker is ephemeral and cannot survive confirmation into a real race', () => {
  const src = read('src/components/map/ArcadeMapLibreView.tsx');

  // A single marker is created at the long-pressed geographic point.
  assert.match(src, /hostSelectionMarkerRef\.current = new Marker\(\{ element: anchor, anchor: 'center' \}\)/);
  assert.match(src, /anchor\.className = 'runnit-gl-host-pulse'/);

  // All exits, including pressing WEITER and tapping outside, must clear it.
  assert.match(src, /const clearHostSelection = \(\) => \{\s*hostSelectionMarkerRef\.current\?\.remove\(\);\s*hostSelectionMarkerRef\.current = null;/);
  assert.match(src, /const closeHostPopup = \(\) => \{\s*hostPopupRef\.current\?\.remove\(\);\s*hostPopupRef\.current = null;\s*clearHostSelection\(\);/);
  assert.match(src, /create\.addEventListener\('click', \(event\) => \{\s*event\.stopPropagation\(\);[\s\S]*?closeHostPopup\(\);\s*callbacks\.current\.onHostAt\(position\);/);
  assert.match(src, /popup\.on\('close', \(\) => \{[\s\S]*?setPopupVisible\(Boolean\(activeRunPopupRef\.current\)\);\s*clearHostSelection\(\);/);
  assert.doesNotMatch(src, /hostCreatingRef/);
  assert.doesNotMatch(src, /if \(hostDialogOpen \|\| hostLocation \|\|/);
});

test('host chooser leaves the 2D/3D switch present; full race detail keeps overlap safety', () => {
  const src = read('src/components/map/ArcadeMapLibreView.tsx');
  const css = read('src/styles/maplibreArcade.css');

  assert.match(src, /hostPopupRef\.current = popup;[\s\S]*?setPopupVisible\(false\)/);
  assert.match(src, /activeRunPopupRef\.current = popup;\s*setPopupVisible\(true\)/);
  assert.match(src, /disabled=\{popupVisible\}/);
  assert.match(src, /className=\{'runnit-gl-tilt-button' \+ \(popupVisible \? ' is-obscured-by-popup' : ''\)\}/);
  assert.match(css, /:has\(\.maplibregl-popup\.runnit-gl-race-popup\) \.runnit-gl-tilt-button/);
  assert.doesNotMatch(css, /:has\(\.maplibregl-popup\.runnit-gl-host-popup\) \.runnit-gl-tilt-button/);
  assert.match(css, /\.runnit-gl-tilt-button\.is-obscured-by-popup/);
  // Recenter is an independent control; this change must not hide it.
  assert.match(read('src/screens/MapScreen.tsx'), /runnit-map-locate-slot pointer-events-auto absolute/);
});

test('real event flags remain the sole marker after host dialog confirmed', () => {
  const screen = read('src/screens/MapScreen.tsx');
  const map = read('src/components/map/ArcadeMapLibreView.tsx');
  assert.match(screen, /await onHost\(distance\);\s*onClose\(\);/);
  assert.match(screen, /setOpenRuns\(previous => \[created, \...previous\.filter\(run => run\.id !== created\.id\)\]\)/);
  assert.match(map, /const marker = new Marker\(\{ element: markerShell\(el\), anchor: 'bottom' \}\)/);
  assert.match(map, /\.setLngLat\(eventPopupLngLat\(originalRun\)\)/);
});
