import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('arcade Profile has independent real navigation and reference-based sections', () => {
  const profile = read('src/screens/ProfileScreen.tsx');
  const css = read('src/styles/runnitMaster.css');
  const parts = ['runnit-profile-hero', 'runnit-profile-tabs', 'id="profil"', 'id="ziele"', 'id="erfolge"', 'id="konto"', 'Individuelle Gehschrittlänge', 'Entwicklungslabore', '<BottomNav'];
  let last = -1;
  for (const marker of parts) {
    const index = profile.indexOf(marker);
    assert.ok(index > last, 'missing/out of order ' + marker);
    last = index;
  }
  assert.match(profile, /runnit-profile-logo/);
  assert.match(profile, /href="#konto"/);
  assert.match(profile, /href="#ziele"/);
  assert.match(profile, /href="#erfolge"/);
  assert.match(css, /\.runnit-profile-hero-character/);
  assert.match(css, /\.runnit-profile-badge-hex/);
});

test('profile never claims achievements, ranking, XP or race records without verification', () => {
  const profile = read('src/screens/ProfileScreen.tsx');
  assert.match(profile, /LV\. —/);
  assert.match(profile, /XP NOCH NICHT VERFÜGBAR/);
  assert.match(profile, /NOCH GESPERRT/);
  assert.match(profile, /KEINE DATEN/);
  assert.doesNotMatch(profile, /Stergios_R|76\.420|38\.420|127|TurboKai/);
  assert.doesNotMatch(profile, /watchPosition|requestPermission|submitDuelResult/);
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
