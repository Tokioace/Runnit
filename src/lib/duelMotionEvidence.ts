import { analyzeSprintCadence, type SprintMotionSample } from './sprintCadence.ts';

export type DuelMotionEvidence = Readonly<{
  motionEvidence: 'consistent' | 'uncertain' | 'incomplete';
  motionCoverage: number;
  motionSamples: number;
  motionGapCount: number;
  sprintCadenceSpm: number | null;
}>;

const MAX_SAMPLES = 30000;
const MAX_GAP_MS = 250;

/** Explicit Ready gesture only; permission failure is not a race failure. */
export async function requestDuelMotionPermission(): Promise<void> {
  try {
    if (typeof DeviceMotionEvent === 'undefined') return;
    const motion = DeviceMotionEvent as typeof DeviceMotionEvent & {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    if (typeof motion.requestPermission === 'function') await motion.requestPermission();
  } catch { /* unavailable, denied or browser gesture restriction */ }
}

/** Convert modern DOM monotonic event timestamps to the GPS epoch clock.
 * Reject ambiguous, future or stale timestamps instead of inventing a sample time.
 */
export function motionEventSample(
  event: Pick<DeviceMotionEvent, 'timeStamp' | 'acceleration'>,
  timeOrigin: number, nowMs: number,
): SprintMotionSample | null {
  const a = event.acceleration;
  const t = event.timeStamp;
  if (!a || a.x === null || a.y === null || a.z === null ||
      !Number.isFinite(timeOrigin) || !Number.isFinite(nowMs) ||
      !Number.isFinite(t) || t < 0 || t > nowMs || nowMs - t > 1000 ||
      ![a.x, a.y, a.z].every(Number.isFinite)) return null;
  const magnitude = Math.hypot(a.x, a.y, a.z);
  const timestampMs = timeOrigin + t;
  if (!Number.isFinite(timestampMs) || magnitude >= 200) return null;
  return { timestampMs, accelerationMagnitudeMps2: magnitude };
}

/** Bounded, local-only samples. No coordinates, audio, or raw sensor upload. */
export class DuelMotionCapture {
  private samples: SprintMotionSample[] = [];
  private truncated = false;
  private resumeAfterMs: number | null = null;
  private firstResumeMs: number | null = null;
  private discontinuities = new Set<number>();
  private resumePending = false;
  private readonly startedAtMs: number;

  constructor(startedAtMs: number) {
    this.startedAtMs = startedAtMs;
  }

  /** Keep previous samples but mark the explicit interruption as a gap. */
  resumeAfter(timestampMs: number): void {
    if (!Number.isFinite(timestampMs)) return;
    this.resumeAfterMs = Math.max(this.resumeAfterMs ?? -Infinity, timestampMs);
    this.firstResumeMs = Math.min(this.firstResumeMs ?? Infinity, timestampMs);
    this.resumePending = true;
  }

  push(sample: SprintMotionSample): boolean {
    if (!Number.isFinite(sample.timestampMs) || sample.timestampMs < this.startedAtMs ||
        !Number.isFinite(sample.accelerationMagnitudeMps2) ||
        sample.accelerationMagnitudeMps2 < 0 || sample.accelerationMagnitudeMps2 >= 200) return false;
    if (this.resumeAfterMs !== null && sample.timestampMs <= this.resumeAfterMs) return false;
    const previous = this.samples[this.samples.length - 1];
    if (previous && sample.timestampMs <= previous.timestampMs) return false;
    if (this.samples.length >= MAX_SAMPLES) { this.truncated = true; return false; }
    if (this.resumePending) {
      this.discontinuities.add(this.samples.length);
      this.resumePending = false;
    }
    this.samples.push({ ...sample });
    return true;
  }

  summarize(finishedAtMs: number, distanceM: number): DuelMotionEvidence {
    const duration = finishedAtMs - this.startedAtMs;
    const samples = this.samples.filter(s => s.timestampMs <= finishedAtMs);
    let observed = 0;
    let gaps = 0;
    for (let i = 1; i < samples.length; i++) {
      const interval = samples[i].timestampMs - samples[i - 1].timestampMs;
      if (interval > MAX_GAP_MS || this.discontinuities.has(i)) gaps++;
      else observed += interval;
    }
    const coverage = Number.isFinite(duration) && duration > 0 ? Math.min(1, observed / duration) : 0;
    const interrupted = this.firstResumeMs !== null && this.firstResumeMs <= finishedAtMs;
    const enough = !this.truncated && !interrupted && samples.length >= 10 && coverage >= 0.7 && gaps === 0;
    const analysis = enough ? analyzeSprintCadence(samples) : null;
    const speed = duration > 0 ? distanceM / (duration / 1000) : 0;
    const consistent = analysis?.status === 'sprint-like-rhythm' &&
      Number.isFinite(speed) && speed >= 3 && speed <= 15;
    return {
      motionEvidence: !enough ? 'incomplete' : consistent ? 'consistent' : 'uncertain',
      motionCoverage: coverage,
      motionSamples: samples.length,
      motionGapCount: gaps,
      sprintCadenceSpm: analysis?.status === 'sprint-like-rhythm' ? analysis.cadenceSpm : null,
    };
  }
}
