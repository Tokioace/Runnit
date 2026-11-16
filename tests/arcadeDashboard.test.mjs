import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('PLAY follows the agreed three-destination app structure instead of the old four-card dashboard', () => {
  const home = read('src/screens/DashboardScreen.tsx');
  const nav = read('src/components/ui/BottomNav.tsx');
  const css = read('src/styles/playArcade.css');
  assert.match(home, /className="play-screen"/);
  assert.match(home, /play-hero/);
  assert.match(home, /runnit-metal-logo\.svg/);
  assert.match(home, /runnit-arena-reference-runner\.svg/);
  assert.match(home, /<BottomNav/);
  assert.match(home, /RUN <em>NOW<\/em>/);
  assert.match(home, /aria-haspopup="dialog"/);
  assert.match(home, /role="dialog" aria-modal="true"/);
  assert.match(home, /RIVAL <em>WANTED<\/em>/);
  assert.match(home, /NEAR YOU/);
  assert.match(home, /BUILD YOUR LEGACY/);
  assert.doesNotMatch(home, /runnit-game-modes|runnit-game-mode|runnit-game-activity/);
  for (const target of ["/home", "/map", "/leaderboard"]) assert.ok(nav.includes(target));
  assert.doesNotMatch(nav, /href: '\/stats'/);
  assert.match(css, /height:100dvh/);
  assert.match(css, /play-run-button/);
  assert.match(css, /play-rival/);
  assert.match(css, /safe-area-inset-bottom/);
});

test('RUN NOW first asks 1v1 or GHOST, then a distance, then the real start location', () => {
  const home = read('src/screens/DashboardScreen.tsx');
  const map = read('src/screens/MapScreen.tsx');
  assert.match(home, /type RaceMode = 'duel' \| 'ghost'/);
  assert.match(home, /type RaceDistance = 50 \| 75 \| 100/);
  assert.match(home, /onClick=\{\(\) => setMode\('ghost'\)\}/);
  assert.match(home, /onClick=\{\(\) => setMode\('duel'\)\}/);
  assert.match(home, /STARTPUNKT WÄHLEN/);
  assert.match(home, /'\/map\?play=duel&distance=' \+ distance/);
  assert.match(home, /500-m-Radius/);
  assert.match(home, /GHOST RUN IST IN VORBEREITUNG/);
  assert.doesNotMatch(home, /to="\/sprint-lab"|submitDuelResult|createDuel\(/);
  assert.match(map, /startParams\.get\('play'\) === 'duel'/);
  assert.match(map, /selectedStartDistance/);
  assert.match(map, /defaultDistance=\{startFromPlay \? selectedStartDistance : 50\}/);
  assert.match(map, /onHostAt=\{openHostRunAt\}/);
  assert.match(map, /if \(!requireRaceAccount\(\)\) return/);
  assert.match(map, /canHostAt\(userCoords, point\)/);
});

test('PLAY does not fake a rivalry, XP, user ratings or official ranks', () => {
  const home = read('src/screens/DashboardScreen.tsx');
  for (const value of ['TurboKai', 'AerofOx führt', '12.430', '15.000 XP', 'RATING 1250', 'LV. 24']) {
    assert.ok(!home.includes(value),value);
  }
  assert.match(home, /source === 'verified'/);
  assert.match(home, /verifiedRank \? '#' \+ verifiedRank\.position : '—'/);
  assert.match(home, /Noch keine verifizierten Rennen oder Platzierungen/);
  assert.match(home, /WER WIRD DEIN ERSTER RIVALE/);
  assert.match(home, /displayName\?\.trim\(\) \|\| 'RUNNER'/);
  assert.doesNotMatch(home, /navigator\.geolocation|watchPosition|supabase|fetch\(/);
});

test('PLAY keeps the welcome/auth launch screen unchanged', () => {
  const launch = read('src/screens/HomeScreen.tsx');
  const app = read('src/App.tsx');
  assert.match(launch, /runnit-launch-portrait\.avif/);
  assert.match(launch, /onClick=\{onStart\}/);
  assert.match(app, /<Route path="\/" element=\{<HomeScreen/);
  assert.match(app, /<Route path="\/home" element=\{<DashboardScreen displayName=\{auth\.user\?\.displayName\} \/>/);
  assert.doesNotMatch(launch, /<BottomNav/);
});

test('PLAY preserves the four-part visual hierarchy without scroll traps', () => {
  const css = read('src/styles/playArcade.css');
  for (const section of ['play-hero','play-hud','play-start','play-rival','play-discovery','play-modal-backdrop']) {
    assert.match(css,new RegExp('\\.' + section + '[\\{\\s:]'),section);
  }
  assert.match(css, /overflow-y:auto/);
  assert.match(css, /overscroll-behavior:contain/);
  assert.match(css, /@media\(max-height:735px\)/);
  assert.match(css, /@media\(max-height:615px\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  const navCss = read('src/styles/arenaArcade.css');
  assert.match(navCss, /\.arena-global-dock\{[\s\S]*position:fixed;inset-inline:0;bottom:0/);
});
