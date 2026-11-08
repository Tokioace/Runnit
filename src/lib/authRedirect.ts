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
