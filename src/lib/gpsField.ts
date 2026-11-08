import { createGpsSprint, type GpsSample, type GpsSprintState } from './sprintGps';

/**
 * Experimental reports are deliberately NEVER eligible for the leaderboard.
 * Real-world device GPS is not proof of distance, effort or identity. A future
 * server-authorized result flow must be designed, implemented and audited separately.
 */
export type ExperimentalRunSource = 'simulation' | 'device-gps';

export type ExperimentalRunReport = Readonly<{
  source: ExperimentalRunSource;
  eligibility: 'not-eligible';
  targetMeters: number;
  observedDistanceMeters: number;
  durationSeconds: number | null;
  acceptedSamples: number;
  rejectedSamples: number;
  maxSpeedMps: number;
  finished: boolean;
}>;

const MAX_FIX_AGE_MS = 3_000;
const MAX_ANCHOR_ACCURACY_M = 15;

export function isFreshStartFix(sample: GpsSample | null, atMs: number): sample is GpsSample {
  return !!sample &&
    Number.isFinite(atMs) &&
    Number.isFinite(sample.latitude) && sample.latitude >= -90 && sample.latitude <= 90 &&
    Number.isFinite(sample.longitude) && sample.longitude >= -180 && sample.longitude <= 180 &&
    Number.isFinite(sample.accuracyM) && sample.accuracyM >= 0 &&
    sample.accuracyM <= MAX_ANCHOR_ACCURACY_M &&
    Number.isFinite(sample.timestampMs) &&
    sample.timestampMs <= atMs &&
    atMs - sample.timestampMs <= MAX_FIX_AGE_MS;
}

/**
 * Use a recent fix taken while the user was standing at the start line.
 * Without this, the first fix AFTER the start would move the effective origin
 * and systematically undercount part of a short sprint.
 */
export function createPrimedGpsSprint(targetMeters: number, startedAtMs: number, anchor: GpsSample): GpsSprintState {
  if (!isFreshStartFix(anchor, startedAtMs)) {
    throw new Error('Start position is inaccurate or stale');
  }
  return {
    ...createGpsSprint(targetMeters, startedAtMs),
    origin: anchor,
    lastAccepted: anchor,
    acceptedSamples: 1,
  };
}

export function createExperimentalRunReport(source: ExperimentalRunSource, state: GpsSprintState): ExperimentalRunReport {
  const finish = state.finishTimestampMs;
  return {
    source,
    eligibility: 'not-eligible',
    targetMeters: state.targetMeters,
    observedDistanceMeters: state.distanceM,
    durationSeconds: finish === null ? null : Math.max(0, (finish - state.startedAtMs) / 1000),
    acceptedSamples: state.acceptedSamples,
    rejectedSamples: state.rejectedSamples,
    maxSpeedMps: state.maxSpeedMps,
    finished: finish !== null,
  };
}

/** Positive = device estimate slower than the independent reference. */
export function compareWithReferenceSeconds(
  report: ExperimentalRunReport,
  referenceSeconds: number | null,
): number | null {
  if (
    report.durationSeconds === null || referenceSeconds === null ||
    !Number.isFinite(referenceSeconds) || referenceSeconds <= 0 || referenceSeconds > 180
  ) return null;
  return report.durationSeconds - referenceSeconds;
}
