import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('launch screen uses real local artwork and DOM controls on a responsive full-height layout', () => {
  const home = read('src/screens/HomeScreen.tsx');
  const artwork = new URL('../public/runnit-launch-hero.webp', import.meta.url);
  assert.ok(statSync(artwork).size > 4000, 'real promotional art must be included');
  assert.match(home, /src="\/runnit-launch-hero\.webp"/);
  assert.match(home, /object-contain object-top/);
  assert.match(home, /min-h-\[100dvh\]/);
  assert.match(home, /safe-area-inset-bottom/);
  assert.match(home, /max-w-\[34rem\]/);
  assert.match(home, /onClick=\{onStart\}/);
  assert.match(home, /onClick=\{onContinueAsGuest\}/);
  assert.match(home, /to="\/login\?mode=signin"/);
  assert.match(home, /to="\/login\?mode=signup"/);
  assert.match(home, /to="\/map"/);
  assert.match(home, /to="\/sprint-lab"/);
  assert.match(home, /GHOST-RUN/);
  assert.match(home, /Vorschau/);
  assert.doesNotMatch(home, /<BottomNav/);
});

test('on signed-in sessions, registration, login and guest actions disappear but STARTEN remains', () => {
  const home = read('src/screens/HomeScreen.tsx');
  const app = read('src/App.tsx');
  assert.match(home, /\{isSignedIn \? \(/);
  assert.match(home, /Angemeldet · Direkt zur Rennkarte/);
  assert.match(home, /guestAccess \?/);
  assert.match(app, /isSignedIn=\{Boolean\(auth\.user\)\}/);
  assert.match(app, /if \(auth\.loading\)/);
  assert.match(app, /previousSignedInId\.current && !auth\.user/);
  assert.match(app, /navigate\('\/', \{ replace: true \}\)/);
});

test('returning users preserve Supabase session and go straight to map on STARTEN', () => {
  const app = read('src/App.tsx');
  const client = read('src/lib/supabaseClient.ts');
  assert.match(client, /persistSession:\s*true/);
  assert.match(client, /autoRefreshToken:\s*true/);
  assert.match(app, /if \(auth\.user\) \{\s*navigate\('\/map'\)/);
  assert.doesNotMatch(app, /auth\.signOut\(\)/);
});

test('sign-in and registration open the existing real forms without creating extra accounts', () => {
  const app = read('src/App.tsx');
  const welcome = read('src/components/auth/WelcomeAuthScreen.tsx');
  const panel = read('src/components/profile/AccountAuthPanel.tsx');
  assert.match(app, /location\.pathname === '\/login'/);
  assert.match(app, /initialMode=\{new URLSearchParams\(location\.search\)/);
  assert.match(welcome, /<AccountAuthPanel signIn=\{signIn\} signUp=\{signUp\} initialMode=\{initialMode\}/);
  assert.match(welcome, /Zurück zum Runnit-Start/);
  assert.match(panel, /const \[mode, setMode\] = useState<Mode>\(initialMode\)/);
  assert.match(panel, /await signIn\(email, password\)/);
  assert.match(panel, /await signUp\(email, password, displayName\)/);
});

test('installed PWA launches the public home and respects mobile safe-area layout', () => {
  const manifest = JSON.parse(read('public/manifest.webmanifest'));
  const html = read('index.html');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /rel="manifest"/);
  assert.match(html, /lang="de"/);
});

test('a guest can explore, but actual create/join/start race still requires authentication', () => {
  const app = read('src/App.tsx');
  const map = read('src/screens/MapScreen.tsx');
  assert.match(app, /sessionStorage\.setItem\(GUEST_SESSION_KEY, '1'\)/);
  assert.match(app, /setGuestAccess\(true\)/);
  assert.match(map, /const requireRaceAccount = \(\): boolean =>/);
  assert.match(map, /if \(authUser\) return true/);
  assert.match(map, /if \(!requireRaceAccount\(\)\) return/);
});
