/** A relative winner/loser label from BOTH server-stored times.
 *  Does not claim anti-cheat verification or an official ranking result. */
export type DuelTime = { user_id: string; time_ms: number };
export type DuelOutcome = 'won' | 'lost' | 'tie' | 'pending';

export function determineDuelOutcome(rows: DuelTime[], userId: string, status: string): DuelOutcome {
  if (status !== 'completed' || rows.length !== 2 ||
      rows[0].user_id === rows[1].user_id) return 'pending';
  if (!rows.every(row => Number.isFinite(row.time_ms) && row.time_ms > 0)) return 'pending';
  const mine = rows.find(row => row.user_id === userId);
  const other = rows.find(row => row.user_id !== userId);
  if (!mine || !other) return 'pending';
  return mine.time_ms === other.time_ms ? 'tie'
    : mine.time_ms < other.time_ms ? 'won' : 'lost';
}
