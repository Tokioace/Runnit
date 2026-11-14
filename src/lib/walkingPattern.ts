import type { MotionSample } from './fairPlay';

/**
 * Independent, experimental offline pedometer for A/B field calibration.
 * Uses a short smoothing window, adaptive amplitude and recurring gait intervals.
 * It is NOT validated and must not affect FairPlay verdicts or ranked races.
 */
export function estimatePatternSteps(samples: readonly MotionSample[]): Readonly<{
  count: number;
  timestampsMs: readonly number[];
  cadenceSpm: number | null;
}> {
  const clean = samples.filter(s => Number.isFinite(s.timestampMs) &&
    Number.isFinite(s.accelerationMagnitudeMps2) &&
    s.accelerationMagnitudeMps2 >= 0 && s.accelerationMagnitudeMps2 < 200)
    .sort((a, b) => a.timestampMs - b.timestampMs);
  const accepted: number[] = [];
  let segment: MotionSample[] = [];
  const process = (part: MotionSample[]) => {
    if (part.length < 12) return;
    // Smooth ~100 ms without assuming a fixed device sampling frequency.
    const smooth = part.map((p, i) => {
      let sum = 0, n = 0;
      for (let j = i; j >= 0 && p.timestampMs - part[j].timestampMs <= 55; j--) { sum += part[j].accelerationMagnitudeMps2; n++; }
      for (let j = i + 1; j < part.length && part[j].timestampMs - p.timestampMs <= 55; j++) { sum += part[j].accelerationMagnitudeMps2; n++; }
      return sum / n;
    });
    // Local background amplitude: robust to changing pocket orientation and pace.
    const candidates: { t: number; amp: number }[] = [];
    for (let i = 2; i < part.length - 2; i++) {
      const v = smooth[i];
      if (v <= smooth[i - 1] || v < smooth[i + 1]) continue;
      let localMin = v;
      for (let j = i - 1; j >= 0 && part[i].timestampMs - part[j].timestampMs <= 230; j--) localMin = Math.min(localMin, smooth[j]);
      for (let j = i + 1; j < part.length && part[j].timestampMs - part[i].timestampMs <= 230; j++) localMin = Math.min(localMin, smooth[j]);
      const prominence = v - localMin;
      if (prominence < 0.65 || v < 0.9) continue;
      const last = candidates[candidates.length - 1];
      if (last && part[i].timestampMs - last.t < 320) {
        if (prominence > last.amp) candidates[candidates.length - 1] = { t: part[i].timestampMs, amp: prominence };
      } else candidates.push({ t: part[i].timestampMs, amp: prominence });
    }
    let run: number[] = [];
    const flush = () => { if (run.length >= 3) accepted.push(...run); run = []; };
    for (const p of candidates) {
      if (!run.length) { run = [p.t]; continue; }
      const dt = p.t - run[run.length - 1];
      if (dt < 320 || dt > 1200) { flush(); run = [p.t]; continue; }
      if (run.length >= 2) {
        const prior = run[run.length - 1] - run[run.length - 2];
        if (Math.abs(dt - prior) > Math.max(220, prior * 0.5)) { flush(); run = [p.t]; continue; }
      }
      run.push(p.t);
    }
    flush();
  };
  for (const p of clean) {
    if (segment.length && p.timestampMs - segment[segment.length - 1].timestampMs > 250) {
      process(segment); segment = [];
    }
    if (segment.length && p.timestampMs <= segment[segment.length - 1].timestampMs) continue;
    segment.push(p);
  }
  process(segment);
  const cadenceSpm = accepted.length >= 3 && accepted[accepted.length - 1] > accepted[0]
    ? 60000 * (accepted.length - 1) / (accepted[accepted.length - 1] - accepted[0]) : null;
  return { count: accepted.length, timestampsMs: accepted, cadenceSpm };
}
