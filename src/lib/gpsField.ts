import type { GpsSample, GpsSprintState } from './sprintGps';

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
export function primeGpsSprint(state: GpsSprintState, anchor: GpsSample): GpsSprintState {
  if (state.origin !== null || state.acceptedSamples !== 0) {
    throw new Error('Sprint has already collected samples');
  }
  if (!isFreshStartFix(anchor, state.startedAtMs)) {
    throw new Error('Start position is inaccurate or stale');
  }
  return {
    ...state,
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

/** Explicit local field-test outcomes, never a ranking or verification flag. */
export type GpsFieldStopReason = 'finish' | 'manual' | 'background' | 'pagehide' |
  'permission-denied' | 'position-unavailable' | 'timeout' | 'gps-error' | 'duration-limit' | 'clock-change';

export function gpsFieldErrorReason(code: number): GpsFieldStopReason {
  return code === 1 ? 'permission-denied' : code === 2 ? 'position-unavailable' :
    code === 3 ? 'timeout' : 'gps-error';
}

/** Relative observation span only, not a finish time or a raw timestamp. */
export function gpsFieldObservationMs(state: GpsSprintState): number | null {
  const last = state.lastAccepted?.timestampMs;
  if (last === undefined || !Number.isFinite(last) || !Number.isFinite(state.startedAtMs)) return null;
  return Math.max(0, last - state.startedAtMs);
}

/** A field trial is bounded like the solo diagnostic run, not a race record. */
export const MAX_GPS_FIELD_RUN_MS = 5 * 60 * 1000;
export function gpsFieldDurationReached(startedAtMs: number, nowMs: number): boolean {
  return Number.isFinite(startedAtMs) && Number.isFinite(nowMs) &&
    nowMs - startedAtMs >= MAX_GPS_FIELD_RUN_MS;
}

/** Export only the rendered terminal snapshot that is still current. A reset,
 * replacement run or a not-yet-rendered terminal transition retires the caller. */
export function ownsGpsFieldReport(
  rendered: GpsSprintState | null, current: GpsSprintState | null,
  renderedPhase: string, currentPhase: string,
): boolean {
  return rendered !== null && rendered === current && renderedPhase === currentPhase &&
    (currentPhase === 'finished' || currentPhase === 'stopped');
}


/** Wall time is needed for GPS timestamps; monotonic time independently
 * detects clock corrections that would invalidate a field-trial duration. */
export function gpsFieldClockChanged(
  startedWallMs: number, startedMonotonicMs: number, nowWallMs: number, nowMonotonicMs: number,
): boolean {
  if (![startedWallMs, startedMonotonicMs, nowWallMs, nowMonotonicMs].every(Number.isFinite)) return true;
  const wall = nowWallMs - startedWallMs;
  const monotonic = nowMonotonicMs - startedMonotonicMs;
  return wall < 0 || monotonic < 0 || Math.abs(wall - monotonic) > 1000;
}
