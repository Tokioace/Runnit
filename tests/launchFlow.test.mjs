import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('approved RUNNIT portrait asset is stored as an optimized local AVIF', () => {
  const portrait = new URL('../public/runnit-launch-portrait.avif', import.meta.url);
  const bytes = readFileSync(portrait);
  assert.ok(statSync(portrait).size >= 20000, 'the full design must be shipped, not a placeholder');
  assert.equal(bytes.subarray(4, 12).toString('ascii'), 'ftypavif');
  const screen = read('src/screens/HomeScreen.tsx');
  assert.match(screen, /src="\/runnit-launch-portrait\.avif"/);
  assert.match(screen, /width=\{941\}/);
  assert.match(screen, /height=\{1672\}/);
  assert.match(screen, /h-\[100dvh\]/);
  assert.ok(screen.includes("aspect-[941/1672]"));
  assert.match(screen, /object-contain/);
  const css = read('src/index.css');
  assert.match(css, /\.runnit-launch-art/);
  assert.match(css, /max-width: min\(600px, 56\.28dvh\)/);
  assert.match(css, /height: 100dvh/);
  assert.match(css, /width: max\(100vw, calc\(100dvh \* 0\.5628\)\)/);
  assert.match(screen, /scale-110 object-cover object-center opacity-35 blur-/);
  assert.doesNotMatch(screen, /object-fill/);
});

test('STARTEN and three frameless account hit regions align to artwork percentages', () => {
  const screen = read('src/screens/HomeScreen.tsx');
  assert.match(screen, /onClick=\{onStart\}/);
  assert.match(screen, /left-\[10%\] top-\[81\.9%\] h-\[9%\] w-\[80%\]/);
  assert.match(screen, /to="\/login"/);
  assert.match(screen, /to="\/register"/);
  assert.match(screen, /onClick=\{onContinueAsGuest\}/);
  assert.match(screen, /left-\[9\.2%\] top-\[91\.6%\]/);
  assert.match(screen, /left-\[37%\] top-\[91\.6%\]/);
  assert.match(screen, /left-\[68\.5%\] top-\[91\.6%\]/);
  assert.match(screen, /bg-transparent/);
  assert.doesNotMatch(screen, /<Swords|<Ghost|<MapPinned|<BottomNav|to="\/map"|to="\/sprint-lab"/);
  assert.match(screen, /focus-visible:outline/);
});

test('signed-in visitors see no sign-in, register or guest hit regions', () => {
  const screen = read('src/screens/HomeScreen.tsx');
  const app = read('src/App.tsx');
  assert.match(screen, /\{isSignedIn \? \(/);
  assert.ok(screen.includes('aria-label="Angemeldet"'));
  assert.ok(screen.includes("h-[7.4%]"));
  assert.match(screen, /Schnellzugriff für angemeldete Nutzer/);
  assert.ok(screen.includes('to="/profile"'));
  assert.ok(screen.includes('to="/leaderboard"'));
  assert.match(screen, /ANGEMELDET/);
  assert.ok(!screen.includes("h-[8.5%]"));
  assert.match(screen, /<nav aria-label="Kontoaktionen"/);
  assert.match(app, /isSignedIn=\{Boolean\(auth\.user\)\}/);
  assert.match(app, /previousSignedInId\.current && !auth\.user/);
});

test('STARTEN enters the original dashboard, never the map; guests can explore too', () => {
  const app = read('src/App.tsx');
  const dashboard = read('src/screens/DashboardScreen.tsx');
  const nav = read('src/components/ui/BottomNav.tsx');
  assert.match(app, /if \(auth\.user\) \{\s*navigate\('\/home'\)/);
  assert.match(app, /setGuestAccess\(true\);\s*navigate\('\/home'\)/);
  assert.match(app, /<Route path="\/home" element=\{<DashboardScreen \/>\}/);
  assert.match(dashboard, /DEIN LAUF\./);
  assert.match(nav, /href: '\/home', label: 'Start'/);
  assert.doesNotMatch(app, /const enterApp = \(\) => \{[\s\S]*?navigate\('\/map'\)/);
});

test('returning users preserve Supabase sessions without forced reauthentication', () => {
  const app = read('src/App.tsx');
  const client = read('src/lib/supabaseClient.ts');
  assert.match(client, /persistSession:\s*true/);
  assert.match(client, /autoRefreshToken:\s*true/);
  assert.match(app, /if \(auth\.loading\)/);
  assert.doesNotMatch(app, /auth\.signOut\(\)/);
});

test('sign-in and registration reuse current real forms and protected redirects', () => {
  const app = read('src/App.tsx');
  const welcome = read('src/components/auth/WelcomeAuthScreen.tsx');
  const panel = read('src/components/profile/AccountAuthPanel.tsx');
  assert.match(app, /location\.pathname === '\/login'/);
  assert.match(app, /location\.pathname === '\/register'/);
  assert.match(app, /initialMode=\{accountMode\}/);
  assert.match(welcome, /<AccountAuthPanel signIn=\{signIn\} signUp=\{signUp\} initialMode=\{initialMode\}/);
  assert.match(panel, /const \[mode, setMode\] = useState<Mode>\(initialMode\)/);
  assert.match(panel, /await signIn\(email, password\)/);
  assert.match(panel, /await signUp\(email, password, displayName\)/);
  assert.match(app, /APP_PATHS\.has\(next\)/);
});

test('installed PWA opens promotional launch at / with iOS safe viewport', () => {
  const manifest = JSON.parse(read('public/manifest.webmanifest'));
  const html = read('index.html');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /rel="manifest"/);
});

test('guest race creation and joining still require a real account', () => {
  const app = read('src/App.tsx');
  const map = read('src/screens/MapScreen.tsx');
  assert.match(app, /sessionStorage\.setItem\(GUEST_SESSION_KEY, '1'\)/);
  assert.match(map, /const requireRaceAccount = \(\): boolean =>/);
  assert.match(map, /if \(authUser\) return true/);
  assert.match(map, /if \(!requireRaceAccount\(\)\) return/);
});
