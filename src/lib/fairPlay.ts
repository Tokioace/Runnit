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
  accelerationX?: number;
  accelerationY?: number;
  accelerationZ?: number;
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
  /** Monotonic timestamps of accepted gait peaks, for local diagnostic plotting only. */
  acceptedStepTimesMs: readonly number[];
  /** Candidate peaks and reason for exclusion; local diagnostics, not ground truth. */
  candidatePeaks: readonly Readonly<{ timestampMs: number; reason: 'accepted' | 'refractory' | 'weak-prominence' | 'irregular-rhythm' }>[];
  cadenceSpm: number | null;
  gpsDistanceM: number | null;
  gpsSpeedMps: number | null;
  gpsAccuracyMedianM: number | null;
  motionCoverage: number;
}>;

/** Gaps between real IMU events, not between downsampled plot points. */
export function findMotionGaps(motion: readonly MotionSample[], thresholdMs = 250): readonly Readonly<{ startMs: number; endMs: number }>[] {
  const gaps: { startMs: number; endMs: number }[] = [];
  for (let i = 1; i < motion.length; i++) {
    const startMs = motion[i - 1].timestampMs;
    const endMs = motion[i].timestampMs;
    if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs - startMs > thresholdMs)
      gaps.push({ startMs, endMs });
  }
  return gaps;
}

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
  let lastAccepted = reliableGps[0];
  for (let i = 1; i < reliableGps.length; i++) {
    const previous = lastAccepted;
    const current = reliableGps[i];
    const elapsed = (current.timestampMs - previous.timestampMs) / 1000;
    if (elapsed <= 0) continue;
    const segment = meters(previous, current);
    if (segment / elapsed > 12) {
      implausibleSegments++;
      // Re-anchor after a discontinuity: otherwise every subsequent valid fix
      // can be rejected against a stale position, hiding recovered movement.
      // Never include the discontinuity itself in measured distance.
      lastAccepted = current;
      continue;
    }
    lastAccepted = current;
    traveled += segment;
    validSegments++;
  }
  const distance = durationMs > 0 && validSegments > 0 ? traveled : null;
  const speed = distance !== null ? distance / (durationMs / 1000) : null;

  // Experimental gait detector: reject isolated shocks and closely spaced
  // secondary peaks. Confirm a run of rhythmic peaks before counting it.
  // This is NOT a validated pedometer; synthetic and on-device tests required.
  const candidates: number[] = [];
  const candidatePeaks: { timestampMs: number; reason: 'accepted' | 'refractory' | 'weak-prominence' | 'irregular-rhythm' }[] = [];
  for (let i = 2; i < imu.length - 2; i++) {
    const p = imu[i];
    if (p.accelerationMagnitudeMps2 < 2.0 ||
      p.accelerationMagnitudeMps2 <= imu[i - 1].accelerationMagnitudeMps2 ||
      p.accelerationMagnitudeMps2 < imu[i + 1].accelerationMagnitudeMps2) continue;
    // A peak must stand above its immediate 100ms neighbourhood, not just
    // adjacent noisy samples. Avoid merging samples across sensor gaps.
    let localMin = p.accelerationMagnitudeMps2;
    for (let j = i - 1; j >= 0 && p.timestampMs - imu[j].timestampMs <= 100; j--)
      localMin = Math.min(localMin, imu[j].accelerationMagnitudeMps2);
    for (let j = i + 1; j < imu.length && imu[j].timestampMs - p.timestampMs <= 100; j++)
      localMin = Math.min(localMin, imu[j].accelerationMagnitudeMps2);
    if (p.accelerationMagnitudeMps2 - localMin < 1.2) {
      candidatePeaks.push({ timestampMs: p.timestampMs, reason: 'weak-prominence' });
      continue;
    }
    // At most one candidate per 350ms; preserve stronger peaks in that window.
    if (candidates.length && p.timestampMs - candidates[candidates.length - 1] < 350) {
      candidatePeaks.push({ timestampMs: p.timestampMs, reason: 'refractory' });
      continue;
    }
    candidates.push(p.timestampMs);
  }
  const stepTimes: number[] = [];
  let rhythmicRun: number[] = [];
  const flushRun = () => {
    if (rhythmicRun.length >= 3) stepTimes.push(...rhythmicRun);
    rhythmicRun = [];
  };
  for (const time of candidates) {
    if (!rhythmicRun.length) { rhythmicRun = [time]; continue; }
    const interval = time - rhythmicRun[rhythmicRun.length - 1];
    if (interval < 350 || interval > 1100) {
      flushRun(); rhythmicRun = [time]; continue;
    }
    if (rhythmicRun.length >= 2) {
      const previous = rhythmicRun[rhythmicRun.length - 1] - rhythmicRun[rhythmicRun.length - 2];
      // Allow pace variation and turns without accepting isolated shocks.
      if (Math.abs(interval - previous) > Math.max(180, previous * 0.45)) {
        flushRun(); rhythmicRun = [time]; continue;
      }
    }
    rhythmicRun.push(time);
  }
  flushRun();
  const acceptedSet = new Set(stepTimes);
  for (const time of candidates) candidatePeaks.push({ timestampMs: time, reason: acceptedSet.has(time) ? 'accepted' : 'irregular-rhythm' });
  candidatePeaks.sort((a, b) => a.timestampMs - b.timestampMs);
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
  if (implausibleSegments > 0) reasons.push('gps-position-jump');
  if (speed !== null && speed > 12) reasons.push('implausible-average-speed');
  // During ordinary walking, very high detected cadence can indicate extra
  // peaks from handheld phone motion. Flag uncertainty, never cheating.
  // This heuristic is not a validated gait classifier or a step correction.
  if (speed !== null && speed >= 0.5 && speed <= 2.2 && cadence !== null && cadence > 175)
    reasons.push('walking-cadence-needs-calibration');
  if (speed !== null && speed > 3 && stepTimes.filter(t => t >= first!.timestampMs && t <= last!.timestampMs).length < 2)
    reasons.push('movement-without-detected-steps');
  // Missing steps alone must not be treated as cheating: phone placement matters.
  // GPS alone is not proof of cheating, especially during walking or weak reception.
  // A GPS jump is a measurement-quality issue, not evidence of cheating.
  const suspicious = reasons.includes('implausible-average-speed');
  const uncertain = reasons.length > 0 || stepTimes.length < 3;
  return {
    verdict: suspicious ? 'suspicious' : uncertain ? 'uncertain' : 'plausible',
    reasons,
    detectedSteps: stepTimes.length,
    acceptedStepTimesMs: stepTimes,
    candidatePeaks,
    cadenceSpm: cadence !== null && Number.isFinite(cadence) ? cadence : null,
    gpsDistanceM: distance,
    gpsSpeedMps: speed,
    gpsAccuracyMedianM: accuracy,
    motionCoverage: coverage,
  };
}
