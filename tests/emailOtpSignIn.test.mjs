import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('Email login requests callback on same HTTPS origin', () => {
  const hook = read('src/hooks/useSupabaseUser.ts');
  const redirect = read('src/lib/authRedirect.ts');
  assert.match(hook, /emailRedirectTo: authCallbackUrl\(window\.location\.origin\)/);
  assert.match(redirect, /AUTH_CALLBACK_PATH = '\/auth\/callback'/);
  assert.doesNotMatch(hook, /http:\/\/localhost:3000/);
});

test('Email OTP verification is delegated to Supabase Auth and requires six digits', () => {
  const hook = read('src/hooks/useSupabaseUser.ts');
  assert.match(hook, /supabase\.auth\.verifyOtp\(/);
  assert.match(hook, /type: 'email'/);
  assert.match(hook, /if \(!\/\^\\d\{6\}\$\/\.test\(cleanToken\)\)/);
  assert.match(hook, /token: cleanToken/);
  assert.doesNotMatch(hook, /localStorage\.setItem|console\.log\(.*token/);
});

test('Welcome UI accepts code in the same browser without requiring email link navigation', () => {
  const welcome = read('src/components/auth/WelcomeAuthScreen.tsx');
  assert.match(welcome, /verifyEmailOtp\(verificationEmail, otpCode\)/);
  assert.match(welcome, /autoComplete="one-time-code"/);
  assert.match(welcome, /inputMode="numeric"/);
  assert.match(welcome, /pattern="\[0-9\]\{6\}"/);
  assert.match(welcome, /name="one-time-code"/);
  assert.match(welcome, /verificationEmail && \(/);
  assert.match(welcome, /Mit Code anmelden/);
});

test('OTP uses email address that requested the code, not a later changed address', () => {
  const welcome = read('src/components/auth/WelcomeAuthScreen.tsx');
  assert.match(welcome, /setVerificationEmail\(email\.trim\(\)\)/);
  assert.match(welcome, /setVerificationEmail\(null\)/);
  assert.match(welcome, /setOtpCode\(''\)/);
});

test('Existing Apple Google Facebook and password login remain available', () => {
  const welcome = read('src/components/auth/WelcomeAuthScreen.tsx');
  assert.match(welcome, /id: 'apple'/);
  assert.match(welcome, /id: 'google'/);
  assert.match(welcome, /id: 'facebook'/);
  assert.match(welcome, /<AccountAuthPanel signIn=\{signIn\} signUp=\{signUp\}/);
});
