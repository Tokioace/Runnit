export const AUTH_CALLBACK_PATH = '/auth/callback';

export type SocialProvider = 'apple' | 'google' | 'facebook';

/** OAuth and email callbacks must return to this app, never a user-supplied URL. */
export function authCallbackUrl(origin: string): string {
  const url = new URL(AUTH_CALLBACK_PATH, origin);
  const allowedLocalhost = url.protocol === 'http:' &&
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  if (url.protocol !== 'https:' && !allowedLocalhost) {
    throw new Error('Authentication requires HTTPS (or localhost for development).');
  }
  return url.toString();
}

/** OAuth providers can return error details in query or hash parameters. */
export function callbackHasError(search: string, hash: string): boolean {
  const query = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const fragment = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  return Boolean(query.get('error') || query.get('error_code') ||
    fragment.get('error') || fragment.get('error_code'));
}

/** Capacitor's bundled iOS origin, not a remote website or a callback URL. */
export function isBundledIosLocation(href: string): boolean {
  try {
    const url = new URL(href);
    return url.protocol === 'capacitor:' && url.hostname === 'localhost' &&
      !url.port && !url.username && !url.password;
  } catch { return false; }
}
export function isNativeAuthRuntime(): boolean {
  return typeof window !== 'undefined' && isBundledIosLocation(window.location.href);
}

/** Native preview supports code entry, not magic-link or OAuth deep links.
 * Keep web redirects restricted to the existing HTTPS/localhost policy. */
export function emailLoginOptions(href: string, origin: string) {
  if (isBundledIosLocation(href)) return { shouldCreateUser: false } as const;
  return { emailRedirectTo: authCallbackUrl(origin), shouldCreateUser: true } as const;
}
