import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('real account page has explicit guest, loading and authenticated views', () => {
  const profile = read('src/screens/ProfileScreen.tsx');
  assert.match(profile, /useSupabaseUser\(\)/);
  assert.match(profile, /loading \? \(/);
  assert.match(profile, /<AccountDetailsPanel/);
  assert.match(profile, /<AccountAuthPanel/);
  assert.match(profile, /Noch keine geprüften Laufdaten|noch keine geprüften Laufdaten/);
  assert.doesNotMatch(profile, /Runner8|9\.33\s?s|Demo-Profil|Win Rate/);
});

test('account operations use Supabase Auth, not a fake account or localStorage password store', () => {
  const hook = read('src/hooks/useSupabaseUser.ts');
  assert.match(hook, /supabase\.auth\.getSession/);
  assert.match(hook, /supabase\.auth\.signInWithPassword/);
  assert.match(hook, /supabase\.auth\.signUp/);
  assert.match(hook, /supabase\.auth\.updateUser/);
  assert.match(hook, /supabase\.auth\.signOut/);
  assert.doesNotMatch(hook, /localStorage\.setItem|sessionStorage\.setItem/);
});

test('only the authenticated user can see the profile detail panel', () => {
  const profile = read('src/screens/ProfileScreen.tsx');
  assert.match(profile, /loading \? \([\s\S]*?\) : user \? \(/);
  const details = read('src/components/profile/AccountDetailsPanel.tsx');
  assert.match(details, /user\.email/);
  assert.match(details, /getAccountDisplayNameError/);
  assert.match(details, /updateDisplayName\(draftName\)/);
  assert.match(details, /signOut\(\)/);
});

test('new account form only submits from a user gesture and has explicit mode controls', () => {
  const form = read('src/components/profile/AccountAuthPanel.tsx');
  assert.match(form, /<form onSubmit=/);
  assert.match(form, /type="password"/);
  assert.match(form, /autoComplete="email"/);
  assert.match(form, /getAccountDisplayNameError\(displayName\)/);
  assert.match(form, /signIn\(email, password\)/);
  assert.match(form, /signUp\(email, password, displayName\)/);
  assert.doesNotMatch(form, /console\.log|localStorage/);
});

test('map shows chosen nickname rather than revealing email prefix as username', () => {
  const map = read('src/screens/MapScreen.tsx');
  assert.match(map, /username: authUser\.displayName/);
  assert.doesNotMatch(map, /authUser\.email\?\.split\('@'\)/);
});

test('account nickname is explicitly not an official sport verification', () => {
  const lib = read('src/lib/accountProfile.ts');
  const details = read('src/components/profile/AccountDetailsPanel.tsx');
  assert.match(lib, /not a verified identity/);
  assert.match(details, /nicht identitätsgeprüft/);
});
