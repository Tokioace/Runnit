/**
 * Validate browser geolocation fixes before mixing them with monotonic IMU time.
 * GeolocationPosition.timestamp uses Unix milliseconds, unlike performance.now().
 * This gate is diagnostic only: it never changes race/FairPlay verdicts.
 */
export function validWalkingGpsFixTimestamp(
  fixEpochMs: number,
  nowEpochMs: number,
  previousAcceptedEpochMs: number | null,
): boolean {
  if (!Number.isFinite(fixEpochMs) || !Number.isFinite(nowEpochMs) || fixEpochMs <= 0) return false;
  const ageMs = nowEpochMs - fixEpochMs;
  if (ageMs < -1000 || ageMs > 3000) return false;
  if (previousAcceptedEpochMs !== null &&
      (!Number.isFinite(previousAcceptedEpochMs) || previousAcceptedEpochMs <= 0 ||
       fixEpochMs <= previousAcceptedEpochMs)) return false;
  return true;
}
