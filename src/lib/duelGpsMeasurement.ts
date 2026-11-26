import { advanceGpsSprint, createGpsSprint, haversineMeters, isFreshLiveGpsFix, type GpsSample, type GpsSprintState } from './sprintGps.ts';
import { isFreshStartFix, primeGpsSprint } from './gpsField.ts';
import type { DuelMetrics } from '../db/submitDuelResult.ts';
import type { DuelMotionEvidence } from './duelMotionEvidence.ts';

/** Unverified client measurement only. Not server-side anti-cheat or proof of a sprint. */
export type DuelGpsMeasurement = Readonly<{
  sprint: GpsSprintState;
  accuracySum: number;
  previousSpeedMps: number | null;
  maxAccelMps2: number;
  usedPrestartFix: boolean;
  staleFixes: number;
}>;

export function createDuelGpsMeasurement(targetM: number, startedAtMs: number, startFix: GpsSample | null): DuelGpsMeasurement {
  const initial = createGpsSprint(targetM, startedAtMs);
  if (isFreshStartFix(startFix, startedAtMs)) {
    return { sprint: primeGpsSprint(initial, startFix), accuracySum: startFix.accuracyM,
      previousSpeedMps: null, maxAccelMps2: 0, usedPrestartFix: true, staleFixes: 0 };
  }
  return { sprint: initial, accuracySum: 0, previousSpeedMps: null,
    maxAccelMps2: 0, usedPrestartFix: false, staleFixes: 0 };
}

export function advanceDuelGpsMeasurement(state: DuelGpsMeasurement, sample: GpsSample, receivedAtMs: number): DuelGpsMeasurement {
  if (state.sprint.finishTimestampMs !== null) {
    return { ...state, sprint: { ...state.sprint, lastDecision: 'already-finished' } };
  }
  // A fresh callback can still contain an old fix. Never compare monotonic
  // performance.now() with epoch-based GeolocationPosition.timestamp.
  if (!isFreshLiveGpsFix(sample, receivedAtMs)) {
    return { ...state, staleFixes: state.staleFixes + 1,
      sprint: { ...state.sprint, rejectedSamples: state.sprint.rejectedSamples + 1, lastDecision: 'invalid-sample' } };
  }
  const previous = state.sprint.lastAccepted;
  const sprint = advanceGpsSprint(state.sprint, sample);
  if (sprint.lastDecision !== 'accepted') return { ...state, sprint };
  let speed = state.previousSpeedMps;
  let maxAccel = state.maxAccelMps2;
  // Keep confirmation diagnostics, but exclude the post-crossing interval from peak acceleration.
  if (previous && sprint.finishTimestampMs === null) {
    const dt = (sample.timestampMs - previous.timestampMs) / 1000;
    // A long observation gap gives an interval average, not a current speed.
    // Do not compare acceleration across that gap or against its average on
    // the following fix. Preserve the last reliable peak.
    if (dt > 3) {
      speed = null;
    } else {
      speed = haversineMeters(previous, sample) / dt;
      if (state.previousSpeedMps !== null) {
        maxAccel = Math.max(maxAccel, Math.abs(speed - state.previousSpeedMps) / dt);
      }
    }
  }
  return { ...state, sprint, accuracySum: state.accuracySum + sample.accuracyM,
    previousSpeedMps: speed, maxAccelMps2: maxAccel };
}

/** Only aggregate diagnostic values cross the submission boundary. No coordinates. */
export function duelGpsMetrics(state: DuelGpsMeasurement, steps: number, motion?: DuelMotionEvidence): DuelMetrics {
  const sprint = state.sprint;
  // Steps are counted through the interpolated finish, not the later
  // confirmation fix. Use the displacement at that same crossing for the
  // estimated step length; retain the observed fix distance for diagnostics.
  const stepDistanceM = sprint.finishTimestampMs !== null ? sprint.targetMeters : sprint.distanceM;
  return {
    stepsCount: steps,
    stepLengthAvgM: steps > 0 ? stepDistanceM / steps : undefined,
    maxSpeedMps: sprint.maxSpeedMps,
    maxAccelMps2: state.maxAccelMps2,
    distanceM: sprint.distanceM,
    metricsJson: {
      avgAccuracyM: sprint.acceptedSamples ? state.accuracySum / sprint.acceptedSamples : null,
      samplesUsed: sprint.acceptedSamples,
      rejectedSamples: sprint.rejectedSamples,
      staleFixes: state.staleFixes,
      usedPrestartFix: state.usedPrestartFix,
      measurement: 'gps-displacement-v1',
      verification: 'unverified',
      ...(motion ? { motionEvidence: motion.motionEvidence, motionCoverage: motion.motionCoverage,
        motionSamples: motion.motionSamples, motionGapCount: motion.motionGapCount,
        ...(motion.sprintCadenceSpm !== null ? { sprintCadenceSpm: motion.sprintCadenceSpm } : {}) } : {}),
    },
  };
}
