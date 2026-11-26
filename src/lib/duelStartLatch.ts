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
