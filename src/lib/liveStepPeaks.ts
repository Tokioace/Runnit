import type { MotionSample } from './fairPlay';

/**
 * Experimental causal detector for foreground DeviceMotion samples.
 * Uses gravity-free acceleration, an 11-sample centered moving average
 * (5-sample latency) and a +/-230 ms local-prominence gate.
 * Counts are provisional and must NOT be used as verified race/FairPlay evidence.
 */
export class LiveStepPeakCounter {
  private raw: { t: number; value: number }[] = [];
  private smooth: { t: number; value: number }[] = [];
  private nextIndex = 1;
  private lastInputMs: number | null = null;
  private lastStepMs = -Infinity;
  private accepted: number[] = [];

  get count(): number { return this.accepted.length; }
  get timestampsMs(): readonly number[] { return this.accepted; }

  reset(): void {
    this.raw = [];
    this.smooth = [];
    this.nextIndex = 1;
    this.lastInputMs = null;
    this.lastStepMs = -Infinity;
    this.accepted = [];
  }

  /** Return the new total only when a step is confirmed, otherwise null. */
  push(sample: Pick<MotionSample, 'timestampMs' | 'accelerationMagnitudeMps2'>): number | null {
    const t = sample.timestampMs;
    const value = sample.accelerationMagnitudeMps2;
    if (!Number.isFinite(t) || !Number.isFinite(value) || value < 0 || value >= 200) return null;
    if (this.lastInputMs !== null && (t <= this.lastInputMs || t - this.lastInputMs > 250)) {
      // Do not bridge a suspended iOS sensor stream or overlapping timestamps.
      // Keep previously confirmed steps, but discard an incomplete peak.
      this.raw = [];
      this.smooth = [];
      this.nextIndex = 1;
    }
    this.lastInputMs = t;
    this.raw.push({ t, value });
    if (this.raw.length > 11) this.raw.shift();
    if (this.raw.length < 11) return null;

    const center = this.raw[5].t;
    const average = this.raw.reduce((sum, item) => sum + item.value, 0) / 11;
    this.smooth.push({ t: center, value: average });
    let updated: number | null = null;
    // The right-hand 230ms window must exist before a peak is confirmed.
    while (this.nextIndex < this.smooth.length - 1 &&
      this.smooth[this.smooth.length - 1].t - this.smooth[this.nextIndex].t >= 230) {
      const index = this.nextIndex++;
      const peak = this.smooth[index];
      if (peak.value < 2.5 || peak.value <= this.smooth[index - 1].value ||
          peak.value < this.smooth[index + 1].value) continue;
      let leftMin = Infinity, rightMin = Infinity;
      let leftCount = 0, rightCount = 0;
      for (let i = index - 1; i >= 0 && peak.t - this.smooth[i].t <= 230; i--) {
        leftMin = Math.min(leftMin, this.smooth[i].value);
        leftCount++;
      }
      for (let i = index + 1; i < this.smooth.length && this.smooth[i].t - peak.t <= 230; i++) {
        rightMin = Math.min(rightMin, this.smooth[i].value);
        rightCount++;
      }
      if (leftCount < 2 || rightCount < 2 ||
          peak.value - leftMin < 1 || peak.value - rightMin < 1 ||
          peak.t - this.lastStepMs < 380) continue;
      this.lastStepMs = peak.t;
      this.accepted.push(peak.t);
      updated = this.accepted.length;
    }
    // Bounded history; no full signal reprocessing at 60Hz.
    while (this.smooth.length && this.nextIndex > 1 &&
      this.smooth[this.smooth.length - 1].t - this.smooth[0].t > 1000) {
      this.smooth.shift();
      this.nextIndex--;
    }
    return updated;
  }
}
