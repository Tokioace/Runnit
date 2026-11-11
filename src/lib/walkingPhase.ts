import type { MotionSample } from './fairPlay';

/** Estimates the sustained movement interval; not a validated step detector. */
export function detectWalkingPhase(samples: MotionSample[]): { startMs: number; endMs: number } | null {
  if (samples.length < 30) return null;
  const first = samples.find(sample => Number.isFinite(sample.timestampMs) && Number.isFinite(sample.accelerationMagnitudeMps2))?.timestampMs;
  if (first === undefined) return null;
  const bins = new Map<number, { energy: number; count: number }>();
  for (const sample of samples) {
    if (!Number.isFinite(sample.timestampMs) || !Number.isFinite(sample.accelerationMagnitudeMps2)) continue;
    const index = Math.floor((sample.timestampMs - first) / 500);
    if (index < 0) continue;
    const bin = bins.get(index) ?? { energy: 0, count: 0 };
    bin.energy += Math.min(100, sample.accelerationMagnitudeMps2 ** 2);
    bin.count++;
    bins.set(index, bin);
  }
  const active = [...bins.entries()].filter(([, b]) => b.count >= 8 && Math.sqrt(b.energy / b.count) >= 1.15).map(([i]) => i).sort((a, b) => a - b);
  if (!active.length) return null;
  let best: { start: number; end: number } | null = null;
  let start = active[0], end = active[0];
  for (const index of active.slice(1)) {
    // Never bridge a missing 500 ms window: the IMU may have stopped recording.
    if (index - end === 1) { end = index; continue; }
    if (!best || end - start > best.end - best.start) best = { start, end };
    start = end = index;
  }
  if (!best || end - start > best.end - best.start) best = { start, end };
  if (best.end - best.start < 5) return null;
  return { startMs: best.start * 500, endMs: (best.end + 1) * 500 };
}
