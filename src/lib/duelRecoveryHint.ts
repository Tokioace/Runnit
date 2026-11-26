type MatchCandidate = {
  id: string;
  status: string;
  host_user_id: string | null;
  challenger_user_id: string | null;
};
/** A local hint is not proof of an active race. A different server-confirmed
 * match can replace an unavailable hint, but never a confirmed race or finish.
 * Call only after a successful exact-duel read returned no row. */
export function canReleaseUnconfirmedDuelHint(input: {
  activeId: string;
  hintId: string | null;
  candidate: MatchCandidate | null;
  userId: string;
  candidateRetired: boolean;
  hasPendingFinish: boolean;
}): boolean {
  const {activeId, hintId, candidate, userId, candidateRetired, hasPendingFinish} = input;
  return activeId === hintId && !hasPendingFinish && !candidateRetired &&
    !!candidate && typeof candidate.id === 'string' && !!candidate.id &&
    candidate.id !== activeId && candidate.status === 'matched' &&
    (candidate.host_user_id === userId || candidate.challenger_user_id === userId);
}
