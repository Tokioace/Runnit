/** Match the existing bounded GO sound handoff. This is a provisional
 * local scheduling tolerance, not a validated GPS accuracy threshold. */
export function canStartGhostCountdown(startsAtMs: number, nowMs: number, visible: boolean): boolean {
  return visible && Number.isFinite(startsAtMs) && Number.isFinite(nowMs) &&
    nowMs >= startsAtMs && nowMs - startsAtMs <= 700;
}
