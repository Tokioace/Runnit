export type DeletionRequest = Readonly<{ requested_at: string }>;
export function isDeletionConfirmation(value: string): boolean {
  return value.trim() === 'LÖSCHEN';
}
export function parseDeletionRequest(value: unknown): DeletionRequest | null {
  if (!value || typeof value !== 'object') return null;
  const requestedAt = (value as Record<string, unknown>).requested_at;
  if (typeof requestedAt !== 'string' || !Number.isFinite(Date.parse(requestedAt))) return null;
  return { requested_at: requestedAt };
}
