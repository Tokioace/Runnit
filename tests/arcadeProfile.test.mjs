import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Profile links to dedicated stats and leaderboard and retains account controls', () => {
  const s=read('src/screens/ProfileScreen.tsx');assert.match(s,/runnit-profile-master/);assert.match(s,/to="\/stats"/);assert.match(s,/to="\/leaderboard"/);assert.match(s,/<AccountDetailsPanel/);
});

test('Profile has no fabricated XP, badges, steps, calories or rankings', () => {
  const s=read('src/screens/ProfileScreen.tsx');assert.doesNotMatch(s,/LV\. —|XP NOCH NICHT VERFÜGBAR|KALORIEN|SCHRITTE.*kcal|futureBadges|goalCards|resultCards/);assert.match(s,/RANGLISTEN-DATENSCHUTZ/);
});

test('existing profile security, calibration and user flows remain connected', () => {
  const profile = read('src/screens/ProfileScreen.tsx');
  const details = read('src/components/profile/AccountDetailsPanel.tsx');
  assert.match(profile, /useSupabaseUser\(\)/);
  assert.match(profile, /<AccountDetailsPanel/);
  assert.match(profile, /updateDisplayName=\{updateDisplayName\}/);
  assert.match(profile, /changePassword=\{changePassword\}/);
  assert.match(profile, /signOut=\{signOut\}/);
  assert.match(profile, /user\.walkingCalibration\.walkingStrideM/);
  assert.match(profile, /to="\/calibration"/);
  assert.match(profile, /to="\/fusion-lab"/);
  assert.match(profile, /to="\/sprint-lab"/);
  assert.match(profile, /to="\/login\?next=%2Fprofile"/);
  assert.match(details, /signOut\(\)/);
});


test('Profile removes dead achievements tabs and provides functional privacy setting', () => {
  const s=read('src/screens/ProfileScreen.tsx');assert.doesNotMatch(s,/selectedTab|href="#ziele"|href="#erfolge"/);assert.match(s,/type="checkbox"/);assert.match(s,/onChange=\{e => \{ void updateOptIn/);
});

test('editable account inputs prevent Safari focus zoom', () => {
  const detail = read('src/components/profile/AccountDetailsPanel.tsx');
  assert.equal(detail.match(/px-4 py-3 text-base text-white/g)?.length, 3);
  assert.match(detail, /id="edit-display-name"/);
  assert.match(detail, /id="new-account-password"/);
  assert.match(detail, /id="confirm-account-password"/);
});


test('Profile preserves mobile artwork and clear account versus privacy hierarchy', () => {
  const s=read('src/screens/ProfileScreen.tsx');assert.match(s,/runnit-profile-hero-character/);assert.match(s,/runnit-profile-player-name/);assert.match(s,/KONTO & EINSTELLUNGEN/);assert.match(s,/safe-area-inset-bottom/);
});
