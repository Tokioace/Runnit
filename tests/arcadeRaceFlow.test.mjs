import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('10-second race starts only after both authenticated players ready on the server', () => {
  const migration = read('supabase/migrations/20261116_003_arcade_ready_ten_second_start.sql');
  const legacy = read('supabase/duel_functions.sql');
  const map = read('src/screens/MapScreen.tsx');
  assert.match(migration, /statement_timestamp\(\) \+ interval '10 seconds'/);
  assert.match(migration, /v_actor is null/);
  assert.match(migration, /v_actor is distinct from v_duel.host_user_id/);
  assert.match(migration, /v_actor is distinct from v_duel.challenger_user_id/);
  assert.match(migration, /for update/);
  assert.match(migration, /v_duel.start_at is not null then return v_duel/);
  assert.match(migration, /grant execute on function public.ready_for_duel\(uuid\) to authenticated/);
  assert.match(migration, /grant update\(status\) on table public.duels to authenticated/);
  assert.doesNotMatch(migration, /interval '3 seconds'/);
  assert.match(legacy, /interval '10 seconds'/);
  assert.match(map, /const confirmMatchReady = async \(\) =>/);
  assert.match(map, /readyForDuel\(supabase, matchedDuel.id\)/);
  assert.match(map, /if \(startAt\) \{/);
  assert.match(map, /startedAt: race.startsAt/);
});

test('lobby shows both users and individual ready states, with audio unlock by tap', () => {
  const map = read('src/screens/MapScreen.tsx');
  const lobby = read('src/components/race/ReadyLobby.tsx');
  assert.match(map, /<ReadyLobby/);
  assert.match(map, /hostName=\{/);
  assert.match(map, /challengerName=\{/);
  assert.match(map, /if \(raceSoundEnabled\) unlockRaceAudio\(\)/);
  assert.match(lobby, /role="dialog" aria-modal="true"/);
  assert.match(lobby, /ready=\{hostReady\}/);
  assert.match(lobby, /ready=\{challengerReady\}/);
  assert.match(lobby, /disabled=\{mineReady \|\| readyBusy\}/);
  assert.match(lobby, /START ERST WENN/);
  assert.match(lobby, /ICH BIN READY/);
});

test('rainbow countdown has ten separate colors and uses authoritative timestamp without restarting effect on render', () => {
  const screen = read('src/components/race/RaceCountdown.tsx');
  const map = read('src/screens/MapScreen.tsx');
  assert.match(screen, /ARCADE_COUNTDOWN_SECONDS = 10/);
  const palette = screen.match(/export const ARCADE_COUNTDOWN_COLORS = \[([\s\S]*?)\] as const/);
  assert.ok(palette);
  assert.equal([...palette[1].matchAll(/#[0-9a-fA-F]{6}/g)].length, 10);
  assert.match(screen, /Math.ceil\(\(startsAt - now\) \/ 1000\)/);
  assert.match(screen, /\}, \[startsAt\]\)/);
  assert.match(screen, /scheduleArcadeStartSfx\(startsAt\)/);
  assert.match(map, /startsAt=\{matchOverlay.startsAt\}/);
  assert.match(map, /ARCADE_COUNTDOWN_SECONDS \* 1000/);
  assert.doesNotMatch(map, /function MatchCountdownOverlay/);
});

test('original synthesized sound and finish UI do not claim a fake race win', () => {
  const audio = read('src/lib/arcadeRaceAudio.ts');
  const map = read('src/screens/MapScreen.tsx');
  const css = read('src/styles/raceArcade.css');
  assert.match(audio, /scheduleArcadeStartSfx\(startsAt: number\)/);
  assert.match(audio, /playArcadeFinishSfx\(\)/);
  assert.match(audio, /if \(ctx\.state !== 'running'\) await ctx.resume\(\)/);
  assert.match(audio, /\[\[3, 620\], \[2, 720\], \[1, 820\]\]/);
  assert.match(audio, /createBufferSource\(\)/);
  const finish = read('src/components/race/DuelFinishScreen.tsx');
  assert.match(finish, /playArcadeFinishSfx\(\)/);
  assert.match(finish, /ZIEL ERREICHT!/);
  assert.match(finish, /status === 'completed'/);
  assert.match(finish, /GPS- und Zeitmessung sind experimentell/);
  assert.match(map, /<DuelFinishScreen/);
  assert.doesNotMatch(map, /setUserTimes\(/);
  assert.match(map, /RaceOverlay/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /race-arcade-live/);
  assert.match(css, /race-arcade-finish/);
});
