import type { PositionSample, MotionSample } from './fairPlay';

/**
 * Local-only alignment between the EXISTING walking lab's monotonic GPS/IMU
 * streams and its relative walking-phase diagnostic. No sensor access,
 * persistence, calibration writes, race timing or anti-cheat decisions.
 */
export type WalkingFusionEvidence = Readonly<{
  usable: boolean;
  reason: string;
  phaseStartMs: number | null;
  phaseEndMs: number | null;
  durationSeconds: number | null;
  alignedSteps: number;
  sensorContinuous: boolean;
  startGps: PositionSample | null;
  endGps: PositionSample | null;
  gpsOffsetAtStartMs: number | null;
  gpsOffsetAtEndMs: number | null;
}>;

const GPS_ENDPOINT_MAX_OFFSET_MS = 2500;
const MAX_GPS_ACCURACY_M = 8;
const MAX_IMU_GAP_MS = 250;
const MIN_PHASE_MS = 5000;

export function selectWalkingFusionEvidence(input: {
  motion: readonly MotionSample[];
  gps: readonly PositionSample[];
  peakTimesMs: readonly number[];
  walkingPhase: { startMs: number; endMs: number } | null;
  backgroundInterrupted: boolean;
}): WalkingFusionEvidence {
  const empty = (reason: string): WalkingFusionEvidence => ({
    usable: false, reason, phaseStartMs: null, phaseEndMs: null, durationSeconds: null,
    alignedSteps: 0, sensorContinuous: false, startGps: null, endGps: null,
    gpsOffsetAtStartMs: null, gpsOffsetAtEndMs: null,
  });
  const motionTimes = input.motion
    .filter(sample => Number.isFinite(sample.timestampMs)
      && Number.isFinite(sample.accelerationMagnitudeMps2)
      && sample.accelerationMagnitudeMps2 >= 0
      && sample.accelerationMagnitudeMps2 < 200)
    .map(sample => sample.timestampMs).sort((a, b) => a - b);
  const phase = input.walkingPhase;
  if (!phase || !motionTimes.length
    || !Number.isFinite(phase.startMs) || !Number.isFinite(phase.endMs)
    || phase.startMs < 0 || phase.endMs - phase.startMs < MIN_PHASE_MS) {
    return empty('Keine ausreichend stabile Gehphase für eine Fusion gefunden.');
  }
  // detectWalkingPhase reports offsets from the earliest *valid* IMU timestamp.
  // GPS and live peak timestamps are already normalized to performance.now().
  const firstMotionMs = motionTimes[0];
  const phaseStartMs = firstMotionMs + phase.startMs;
  const phaseEndMs = firstMotionMs + phase.endMs;
  const alignedSteps = input.peakTimesMs
    .filter(t => Number.isFinite(t) && t >= phaseStartMs && t <= phaseEndMs).length;
  const inPhase = motionTimes.filter(t => t >= phaseStartMs && t <= phaseEndMs);
  let sensorContinuous = !input.backgroundInterrupted && inPhase.length >= 30
    && inPhase[0] - phaseStartMs <= MAX_IMU_GAP_MS
    && phaseEndMs - inPhase[inPhase.length - 1] <= 500;
  if (sensorContinuous) {
    for (let index = 1; index < inPhase.length; index++) {
      if (inPhase[index] - inPhase[index - 1] > MAX_IMU_GAP_MS) {
        sensorContinuous = false;
        break;
      }
    }
  }

  const goodGps = input.gps
    .filter(p => Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90
      && Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180
      && Number.isFinite(p.timestampMs) && Number.isFinite(p.accuracyM)
      && p.accuracyM > 0 && p.accuracyM <= MAX_GPS_ACCURACY_M)
    .sort((a, b) => a.timestampMs - b.timestampMs);
  const nearest = (at: number): PositionSample | null => {
    let best: PositionSample | null = null;
    for (const p of goodGps) {
      if (Math.abs(p.timestampMs - at) > GPS_ENDPOINT_MAX_OFFSET_MS) continue;
      if (!best || Math.abs(p.timestampMs - at) < Math.abs(best.timestampMs - at)
        || (Math.abs(p.timestampMs - at) === Math.abs(best.timestampMs - at) && p.accuracyM < best.accuracyM))
        best = p;
    }
    return best;
  };
  let startGps = nearest(phaseStartMs);
  let endGps = nearest(phaseEndMs);
  if (startGps && endGps && (startGps.timestampMs >= endGps.timestampMs
    || endGps.timestampMs - startGps.timestampMs < MIN_PHASE_MS)) {
    startGps = null;
    endGps = null;
  }
  const reason = input.backgroundInterrupted
    ? 'App war im Hintergrund; Sensorabdeckung nicht durchgehend.'
    : !sensorContinuous
      ? 'IMU-Unterbrechung innerhalb der Gehphase erkannt.'
      : alignedSteps < 5
        ? 'Zu wenige erkannte Schritte innerhalb der Gehphase.'
        : !startGps || !endGps
          ? 'Keine guten GPS-Fixes an beiden Gehphasen-Endpunkten; nur Schrittschätzung möglich.'
          : 'GPS- und IMU-Zeitfenster zugeordnet; Distanz weiterhin experimentell.';
  return {
    usable: sensorContinuous && alignedSteps >= 5,
    reason, phaseStartMs, phaseEndMs,
    durationSeconds: (phaseEndMs - phaseStartMs) / 1000,
    alignedSteps, sensorContinuous, startGps, endGps,
    gpsOffsetAtStartMs: startGps ? startGps.timestampMs - phaseStartMs : null,
    gpsOffsetAtEndMs: endGps ? endGps.timestampMs - phaseEndMs : null,
  };
}
