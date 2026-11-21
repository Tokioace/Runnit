/** The selected duel survives a Safari/PWA reload until this device dismisses the
 *  confirmed final results. Only UUIDs are stored; never identities or GPS. */
const PREFIX = 'runnit:active-duel:v1:';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function readActiveDuelId(userId: string): string | null {
  if (!UUID.test(userId) || typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(PREFIX + userId);
    return value && UUID.test(value) ? value : null;
  } catch { return null; }
}
export function rememberActiveDuelId(userId: string, duelId: string): void {
  if (!UUID.test(userId) || !UUID.test(duelId) || typeof window === 'undefined') return;
  try { window.localStorage.setItem(PREFIX + userId, duelId); }
  catch { /* Safari private mode may deny storage. Realtime still works. */ }
}
export function forgetActiveDuelId(userId: string, duelId: string): void {
  if (!UUID.test(userId) || typeof window === 'undefined') return;
  try {
    const storedId = window.localStorage.getItem(PREFIX + userId);
    if (storedId && UUID.test(storedId) && storedId.toLowerCase() === duelId.toLowerCase()) {
      window.localStorage.removeItem(PREFIX + userId);
    }
  } catch { /* no-op */ }
}
