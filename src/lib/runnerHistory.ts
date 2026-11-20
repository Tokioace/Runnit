export type RaceOutcome = 'won' | 'lost' | 'tie' | 'pending';
export type StoredDuelResult = {
  duel_id: string; user_id: string; time_ms: number;
  steps_count: number | null; distance_m: number | null; created_at: string;
};
export type StoredDuel = {
  id: string; status: string; target_distance_m: number | null;
  host_user_id: string | null; challenger_user_id: string | null; created_at: string;
};
export type PairedResult = { user_id: string; time_ms: number; username?: string | null };
export type StoredGhostSession = {
  id: string; created_at: string; target_distance_m: number;
  run_state: string; elapsed_ms: number | null;
  observed_distance_m: number; steps_count: number; motion_permission?: string;
};
export type RaceHistoryItem = {
  id: string; occurredAt: string; distanceM: number; timeMs: number;
  stepsCount: number | null; measuredDistanceM: number | null;
  completed: boolean; outcome: RaceOutcome; opponentTimeMs: number | null;
  opponentUserId?: string | null; opponentName?: string | null;
};
export type ActivityTotals = {
  completedDuels: number; wins: number; losses: number; ties: number;
  recordedSessions: number; weeklySessions: number;
  weeklySteps: number | null; weeklyDistanceM: number | null;
  best50Ms: number | null; best75Ms: number | null; best100Ms: number | null;
};

const nonnegative = (value: number | null | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

export function raceHistoryFromServer(
  userId: string,
  results: readonly StoredDuelResult[],
  duels: readonly StoredDuel[],
  pairedResults: ReadonlyMap<string, readonly PairedResult[]>,
): RaceHistoryItem[] {
  const byId = new Map(duels.map(duel => [duel.id, duel]));
  return results.flatMap((result) => {
    const duel = byId.get(result.duel_id);
    if (!duel || result.user_id !== userId || !Number.isFinite(result.time_ms) || result.time_ms <= 0) return [];
    if (duel.host_user_id !== userId && duel.challenger_user_id !== userId) return [];
    const paired = pairedResults.get(duel.id) ?? [];
    // Require two distinct authorized participants, with no duplicate identities.
    const correctParticipants = Boolean(duel.host_user_id) &&
      Boolean(duel.challenger_user_id) &&
      duel.host_user_id !== duel.challenger_user_id &&
      paired.length === 2 &&
      new Set(paired.map(row => row.user_id)).size === 2 &&
      // The authorized pair must agree with the player's stored result before ranking.
      paired.some(row => row.user_id === userId && row.time_ms === result.time_ms) &&
      paired.some(row => row.user_id === duel.host_user_id) &&
      paired.some(row => row.user_id === duel.challenger_user_id) &&
      paired.every(row => Number.isFinite(row.time_ms) && row.time_ms > 0);
    const rival = correctParticipants ? paired.find(row => row.user_id !== userId) : undefined;
    const completed = duel.status === 'completed' && Boolean(rival);
    const outcome: RaceOutcome = !completed || !rival ? 'pending'
      : result.time_ms < rival.time_ms ? 'won'
        : result.time_ms > rival.time_ms ? 'lost' : 'tie';
    // A race target is not a sensor reading. Missing GPS distance remains unknown.
    const measuredDistanceM = nonnegative(result.distance_m);
    return [{
      id: result.duel_id, occurredAt: result.created_at || duel.created_at,
      distanceM: nonnegative(duel.target_distance_m) ?? 0,
      timeMs: result.time_ms, stepsCount: nonnegative(result.steps_count),
      measuredDistanceM, completed, outcome,
      opponentTimeMs: rival?.time_ms ?? null,
      opponentUserId: rival?.user_id ?? null,
      opponentName: rival?.username?.trim() || null,
    }];
  }).sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
}

/** Only recorded sensor sessions and completed server-paired duels count.
 * This is NOT a daily pedometer, calorie estimator, or anti-cheat rating. */
export function calculateActivityTotals(
  races: readonly RaceHistoryItem[],
  ghosts: readonly StoredGhostSession[],
  weekStartMs: number,
): ActivityTotals {
  const finishedRaces = races.filter(r => r.completed);
  const finishedGhosts = ghosts.filter(g => g.run_state === 'finished' &&
    Number.isFinite(g.elapsed_ms) && (g.elapsed_ms ?? 0) > 0);
  // Include exactly the selected local week, even across DST boundaries.
  const weekEnd = new Date(weekStartMs);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndMs = weekEnd.getTime();
  const isInWeek = (date: string) => {
    const stamp = Date.parse(date);
    return Number.isFinite(stamp) && stamp >= weekStartMs && stamp < weekEndMs;
  };
  const weekRaces = finishedRaces.filter(r => isInWeek(r.occurredAt));
  const weekGhosts = finishedGhosts.filter(g => isInWeek(g.created_at));
  const steps = [
    ...weekRaces.map(r => nonnegative(r.stepsCount)),
    ...weekGhosts.map(g => g.motion_permission === 'granted' ? nonnegative(g.steps_count) : null),
  ].filter((value): value is number => value !== null);
  const distances = [
    ...weekRaces.map(r => nonnegative(r.measuredDistanceM)),
    ...weekGhosts.map(g => nonnegative(g.observed_distance_m)),
  ].filter((value): value is number => value !== null);
  const best = (distance: number) => finishedRaces
    .filter(r => r.distanceM === distance)
    .reduce<number | null>((min, r) => min === null ? r.timeMs : Math.min(min, r.timeMs), null);
  return {
    completedDuels: finishedRaces.length,
    wins: finishedRaces.filter(r => r.outcome === 'won').length,
    losses: finishedRaces.filter(r => r.outcome === 'lost').length,
    ties: finishedRaces.filter(r => r.outcome === 'tie').length,
    recordedSessions: finishedRaces.length + finishedGhosts.length,
    weeklySessions: weekRaces.length + weekGhosts.length,
    weeklySteps: steps.length ? Math.round(steps.reduce((a, b) => a + b, 0)) : null,
    weeklyDistanceM: distances.length ? distances.reduce((a, b) => a + b, 0) : null,
    best50Ms: best(50), best75Ms: best(75), best100Ms: best(100),
  };
}

export function currentLocalWeekStart(now = new Date()): number {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start.getTime();
}
export function formatRaceTime(timeMs: number | null | undefined): string {
  return typeof timeMs === 'number' && Number.isFinite(timeMs) && timeMs > 0
    ? (timeMs / 1000).toFixed(2).replace('.', ',') + ' s'
    : '—';
}

