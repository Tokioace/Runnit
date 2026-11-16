import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('Arena follows the three latest supplied reference screens', () => {
  const screen = read('src/screens/LeaderboardScreen.tsx');
  const css = read('src/styles/arenaArcade.css');
  assert.match(screen, /className="arena-screen"/);
  assert.match(screen, /<h1>ARENA<\/h1>/);
  assert.match(screen, /'rivals', label: 'RIVALS'/);
  assert.match(screen, /'ladder', label: 'LADDER'/);
  assert.match(screen, /'legends', label: 'LEGENDS'/);
  assert.match(screen, /role="tablist"/);
  assert.match(screen, /aria-selected=\{tab === id\}/);
  assert.match(screen, /onKeyDown=\{event => onTabKeyDown\(event, index\)\}/);
  assert.match(screen, /<Rivals currentName=\{currentName\}\/>/);
  assert.match(screen, /<Ladder scope=\{scope\} setScope=\{changeScope\} currentName=\{currentName\}\/>/);
  assert.match(screen, /<Legends scope=\{scope\} setScope=\{changeScope\} currentName=\{currentName\} resetScroll=\{resetScroll\}\/>/);
  assert.match(screen, /<BottomNav\/>/);
  assert.doesNotMatch(screen, /<PageFrame|RANGLISTE<\/h1>/);
  for(const selector of ['arena-hero','arena-tabs','arena-section-bar','arena-showdown','arena-ladder-grid','arena-metrics','arena-board-list','arena-champion','arena-self-strip']) {
    assert.match(css, new RegExp('\\.' + selector + '[\\{\\s\\.]'));
  }
});

test('Arena showcases are explicitly fictional, never claimed as server-verified rankings', () => {
  const screen = read('src/screens/LeaderboardScreen.tsx');
  const provenance = read('src/lib/leaderboardProvenance.ts');
  assert.match(screen, /FICTIONAL SHOWCASE/);
  assert.match(screen, /FIKTIVE NAMEN, RÄNGE UND REKORDE/);
  assert.match(screen, /NICHT VERIFIZIERT/);
  assert.match(screen, /Diese Gegner und Herausforderungen sind fiktiv/);
  assert.doesNotMatch(screen, /\.from\('profiles'\)|\.from\('duel_results'\)|fetch\(/);
  assert.match(provenance, /'demo':|demo: 'Demo/);
});

test('Legends has exactly six metrics and always switches a single-metric ranking', () => {
  const screen = read('src/screens/LeaderboardScreen.tsx');
  for(const id of ['times','speed','acceleration','reaction','wins','streak']) {
    assert.match(screen, new RegExp("id: '" + id + "'"));
  }
  assert.match(screen, /onClick=\{\(\) => \{ setMetric\(id\); resetScroll\(\); \}\}/);
  assert.match(screen, /recordText\(metric, distance, i\)/);
  assert.match(screen, /LeaderboardList title=\{selected\.title/);
  assert.match(screen, /aria-pressed=\{metric === id\}/);
  assert.match(screen, /m\/s²/);
});

test('Only BESTZEITEN has 50/75/100 m and content below never jumps', () => {
  const screen = read('src/screens/LeaderboardScreen.tsx');
  const css = read('src/styles/arenaArcade.css');
  assert.match(screen, /metric === 'times' && \(/);
  assert.match(screen, /50, 75, 100/);
  assert.match(screen, /className="arena-distance"/);
  assert.match(css, /\.arena-distance\{/);
  assert.match(css, /position:absolute;z-index:2/);
  assert.match(css, /\.arena-champion\{/);
  assert.match(css, /flex:0 0 clamp\(64px,8\.9dvh,90px\)/);
  assert.match(css, /\.arena-board-list\{list-style:none;display:grid;grid-template-rows:repeat\(10/);
});

test('Ten placements plus one own placement are present; official result tables need integration', () => {
  const screen = read('src/screens/LeaderboardScreen.tsx');
  assert.match(screen, /runners\.map\(x => String\(x\.rating\)\)/);
  assert.match(screen, /entries\.map\(\(entry, index\) =>/);
  assert.match(screen, /<DemoRow rank=\{ownRank\}/);
  assert.match(screen, /scope === 'city' \? 27 : scope === 'country' \? 132 : 247/);
  assert.match(screen, /SpeedKaze/);
  assert.match(screen, /AeroFox/);
  assert.match(screen, /currentName/);
  assert.match(screen, /displayName\?\.trim\(\)/);
});

test('Rivals actions are only a visual preview until verified challenge invitations exist', () => {
  const screen = read('src/screens/LeaderboardScreen.tsx');
  assert.match(screen, /HEAD-TO-HEAD/);
  assert.match(screen, /REVANCHE/);
  assert.match(screen, /DEINE RIVALEN/);
  assert.match(screen, /HERAUSFORDERUNGEN/);
  assert.match(screen, /onClick=\{notify\}/);
  assert.match(screen, /DESIGNVORSCHAU: Diese Gegner und Herausforderungen sind fiktiv/);
  assert.doesNotMatch(screen, /createChallenge\(|sendChallenge\(|submitDuelResult\(/);
});

test('Shared bottom navigation has three stable PLAY/MAP/ARENA destinations and real profile access', () => {
  const nav = read('src/components/ui/BottomNav.tsx');
  const screen = read('src/screens/LeaderboardScreen.tsx');
  const css = read('src/styles/arenaArcade.css');
  for(const expected of ["href: '/home', label: 'PLAY'","href: '/map', label: 'MAP'","href: '/leaderboard', label: 'ARENA'"]) {
    assert.ok(nav.includes(expected),expected);
  }
  assert.match(nav, /aria-current=\{active \? 'page' : undefined\}/);
  assert.match(nav, /aria-label=\{label\}/);
  assert.match(screen, /to="\/profile"/);
  assert.match(css, /\.arena-global-dock ul\{width:100%;max-width:614px;display:grid;grid-template-columns:repeat\(3/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /height:100dvh/);
  assert.match(css, /overflow:hidden/);
});


test('iPhone preview rows never collapse into overlaid zero-height grid tracks', () => {
  const css = read('src/styles/arenaArcade.css');
  assert.match(css, /grid-template-rows:repeat\(10,minmax\(20px,1fr\)\)/);
  assert.match(css, /min-height:200px;flex:1 0 auto/);
  assert.match(css, /\.arena-content\{overflow-y:auto/);
  assert.match(css, /\.arena-global-dock\{[\s\S]*position:fixed;inset-inline:0;bottom:0/);
  assert.match(css, /\.arena-screen\{[\s\S]*padding-bottom:var\(--arena-dock-reserve\)/);
  assert.match(css, /\.arena-stage\{gap:3px\}/);
  assert.match(css, /\.arena-next-rival\{flex:0 0 clamp/);
  assert.match(css, /\.arena-showdown\{padding:5px 6px\}/);
  assert.doesNotMatch(css, /url\('\/runnit-launch-hero\.webp'\)/);
});


test('switching Arena tabs and records resets stale scrolling instead of hiding new headers', () => {
  const screen = read('src/screens/LeaderboardScreen.tsx');
  assert.match(screen, /const contentRef = useRef<HTMLDivElement>\(null\)/);
  assert.match(screen, /contentRef\.current\.scrollTop = 0/);
  assert.match(screen, /onClick=\{\(\) => \{ setTab\(id\); resetScroll\(\); \}\}/);
  assert.match(screen, /onClick=\{\(\) => \{ setMetric\(id\); resetScroll\(\); \}\}/);
  assert.match(screen, /key=\{tab\} className="arena-content"/);
});

test('Arena uses approved illustrated reference runner instead of the stick-figure fallback', () => {
  const css = read('src/styles/arenaArcade.css');
  const art = read('public/runnit-arena-reference-runner.svg');
  assert.match(css, /runnit-arena-reference-runner\.svg/);
  assert.doesNotMatch(css, /runnit-runner-mark\.svg/);
  assert.match(art, /viewBox="0 0 150 118"/);
  const match = art.match(/data:image\/webp;base64,([A-Za-z0-9+/=]+)/);
  assert.ok(match, 'embedded WebP illustration must be present');
  const bytes = Buffer.from(match[1], 'base64');
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
});
