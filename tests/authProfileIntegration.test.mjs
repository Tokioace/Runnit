import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('app allows opt-in guests to browse and preserves explicit login route', () => {
  const app = read('src/App.tsx');
  assert.match(app, /wasGuestModeChosen/);
  assert.match(app, /guestAccess/);
  assert.match(app, /location\.pathname === AUTH_CALLBACK_PATH/);
  assert.ok(app.includes("!auth.user && location.pathname === '/login'"));
  assert.match(app, /<WelcomeAuthScreen/);
  assert.match(app, /<Route path="\/map" element=\{<MapScreen \/>\}/);
});

test('authenticated profiles never display fictional races, medals or guest registration forms', () => {
  const profile = read('src/screens/ProfileScreen.tsx');
  assert.match(profile, /useSupabaseUser\(\)/);
  assert.match(profile, /loading \? \(/);
  assert.match(profile, /<AccountDetailsPanel/);
  assert.match(profile, /noch keine geprüften Laufdaten/);
  assert.doesNotMatch(profile, /Runner8|9\.33\s?s|Demo-Profil|<AccountAuthPanel/);
});

test('account flows stay within Supabase Auth and never store passwords in custom browser storage', () => {
  const hook = read('src/hooks/useSupabaseUser.ts');
  assert.match(hook, /supabase\.auth\.getSession/);
  assert.match(hook, /supabase\.auth\.signInWithPassword/);
  assert.match(hook, /supabase\.auth\.signUp/);
  assert.match(hook, /supabase\.auth\.signInWithOtp/);
  assert.match(hook, /supabase\.auth\.signInWithOAuth/);
  assert.match(hook, /supabase\.auth\.updateUser/);
  assert.match(hook, /supabase\.auth\.signOut/);
  assert.doesNotMatch(hook, /localStorage\.setItem|sessionStorage\.setItem/);
});

test('the real account page shows only current user details and edits current auth metadata', () => {
  const profile = read('src/screens/ProfileScreen.tsx');
  assert.match(profile, /loading \? \([\s\S]*?\) : user \? \(/);
  const details = read('src/components/profile/AccountDetailsPanel.tsx');
  assert.match(details, /user\.email/);
  assert.match(details, /getAccountDisplayNameError/);
  assert.match(details, /updateDisplayName\(draftName\)/);
  assert.match(details, /signOut\(\)/);
});

test('email-password login remains an explicit alternative for existing accounts', () => {
  const form = read('src/components/profile/AccountAuthPanel.tsx');
  const welcome = read('src/components/auth/WelcomeAuthScreen.tsx');
  assert.match(welcome, /<AccountAuthPanel signIn=\{signIn\} signUp=\{signUp\}/);
  assert.match(form, /<form onSubmit=/);
  assert.match(form, /type="password"/);
  assert.match(form, /autoComplete="email"/);
  assert.match(form, /getAccountDisplayNameError\(displayName\)/);
  assert.match(form, /signIn\(email, password\)/);
  assert.match(form, /signUp\(email, password, displayName\)/);
  assert.doesNotMatch(form, /console\.log|localStorage/);
});

test('the map uses editable nickname rather than email prefix and no source claims verified identity', () => {
  const map = read('src/screens/MapScreen.tsx');
  assert.match(map, /username: authUser\.displayName/);
  assert.doesNotMatch(map, /authUser\.email\?\.split\('@'\)/);
  const lib = read('src/lib/accountProfile.ts');
  assert.match(lib, /not a verified identity/);
  const details = read('src/components/profile/AccountDetailsPanel.tsx');
  assert.match(details, /nicht identitätsgeprüft/);
});
