import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const styles = read('src/styles/runnitCompetition.css');
const screen = read('src/screens/LeaderboardScreen.tsx');
const fixes = styles.slice(styles.lastIndexOf('iPhone real-data layout review'));

test('one visible player cannot stretch into a full-height leaderboard tile', () => {
  assert.match(fixes, /\.runnit-competition \.arena-live-board \{[\s\S]*?flex: 0 1 auto;/);
  assert.match(fixes, /\.runnit-competition \.arena-board-row,[\s\S]*?flex: 0 0 clamp\(29px, 3\.7dvh, 34px\);/);
  assert.match(fixes, /\.runnit-competition \.arena-board-list \{[\s\S]*?overflow-y: auto;/);
  assert.match(screen, /rows\.slice\(0,10\)/);
});

test('real rival panels are content-sized rather than half-screen blank cards', () => {
  assert.match(fixes, /\.arena-rivals \.arena-duel-grid \{[\s\S]*?flex: 0 1 auto;[\s\S]*?min-height: 0;/);
  assert.match(fixes, /\.arena-rivals \.arena-duel-panel \{[\s\S]*?min-height: 70px;/);
  assert.match(fixes, /\.arena-rivals \.arena-mini-row \{[\s\S]*?flex: 0 0 24px;/);
  assert.match(screen, /summarizeRivals\(history\.races\)/);
});

test('the new-duel button and 50m champion have dedicated non-overlapping room', () => {
  assert.match(fixes, /\.arena-rivals \.arena-showdown \{[\s\S]*?flex: 0 0 clamp\(162px, 20\.5dvh, 180px\);/);
  assert.match(fixes, /\.arena-rematch \{[\s\S]*?margin-top: 6px;/);
  assert.match(fixes, /\.arena-champion:has\(\.arena-distance\) \{[\s\S]*?flex: 0 0 clamp\(97px, 12dvh, 108px\);/);
  assert.match(fixes, /\.arena-champion:has\(\.arena-distance\) \.arena-champion-main \{[\s\S]*?padding-top: 28px;/);
  assert.match(screen, /\(\[50,75,100\] as const\)/);
});

test('the existing Supabase data sources and bottom navigation are unchanged', () => {
  assert.match(screen, /list_beta_duel_leaderboard/);
  assert.match(screen, /list_beta_runnit_records/);
  assert.match(screen, /<BottomNav\/>/);
  assert.match(read('src/components/ui/BottomNav.tsx'), /grid-cols-5/);
});
