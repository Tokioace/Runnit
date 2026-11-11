/** Diagnostic-only IMU gaps, computed from full-rate samples before chart decimation. */
export function findImuGaps(samples: readonly { timestampMs: number }[], thresholdMs = 250): { startMs: number; endMs: number }[] {
  const times = samples.map(s => s.timestampMs).filter(Number.isFinite).sort((a, b) => a - b);
  const gaps: { startMs: number; endMs: number }[] = [];
  for (let i = 1; i < times.length; i++) {
    if (times[i] - times[i - 1] > thresholdMs) gaps.push({ startMs: times[i - 1], endMs: times[i] });
  }
  return gaps;
}

/** Split a decimated chart trace only at verified full-rate gaps. */
export function splitTraceAtGaps<T extends { timestampMs: number }>(samples: readonly T[], gaps: readonly { startMs: number; endMs: number }[]): T[][] {
  const segments: T[][] = [];
  for (const sample of samples) {
    const last = segments[segments.length - 1];
    const previous = last?.[last.length - 1];
    if (!previous || gaps.some(g => g.startMs >= previous.timestampMs && g.endMs <= sample.timestampMs)) segments.push([]);
    segments[segments.length - 1].push(sample);
  }
  return segments;
}
