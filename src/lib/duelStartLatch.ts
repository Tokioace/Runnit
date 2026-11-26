/** The server schedules one start per matched duel. Late lobby snapshots
 * cannot revoke it or supply a different start. Equivalent timestamp formats
 * refer to the same instant. This is not authorization or clock validation. */
export function createDuelStartLatch() {
  const starts = new Map<string, number>();
  return {
    accept(duelId: string, startAt: string | null): boolean {
      const previous = starts.get(duelId);
      if (startAt === null) return previous === undefined;
      const stamp = Date.parse(startAt);
      if (!Number.isFinite(stamp)) return false;
      if (previous !== undefined) return previous === stamp;
      starts.set(duelId, stamp);
      return true;
    },
  };
}

/** Reuse the existing late-recovery window at both countdown admission and
 * GO. Future scheduled starts are allowed; exactly 10 seconds late is not.
 * This is a client recovery cutoff, not a clock synchronization guarantee. */
export function isDuelStartRecoverable(startsAt: number, nowMs: number): boolean {
  return Number.isFinite(startsAt) && Number.isFinite(nowMs) && startsAt > nowMs - 10_000;
}
