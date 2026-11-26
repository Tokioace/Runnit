import type { GpsSprintState } from './sprintGps';

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
