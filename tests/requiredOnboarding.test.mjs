import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AUTH_CALLBACK_PATH, authCallbackUrl, callbackHasError,
} from '../src/lib/authRedirect.ts';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('login callback stays on same origin and fixed route', () => {
  assert.equal(AUTH_CALLBACK_PATH, '/auth/callback');
  assert.equal(authCallbackUrl('https://runnit.example'), 'https://runnit.example/auth/callback');
  assert.equal(authCallbackUrl('http://localhost:5173'), 'http://localhost:5173/auth/callback');
  assert.throws(() => authCallbackUrl('http://runnit.example'), /HTTPS/);
  assert.throws(() => authCallbackUrl('javascript:alert(1)'), /Invalid URL|HTTPS/);
});

test('OAuth rejection from query or hash can be recognized without echoing raw details', () => {
  assert.equal(callbackHasError('?error=access_denied', ''), true);
  assert.equal(callbackHasError('', '#error_code=provider_error&error_description=sensitive'), true);
  assert.equal(callbackHasError('?code=abc', ''), false);
  assert.equal(callbackHasError('', '#access_token=redacted'), false);
});

test('welcome page offers all four requested login types and no guest bypass', () => {
  const welcome = read('src/components/auth/WelcomeAuthScreen.tsx');
  assert.match(welcome, /id: 'apple'/);
  assert.match(welcome, /id: 'google'/);
  assert.match(welcome, /id: 'facebook'/);
  assert.match(welcome, /Mit E-Mail fortfahren/);
  assert.match(welcome, /sendMagicLink\(email\)/);
  assert.match(welcome, /signInWithProvider\(provider\)/);
  assert.match(welcome, /<AccountAuthPanel/);
  assert.doesNotMatch(welcome, /Ohne Konto fortfahren|Als Gast|Gastmodus/);
});

test('social auth and passwordless email do not use provider secrets inside browser code', () => {
  const hook = read('src/hooks/useSupabaseUser.ts');
  assert.match(hook, /provider,\s*options: \{ redirectTo: authCallbackUrl\(window\.location\.origin\) \}/);
  assert.match(hook, /emailRedirectTo: authCallbackUrl\(window\.location\.origin\)/);
  assert.match(hook, /shouldCreateUser: true/);
  assert.doesNotMatch(hook, /client_secret|private_key|facebook_secret/i);
});

test('unknown callback errors are not rendered as server-provided HTML or strings', () => {
  const page = read('src/components/auth/AuthCallbackScreen.tsx');
  assert.match(page, /callbackHasError/);
  assert.doesNotMatch(page, /error_description\b|dangerouslySetInnerHTML/);
});

test('global onboarding is enforced for home, map, rankings and profile', () => {
  const app = read('src/App.tsx');
  const condition = app.indexOf('if (!auth.user)');
  const routes = app.indexOf('<Routes>');
  assert.ok(condition > 0 && condition < routes);
  for (const name of ['HomeScreen', 'MapScreen', 'LeaderboardScreen', 'ProfileScreen', 'GpsLabScreen']) {
    assert.match(app, new RegExp('<Route[^>]*<' + name + ' \\/>'));
  }
});
