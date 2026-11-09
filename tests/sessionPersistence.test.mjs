import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Supabase sessions persist between visits in the same browser without changing the existing storage key', () => {
  const client = read('src/lib/supabaseClient.ts');
  assert.match(client, /persistSession:\s*true/);
  assert.match(client, /autoRefreshToken:\s*true/);
  assert.match(client, /detectSessionInUrl:\s*true/);
  assert.doesNotMatch(client, /storageKey:\s*['"]/);
  assert.doesNotMatch(client, /sessionStorage/);
});

test('app reads restored session before opening sign-in UI', () => {
  const app = read('src/App.tsx');
  const hook = read('src/hooks/useSupabaseUser.ts');
  assert.match(hook, /supabase\.auth\.getSession\(\)/);
  assert.match(hook, /supabase\.auth\.onAuthStateChange/);
  assert.match(app, /if \(auth\.loading\)/);
  assert.match(app, /!auth\.user && \(!guestAccess \|\| location\.pathname === '\/login'\)/);
});

test('sign-out requires confirmation and warns it invalidates saved login', () => {
  const panel = read('src/components/profile/AccountDetailsPanel.tsx');
  assert.match(panel, /const \[confirmLogout, setConfirmLogout\]/);
  assert.match(panel, /if \(pending \|\| !confirmLogout\) return;/);
  assert.match(panel, /Angemeldet bleiben/);
  assert.match(panel, /Wirklich abmelden/);
});

test('email login screen explains browser and preview isolation', () => {
  const welcome = read('src/components/auth/WelcomeAuthScreen.tsx');
  assert.match(welcome, /brauchst kein neues Konto/);
  assert.match(welcome, /In-App-Browser, private Tabs/);
});
