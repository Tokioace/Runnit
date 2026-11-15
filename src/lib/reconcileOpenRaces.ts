/** Merge a refreshed set of discovered open races without jumping the list.
 * A confirmed locally hosted open race is retained until the host leaves or
 * realtime reports cancellation/match. Never mutate a previous array. */
export type IdentifiedRace = { id: string; hostUserId?: string };
export function reconcileOpenRaces<T extends IdentifiedRace>(
  previous: readonly T[], discovered: readonly T[], ownHostId: string,
): T[] {
  const incoming = new Map(discovered.map(run => [run.id, run]));
  const own = previous.filter(run => run.hostUserId === ownHostId && !run.id.startsWith('demo-run-'));
  for (const race of own) if (!incoming.has(race.id)) incoming.set(race.id, race);
  const kept = previous.flatMap(run => {
    const latest = incoming.get(run.id);
    if (!latest) return [];
    incoming.delete(run.id);
    return [latest];
  });
  return [...kept, ...incoming.values()];
}
