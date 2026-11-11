import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('guest mode requires a deliberate opt-in and never creates a Supabase identity', () => {
  const app = read('src/App.tsx');
  const welcome = read('src/components/auth/WelcomeAuthScreen.tsx');
  assert.match(welcome, /Als Gast fortfahren/);
  assert.match(welcome, /onContinueAsGuest/);
  assert.match(app, /sessionStorage\.getItem\(GUEST_SESSION_KEY\)/);
  assert.match(app, /sessionStorage\.setItem\(GUEST_SESSION_KEY, '1'\)/);
  assert.ok(app.includes("!auth.user && location.pathname === '/login'"));
  assert.doesNotMatch(app, /signInAnonymously|signInWithIdToken|service_role/);
});

test('guest may browse home, map, leaderboard, profile and GPS test lab', () => {
  const app = read('src/App.tsx');
  for (const segment of ['/', '/map', '/leaderboard', '/profile', '/gps-lab']) {
    assert.ok(app.includes('path="' + segment + '"'), segment + ' route missing');
  }
  assert.match(app, /location\.pathname === '\/login'/);
  assert.match(app, /safeLoginReturnPath/);
  assert.match(app, /APP_PATHS\.has\(next\)/);
});

test('guest race host button and join button request account login before other actions', () => {
  const map = read('src/screens/MapScreen.tsx');
  assert.match(map, /const requireRaceAccount = \(\): boolean => \{/);
  assert.match(map, /if \(authUser\) return true;/);
  assert.match(map, /navigate\('\/login\?next=%2Fmap'\);/);
  assert.match(map, /const openHostRun = \(\) => \{\s*if \(!requireRaceAccount\(\)\) return;/);
  assert.match(map, /const handleHostRun = async \(distanceMeters: number\) => \{\s*if \(!requireRaceAccount\(\)\) return;/);
  assert.match(map, /const handleJoinRun = async \(run: OpenRun\) => \{\s*if \(!requireRaceAccount\(\)\) return;/);
  assert.match(map, /onClick=\{openHostRun\}/);
  assert.match(map, /onClick=\{\(\) => handleJoinRun\(r\)\}/);
  assert.doesNotMatch(map, /In demo mode, create local run/);
  assert.doesNotMatch(map, /In demo mode, start race immediately/);
});

test('guest cannot reach running and finished race UI even if local state persists', () => {
  const map = read('src/screens/MapScreen.tsx');
  assert.match(map, /if \(!authUser\) \{\s*setMatchOverlay\(null\);\s*setRace\(\{ status: 'idle' \}\);/);
  assert.match(map, /race\.status === 'running' && authUser/);
  assert.match(map, /race\.status === 'finished' && authUser/);
  assert.match(map, /open=\{hostOpen && Boolean\(authUser\)\}/);
});

test('guest browsing does not query protected personal leaderboard or duel data', () => {
  const map = read('src/screens/MapScreen.tsx');
  assert.match(map, /if \(!authUser\) \{\s*setPlayers\(generateCityPlayers\);/);
  assert.match(map, /if \(!authUser\) \{\s*setOpenRuns\(generateDemoRuns\);/);
  assert.match(map, /if \(!authUser\) return;\s*const channel = supabase/);
  assert.match(map, /Demo-Modus: einige Spieler oder Rennen sind frei erfunden/);
});

test('guest profile provides sign-in instead of invented private statistics', () => {
  const profile = read('src/screens/ProfileScreen.tsx');
  assert.match(profile, /aria-label="Gastprofil"/);
  assert.match(profile, /Du erkundest Runnit als Gast/);
  assert.match(profile, /to="\/login\?next=%2Fprofile"/);
  assert.match(profile, /<AccountDetailsPanel user=\{user\}/);
});

test('guest navigation cannot be an open redirect through next parameter', () => {
  const app = read('src/App.tsx');
  assert.match(app, /const next = new URLSearchParams\(search\)\.get\('next'\)/);
  assert.match(app, /next && APP_PATHS\.has\(next\) \? next : '\/map'/);
});
