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
