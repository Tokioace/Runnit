import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('Rangliste follows the user-supplied Y2K layout instead of the generic PageFrame panel', () => {
  const screen = read('src/screens/LeaderboardScreen.tsx');
  const css = read('src/styles/leaderboardArcade.css');
  assert.match(screen, /className="runnit-ranking-screen"/);
  assert.match(screen, /<h1>RANGLISTE<\/h1>/);
  assert.match(screen, /<Trophy \/>/);
  assert.match(screen, /<BottomNav \/>/);
  assert.doesNotMatch(screen, /<PageFrame/);
  for (const part of ['runnit-ranking-header', 'runnit-ranking-tabs',
    'runnit-ranking-row', 'runnit-ranking-avatar', 'runnit-ranking-points',
    'runnit-ranking-city', 'runnit-ranking-disclaimer']) {
    assert.match(css, new RegExp('\\.' + part + '(?:[\\s:{])'));
  }
  assert.match(css, /url\('\/runnit-ranking-city\.svg'\)/);
  assert.match(css, /runnit-ranking-row\.is-featured/);
  assert.match(css, /#d9ff32/);
  assert.match(css, /--ranking-pink:#f524d9/);
  assert.match(css, /@media\(max-width:370px\)/);
});

test('the five portrait and points entries are visibly fictional design references', () => {
  const screen = read('src/screens/LeaderboardScreen.tsx');
  const profile = read('src/components/leaderboard/ArcadeAvatar.tsx');
  const city = read('public/runnit-ranking-city.svg');
  for (const name of ['SpeedKaze', 'NightRunner', 'AeroFox', 'Stergios', 'RunHikari']) {
    assert.match(screen, new RegExp(name));
  }
  for (const level of [36, 34, 33, 24, 28]) {
    assert.match(screen, new RegExp('level: ' + level));
  }
  for (const point of [5420, 5210, 5080, 4920, 4760]) {
    assert.match(screen, new RegExp('points: ' + point));
  }
  assert.match(screen, /featured: true/);
  assert.match(screen, /DESIGNVORSCHAU/);
  assert.match(screen, /Alle Namen, Level und Punkte unten sind fiktiv/);
  assert.match(screen, /Demo-Platz/);
  assert.match(screen, /Noch keine offiziellen Sprint-Ränge/);
  assert.match(screen, /Erst unabhängig geprüfte Rennergebnisse/);
  assert.doesNotMatch(screen, /\.from\('duel_results'\)|\.from\('profiles'\)|fetch\(/);
  assert.match(profile, /Original, deterministic vector portraits/);
  assert.match(profile, /aria-hidden="true"/);
  assert.match(city, /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.doesNotMatch(city, /<script|javascript:|<image href="http/i);
});

test('GLOBAL, REGION and FREUNDE are functional semantic tabs, region/friends do not fabricate results', () => {
  const screen = read('src/screens/LeaderboardScreen.tsx');
  const css = read('src/styles/leaderboardArcade.css');
  assert.match(screen, /'global', label: 'GLOBAL'/);
  assert.match(screen, /'region', label: 'REGION'/);
  assert.match(screen, /'friends', label: 'FREUNDE'/);
  assert.match(screen, /useState<RankingTab>\('global'\)/);
  assert.match(screen, /role="tablist"/);
  assert.match(screen, /role="tab"/);
  assert.match(screen, /aria-selected=\{activeTab === id\}/);
  assert.match(screen, /onKeyDown=\{\(event\) => selectTabFromKeyboard\(event, index\)\}/);
  assert.match(screen, /key === 'ArrowRight'/);
  assert.match(screen, /key === 'ArrowLeft'/);
  assert.match(screen, /role="tabpanel"/);
  assert.match(screen, /activeTab === 'global' \? \(/);
  assert.match(screen, /<NoVerifiedResults scope=\{activeTab\} \/>/);
  assert.match(screen, /Keine erfundenen Platzierungen|keine erfundenen Platzierungen/);
  assert.match(css, /runnit-ranking-no-results/);
  assert.match(css, /runnit-ranking-tab\[aria-selected="true"\]/);
  assert.match(css, /runnit-ranking-tab:focus-visible/);
});

test('avatar art and skyline are local static assets, no remote profile data or photo permissions', () => {
  const avatar = read('src/components/leaderboard/ArcadeAvatar.tsx');
  const screen = read('src/screens/LeaderboardScreen.tsx');
  const css = read('src/styles/leaderboardArcade.css');
  for (const variant of ['speed','night','aero','player','hikari']) {
    assert.match(avatar, new RegExp('\\b' + variant + ':'));
  }
  assert.match(avatar, /viewBox="0 0 88 88"/);
  assert.match(css, /background:url\('\/runnit-ranking-city\.svg'\)/);
  assert.doesNotMatch(avatar, /fetch\(|https?:\/\//);
  assert.doesNotMatch(screen, /Date\.now\(\)|Math\.random\(\)/);
});
