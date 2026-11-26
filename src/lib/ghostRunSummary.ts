import type { GpsSample, GpsSprintState } from './sprintGps';
import { gpsGapDiagnostics } from './sprintGps.ts';

export type MotionPermission = 'granted' | 'denied' | 'unavailable';
export type DiagnosticSummary = {
  target_distance_m: number;
  run_state: 'finished' | 'stopped';
  elapsed_ms: number | null;
  observed_distance_m: number;
  steps_count: number;
  gps_accepted: number;
  gps_rejected: number;
  motion_samples: number;
  motion_gaps: number;
  max_speed_mps: number;
  motion_permission: MotionPermission;
  interrupted: boolean;
};

export function safeNumber(value: number, digits = 2): number {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : 0;
}

/** Limit finish diagnostics to the interpolated crossing, not the later GPS
 * confirmation. A confirmed peak can precede the sample that confirmed it.
 * Do not invent missing samples or steps. */
export function ghostFinishMotion<T extends { t_ms: number; steps: number }>(
  trace: readonly T[], stepTimestampsMs: readonly number[], startedAtMs: number, finishedAtMs: number,
): { trace: T[]; steps: number; gaps: number } {
  const cutoff = finishedAtMs - startedAtMs;
  const peaks = stepTimestampsMs.filter(t => Number.isFinite(t) && t >= startedAtMs && t <= finishedAtMs);
  let index = 0;
  let gaps = 0;
  let previous: number | null = null;
  const retained = trace.filter(s => Number.isFinite(s.t_ms) && s.t_ms >= 0 && s.t_ms <= cutoff)
    .map(s => {
      if (previous !== null && s.t_ms - previous > 250) gaps++;
      previous = s.t_ms;
      while (index < peaks.length && peaks[index] - startedAtMs <= s.t_ms) index++;
      return { ...s, steps: index };
    });
  return { trace: retained, steps: peaks.length, gaps };
}

/** Experimental GPS and IMU summary, never eligible for official standings. */
export function ghostSummary(state: GpsSprintState, steps: number, imu: number, gaps: number,
  permission: MotionPermission, interrupted: boolean, finish: boolean): DiagnosticSummary {
  const completed = finish && state.finishTimestampMs !== null;
  return {
    target_distance_m: state.targetMeters,
    run_state: completed ? 'finished' : 'stopped',
    elapsed_ms: completed
      ? Math.max(1, (state.finishTimestampMs as number) - state.startedAtMs)
      : null,
    observed_distance_m: safeNumber(state.distanceM),
    steps_count: Math.max(0, Math.floor(steps)),
    gps_accepted: state.acceptedSamples,
    gps_rejected: state.rejectedSamples,
    motion_samples: Math.max(0, Math.floor(imu)),
    motion_gaps: Math.max(0, Math.floor(gaps)),
    max_speed_mps: safeNumber(state.maxSpeedMps),
    motion_permission: permission,
    interrupted,
  };
}

/** Local diagnostic values: unknown is null, never a fabricated zero.
 * Relative positions are approximate and do not change the sprint evaluator. */
export function ghostRelativeGpsFix(sample: GpsSample, origin: GpsSample | null, startedAtMs: number) {
  const validPosition = (p: GpsSample) =>
    Number.isFinite(p.latitude) && p.latitude >= -90 && p.latitude <= 90 &&
    Number.isFinite(p.longitude) && p.longitude >= -180 && p.longitude <= 180;
  const validCoordinates = origin !== null && validPosition(origin) && validPosition(sample);
  const deltaMs = sample.timestampMs - startedAtMs;
  const validTime = Number.isFinite(deltaMs) && deltaMs >= 0;
  return {
    t_ms: validTime ? deltaMs : null,
    east_m: validCoordinates ? safeNumber(((sample.longitude - origin.longitude + 540) % 360 - 180) *
      111320 * Math.cos(origin.latitude * Math.PI / 180)) : null,
    north_m: validCoordinates ? safeNumber((sample.latitude - origin.latitude) * 111320) : null,
    accuracy_m: Number.isFinite(sample.accuracyM) && sample.accuracyM >= 0 ? safeNumber(sample.accuracyM) : null,
  };
}

/** Local export metadata only. The primed anchor is not in the live GPS trace,
 * which may also include the confirmation fix after the estimated crossing.
 * Motion omitted after the crossing does not truncate the exported sprint. */
export function ghostTraceDiagnostics(state: GpsSprintState, gpsOmitted: number,
  firstMotionOmittedMs: number | null) {
  const origin = state.origin;
  const age = origin === null ? NaN : state.startedAtMs - origin.timestampMs;
  const last = state.lastAccepted;
  const observed = last === null ? NaN : last.timestampMs - state.startedAtMs;
  const cutoff = state.finishTimestampMs === null ? Infinity : state.finishTimestampMs - state.startedAtMs;
  const motionTruncated = firstMotionOmittedMs !== null &&
    Number.isFinite(firstMotionOmittedMs) && firstMotionOmittedMs >= 0 && firstMotionOmittedMs <= cutoff;
  return {
    startFixAgeMs: Number.isFinite(age) && age >= 0 ? age : null,
    startFixAccuracyM: origin !== null && Number.isFinite(origin.accuracyM) && origin.accuracyM >= 0
      ? origin.accuracyM : null,
    observationMs: Number.isFinite(observed) ? Math.max(0, observed) : null,
    crossingIntervalMs: state.finishTimestampMs !== null ? state.crossingIntervalMs : null,
    ...gpsGapDiagnostics(state),
    gpsTraceOmitted: gpsOmitted,
    motionTraceTruncated: motionTruncated,
    motionTraceFirstOmittedMs: motionTruncated ? firstMotionOmittedMs : null,
  };
}
