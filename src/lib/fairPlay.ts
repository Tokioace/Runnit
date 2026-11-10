/**
 * Experimental, client-side FairPlay evidence analysis.
 * This is NOT an anti-cheat guarantee, official timing system or proof of running.
 * Do not use this verdict alone to ban users or publish verified sprint records.
 * No microphone, raw location persistence, network calls or user identifiers.
 */
export type MotionSample = Readonly<{
  timestampMs: number;
  accelerationMagnitudeMps2: number;
  rotationMagnitudeRadps?: number;
}>;
export type PositionSample = Readonly<{
  timestampMs: number;
  latitude: number;
  longitude: number;
  accuracyM: number;
}>;
export type FairPlayVerdict = 'plausible' | 'uncertain' | 'suspicious';
export type FairPlayReport = Readonly<{
  verdict: FairPlayVerdict;
  reasons: string[];
  detectedSteps: number;
  cadenceSpm: number | null;
  gpsDistanceM: number | null;
  gpsSpeedMps: number | null;
  gpsAccuracyMedianM: number | null;
  motionCoverage: number;
}>;

const rad = Math.PI / 180;
function meters(a: PositionSample, b: PositionSample): number {
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 12742000 * Math.asin(Math.min(1, Math.sqrt(h)));
}
function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Inputs are expected to use the SAME monotonic clock (e.g. performance.now).
 * GPS GeolocationPosition.timestamp uses epoch time: normalize it BEFORE calling.
 * Never compare wall-clock and monotonic timestamps directly.
 */
export function assessFairPlay(
  positions: readonly PositionSample[],
  motion: readonly MotionSample[],
): FairPlayReport {
  const reasons: string[] = [];
  const gps = [...positions].filter(p =>
    Number.isFinite(p.timestampMs) && Number.isFinite(p.latitude) &&
    Number.isFinite(p.longitude) && Math.abs(p.latitude) <= 90 &&
    Math.abs(p.longitude) <= 180 && Number.isFinite(p.accuracyM) && p.accuracyM >= 0
  ).sort((a, b) => a.timestampMs - b.timestampMs);
  const imu = [...motion].filter(m =>
    Number.isFinite(m.timestampMs) && Number.isFinite(m.accelerationMagnitudeMps2) &&
    m.accelerationMagnitudeMps2 >= 0 && m.accelerationMagnitudeMps2 < 200
  ).sort((a, b) => a.timestampMs - b.timestampMs);
  const accuracy = median(gps.map(p => p.accuracyM));
  const reliableGps = gps.filter(p => p.accuracyM <= 15);
  const first = reliableGps[0];
  const last = reliableGps[reliableGps.length - 1];
  const durationMs = first && last ? last.timestampMs - first.timestampMs : 0;
  // Displacement is not walked distance: accumulate plausible consecutive GPS segments.
  let traveled = 0;
  let validSegments = 0;
  let implausibleSegments = 0;
  for (let i = 1; i < reliableGps.length; i++) {
    const previous = reliableGps[i - 1];
    const current = reliableGps[i];
    const elapsed = (current.timestampMs - previous.timestampMs) / 1000;
    if (elapsed <= 0) continue;
    const segment = meters(previous, current);
    if (segment / elapsed > 12) { implausibleSegments++; continue; } // reject GPS teleportation
    traveled += segment;
    validSegments++;
  }
  const distance = durationMs > 0 && validSegments > 0 ? traveled : null;
  const speed = distance !== null ? distance / (durationMs / 1000) : null;

  // Conservative peak detector: local maxima, refractory period 250ms.
  // Calibration across device placement and running styles is still required.
  const stepTimes: number[] = [];
  for (let i = 1; i < imu.length - 1; i++) {
    const p = imu[i];
    if (p.accelerationMagnitudeMps2 < 2.0 ||
      p.accelerationMagnitudeMps2 <= imu[i - 1].accelerationMagnitudeMps2 ||
      p.accelerationMagnitudeMps2 < imu[i + 1].accelerationMagnitudeMps2) continue;
    if (stepTimes.length && p.timestampMs - stepTimes[stepTimes.length - 1] < 250) continue;
    stepTimes.push(p.timestampMs);
  }
  const cadence = stepTimes.length >= 3
    ? 60000 * (stepTimes.length - 1) / (stepTimes[stepTimes.length - 1] - stepTimes[0])
    : null;
  const overlap = first && last
    ? imu.filter(m => m.timestampMs >= first.timestampMs && m.timestampMs <= last.timestampMs)
    : [];
  const coverage = durationMs > 0
    ? Math.min(1, (overlap.length >= 2 ? overlap[overlap.length - 1].timestampMs - overlap[0].timestampMs : 0) / durationMs)
    : 0;

  if (reliableGps.length < 3 || durationMs < 1000) reasons.push('insufficient-gps');
  if (accuracy === null || accuracy > 15) reasons.push('poor-gps-accuracy');
  if (overlap.length < 10 || coverage < 0.7) reasons.push('insufficient-motion-coverage');
  if (implausibleSegments > 0 || (speed !== null && speed > 12)) reasons.push('implausible-average-speed');
  if (speed !== null && speed > 3 && stepTimes.filter(t => t >= first!.timestampMs && t <= last!.timestampMs).length < 2)
    reasons.push('movement-without-detected-steps');
  // Missing steps alone must not be treated as cheating: phone placement matters.
  // GPS alone is not proof of cheating, especially during walking or weak reception.
  const suspicious = reasons.includes('implausible-average-speed');
  const uncertain = reasons.length > 0 || stepTimes.length < 3;
  return {
    verdict: suspicious ? 'suspicious' : uncertain ? 'uncertain' : 'plausible',
    reasons,
    detectedSteps: stepTimes.length,
    cadenceSpm: cadence !== null && Number.isFinite(cadence) ? cadence : null,
    gpsDistanceM: distance,
    gpsSpeedMps: speed,
    gpsAccuracyMedianM: accuracy,
    motionCoverage: coverage,
  };
}
