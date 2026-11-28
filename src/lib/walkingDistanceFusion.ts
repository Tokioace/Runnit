import type { CalibrationFix } from './strideCalibration';

// Node's strip-types regression runner cannot resolve extensionless runtime
// imports of TypeScript modules. Keep this tiny distance primitive independent.
function distanceBetweenFixes(a: CalibrationFix, b: CalibrationFix): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Pure, experimental walking-distance reconciliation.
 * This is NOT a sprint detector, a Kalman filter, a certified odometer,
 * an anti-cheat verdict, or input to duels / leaderboards.
 *
 * GPS endpoint displacement describes only a near-straight route. Summing GPS
 * segments would amplify jitter; step distance is stride * accepted steps.
 * GPS and stride calibration are statistically correlated, so combining them
 * does not automatically improve accuracy.
 */
export type FusionMode = 'combined' | 'steps-only' | 'gps-only' | 'conflict' | 'paused' | 'unavailable';
export type WalkingFusionInput = Readonly<{
  walkingStrideM: number | null;
  stepCount: number | null;
  startGps: CalibrationFix | null;
  currentGps: CalibrationFix | null;
  nowMs: number;
  sensorContinuous: boolean;
  straightRoute: boolean;
}>;
export type WalkingFusionResult = Readonly<{
  mode: FusionMode;
  estimatedDistanceM: number | null;
  stepDistanceM: number | null;
  gpsDisplacementM: number | null;
  gpsAccuracyM: number | null;
  disagreementM: number | null;
  reason: string;
}>;

const MAX_GPS_ACCURACY_M = 8;
const MAX_GPS_AGE_MS = 5000;

function validFix(p: CalibrationFix | null): p is CalibrationFix {
  return Boolean(p && Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90
    && Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180
    && Number.isFinite(p.timestampMs) && Number.isFinite(p.accuracyM)
    && p.accuracyM > 0 && p.accuracyM <= MAX_GPS_ACCURACY_M);
}

export function reconcileWalkingDistance(input: WalkingFusionInput): WalkingFusionResult {
  const blank = (mode: FusionMode, reason: string, stepDistanceM: number | null = null,
    gpsDisplacementM: number | null = null, gpsAccuracyM: number | null = null,
    disagreementM: number | null = null): WalkingFusionResult =>
    ({ mode, reason, estimatedDistanceM: null, stepDistanceM, gpsDisplacementM, gpsAccuracyM, disagreementM });

  const hasSteps = input.walkingStrideM !== null && input.stepCount !== null
    && Number.isFinite(input.walkingStrideM) && input.walkingStrideM >= 0.3 && input.walkingStrideM <= 1.3
    && Number.isInteger(input.stepCount) && input.stepCount >= 0 && input.stepCount <= 10000;
  const stepDistanceM = hasSteps ? input.stepCount! * input.walkingStrideM! : null;

  if (!Number.isFinite(input.nowMs)) return blank('unavailable', 'Ungültige Zeitbasis.');
  if (!input.sensorContinuous) return blank('paused', 'IMU-Unterbrechung: keine Distanz über die Lücke extrapolieren.',
    stepDistanceM);
  const gpsValid = validFix(input.startGps) && validFix(input.currentGps)
    && input.currentGps.timestampMs >= input.startGps.timestampMs
    && input.currentGps.timestampMs <= input.nowMs
    && input.nowMs - input.currentGps.timestampMs <= MAX_GPS_AGE_MS;
  if (!gpsValid) {
    return stepDistanceM !== null
      ? { ...blank('steps-only', 'GPS fehlt, ist veraltet oder zu ungenau. Nur vorläufige Schrittdistanz.',
          stepDistanceM), estimatedDistanceM: stepDistanceM }
      : blank('unavailable', 'Keine brauchbare GPS-/IMU-Messung.');
  }
  const start = input.startGps!;
  const current = input.currentGps!;
  const gpsDisplacementM = distanceBetweenFixes(start, current);
  const gpsAccuracyM = start.accuracyM + current.accuracyM; // quality heuristic, NOT a confidence interval

  if (!input.straightRoute) {
    return stepDistanceM !== null
      ? { ...blank('steps-only', 'Kurviger Weg: GPS-Luftlinie ist keine Wegstrecke.',
          stepDistanceM, gpsDisplacementM, gpsAccuracyM), estimatedDistanceM: stepDistanceM }
      : blank('unavailable', 'Ohne Kalibrierung ist die Luftlinie auf kurvigen Wegen keine Distanz.',
          null, gpsDisplacementM, gpsAccuracyM);
  }

  if (stepDistanceM === null) {
    // Expose GPS-only fallback distinctly; never mistake it for combined evidence.
    return { ...blank('gps-only', 'Keine gültige Gehschrittlänge. Nur GPS-Luftlinie.',
      null, gpsDisplacementM, gpsAccuracyM), estimatedDistanceM: gpsDisplacementM };
  }
  const discrepancyM = Math.abs(stepDistanceM - gpsDisplacementM);
  const toleranceM = Math.max(4, gpsAccuracyM, stepDistanceM * 0.18);
  if (discrepancyM > toleranceM) {
    return blank('conflict', 'GPS und IMU widersprechen sich: keine gemeinsame Distanz behaupten.',
      stepDistanceM, gpsDisplacementM, gpsAccuracyM, discrepancyM);
  }

  // Avoid GPS stationary noise turning zero detected steps into traveled meters.
  if (stepDistanceM === 0) {
    return { mode: 'combined', estimatedDistanceM: 0, stepDistanceM, gpsDisplacementM,
      gpsAccuracyM, disagreementM: discrepancyM, reason: 'Stillstand: GPS-Jitter nicht als Bewegung zählen.' };
  }
  const stepUncertainty = Math.max(1.2, stepDistanceM * 0.12);
  const gpsUncertainty = Math.max(3, Math.hypot(start.accuracyM, current.accuracyM));
  // Heuristic weighting for demonstration, not calibrated statistical fusion.
  const gpsWeight = stepUncertainty ** 2 / (stepUncertainty ** 2 + gpsUncertainty ** 2);
  const estimatedDistanceM = stepDistanceM + (gpsDisplacementM - stepDistanceM) * gpsWeight;
  return { mode: 'combined', estimatedDistanceM, stepDistanceM, gpsDisplacementM,
    gpsAccuracyM, disagreementM: discrepancyM,
    reason: 'GPS-Luftlinie und IMU-Schrittdistanz sind vereinbar. Nur experimentelle Näherung.' };
}
