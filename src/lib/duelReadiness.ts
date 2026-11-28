type Readiness = {
  id: string;
  hostUserId: string;
  challengerUserId: string;
  hostReady: boolean;
  challengerReady: boolean;
};

/** Ready is a one-way acknowledgement for the same matched participant pair.
 * Do not transfer readiness to a different duel or participant identity. */
export function mergeDuelReadiness<T extends Readiness>(previous: T | null, incoming: T): T {
  if (!previous || previous.id !== incoming.id ||
      previous.hostUserId !== incoming.hostUserId ||
      previous.challengerUserId !== incoming.challengerUserId) return incoming;
  return {
    ...incoming,
    hostReady: previous.hostReady || incoming.hostReady,
    challengerReady: previous.challengerReady || incoming.challengerReady,
  };
}

/** A late completion must not release another duel's Ready indicator. */
export function clearReadyRequest(pendingDuelId: string | null, completedDuelId: string): string | null {
  return pendingDuelId === completedDuelId ? null : pendingDuelId;
}

/** Only the current lobby may display its pending request or error.
 * A confirmed acknowledgement supersedes an ambiguous write response. */
export function readyRequestView(
  duelId: string | null, ownReady: boolean, pendingDuelId: string | null,
  error: { duelId: string; message: string } | null,
): { busy: boolean; error: string | null } {
  return {
    busy: duelId !== null && !ownReady && pendingDuelId === duelId,
    error: duelId !== null && !ownReady && error?.duelId === duelId ? error.message : null,
  };
}
