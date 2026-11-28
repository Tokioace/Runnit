const KEY = 'runnit:pending-registration-v1';
const MAX_AGE_MS = 30 * 60 * 1000;
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function registrationPending(storage: StorageLike, now = Date.now()): boolean {
  try {
    const raw = storage.getItem(KEY);
    if (raw === null) return false;
    const created = Number(raw);
    if (String(created) === raw && Number.isSafeInteger(created) && created > 0 &&
        created <= now && now - created < MAX_AGE_MS) return true;
    storage.removeItem(KEY);
  } catch { /* Storage may be unavailable; registration remains usable. */ }
  return false;
}

export function markRegistrationPending(storage: StorageLike, now = Date.now()): void {
  try { storage.setItem(KEY, String(now)); } catch { /* Best effort only. */ }
}

export function clearRegistrationPending(storage: StorageLike): void {
  try { storage.removeItem(KEY); } catch { /* Best effort only. */ }
}

export function hasPendingWebRegistration(): boolean {
  try { return registrationPending(window.localStorage); } catch { return false; }
}

export function rememberWebRegistration(): void {
  try { markRegistrationPending(window.localStorage); } catch { /* Best effort only. */ }
}

export function forgetWebRegistration(): void {
  try { clearRegistrationPending(window.localStorage); } catch { /* Best effort only. */ }
}
