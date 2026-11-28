import test from 'node:test';
import assert from 'node:assert/strict';
import { authCallbackUrl, callbackHasError } from '../src/lib/authRedirect.ts';

test('authentication callback stays on the supplied HTTPS origin', () => {
  assert.equal(authCallbackUrl('https://runnit.example'), 'https://runnit.example/auth/callback');
  assert.equal(authCallbackUrl('https://runnit.example:8443'), 'https://runnit.example:8443/auth/callback');
  assert.equal(authCallbackUrl('https://runnit.example/some/route?next=https://evil.example'), 'https://runnit.example/auth/callback');
});

test('insecure remote HTTP origins are rejected, including localhost lookalikes', () => {
  for (const origin of ['http://runnit.example', 'http://localhost.evil.example', 'http://127.0.0.1.evil.example', 'ftp://runnit.example']) {
    assert.throws(() => authCallbackUrl(origin), /requires HTTPS/);
  }
});

test('local development HTTP is explicitly limited to loopback hostnames', () => {
  assert.equal(authCallbackUrl('http://localhost:5173'), 'http://localhost:5173/auth/callback');
  assert.equal(authCallbackUrl('http://127.0.0.1:5173'), 'http://127.0.0.1:5173/auth/callback');
});

test('OAuth callback detects error codes in query and hash without exposing details', () => {
  assert.equal(callbackHasError('?error=access_denied', ''), true);
  assert.equal(callbackHasError('?error_code=otp_expired', ''), true);
  assert.equal(callbackHasError('', '#error=access_denied'), true);
  assert.equal(callbackHasError('', '#error_code=otp_expired'), true);
  assert.equal(callbackHasError('?code=success', '#access_token=example'), false);
  assert.equal(callbackHasError('', ''), false);
});
