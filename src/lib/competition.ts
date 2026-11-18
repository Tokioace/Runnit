import type { RaceHistoryItem } from './runnerHistory';

export type RivalSummary = {
  userId: string;
  name: string;
  duels: number;
  wins: number;
  losses: number;
  ties: number;
  lastPlayedAt: string;
  lastDistanceM: number;
  lastMyTimeMs: number;
  lastTheirTimeMs: number;
};

/** Private, authenticated head-to-head records derived from paired Supabase results.
 * No suggested opponents, fake pending invitations, or generated challenge outcomes. */
export function summarizeRivals(races: readonly RaceHistoryItem[]): RivalSummary[] {
  const rivals = new Map<string, RivalSummary>();
  const ordered = [...races].filter(r => r.completed &&
    r.opponentUserId && r.opponentTimeMs !== null &&
    r.outcome !== 'pending'
  ).sort((a,b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  for (const race of ordered) {
    const id = race.opponentUserId!;
    let summary = rivals.get(id);
    if (!summary) {
      summary = {
        userId: id, name: race.opponentName || 'RUNNER',
        duels: 0, wins: 0, losses: 0, ties: 0,
        lastPlayedAt: race.occurredAt, lastDistanceM: race.distanceM,
        lastMyTimeMs: race.timeMs, lastTheirTimeMs: race.opponentTimeMs!,
      };
      rivals.set(id, summary);
    }
    summary.duels++;
    if (race.outcome === 'won') summary.wins++;
    else if (race.outcome === 'lost') summary.losses++;
    else summary.ties++;
  }
  return [...rivals.values()].sort((a,b) =>
    b.duels - a.duels || Date.parse(b.lastPlayedAt) - Date.parse(a.lastPlayedAt));
}
