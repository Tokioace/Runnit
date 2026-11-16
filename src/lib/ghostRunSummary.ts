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
