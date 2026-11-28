export type DuelJoinErrorKind = 'unavailable' | 'permission' | 'unknown';

/** PostgREST errors are often plain objects rather than Error instances.
 * Only known server rejections justify removing the open challenge marker. */
export function classifyDuelJoinError(error: unknown): DuelJoinErrorKind {
  if (!error || typeof error !== 'object') return 'unknown';
  const value = error as { code?: unknown; message?: unknown };
  const code = typeof value.code === 'string' ? value.code : '';
  const message = typeof value.message === 'string' ? value.message.trim().toLowerCase() : '';
  if (code === '42501' || message === 'login required' || message === 'host cannot join own duel') return 'permission';
  if (message === 'challenge expired or unavailable' ||
      message === 'duel was already joined or expired' ||
      message === 'duel not found') return 'unavailable';
  return 'unknown';
}
