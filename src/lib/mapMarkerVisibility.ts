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
