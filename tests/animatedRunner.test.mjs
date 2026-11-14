import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('runner is a right-facing vector with separate animated arms and legs, not a platform emoji', () => {
  const runner = read('src/components/ui/AnimatedRunner.tsx');
  const screen = read('src/screens/SprintArenaLabScreen.tsx');
  assert.match(runner, /viewBox="0 0 48 48"/);
  assert.match(runner, /circle cx="34" cy="11\.2"/); // Visible eye on the right of the head
  assert.match(runner, /runnit-sprint-arm--front/);
  assert.match(runner, /runnit-sprint-arm--back/);
  assert.match(runner, /runnit-sprint-leg--front/);
  assert.match(runner, /runnit-sprint-leg--back/);
  assert.match(runner, /moving \? 'runnit-sprint-runner--moving' : ''/);
  assert.match(screen, /<AnimatedRunner moving=\{moving\} rival=\{rival\}/);
  assert.doesNotMatch(screen, /🏃/);
});

test('both runners animate only while their own simulated race is in progress', () => {
  const screen = read('src/screens/SprintArenaLabScreen.tsx');
  assert.ok(screen.includes('moving={isRunning && !race.youFinished}'));
  assert.ok(screen.includes('moving={isRunning && !race.rivalFinished}'));
  assert.match(screen, /<RaceTrackLane title="YOU"/);
  assert.match(screen, /<RaceTrackLane title="RIVAL · SIM"/);
  const runner = read('src/components/ui/AnimatedRunner.tsx');
  assert.ok(runner.includes("aria-hidden=\"true\""));
  assert.ok(runner.includes("rival ? '#e879f9' : '#67e8f9'"));
});

test('limbs alternate and stop under reduced-motion preference', () => {
  const css = read('src/index.css');
  assert.match(css, /@keyframes runnit-sprint-swing-forward/);
  assert.match(css, /@keyframes runnit-sprint-swing-back/);
  assert.match(css, /@keyframes runnit-sprint-bob/);
  assert.match(css, /runnit-sprint-runner--moving \.runnit-sprint-arm--front/);
  assert.match(css, /runnit-sprint-runner--moving \.runnit-sprint-leg--front/);
  assert.match(css, /runnit-sprint-runner--moving \.runnit-sprint-arm--back/);
  assert.match(css, /runnit-sprint-runner--moving \.runnit-sprint-leg--back/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /animation: none !important/);
});

test('ZIEL is outside the clipped race track, independent of the runner and checkered stripe', () => {
  const screen = read('src/screens/SprintArenaLabScreen.tsx');
  // This footer comes AFTER the lane closes and before its progress bar.
  assert.match(screen, /<AnimatedRunner moving=\{moving\} rival=\{rival\}[^>]*\/>\s*<\/span>\s*<\/div>\s*<div className="flex items-center justify-between/);
  assert.match(screen, /px-2 py-1 text-emerald-200">ZIEL<\/span>/);
  assert.match(screen, /backgroundImage: 'repeating-linear-gradient\(180deg/);
  assert.doesNotMatch(screen, /absolute bottom-1 right-2[^\n]*>ZIEL<\/span>/);
});

test('new preview animations stay isolated from measured races and backend', () => {
  const runner = read('src/components/ui/AnimatedRunner.tsx');
  const screen = read('src/screens/SprintArenaLabScreen.tsx');
  for (const prohibited of ['navigator.geolocation', 'devicemotion', 'supabase.from(', 'submitDuelResult(', 'createDuel(']) {
    assert.equal((runner + screen).includes(prohibited), false, prohibited);
  }
});
