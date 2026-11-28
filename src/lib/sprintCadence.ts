/**
 * Experimental sprint-cadence candidate detector, isolated from the proven
 * walking counter. Peaks are NOT verified steps and cannot establish speed,
 * distance, sprint performance or anti-cheat evidence. A shaken phone can
 * mimic rhythmic peaks. No network, GPS, auth, microphone or storage.
 */
export type SprintMotionSample = Readonly<{
  timestampMs: number;
  accelerationMagnitudeMps2: number;
}>;

export type SprintCadenceStatus =
  | 'sprint-like-rhythm'
  | 'slow-rhythm'
  | 'irregular'
  | 'sensor-gap'
  | 'insufficient-evidence';

export type SprintCadenceAnalysis = Readonly<{
  status: SprintCadenceStatus;
  candidatePeakTimesMs: readonly number[];
  candidateCount: number;
  cadenceSpm: number | null;
  intervalVariation: number | null;
  sensorGapCount: number;
  rejectedSamples: number;
  reason: string;
}>;

const MAX_SAMPLE_GAP_MS = 250;
const MIN_PEAK_INTERVAL_MS = 190;
const MAX_PEAK_WINDOW_MS = 110;
const MIN_PEAK_MPS2 = 4;
const MIN_PROMINENCE_MPS2 = 1.8;
const MIN_RHYTHMIC_PEAKS = 6;

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Does not interpolate across missing DeviceMotion updates. Input is expected
 * in event arrival order; invalid/out-of-order samples are skipped, never
 * reordered into a misleading cadence.
 */
export function analyzeSprintCadence(samples: readonly SprintMotionSample[]): SprintCadenceAnalysis {
  const valid: (SprintMotionSample & { segment: number })[] = [];
  let rejectedSamples = 0;
  let sensorGapCount = 0;
  let segment = 0;

  for (const sample of samples) {
    if (!Number.isFinite(sample.timestampMs) ||
      !Number.isFinite(sample.accelerationMagnitudeMps2) ||
      sample.accelerationMagnitudeMps2 < 0 || sample.accelerationMagnitudeMps2 >= 200) {
      rejectedSamples++;
      continue;
    }
    const previous = valid[valid.length - 1];
    if (previous && sample.timestampMs <= previous.timestampMs) {
      rejectedSamples++;
      continue;
    }
    if (previous && sample.timestampMs - previous.timestampMs > MAX_SAMPLE_GAP_MS) {
      sensorGapCount++;
      segment++;
    }
    valid.push({ ...sample, segment });
  }

  const peaks: { timestampMs: number; segment: number }[] = [];
  for (let i = 1; i < valid.length - 1; i++) {
    const peak = valid[i];
    if (valid[i - 1].segment !== peak.segment || valid[i + 1].segment !== peak.segment ||
      peak.accelerationMagnitudeMps2 < MIN_PEAK_MPS2 ||
      peak.accelerationMagnitudeMps2 <= valid[i - 1].accelerationMagnitudeMps2 ||
      peak.accelerationMagnitudeMps2 < valid[i + 1].accelerationMagnitudeMps2) continue;

    let leftMin = peak.accelerationMagnitudeMps2;
    let rightMin = peak.accelerationMagnitudeMps2;
    for (let j = i - 1; j >= 0 && valid[j].segment === peak.segment &&
      peak.timestampMs - valid[j].timestampMs <= MAX_PEAK_WINDOW_MS; j--) {
      leftMin = Math.min(leftMin, valid[j].accelerationMagnitudeMps2);
    }
    for (let j = i + 1; j < valid.length && valid[j].segment === peak.segment &&
      valid[j].timestampMs - peak.timestampMs <= MAX_PEAK_WINDOW_MS; j++) {
      rightMin = Math.min(rightMin, valid[j].accelerationMagnitudeMps2);
    }
    if (peak.accelerationMagnitudeMps2 - Math.max(leftMin, rightMin) < MIN_PROMINENCE_MPS2) continue;

    const last = peaks[peaks.length - 1];
    if (last && last.segment === peak.segment && peak.timestampMs - last.timestampMs < MIN_PEAK_INTERVAL_MS)
      continue;
    peaks.push({ timestampMs: peak.timestampMs, segment: peak.segment });
  }

  const base = {
    candidatePeakTimesMs: peaks.map(p => p.timestampMs),
    candidateCount: peaks.length,
    sensorGapCount, rejectedSamples,
  };
  const report = (status: SprintCadenceStatus, cadenceSpm: number | null,
    intervalVariation: number | null, reason: string): SprintCadenceAnalysis =>
    ({ ...base, status, cadenceSpm, intervalVariation, reason });

  if (sensorGapCount > 0)
    return report('sensor-gap', null, null, 'IMU-Aufzeichnung unterbrochen. Keine Kadenz über Sensorlücken schätzen.');

  const latest = peaks.slice(-10);
  if (latest.length < MIN_RHYTHMIC_PEAKS)
    return report('insufficient-evidence', null, null, 'Zu wenige markante Beschleunigungsspitzen für einen Rhythmus.');
  const intervals = latest.slice(1).map((p, i) => p.timestampMs - latest[i].timestampMs);
  const typicalMs = median(intervals);
  const variation = median(intervals.map(ms => Math.abs(ms - typicalMs))) / typicalMs;
  if (!Number.isFinite(typicalMs) || typicalMs <= 0 || variation > 0.2)
    return report('irregular', null, variation, 'Spitzenabstände zu unregelmäßig; keine Sprintkadenz melden.');
  const cadenceSpm = 60000 / typicalMs;
  if (cadenceSpm < 140 || cadenceSpm > 300)
    return report('slow-rhythm', cadenceSpm, variation, 'Rhythmisch, aber außerhalb des experimentellen Sprintkadenzfensters.');
  return report('sprint-like-rhythm', cadenceSpm, variation,
    'Sprintähnlicher Bewegungsrhythmus – kein Beweis für echte Schritte oder Sprinten.');
}

export type SyntheticSprintMode = 'running-165' | 'running-225' | 'walking-110' | 'phone-shakes' | 'motion-gap';

/** Deterministic artificial impulse traces, only for the indoor simulator. */
export function syntheticSprintTrace(mode: SyntheticSprintMode): SprintMotionSample[] {
  const cadenceSpm = mode === 'walking-110' ? 110 : mode === 'running-225' || mode === 'motion-gap' ? 225 : 165;
  const periodMs = 60000 / cadenceSpm;
  const centers: number[] = [];
  if (mode === 'phone-shakes') {
    centers.push(500, 1320, 1560, 3380, 5050, 5410, 7100);
  } else {
    for (let t = 500; t < 8500; t += periodMs) centers.push(t);
  }
  const trace: SprintMotionSample[] = [];
  for (let t = 0; t <= 8800; t += 10) {
    if (mode === 'motion-gap' && t > 2800 && t < 4100) continue;
    const nearest = centers.reduce((best, center) => Math.min(best, Math.abs(t - center)), Infinity);
    const impulse = 7.5 * Math.exp(-Math.pow(nearest / 23, 2));
    trace.push({ timestampMs: t, accelerationMagnitudeMps2: 0.5 + impulse });
  }
  return trace;
}
