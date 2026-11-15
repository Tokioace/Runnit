/** Low-zoom dots crossfade into full HTML marker art as the map is enlarged.
 * The constants match the WebGL circle opacity stops in ArcadeMapLibreView. */
export const PIN_FADE_START_ZOOM = 12.2;
export const PIN_FADE_END_ZOOM = 12.8;
export const FULL_PIN_ZOOM = 16;
const MIN_MARKER_SCALE = 0.22;

export function markerPinOpacityAtZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 0;
  return Math.max(0, Math.min(1,
    (zoom - PIN_FADE_START_ZOOM) / (PIN_FADE_END_ZOOM - PIN_FADE_START_ZOOM)));
}

export function markerScaleAtZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return MIN_MARKER_SCALE;
  return Math.max(MIN_MARKER_SCALE, Math.min(1,
    MIN_MARKER_SCALE + (zoom - PIN_FADE_START_ZOOM) *
    ((1 - MIN_MARKER_SCALE) / (FULL_PIN_ZOOM - PIN_FADE_START_ZOOM))));
}
