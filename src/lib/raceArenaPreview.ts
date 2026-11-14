/**
 * Deterministic, synthetic 1-v-1 HUD preview. No GPS, IMU, user identity,
 * network, real race state or leaderboard. All speeds are invented demo values.
 */
export type DemoRaceMeters = 50 | 75 | 100;
export type DemoRaceScenario = 'balanced' | 'chase' | 'fast-rival';
export type DemoRaceSnapshot = Readonly<{
  targetMeters: DemoRaceMeters;
  elapsedMs: number;
  /** Your on-screen stopwatch stops at your own finish, independently of rival. */
  yourElapsedMs: number;
  youFinished: boolean;
  rivalFinished: boolean;
  /** Status of the first runner to cross, even while the other keeps running. */
  firstFinisher: 'you' | 'rival' | 'tie' | null;
  /** Distance between runners at the FIRST finish (never after both reach 100%). */
  firstFinishGapM: number | null;
  /** Difference between simulated finish times; available only once winner has crossed. */
  finishMarginMs: number | null;
  youMeters: number;
  rivalMeters: number;
  leadMeters: number;
  yourFinishMs: number;
  rivalFinishMs: number;
  finished: boolean;
  winner: 'you' | 'rival' | 'tie' | null;
}>;

function distanceAt(seconds: number, topSpeedMps: number): number {
  // Simple fictional acceleration curve. Never infer actual human movement.
  const secondsValid = Math.max(0, seconds);
  const accelerationTimeSeconds = 1.25;
  return topSpeedMps * (secondsValid - accelerationTimeSeconds *
    (1 - Math.exp(-secondsValid / accelerationTimeSeconds)));
}

function finishMs(target: number, speed: number): number {
  let low = 0, high = 90;
  for (let i = 0; i < 45; i++) {
    const middle = (low + high) / 2;
    if (distanceAt(middle, speed) >= target) high = middle;
    else low = middle;
  }
  return Math.round(high * 1000);
}

const SPEEDS: Record<DemoRaceScenario, readonly [number, number]> = {
  balanced: [8.0, 7.8],
  chase: [8.5, 7.5],
  'fast-rival': [7.4, 8.7],
};

export function demoRaceSnapshot(input: {
  targetMeters: DemoRaceMeters;
  scenario: DemoRaceScenario;
  elapsedMs: number;
}): DemoRaceSnapshot {
  const { targetMeters, scenario, elapsedMs } = input;
  if (![50, 75, 100].includes(targetMeters) || !(scenario in SPEEDS) ||
    !Number.isFinite(elapsedMs)) throw new Error('Unsupported demo race configuration');
  const safeElapsedMs = Math.max(0, elapsedMs);
  const [youSpeed, rivalSpeed] = SPEEDS[scenario];
  const yourFinishMs = finishMs(targetMeters, youSpeed);
  const rivalFinishMs = finishMs(targetMeters, rivalSpeed);
  const youMeters = Math.min(targetMeters, distanceAt(safeElapsedMs / 1000, youSpeed));
  const rivalMeters = Math.min(targetMeters, distanceAt(safeElapsedMs / 1000, rivalSpeed));
  const youFinished = safeElapsedMs >= yourFinishMs;
  const rivalFinished = safeElapsedMs >= rivalFinishMs;
  const firstFinishMs = Math.min(yourFinishMs, rivalFinishMs);
  const firstFinisher = safeElapsedMs < firstFinishMs ? null
    : yourFinishMs === rivalFinishMs ? 'tie' : yourFinishMs < rivalFinishMs ? 'you' : 'rival';
  const firstFinishGapM = firstFinisher === null ? null : firstFinisher === 'tie' ? 0
    : firstFinisher === 'you'
      ? Math.max(0, targetMeters - distanceAt(firstFinishMs / 1000, rivalSpeed))
      : Math.max(0, targetMeters - distanceAt(firstFinishMs / 1000, youSpeed));
  const finished = youFinished && rivalFinished;
  const winner = finished ? firstFinisher : null;
  return {
    targetMeters, elapsedMs: safeElapsedMs,
    yourElapsedMs: Math.min(safeElapsedMs, yourFinishMs), youFinished, rivalFinished,
    firstFinisher, firstFinishGapM,
    finishMarginMs: firstFinisher === null ? null : Math.abs(yourFinishMs - rivalFinishMs),
    youMeters, rivalMeters,
    leadMeters: youMeters - rivalMeters,
    yourFinishMs, rivalFinishMs, finished, winner,
  };
}
