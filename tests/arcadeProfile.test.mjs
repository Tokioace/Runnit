import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Profile has its own compact, image-backed Y2K screen and keeps the shared nav', () => {
  const screen = read('src/screens/ProfileScreen.tsx');
  const css = read('src/styles/profileY2k.css');
  assert.match(screen, /className="rp-screen rp-hub"/);
  assert.match(screen, /<BottomNav/);
  assert.match(screen, /runnit-metal-logo.svg/);
  assert.match(screen, /runnit-profile-avatar.avif/);
  assert.match(screen, /rp-runner-reference-art-static/);
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

test('Legacy 3D geometry remains available separately, but profile uses only original 2D artwork', () => {
  const scene = read('src/screens/ProfileScreen.tsx');
  const source = read('src/components/profile/RunnerHologram3D.tsx');
  const model = read('src/components/profile/RunnerHologramModel.tsx');
  assert.doesNotMatch(scene, /RunnerHologramModel/);
  assert.match(model, /RunnerHologram3D/); // Legacy geometry remains a working fallback.
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

test('Human scan includes cranial profile, eyes, nose, jaw and integrated shoulders', () => {
  const source=read('src/components/profile/RunnerHologram3D.tsx');
  assert.match(source, /facialTraces/);
  assert.match(source, /nose profile/);
  assert.match(source, /cheekbones/);
  assert.match(source, /contained within torso/);
  assert.match(source, /lighting=/);
  assert.match(source, /rotating model, never screen-fixed/);
});

test('Optional legacy 3D component remains internally valid but is not loaded by the profile', () => {
  const screen = read('src/screens/ProfileScreen.tsx');
  const model = read('src/components/profile/RunnerHologramModel.tsx');
  assert.doesNotMatch(screen, /<RunnerHologramModel/);
  assert.match(model, /model-viewer/);
  assert.match(model, /runnit-runner-3d\.glb/);
  assert.match(read('docs/runner-model.md'), /a488723e3a93d73d5c562d88f8a85353c37bc721/);
  assert.doesNotMatch(model, /setBaseColorFactor\?\.\(\[/);
  assert.match(model, /setAlphaMode/);
  assert.match(model, /auto-rotate/);
  assert.match(model, /getCameraOrbit/);
  assert.match(model, /RunnerHologram3D rotating=\{rotating\}/);
  assert.match(model, /setStatus\('failed'\)/);
  assert.match(read('docs/runner-model.md'), /CC0/);
});

test('runner 3D is skinned into relaxed stance before being enlarged in profile', () => {
  const model=read('src/components/profile/RunnerHologramModel.tsx');
  const pose=read('src/lib/poseRunnerGlb.ts');
  assert.match(model,/poseRunnerGlb\(await response\.arrayBuffer\(\)\)/);
  assert.match(model,/URL\.createObjectURL/);
  assert.match(model,/URL\.revokeObjectURL/);
  assert.match(model,/RUNNER_CAMERA_DISTANCE = '130%'/);
  assert.match(model,/RUNNER_CAMERA_FOV = '30deg'/);
  assert.match(model,/String\(firstAngle\.current\) \+ 'deg 90deg ' \+ RUNNER_CAMERA_DISTANCE/);
  assert.match(model,/String\(angle\) \+ 'deg 90deg ' \+ RUNNER_CAMERA_DISTANCE/);
  assert.match(model,/min-camera-orbit', 'auto auto 115%'/);
  assert.doesNotMatch(model,/90deg 65%/);
  assert.match(pose,/upperarm_/);
  assert.match(pose,/lowerarm_/);
  assert.match(pose,/hand_/);
  assert.match(pose,/inverse bind matrices are kept byte-for-byte/);
  assert.match(model,/RunnerHologram3D rotating=\{rotating\}/);
});

test('Runner stays completely framed through both continuous and manual rotations', () => {
  const viewer = read('src/components/profile/RunnerHologramModel.tsx');
  const distance = viewer.match(/const RUNNER_CAMERA_DISTANCE = '(\d+)%'/)?.[1];
  const fov = viewer.match(/const RUNNER_CAMERA_FOV = '(\d+)deg'/)?.[1];
  assert.ok(distance, 'A single source of truth for camera distance is required');
  assert.ok(Number(distance) >= 115 && Number(distance) <= 145, 'Camera orbit must give full body headroom and footroom on mobile');
  assert.ok(Number(fov) >= 28 && Number(fov) <= 36, 'Mobile camera FOV must remain legible');
  assert.equal(viewer.match(/RUNNER_CAMERA_DISTANCE/g)?.length, 3);
  assert.match(viewer, /camera-orbit', String\(firstAngle\.current\) \+ 'deg 90deg ' \+ RUNNER_CAMERA_DISTANCE/);
  assert.match(viewer, /camera-orbit', String\(angle\) \+ 'deg 90deg ' \+ RUNNER_CAMERA_DISTANCE/);
});

test('Full-body scan framing leaves clear head and foot room at iPhone aspect ratios', () => {
  const viewer = read('src/components/profile/RunnerHologramModel.tsx');
  const distance = Number(viewer.match(/const RUNNER_CAMERA_DISTANCE = '(\d+)%'/)?.[1]);
  assert.ok(distance >= 115 && distance <= 145,
    'Model viewer 100% is a tight frame; add at least 10% margin for head and shoes');
  assert.match(viewer, /min-camera-orbit', 'auto auto 115%'/);
  assert.match(viewer, /max-camera-orbit', 'auto auto 180%'/);
  assert.match(viewer, /camera-orbit', String\(firstAngle\.current\) \+ 'deg 90deg ' \+ RUNNER_CAMERA_DISTANCE/);
  assert.match(viewer, /String\(angle\) \+ 'deg 90deg ' \+ RUNNER_CAMERA_DISTANCE/);
});


test('Profile reference artwork is a real imported image; data and controls stay live', () => {
  const source = read('src/screens/ProfileScreen.tsx');
  const styles = read('src/styles/profileY2k.css');
  const model = read('src/components/profile/RunnerHologramModel.tsx');
  const image = readFileSync(new URL('../public/assets/runnit-reference-runner.webp', import.meta.url));
  assert.equal(image.subarray(0,4).toString('ascii'),'RIFF');
  assert.equal(image.subarray(8,12).toString('ascii'),'WEBP');
  assert.match(source, /rp-runner-reference-art/);
  assert.match(source, /runnit-reference-runner\.webp/);
  assert.doesNotMatch(source, /runnerView/);
  assert.match(source, /rp-hub-runner-static/);
  assert.doesNotMatch(source, /<RunnerHologramModel/);
  assert.match(source, /supabase\.auth\.updateUser/);
  assert.match(source, /<BottomNav/);
  assert.match(styles,/\.rp-runner-reference-art/);
  assert.match(styles,/height:100dvh/);
  assert.match(styles,/\.rp-hologram-wrap\.is-paused \.rp-scan-line/);
  assert.match(model,/String\(firstAngle\.current\) \+ 'deg 90deg ' \+ RUNNER_CAMERA_DISTANCE/);
  assert.doesNotMatch(source,/LVL 14|34,7 km/);
});

test('Profile hub keeps the real runner centered and all five accessible sections work', () => {
  const screen = read('src/screens/ProfileScreen.tsx');
  const css = read('src/styles/profileHub.css');
  assert.match(screen, /useState<HubSection>\('identity'\)/);
  assert.doesNotMatch(screen, /useState<'art' \| '3d'>/);
  for (const item of ['identity', 'style', 'dna', 'training', 'badges']) {
    assert.match(screen, new RegExp("id: '" + item + "'"));
    assert.match(screen, new RegExp("activeSection === '" + item + "'"));
  }
  assert.match(screen, /role="tablist"/);
  assert.match(screen, /role="tabpanel"/);
  assert.match(screen, /aria-selected=\{activeSection === id\}/);
  assert.match(screen, /rp-hub-callouts-left/);
  assert.match(screen, /rp-hub-callouts-right/);
  assert.match(css, /\.rp-hub-callout:after/);
  assert.match(css, /\.rp-hub .rp-hub-layout/);
  assert.match(screen, /<BottomNav \/>/);
});

test('Profile hub reads real results and does not invent badges, XP or editable 3D wardrobe', () => {
  const screen = read('src/screens/ProfileScreen.tsx');
  assert.match(screen, /useRunnerHistory\(user\?\.id\)/);
  assert.match(screen, /historyAvailable \? String\(history\.totals\.completedDuels\) : '—'/);
  assert.match(screen, /historyAvailable \? formatRaceTime\(history\.totals\.best50Ms\) : '—'/);
  assert.match(screen, /formatMetric\(performance\.acceleration/);
  assert.match(screen, /formatMetric\(performance\.stride/);
  assert.match(screen, /formatMetric\(performance\.cadence/);
  assert.match(screen, /Noch keine vergebenen Badges/);
  assert.match(screen, /3D-Kleidung ist derzeit nicht wechselbar/);
  assert.doesNotMatch(screen, /LVL 14|3\.420 \/ 5\.000|128 spm|1,24 m\/s²/);
});

test('Profile redesign retains editable inputs, guest, calibration, privacy and account operations', () => {
  const screen = read('src/screens/ProfileScreen.tsx');
  for (const id of ['account','privacy','editor','dna','equipment','training','goals','badges','bio']) {
    assert.match(screen, new RegExp("pane === '" + id + "'|open\\('" + id + "'\\)"));
  }
  for (const path of ['/calibration','/gps-lab','/fusion-lab','/sprint-lab']) {
    assert.ok(screen.includes('to="' + path + '"'));
  }
  assert.match(screen, /onChange=\{\(\) => \{ void toggleGoal\(\); \}\}/);
  assert.match(screen, /onChange=\{\(event\) => \{ void saveConsent\(event\.currentTarget\.checked\); \}\}/);
  assert.match(screen, /to="\/login\?next=%2Fprofile"/);
  assert.match(screen, /supabase\.auth\.updateUser/);
  assert.match(screen, /<AccountDetailsPanel/);
});

test('Static 2D HUD keeps all six precise connector lines without rotation controls', () => {
  const screen = read('src/screens/ProfileScreen.tsx');
  const css = read('src/styles/profileHub.css');
  assert.match(screen, /viewBox="0 0 360 400"/);
  assert.equal((screen.match(/<polyline points=/g) ?? []).length, 6);
  assert.match(screen, /rp-hub-lines/);
  assert.match(screen, /rp-hub-runner-static/);
  assert.doesNotMatch(screen, /onPointerDown|setRunnerView|setTurnAngle|setTurning|runnerInteracting/);
  assert.doesNotMatch(screen, /rp-holo-controls|rp-hub-view-controls|360° SCAN/);
  assert.doesNotMatch(screen, /RunnerHologramModel|rp-hologram-real-model/);
  assert.match(screen, /className="rp-hub-anchors"/);
  assert.match(css, /\.rp-hub-anchors\{z-index:5\}/);
  assert.match(css, /left:21%;top:0;bottom:0;width:58%/);
  assert.doesNotMatch(css, /rp-hub-callout:after\{\s*content:''/);
});

test('Fidelity tabs have real-content actions, avatar images, keyboard navigation and runner ID copy', () => {
  const screen = read('src/screens/ProfileScreen.tsx');
  for (const name of ['identity','style','dna','training','badges']) {
    assert.match(screen, new RegExp("activeSection === '" + name + "'"));
  }
  assert.match(screen, /tabIndex=\{activeSection === id \? 0 : -1\}/);
  assert.match(screen, /event\.key === 'ArrowRight'/);
  assert.match(screen, /event\.key === 'ArrowLeft'/);
  assert.match(screen, /event\.key === 'Home'/);
  assert.match(screen, /event\.key === 'End'/);
  assert.match(screen, /navigator\.clipboard\.writeText\(user\.id\)/);
  assert.match(screen, /avatarImages\[item\]/);
  assert.match(screen, /onClick=\{\(\) => open\('editor'\)\}/);
  assert.match(screen, /onClick=\{\(\) => open\('equipment'\)\}/);
  assert.match(screen, /onClick=\{\(\) => open\('dna'\)\}/);
  assert.match(screen, /onClick=\{\(\) => open\('training'\)\}/);
  assert.match(screen, /onClick=\{\(\) => open\('privacy'\)\}/);
  assert.match(screen, /Noch keine vergebenen Badges/);
  assert.match(screen, /<BottomNav \/>/);
});

test('Static original 2D runner is centered full-height at normal and small iPhone sizes', () => {
  const source = read('src/screens/ProfileScreen.tsx');
  const css = read('src/styles/profileHub.css');
  assert.match(source, /src="\/assets\/runnit-reference-runner\.webp"/);
  assert.match(source, /rp-runner-reference-art-static/);
  assert.match(source, /rp-holo-stage-static/);
  assert.match(source, /rp-holo-center-static/);
  assert.match(css, /\.rp-hub \.rp-hub-runner-static/);
  assert.match(css, /\.rp-hub \.rp-hub-runner-static \.rp-runner-reference-art-static/);
  assert.match(css, /height:101%/);
  assert.match(css, /left:20%/);
  assert.match(css, /width:60%/);
  assert.match(css, /@media\(max-height:730px\)/);
  assert.doesNotMatch(source, /turnAngle|runnerView|setTurning|model-viewer|RunnerHologramModel/);
  assert.doesNotMatch(css, /rp-hub-view-controls|rp-holo-controls|rp-real-hologram/);
});

test('Guest identity panel is usable and never shows a fake runner ID', () => {
  const source = read('src/screens/ProfileScreen.tsx');
  const styles = read('src/styles/profileHub.css');
  assert.match(source, /activeSection === 'identity' && \(!user \?/);
  assert.match(source, /className="rp-hub-guest"/);
  assert.match(source, /ALS GAST NICHT VERFÜGBAR|GASTMODUS/);
  assert.match(source, /className="rp-hub-guest-login"/);
  assert.match(source, /navigator\.clipboard\.writeText\(user\.id\)/);
  assert.match(styles, /\.rp-hub \.rp-hub-guest-login/);
  assert.doesNotMatch(source, /3\.420 \/ 5\.000 XP|LVL 14/);
});
