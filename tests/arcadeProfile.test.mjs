import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Profile has its own compact, image-backed Y2K screen and keeps the shared nav', () => {
  const screen = read('src/screens/ProfileScreen.tsx');
  const css = read('src/styles/profileY2k.css');
  assert.match(screen, /className="rp-screen"/);
  assert.match(screen, /<BottomNav/);
  assert.match(screen, /runnit-metal-logo.svg/);
  assert.match(screen, /runnit-profile-avatar.avif/);
  assert.match(screen, /<RunnerHologram3D rotating=\{turning\} manualAngle=\{turnAngle\}/);
  assert.match(css, /runnit-profile-race-scene.avif/);
  assert.match(css, /height:100dvh/);
  assert.match(css, /overflow:hidden/);
  assert.match(css, /rp-hologram-canvas/);
  assert.doesNotMatch(screen, /id="profile-links"|DEIN RUNNIT/);
});
test('User information is private, optional and free of invented athlete achievements', () => {
  const s = read('src/screens/ProfileScreen.tsx');
  assert.doesNotMatch(s, /2,98 s|34,7 km\/h|LVL 14|1\.482|KALORIEN|futureBadges|resultCards|goalCards/);
  assert.match(s, /bmiFor\(profile\)/);
  assert.match(s, /Noch keine vergebenen Badges/);
  assert.match(s, /runnit_profile_v1/);
  assert.match(s, /supabase.auth.updateUser/);
  assert.match(s, /RANGLISTEN-DATENSCHUTZ/);
  assert.match(s, /leaderboard_opt_in/);
  assert.match(s, /select\('leaderboard_opt_in'\)\.single\(\)/);
});
test('Profile retains editable account, privacy, calibration, diagnostics and guest links', () => {
  const s = read('src/screens/ProfileScreen.tsx');
  const account = read('src/components/profile/AccountDetailsPanel.tsx');
  assert.match(s, /useSupabaseUser\(\)/);
  assert.match(s, /<AccountDetailsPanel/);
  assert.match(s, /updateDisplayName=\{updateDisplayName\}/);
  assert.match(s, /changePassword=\{changePassword\}/);
  assert.match(s, /signOut=\{signOut\}/);
  assert.match(s, /user.walkingCalibration.walkingStrideM/);
  for (const path of ['/calibration', '/fusion-lab', '/sprint-lab', '/gps-lab']) {
    assert.ok(s.includes('to="' + path + '"'), path);
  }
  assert.match(s, /to="\/login\?next=%2Fprofile"/);
  assert.match(account, /signOut\(\)/);
});
test('Profile uses functional privacy toggle and not static achievements tabs', () => {
  const s = read('src/screens/ProfileScreen.tsx');
  assert.doesNotMatch(s, /selectedTab|href="#ziele"|href="#erfolge"/);
  assert.match(s, /type="checkbox"/);
  assert.match(s, /onChange=\{\(event\) => \{ void saveConsent\(event.currentTarget.checked\)/);
  assert.match(s, /onChange=\{\(\) => \{ void toggleGoal\(\)/);
  assert.match(s, /setPane\(null\)/);
});
test('Editable account inputs avoid Safari focus zoom', () => {
  const s = read('src/components/profile/AccountDetailsPanel.tsx');
  assert.equal(s.match(/px-4 py-3 text-base text-white/g)?.length, 3);
  assert.match(s, /id="edit-display-name"/);
  assert.match(s, /id="new-account-password"/);
  assert.match(s, /id="confirm-account-password"/);
});
test('Profile uses no-scroll body with accessible, internally scrollable dialogs', () => {
  const s = read('src/screens/ProfileScreen.tsx');
  const css = read('src/styles/profileY2k.css');
  assert.match(s, /aria-modal="true"/);
  assert.match(s, /aria-label="Dialog schließen"/);
  assert.match(css, /\.rp-modal\{/);
  assert.match(css, /max-height:min\(78dvh,650px\);overflow:auto/);
  assert.match(css, /env\(safe-area-inset-bottom/);
});

test('Runner hologram rotates volumetric torso, limbs and head instead of flat SVG billboards', () => {
  const scene = read('src/screens/ProfileScreen.tsx');
  const source = read('src/components/profile/RunnerHologram3D.tsx');
  assert.match(scene, /RunnerHologram3D/);
  assert.doesNotMatch(scene, /runnit-profile-hologram.svg/);
  assert.match(source, /function loft\(/);
  assert.match(source, /function swept\(/);
  assert.match(source, /contourLines/);
  assert.match(source, /Math\.cos\(angle\)/);
  assert.match(source, /Math\.sin\(angle\)/);
  assert.match(source, /requestAnimationFrame/);
  assert.match(source, /matchMedia/);
  assert.match(source, /canvas/);
});
