import test from 'node:test';
import assert from 'node:assert/strict';
import { markerInViewport, projectedMarkersOverlap } from '../src/lib/mapMarkerVisibility.ts';

const point = { x: 120, y: 160 };
const viewport = { width: 320, height: 640, top: 40, bottom: 600 };

test('valid visible event stays visible and offscreen event is hidden', () => {
  assert.equal(markerInViewport(true, point, viewport), true);
  assert.equal(markerInViewport(false, point, viewport), false);
  assert.equal(markerInViewport(true, { x: -1, y: 160 }, viewport), false);
});

test('invalid iOS viewport insets cannot accidentally expose offscreen markers', () => {
  for (const invalid of [
    { top: NaN }, { bottom: Infinity }, { left: NaN }, { right: -Infinity },
    { top: -1 }, { bottom: 641 }, { left: -1 }, { right: -1 },
    { height: 0 }, { width: 0 }, { top: 500, bottom: 400 },
  ]) {
    assert.equal(markerInViewport(true, point, { ...viewport, ...invalid }), false,
      JSON.stringify(invalid));
  }
});

test('finite inset boundaries and GPS overlap remain deterministic', () => {
  assert.equal(markerInViewport(true, { x: 22, y: 40 }, viewport), true);
  assert.equal(markerInViewport(true, { x: 298, y: 600 }, viewport), true);
  assert.equal(projectedMarkersOverlap(point, { x: 121, y: 160 }), true);
  assert.equal(projectedMarkersOverlap(point, { x: 200, y: 160 }), false);
});
