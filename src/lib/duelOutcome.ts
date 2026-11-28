/** A relative winner/loser label from BOTH server-stored times.
 *  Does not claim anti-cheat verification or an official ranking result. */
export type DuelTime = { user_id: string; time_ms: number };
export type DuelOutcome = 'won' | 'lost' | 'tie' | 'pending';

/** Validate the entire result snapshot rather than discarding contradictory rows.
 * One valid row is allowed while the other participant has not finished. */
export function validateDuelResultRows<T extends DuelTime>(
  rows: readonly T[], hostId: string | null, challengerId: string | null,
): T[] | null {
  if (typeof hostId !== 'string' || !hostId.trim() ||
      typeof challengerId !== 'string' || !challengerId.trim() ||
      hostId === challengerId || !Array.isArray(rows) || rows.length > 2) return null;
  const seen = new Set<string>();
  const valid: T[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object' ||
        (row.user_id !== hostId && row.user_id !== challengerId) ||
        !Number.isFinite(row.time_ms) || row.time_ms <= 0 ||
        seen.has(row.user_id)) return null;
    seen.add(row.user_id);
    valid.push(row);
  }
  return valid;
}

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
