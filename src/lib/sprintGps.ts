/**
 * Experimental GPS sprint evaluator. Pure and deterministic: no permissions,
 * network calls or writes. It does NOT certify timing accuracy or prevent cheating.
 * Distance is straight-line displacement from the first accepted sample, NOT a
 * GPS path-length measurement. Suitable for reproducible synthetic testing only.
 */
export type GpsSample = Readonly<{
  latitude: number;
  longitude: number;
  accuracyM: number;
  timestampMs: number;
}>;

export type GpsDecision =
  | 'accepted'
  | 'poor-accuracy'
  | 'invalid-sample'
  | 'before-start'
  | 'out-of-order'
  | 'too-frequent'
  | 'implausible-speed'
  | 'already-finished';

export type GpsSprintState = Readonly<{
  targetMeters: number;
  startedAtMs: number;
  origin: GpsSample | null;
  lastAccepted: GpsSample | null;
  distanceM: number;
  maxSpeedMps: number;
  acceptedSamples: number;
  rejectedSamples: number;
  beyondTargetCount: number;
  crossingTimestampMs: number | null;
  finishTimestampMs: number | null;
  lastDecision: GpsDecision | null;
}>;

const MAX_ACCURACY_M = 15;
const MAX_SPEED_MPS = 12;
const MIN_SAMPLE_INTERVAL_MS = 200;

export function haversineMeters(a: GpsSample, b: GpsSample): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const lat1 = a.latitude * rad;
  const lat2 = b.latitude * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function createGpsSprint(targetMeters: number, startedAtMs: number): GpsSprintState {
  if (![50, 75, 100].includes(targetMeters) || !Number.isFinite(startedAtMs)) {
    throw new Error('Unsupported sprint distance or start time');
  }
  return {
    targetMeters, startedAtMs, origin: null, lastAccepted: null, distanceM: 0,
    maxSpeedMps: 0, acceptedSamples: 0, rejectedSamples: 0, beyondTargetCount: 0,
    crossingTimestampMs: null, finishTimestampMs: null, lastDecision: null,
  };
}

function reject(state: GpsSprintState, reason: GpsDecision): GpsSprintState {
  return { ...state, rejectedSamples: state.rejectedSamples + 1, lastDecision: reason };
}

export function advanceGpsSprint(state: GpsSprintState, sample: GpsSample): GpsSprintState {
  if (state.finishTimestampMs !== null) return { ...state, lastDecision: 'already-finished' };
  if (
    !Number.isFinite(sample.latitude) || sample.latitude < -90 || sample.latitude > 90 ||
    !Number.isFinite(sample.longitude) || sample.longitude < -180 || sample.longitude > 180 ||
    !Number.isFinite(sample.accuracyM) || sample.accuracyM < 0 ||
    !Number.isFinite(sample.timestampMs)
  ) return reject(state, 'invalid-sample');
  if (sample.timestampMs < state.startedAtMs) return reject(state, 'before-start');
  if (sample.accuracyM > MAX_ACCURACY_M) return reject(state, 'poor-accuracy');

  const prev = state.lastAccepted;
  if (!prev) {
    return { ...state, origin: sample, lastAccepted: sample, acceptedSamples: 1, lastDecision: 'accepted' };
  }
  const elapsedMs = sample.timestampMs - prev.timestampMs;
  if (elapsedMs <= 0) return reject(state, 'out-of-order');
  if (elapsedMs < MIN_SAMPLE_INTERVAL_MS) return reject(state, 'too-frequent');

  const speedMps = haversineMeters(prev, sample) / (elapsedMs / 1000);
  if (speedMps > MAX_SPEED_MPS) {
    // Never replace lastAccepted with a rejected GPS jump.
    return reject(state, 'implausible-speed');
  }
  const distanceM = haversineMeters(state.origin!, sample);
  const isBeyond = distanceM >= state.targetMeters;
  const beyondTargetCount = isBeyond ? state.beyondTargetCount + 1 : 0;
  let crossingTimestampMs = isBeyond ? state.crossingTimestampMs : null;
  if (isBeyond && crossingTimestampMs === null) {
    const oldDistance = state.distanceM;
    const fraction = distanceM > oldDistance
      ? Math.max(0, Math.min(1, (state.targetMeters - oldDistance) / (distanceM - oldDistance)))
      : 1;
    crossingTimestampMs = prev.timestampMs + Math.round(elapsedMs * fraction);
  }
  return {
    ...state, lastAccepted: sample, distanceM,
    maxSpeedMps: Math.max(state.maxSpeedMps, speedMps),
    acceptedSamples: state.acceptedSamples + 1, beyondTargetCount, crossingTimestampMs,
    finishTimestampMs: beyondTargetCount >= 2 ? crossingTimestampMs : null,
    lastDecision: 'accepted',
  };
}

export function runGpsSimulation(targetMeters: number, startedAtMs: number, samples: GpsSample[]): GpsSprintState {
  return samples.reduce(advanceGpsSprint, createGpsSprint(targetMeters, startedAtMs));
}

/** Fake coordinates along the equator. Never send these to a ranking service. */
export function syntheticPoint(distanceMeters: number, timestampMs: number, accuracyM = 3): GpsSample {
  return { latitude: 0, longitude: distanceMeters / (6371000 * Math.PI / 180), accuracyM, timestampMs };
}
