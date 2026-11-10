import type { MotionSample } from './fairPlay';

/**
 * Experimental, causal peak counter for foreground DeviceMotion samples.
 * Detects raw acceleration crests backed by a local 250 ms rise, then
 * debounces subsequent crests for 450 ms. This avoids losing short footfall
 * impulses to smoothing while suppressing multiple crests from one step.
 *
 * Counts are provisional: device position, pace and phone handling affect
 * sensitivity; this does not verify a step or provide FairPlay evidence.
 */
export class LiveStepPeakCounter {
  private recent: { t: number; value: number }[] = [];
  private lastInputMs: number | null = null;
  private lastStepMs = -Infinity;
  private accepted: number[] = [];

  get count(): number { return this.accepted.length; }
  get timestampsMs(): readonly number[] { return this.accepted; }

  reset(): void {
    this.recent = [];
    this.lastInputMs = null;
    this.lastStepMs = -Infinity;
    this.accepted = [];
  }

  /** Return a new total on each confirmed local crest; otherwise null. */
  push(sample: Pick<MotionSample, 'timestampMs' | 'accelerationMagnitudeMps2'>): number | null {
    const t = sample.timestampMs;
    const value = sample.accelerationMagnitudeMps2;
    if (!Number.isFinite(t) || !Number.isFinite(value) || value < 0 || value >= 200) return null;
    if (this.lastInputMs !== null && (t <= this.lastInputMs || t - this.lastInputMs > 250)) {
      // Never infer steps across suspended sensor events or stale timestamps.
      // Previously accepted steps remain visible.
      this.recent = [];
    }
    this.lastInputMs = t;
    this.recent.push({ t, value });
    // Keep at most the preceding 250 ms plus the two nearest neighbours.
    while (this.recent.length > 3 && this.recent[0].t < t - 270) this.recent.shift();
    const length = this.recent.length;
    if (length < 3) return null;

    const preceding = this.recent[length - 3];
    const peak = this.recent[length - 2];
    const following = this.recent[length - 1];
    if (peak.value < 3.5 || peak.value <= preceding.value || peak.value < following.value ||
        peak.t - this.lastStepMs < 450) return null;

    let baseline = Infinity;
    let baselineSamples = 0;
    for (let i = 0; i < length - 2; i++) {
      const previous = this.recent[i];
      if (peak.t - previous.t > 250) continue;
      baseline = Math.min(baseline, previous.value);
      baselineSamples++;
    }
    if (baselineSamples < 2 || peak.value - baseline < 2) return null;

    this.lastStepMs = peak.t;
    this.accepted.push(peak.t);
    return this.accepted.length;
  }
}
