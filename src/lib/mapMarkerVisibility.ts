/** Both geographic visibility AND projected screen location must be valid.
 * MapLibre may otherwise clamp offscreen HTML Markers to a screen boundary,
 * particularly with a pitched or rotated camera.
 */
export type ViewportPoint = Readonly<{ x: number; y: number }>;
export type ViewportArea = Readonly<{
  width: number;
  height: number;
  top: number;
  bottom: number;
  left?: number;
  right?: number;
}>;
export function markerInViewport(
  inMapBounds: boolean,
  projected: ViewportPoint,
  viewport: ViewportArea,
): boolean {
  if (!inMapBounds ||
      !Number.isFinite(projected.x) || !Number.isFinite(projected.y) ||
      !Number.isFinite(viewport.width) || !Number.isFinite(viewport.height)) return false;
  const left = viewport.left ?? 22;
  const right = viewport.right ?? 22;
  return viewport.width > left + right &&
    viewport.bottom > viewport.top &&
    projected.x >= left && projected.x <= viewport.width - right &&
    projected.y >= viewport.top && projected.y <= viewport.bottom;
}


/** A real GPS fix and an own race can project to the same pixels.
 * At street zoom the event pin must remain clickable and readable.
 * GPS coordinates, tracking and the cyan radar stay unchanged; only the
 * duplicate HTML blue dot is hidden while there is a visual collision. */
export function projectedMarkersOverlap(
  first: ViewportPoint,
  second: ViewportPoint,
  thresholdPx = 38,
): boolean {
  if (![first.x, first.y, second.x, second.y, thresholdPx].every(Number.isFinite) ||
      thresholdPx <= 0) return false;
  return Math.hypot(first.x - second.x, first.y - second.y) < thresholdPx;
}
