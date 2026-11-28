/** A lost or ambiguous response cannot prove that a private insert failed.
 * Only an ordinary, explicit client rejection is eligible for blind retry.
 * This is a conservative client policy, not server-side idempotency. */
export function isUncertainGhostSave(status: number, error: unknown): boolean {
  if (!Number.isInteger(status)) return true;
  if (!error) return status < 200 || status >= 300;
  // Timeouts, client-closed requests, gateway errors and unexpected responses
  // do not establish whether the upstream transaction committed.
  return status < 400 || status >= 500 || status === 408 || status === 499;
}

/** A unique-constraint response can indicate an earlier insert of this ID. */
export function isGhostSaveConflict(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'code' in error && error.code === '23505';
}

/** Confirm the exact account-owned summary; a missing or partial row is not proof. */
export function matchesGhostSave(payload: Record<string, unknown>, row: unknown): boolean {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return false;
  const record = row as Record<string, unknown>;
  return Object.keys(payload).every(key =>
    Object.prototype.hasOwnProperty.call(record, key) && record[key] === payload[key]);
}

/** A queued retry belongs to the exact terminal measurement object, not
 * merely another run with identical values. A reset retires that identity. */
export function ownsGhostSaveReport<T extends object>(
  terminal: { summary: T } | null, item: T, phase: string,
): boolean {
  return (phase === 'finished' || phase === 'stopped') && terminal !== null && terminal.summary === item;
}
