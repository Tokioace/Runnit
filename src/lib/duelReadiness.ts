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
