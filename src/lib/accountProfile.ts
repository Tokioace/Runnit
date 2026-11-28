/**
 * A profile label is a user-editable nickname, not a verified identity.
 * It is stored in the currently authenticated user's Supabase Auth metadata;
 * no public username availability, uniqueness, or anti-impersonation is implied.
 */
export const MIN_DISPLAY_NAME_LENGTH = 3;
export const MAX_DISPLAY_NAME_LENGTH = 24;

export function normalizeDisplayName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function isValidDisplayName(value: string): boolean {
  const normalized = normalizeDisplayName(value);
  return normalized.length >= MIN_DISPLAY_NAME_LENGTH &&
    normalized.length <= MAX_DISPLAY_NAME_LENGTH &&
    /^[\p{L}\p{N} _-]+$/u.test(normalized);
}

export function getAccountDisplayName(metadata: unknown): string {
  if (typeof metadata !== 'object' || metadata === null) return 'Runnit-Läufer';
  const name = (metadata as Record<string, unknown>).display_name;
  return typeof name === 'string' && isValidDisplayName(name)
    ? normalizeDisplayName(name)
    : 'Runnit-Läufer';
}

export function getAccountDisplayNameError(value: string): string | null {
  const normalized = normalizeDisplayName(value);
  if (normalized.length < MIN_DISPLAY_NAME_LENGTH || normalized.length > MAX_DISPLAY_NAME_LENGTH) {
    return 'Der Anzeigename muss 3 bis 24 Zeichen haben.';
  }
  if (!isValidDisplayName(normalized)) {
    return 'Erlaubt sind Buchstaben, Zahlen, Leerzeichen, _ und -.';
  }
  return null;
}
