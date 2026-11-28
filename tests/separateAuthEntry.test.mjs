import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('artwork hotspots navigate to different sign-in and registration URLs', () => {
  const home = read('src/screens/HomeScreen.tsx');
  assert.match(home, /to="\/login"/);
  assert.match(home, /to="\/register"/);
  assert.doesNotMatch(home, /to="\/login\?mode=signup"/);
  assert.match(home, /onClick=\{onStart\}/);
  assert.match(home, /onClick=\{onContinueAsGuest\}/);
});

test('distinct account routes select the intended form without remount ambiguity', () => {
  const app = read('src/App.tsx');
  assert.match(app, /const accountPage = location\.pathname === '\/login' \|\| location\.pathname === '\/register'/);
  assert.match(app, /const accountMode = location\.pathname === '\/register' \|\|/);
  assert.match(app, /get\('mode'\) === 'signup' \? 'signup' : 'signin'/);
  assert.match(app, /if \(auth\.user && accountPage\)/);
  assert.match(app, /if \(!auth\.user && accountPage\)/);
  assert.match(app, /key=\{accountMode\}/);
  assert.match(app, /initialMode=\{accountMode\}/);
});

test('account page labels reflect the user intent and prioritize password form', () => {
  const welcome = read('src/components/auth/WelcomeAuthScreen.tsx');
  assert.match(welcome, /'REGISTRIEREN\.'/);
  assert.match(welcome, /'ANMELDEN\.'/);
  assert.match(welcome, /initialMode === 'signup' \? 'Konto registrieren' : 'Bei RUNNIT anmelden'/);
  assert.match(welcome, /useState<EmailMode>\('password'\)/);
  assert.match(welcome, /<AccountAuthPanel signIn=\{signIn\} signUp=\{signUp\} initialMode=\{initialMode\} hideModeSwitch \/>/);
  assert.match(welcome, /to=\{initialMode === 'signin' \? '\/register' : '\/login'\}/);
  assert.doesNotMatch(welcome, /Konto erstellen oder anmelden/);
});

test('registration requires name, email and password; signing in does not request a nickname', () => {
  const panel = read('src/components/profile/AccountAuthPanel.tsx');
  assert.match(panel, /mode === 'signup' && \(/);
  assert.match(panel, /name="nickname"/);
  assert.match(panel, /name="email"/);
  assert.match(panel, /name="password"/);
  assert.match(panel, /autoComplete=\{mode === 'signin' \? 'current-password' : 'new-password'\}/);
  assert.match(panel, /await signIn\(email, password\)/);
  assert.match(panel, /await signUp\(email, password, displayName\)/);
  assert.match(panel, /!hideModeSwitch && <div/);
  assert.match(panel, /if \(hideModeSwitch\) \{/);
  assert.match(panel, /setRegistrationSubmitted\(true\)/);
  assert.match(panel, /registrationSubmitted \? \(/);
});

test('OAuth, OTP, guest access and existing session handling remain supported', () => {
  const welcome = read('src/components/auth/WelcomeAuthScreen.tsx');
  const app = read('src/App.tsx');
  const auth = read('src/hooks/useSupabaseUser.ts');
  assert.match(welcome, /signInWithProvider\(provider\)/);
  assert.match(welcome, /sendMagicLink\(email\)/);
  assert.match(welcome, /verifyEmailOtp\(verificationEmail, otpCode\)/);
  assert.match(welcome, /Als Gast fortfahren/);
  assert.match(app, /navigate\('\/home'\)/);
  assert.match(auth, /supabase\.auth\.signInWithPassword/);
  assert.match(auth, /supabase\.auth\.signUp/);
  assert.match(auth, /supabase\.auth\.getSession\(\)/);
  assert.doesNotMatch(app + welcome + auth, /service_role/);
});
