import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyzeSprintCadence, syntheticSprintTrace } from '../src/lib/sprintCadence.ts';
import { demoRaceSnapshot } from '../src/lib/raceArenaPreview.ts';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('new sprint detector recognizes fast synthetic cadence without changing walking counter', () => {
  for (const [mode, expected] of [['running-165', 165], ['running-225', 225]]) {
    const report = analyzeSprintCadence(syntheticSprintTrace(mode));
    assert.equal(report.status, 'sprint-like-rhythm', mode);
    assert.ok(Math.abs(report.cadenceSpm - expected) <= 4, mode + ': ' + report.cadenceSpm);
    assert.ok(report.candidateCount >= 10, mode + ': peak candidates');
    assert.equal(report.sensorGapCount, 0);
    assert.ok(report.intervalVariation <= 0.2);
  }
  assert.doesNotMatch(read('src/lib/sprintCadence.ts'), /new LiveStepPeakCounter|import .*liveStepPeaks/);
});

test('walking cadence is not silently promoted to sprinting', () => {
  const report = analyzeSprintCadence(syntheticSprintTrace('walking-110'));
  assert.equal(report.status, 'slow-rhythm');
  assert.ok(report.cadenceSpm < 140);
});

test('unstructured shaking is never described as established sprint cadence', () => {
  const report = analyzeSprintCadence(syntheticSprintTrace('phone-shakes'));
  assert.notEqual(report.status, 'sprint-like-rhythm');
  assert.equal(report.cadenceSpm, null);
});

test('a long sensor interruption blocks cadence despite repeated peaks', () => {
  const report = analyzeSprintCadence(syntheticSprintTrace('motion-gap'));
  assert.equal(report.status, 'sensor-gap');
  assert.ok(report.sensorGapCount >= 1);
  assert.equal(report.cadenceSpm, null);
});

test('invalid, out-of-order and duplicate readings are skipped without creating phantom peaks', () => {
  const trace = syntheticSprintTrace('running-225');
  const dirty = [{ timestampMs: -1, accelerationMagnitudeMps2: NaN },
    ...trace.slice(0, 50), trace[30], trace[30],
    { timestampMs: 500, accelerationMagnitudeMps2: -1 },
    ...trace.slice(50)];
  const report = analyzeSprintCadence(dirty);
  assert.ok(report.rejectedSamples >= 4);
  assert.equal(report.status, 'sprint-like-rhythm');
  assert.ok(Math.abs(report.cadenceSpm - 225) <= 4);
});

test('stationary acceleration noise and isolated impulses are not classified as sprinting', () => {
  const still = Array.from({ length: 500 }, (_, i) => ({
    timestampMs: i * 10, accelerationMagnitudeMps2: 0.5 + 0.1 * Math.sin(i),
  }));
  const report = analyzeSprintCadence(still);
  assert.equal(report.status, 'insufficient-evidence');
  assert.equal(report.candidateCount, 0);
  assert.equal(report.cadenceSpm, null);
});

test('demo race starts at zero and increases both fictional track positions', () => {
  const a = demoRaceSnapshot({ targetMeters: 100, scenario: 'balanced', elapsedMs: 0 });
  const b = demoRaceSnapshot({ targetMeters: 100, scenario: 'balanced', elapsedMs: 6000 });
  assert.equal(a.youMeters, 0);
  assert.equal(a.rivalMeters, 0);
  assert.ok(b.youMeters > 0 && b.youMeters < 100);
  assert.ok(b.rivalMeters > 0 && b.rivalMeters < 100);
  assert.equal(b.winner, null);
  assert.equal(b.finished, false);
});

test('race animation respects target, winner and timing without affecting ranked results', () => {
  for (const targetMeters of [50, 75, 100]) {
    const win = demoRaceSnapshot({ targetMeters, scenario: 'chase', elapsedMs: 120000 });
    const loss = demoRaceSnapshot({ targetMeters, scenario: 'fast-rival', elapsedMs: 120000 });
    assert.equal(win.finished, true);
    assert.equal(win.winner, 'you');
    assert.equal(loss.winner, 'rival');
    assert.equal(win.youMeters, targetMeters);
    assert.equal(win.rivalMeters, targetMeters);
    assert.ok(win.yourFinishMs < win.rivalFinishMs);
    assert.ok(loss.yourFinishMs > loss.rivalFinishMs);
  }
});

test('invalid race inputs are rejected; elapsed demo time is bounded below by zero', () => {
  assert.throws(() => demoRaceSnapshot({ targetMeters: 30, scenario: 'balanced', elapsedMs: 0 }));
  assert.throws(() => demoRaceSnapshot({ targetMeters: 50, scenario: 'balanced', elapsedMs: Infinity }));
  assert.equal(demoRaceSnapshot({ targetMeters: 50, scenario: 'balanced', elapsedMs: -10 }).elapsedMs, 0);
});

test('sprint page and model are separate from GPS, live sensors, Supabase and race writes', () => {
  const screen = read('src/screens/SprintArenaLabScreen.tsx');
  const app = read('src/App.tsx');
  const profile = read('src/screens/ProfileScreen.tsx');
  const engine = read('src/lib/sprintCadence.ts');
  const demo = read('src/lib/raceArenaPreview.ts');
  assert.match(screen, /DEMO · KEINE ECHTEN LÄUFER/);
  assert.match(screen, /syntheticSprintTrace/);
  assert.match(screen, /demoRaceSnapshot/);
  assert.match(screen, /countdownNumber/);
  assert.match(screen, /Gegner/);
  assert.match(app, /<Route path="\/sprint-lab" element=\{<SprintArenaLabScreen \/>\}/);
  assert.match(profile, /to="\/sprint-lab"/);
  for (const prohibited of ['navigator.geolocation', 'devicemotion', 'supabase.auth',
    'supabase.from(', 'submitDuelResult(', 'saveRaceResult(', 'createDuel(']) {
    assert.equal((screen + engine + demo).includes(prohibited), false, prohibited);
  }
  assert.doesNotMatch(engine, /walkingStrideM|stepDistanceM|walkingCalibration/);
});

test('personal stopwatch freezes at own simulated finish while the rival is still running', () => {
  for (const targetMeters of [50, 75, 100]) {
    const seed = demoRaceSnapshot({ targetMeters, scenario: 'chase', elapsedMs: 0 });
    const justBefore = demoRaceSnapshot({ targetMeters, scenario: 'chase', elapsedMs: seed.yourFinishMs - 1 });
    assert.equal(justBefore.youFinished, false);
    assert.equal(justBefore.firstFinisher, null);
    assert.equal(justBefore.firstFinishGapM, null);
    const firstFinish = demoRaceSnapshot({ targetMeters, scenario: 'chase', elapsedMs: seed.yourFinishMs });
    assert.equal(firstFinish.youFinished, true);
    assert.equal(firstFinish.rivalFinished, false);
    assert.equal(firstFinish.finished, false);
    assert.equal(firstFinish.firstFinisher, 'you');
    assert.equal(firstFinish.yourElapsedMs, seed.yourFinishMs);
    assert.ok(firstFinish.firstFinishGapM > 0);
    assert.equal(firstFinish.finishMarginMs, seed.rivalFinishMs - seed.yourFinishMs);
    const afterFinish = demoRaceSnapshot({ targetMeters, scenario: 'chase', elapsedMs: seed.rivalFinishMs + 1000 });
    assert.equal(afterFinish.yourElapsedMs, seed.yourFinishMs, 'own stopwatch must remain frozen');
    assert.equal(afterFinish.leadMeters, 0, 'both displayed track positions equal at end');
    assert.ok(afterFinish.firstFinishGapM > 0, 'historical finish gap survives both bars reaching 100%');
    assert.equal(afterFinish.winner, 'you');
  }
});

test('when the rival wins, own stopwatch keeps running until own finish', () => {
  const seed = demoRaceSnapshot({ targetMeters: 100, scenario: 'fast-rival', elapsedMs: 0 });
  const firstFinish = demoRaceSnapshot({ targetMeters: 100, scenario: 'fast-rival', elapsedMs: seed.rivalFinishMs });
  assert.equal(firstFinish.firstFinisher, 'rival');
  assert.equal(firstFinish.rivalFinished, true);
  assert.equal(firstFinish.youFinished, false);
  assert.equal(firstFinish.yourElapsedMs, seed.rivalFinishMs, 'your stopwatch does not stop when rival finishes');
  assert.ok(firstFinish.firstFinishGapM > 0);
  const ownFinish = demoRaceSnapshot({ targetMeters: 100, scenario: 'fast-rival', elapsedMs: seed.yourFinishMs + 2000 });
  assert.equal(ownFinish.yourElapsedMs, seed.yourFinishMs);
  assert.equal(ownFinish.winner, 'rival');
  assert.equal(ownFinish.finishMarginMs, seed.yourFinishMs - seed.rivalFinishMs);
});

test('zero time has no phantom finish and snapshot never advances the personal clock past finish', () => {
  for (const scenario of ['balanced', 'chase', 'fast-rival']) {
    const start = demoRaceSnapshot({ targetMeters: 100, scenario, elapsedMs: 0 });
    assert.equal(start.yourElapsedMs, 0);
    assert.equal(start.youFinished, false);
    assert.equal(start.rivalFinished, false);
    assert.equal(start.firstFinisher, null);
    const late = demoRaceSnapshot({ targetMeters: 100, scenario, elapsedMs: 999999 });
    assert.equal(late.yourElapsedMs, late.yourFinishMs);
    assert.equal(late.finished, true);
    assert.equal(late.firstFinishGapM >= 0, true);
  }
});

test('HUD renders frozen personal time, two moving running lanes and historical finish gap', () => {
  const screen = read('src/screens/SprintArenaLabScreen.tsx');
  assert.match(screen, /seconds\(race\.yourElapsedMs\)/);
  assert.match(screen, /DEINE ZIELZEIT/);
  assert.match(screen, /firstFinishGapM\?\.toFixed\(1\)/);
  assert.match(screen, /Abstand beim ersten Zieleinlauf/);
  assert.match(screen, /<RaceTrackLane title="YOU"/);
  assert.match(screen, /<RaceTrackLane title="RIVAL · SIM"/);
  assert.match(screen, /transition-\\[left,transform\\]/);
  assert.match(screen, /role="status"/);
  assert.doesNotMatch(screen, /Abstand in der Demo: .*race\.leadMeters/);
  const map = read('src/screens/MapScreen.tsx');
  assert.match(map, /Renn-Grafik testen · Demo ohne zweiten Läufer/);
});

test('mobile runner avatars remain entirely in lane at start, mid-race and finish', () => {
  const screen = read('src/screens/SprintArenaLabScreen.tsx');
  assert.ok(screen.includes('left: \`${progress}%\`'));
  assert.ok(screen.includes('transform: \`translateX(-${progress}%)\`'));
  assert.match(screen, /flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs/);
  assert.match(screen, /whitespace-nowrap font-black tabular-nums/);

  // In CSS left: p% uses track width, while translateX(-p%) uses
  // the runner badge's own width; endpoints remain fully visible.
  for (const trackWidth of [210, 280, 375]) {
    for (const markerWidth of [32, 40]) {
      for (const progress of [0, 1, 30, 66.4, 99, 100]) {
        const left = trackWidth * progress / 100 - markerWidth * progress / 100;
        assert.ok(left >= 0, 'badge starts inside the track');
        assert.ok(left + markerWidth <= trackWidth + 1e-8, 'badge ends inside the track');
      }
    }
  }
});
