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
  assert.ok(app.includes("!auth.user && accountPage"));
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
  assert.match(map, /const openHostRunAt = \(point: Coordinates\) => \{\s*if \(!requireRaceAccount\(\)\) return;/);
  assert.match(map, /const handleHostRun = async \(distanceMeters: number\) => \{\s*if \(!requireRaceAccount\(\)\) return;/);
  assert.match(map, /location: hostLocation/);
  assert.match(map, /const handleJoinRun = async \(run: OpenRun\) => \{\s*if \(!requireRaceAccount\(\)\) return;/);
  assert.match(map, /onHostAt=\{openHostRunAt\}/);
  assert.match(read('src/components/map/ArcadeMapLibreView.tsx'), /callbacks\.current\.onHostAt\(position\)/);
  assert.doesNotMatch(read('src/components/map/ArcadeMapChrome.tsx'), /onClick=\{onHost\}/);
  assert.match(map, /onJoin=\{joinArcadeRun\}/);
  assert.match(map, /if \(run\) \{ void handleJoinRun\(run\); \}/);
  const vector = read('src/components/map/ArcadeMapLibreView.tsx');
  assert.match(vector, /const popup = new Popup/);
  assert.match(vector, /callbacks\.current\.onJoinRun\(selectedRun\.id\)/);
  assert.match(map, /<ArcadeMapLibreView/);
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
  assert.match(map, /if \(!authUser\) \{\s*setPlayers\(\[\]\);/);
  assert.match(map, /if \(!authUser\) \{\s*discoveryLoadedRef\.current = false;\s*setOpenRuns\(\[\]\);/);
  assert.match(map, /if \(!authUser\) \{ setRealtimeConnected\(false\); return; \}\s*setRealtimeConnected\(false\);\s*const lifetime = createDuelRealtimeLifetime\(\);\s*const channel = supabase\s*\.channel\('duels-realtime'\)/);
  assert.doesNotMatch(map, /DEMO · BEISPIELRENNEN|generateDemoRuns|generateCityPlayers/);
});

test('Guest profile has a login CTA but no personal stats leak', () => {
  const s=read('src/screens/ProfileScreen.tsx');assert.match(s,/GASTMODUS/);assert.match(s,/ANMELDEN \/ REGISTRIEREN/);assert.doesNotMatch(s,/runnit-profile-goal-grid|KALORIEN/);
});

test('guest navigation cannot be an open redirect through next parameter', () => {
  const app = read('src/App.tsx');
  assert.match(app, /const next = new URLSearchParams\(search\)\.get\('next'\)/);
  assert.ok(app.includes("next && APP_PATHS.has(next) ? next : '/home'"));
});
