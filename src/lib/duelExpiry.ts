/** Server-issued 60-minute open-lobby expiry. This is a UI clock, never
 * a substitute for the database's unique index, expiry guard and cron job. */
export const OPEN_EVENT_LIFETIME_MINUTES = 60;
export const OPEN_EVENT_LIFETIME_MS = OPEN_EVENT_LIFETIME_MINUTES * 60_000;

export function openEventMsLeft(expiresAt: string | null | undefined, nowMs = Date.now()): number {
  if (!expiresAt || !Number.isFinite(nowMs)) return 0;
  const endsAt = Date.parse(expiresAt);
  if (!Number.isFinite(endsAt)) return 0;
  return Math.max(0, endsAt - nowMs);
}

export function isOpenEventAvailable(expiresAt: string | null | undefined, nowMs = Date.now()): boolean {
  return openEventMsLeft(expiresAt, nowMs) > 0;
}

export function openEventClockLabel(expiresAt: string | null | undefined, nowMs = Date.now()): string {
  const seconds = Math.ceil(openEventMsLeft(expiresAt, nowMs) / 1000);
  return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' +
    String(seconds % 60).padStart(2, '0');
}

export function isHostSlotBlocked(status: string): boolean {
  return status === 'open' || status === 'matched';
}

export function isDuplicateActiveHostEventError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const raw = error as { code?: unknown; message?: unknown };
  return raw.code === '23505' &&
    typeof raw.message === 'string' &&
    raw.message.includes('duels_one_inflight_host_uidx');
}
