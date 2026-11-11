import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowLeft, ArrowRight, Flag, Footprints, Gauge, RotateCcw, ShieldAlert, Timer, Trophy, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageFrame from '../components/ui/PageFrame';
import { analyzeSprintCadence, syntheticSprintTrace, type SyntheticSprintMode } from '../lib/sprintCadence';
import { demoRaceSnapshot, type DemoRaceMeters, type DemoRaceScenario } from '../lib/raceArenaPreview';

const CADENCE_OPTIONS: { id: SyntheticSprintMode; label: string; note: string }[] = [
  { id: 'running-165', label: '165 /min', note: 'Ruhiger Laufrhythmus' },
  { id: 'running-225', label: '225 /min', note: 'Schnelle Impulse' },
  { id: 'walking-110', label: '110 /min', note: 'Gehfrequenz' },
  { id: 'phone-shakes', label: 'Stöße', note: 'Unregelmäßige Handybewegungen' },
  { id: 'motion-gap', label: 'Sensorlücke', note: 'Unterbrochener Datenstrom' },
];
const RACE_OPTIONS: { id: DemoRaceScenario; label: string }[] = [
  { id: 'balanced', label: 'Kopf an Kopf' },
  { id: 'chase', label: 'Du holst auf' },
  { id: 'fast-rival', label: 'Starker Gegner' },
];

const statusTitle: Record<ReturnType<typeof analyzeSprintCadence>['status'], string> = {
  'sprint-like-rhythm': 'Sprintähnlicher Rhythmus',
  'slow-rhythm': 'Außerhalb Sprintbereich',
  irregular: 'Unregelmäßige Impulse',
  'sensor-gap': 'Sensorunterbrechung',
  'insufficient-evidence': 'Nicht genug Evidenz',
};
const percent = (distance: number, target: number) => Math.max(0, Math.min(100, 100 * distance / target));
const seconds = (ms: number) => (ms / 1000).toFixed(2).replace('.', ',');

export default function SprintArenaLabScreen() {
  const [cadenceMode, setCadenceMode] = useState<SyntheticSprintMode>('running-225');
  const [distance, setDistance] = useState<DemoRaceMeters>(100);
  const [raceScenario, setRaceScenario] = useState<DemoRaceScenario>('balanced');
  const [startEpochMs, setStartEpochMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(0);

  const cadence = useMemo(() => analyzeSprintCadence(syntheticSprintTrace(cadenceMode)), [cadenceMode]);
  const elapsedMs = startEpochMs === null ? 0 : Math.max(0, nowMs - startEpochMs);
  const race = demoRaceSnapshot({ targetMeters: distance, scenario: raceScenario, elapsedMs });
  const isCountdown = startEpochMs !== null && nowMs < startEpochMs;
  const isRunning = startEpochMs !== null && !isCountdown && !race.finished;
  const isFinished = startEpochMs !== null && !isCountdown && race.finished;
  const active = isCountdown || isRunning;
  const countdownNumber = Math.max(1, Math.ceil((startEpochMs ?? nowMs) / 1000 - nowMs / 1000));

  useEffect(() => {
    if (startEpochMs === null || nowMs >= startEpochMs + race.rivalFinishMs + 20000 ||
      nowMs >= startEpochMs + Math.max(race.rivalFinishMs, race.yourFinishMs)) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 80);
    return () => window.clearInterval(id);
  }, [startEpochMs, nowMs >= (startEpochMs ?? Infinity) + Math.max(race.rivalFinishMs, race.yourFinishMs)]);

  const resetRace = () => { setStartEpochMs(null); setNowMs(0); };
  const startRace = () => {
    const now = Date.now();
    setNowMs(now);
    setStartEpochMs(now + 3200);
  };

  return (
    <PageFrame
      kicker="RUNNIT // ENGINEERING"
      title="Sprint Arena."
      description="Die erste interaktive 1-v-1-Rennoberfläche und ein getrenntes Sprintkadenz-Labor. Alles auf diesem Bildschirm ist simuliert."
      icon={<Zap className="h-7 w-7" aria-hidden="true" />}
    >
      <section aria-label="Simulierter Rennenbildschirm" className="relative overflow-hidden rounded-[30px] border border-cyan-300/25 bg-gradient-to-br from-[#392161] via-[#182747] to-[#073a42] p-5 shadow-[0_18px_60px_rgba(0,0,0,.32)]">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-12 h-60 w-60 rounded-full bg-fuchsia-500/20 blur-[55px]" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -left-24 h-48 w-48 rounded-full bg-cyan-400/10 blur-[52px]" />
        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.23em] text-emerald-300">RACE ENGINE // HUD PROTOTYPE</p>
            <span className="rounded-full border border-amber-200/40 bg-amber-300/10 px-3 py-1 text-[10px] font-black text-amber-100">DEMO · KEINE ECHTEN LÄUFER</span>
          </div>
          <div className="mt-8 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.19em] text-cyan-100/65">HEAD TO HEAD</p>
              <p className="mt-1 text-5xl font-black tracking-[-0.07em] text-white">{distance}<span className="ml-1 text-xl tracking-normal text-emerald-300">M</span></p>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-[#07101d]/50 px-3 py-2">
              <Timer className="h-5 w-5 text-cyan-300" aria-hidden="true" />
              <span className="font-mono text-xl font-black tabular-nums">{seconds(race.elapsedMs)}s</span>
            </div>
          </div>
          <div className="mt-8 rounded-[24px] border border-white/10 bg-[#080e21]/55 p-4">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-black uppercase tracking-widest text-cyan-100">YOU</span>
              <span className="font-black tabular-nums text-cyan-200">{race.youMeters.toFixed(1)} / {distance} m</span>
            </div>
            <div className="mt-2 h-4 overflow-hidden rounded-full bg-white/10">
              <div style={{ width: percent(race.youMeters, distance) + '%' }}
                className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 via-blue-400 to-cyan-300 transition-[width] duration-75" />
            </div>
            <div className="mt-6 flex items-center justify-between gap-2 text-xs">
              <span className="font-black uppercase tracking-widest text-violet-200">RIVAL · SIM</span>
              <span className="font-black tabular-nums text-violet-200">{race.rivalMeters.toFixed(1)} / {distance} m</span>
            </div>
            <div className="mt-2 h-4 overflow-hidden rounded-full bg-white/10">
              <div style={{ width: percent(race.rivalMeters, distance) + '%' }}
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-300 transition-[width] duration-75" />
            </div>
            <p className="mt-5 text-right text-xs font-bold text-white/60">
              {active || isFinished ? `Abstand in der Demo: ${Math.abs(race.leadMeters).toFixed(1)} m · ${race.leadMeters >= 0 ? 'Du liegst vorn' : 'Gegner liegt vorn'}`
                : 'Beide Figuren warten am Start'}
            </p>
          </div>
          <div className="mt-5 flex min-h-20 items-center justify-center rounded-2xl border border-emerald-300/25 bg-[#08182a]/70 p-4 text-center" aria-live="polite">
            {isCountdown ? <p className="text-6xl font-black tabular-nums tracking-[-0.1em] text-amber-200">{countdownNumber}</p> :
              isFinished ? <div className="space-y-1">
                <p className="flex items-center justify-center gap-2 text-xl font-black text-emerald-200">
                  <Trophy className="h-5 w-5" aria-hidden="true" />
                  {race.winner === 'you' ? 'DEMO-SIEG' : race.winner === 'rival' ? 'DEMO-NIEDERLAGE' : 'DEMO-GLEICHSTAND'}
                </p>
                <p className="text-xs text-white/65">Du: {seconds(race.yourFinishMs)} s · Gegner: {seconds(race.rivalFinishMs)} s (künstliche Zeiten)</p>
              </div> : isRunning ? <p className="text-3xl font-black italic tracking-[0.07em] text-emerald-300">GO! GO! GO!</p>
                : <p className="flex items-center gap-2 text-base font-extrabold text-white/70"><Flag className="h-5 w-5" aria-hidden="true" /> BEREIT FÜR DIE DEMO</p>}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div><h2 className="text-xl font-black">Stelle dein Duell ein</h2>
          <p className="mt-1 text-xs leading-5 text-white/55">Hier werden nur festgelegte Beispielgeschwindigkeiten animiert, keine echte Distanz gemessen.</p></div>
        <div className="grid grid-cols-3 gap-2">
          {([50, 75, 100] as const).map(m => (
            <button key={m} type="button" disabled={active} aria-pressed={distance === m}
              onClick={() => { resetRace(); setDistance(m); }}
              className={`min-h-12 rounded-xl border text-sm font-black disabled:opacity-40 ${distance === m ? 'border-cyan-300/50 bg-cyan-300/15 text-cyan-100' : 'border-white/10 bg-white/[0.04] text-white/70'}`}>
              {m} m
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {RACE_OPTIONS.map(option => (
            <button key={option.id} type="button" disabled={active} aria-pressed={raceScenario === option.id}
              onClick={() => { resetRace(); setRaceScenario(option.id); }}
              className={`min-h-16 rounded-xl border px-2 text-xs font-extrabold disabled:opacity-40 ${raceScenario === option.id ? 'border-violet-300/50 bg-violet-500/20 text-violet-100' : 'border-white/10 bg-white/[0.04] text-white/65'}`}>
              {option.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <button type="button" disabled={active} onClick={startRace}
            className="flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 px-4 text-sm font-black text-white shadow-[0_12px_35px_rgba(139,92,246,.16)] disabled:opacity-40">
            <Flag className="h-5 w-5" aria-hidden="true" /> {isFinished ? 'DEMO ERNEUT STARTEN' : '3-2-1 DEMO STARTEN'}
          </button>
          <button type="button" onClick={resetRace} aria-label="Demorennen zurücksetzen"
            className="flex min-h-14 min-w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/5 text-white">
            <RotateCcw className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </section>

      <section aria-label="Sprintkadenz-Testlabor" className="space-y-4 rounded-[26px] border border-violet-300/20 bg-gradient-to-br from-[#181931] to-[#10242c] p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-emerald-300/25 bg-emerald-300/10">
            <Gauge className="h-6 w-6 text-emerald-300" aria-hidden="true" />
          </div>
          <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">EXPERIMENTAL CADENCE ENGINE</p>
            <h2 className="mt-1 text-xl font-black">Sprint-Rhythmus</h2></div>
        </div>
        <p className="text-xs leading-6 text-white/65">
          Separater Algorithmus für schnellere Beschleunigungsimpulse. Die künstlichen Testsignale erlauben keinen Rückschluss auf echte Schritte, Geschwindigkeit oder Sprintdistanz.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {CADENCE_OPTIONS.map(option => (
            <button key={option.id} type="button" aria-pressed={cadenceMode === option.id} onClick={() => setCadenceMode(option.id)}
              className={`min-h-16 rounded-xl border px-3 py-3 text-left ${cadenceMode === option.id ? 'border-emerald-300/40 bg-emerald-300/10' : 'border-white/10 bg-white/[0.035]'}`}>
              <span className="block text-sm font-black">{option.label}</span>
              <span className="mt-1 block text-[10px] leading-4 text-white/55">{option.note}</span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.07] p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-cyan-200">Peak-Kandidaten</p>
            <p className="mt-2 text-3xl font-black tabular-nums">{cadence.candidateCount}</p>
          </div>
          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.07] p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-200">Kadenz-Schätzung</p>
            <p className="mt-2 text-3xl font-black tabular-nums">{cadence.cadenceSpm === null ? '—' : cadence.cadenceSpm.toFixed(0)}<span className="ml-1 text-xs font-bold text-white/55">/min</span></p>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#080e1b]/60 p-4" role="status">
          <p className="font-black text-white">{statusTitle[cadence.status]}</p>
          <p className="mt-2 text-xs leading-6 text-white/65">{cadence.reason}</p>
          <p className="mt-2 text-[11px] text-amber-200">Sensorlücken: {cadence.sensorGapCount} · keine Schritte ergänzt, keine Sprintwertung.</p>
        </div>
      </section>
      <div className="flex gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.05] p-4">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" aria-hidden="true" />
        <p className="text-xs leading-6 text-white/70"><strong className="text-amber-100">Technischer Prototyp.</strong> Rennen, Gegner, Zeit, Signal und Fortschritt sind vollständig simuliert.
          Kein Zugriff auf GPS, Bewegungssensoren, Anmeldung, Supabase oder Ranglisten. Die reale Schrittlänge beim Sprinten ist variabel und wird hier bewusst nicht aus der Gehkalibrierung übernommen.</p>
      </div>
      <Link to="/gps-lab" className="flex min-h-14 items-center justify-between rounded-xl border border-cyan-300/20 bg-white/[0.05] px-4 text-sm font-extrabold text-cyan-100">
        <span className="flex items-center gap-2"><Footprints className="h-5 w-5" aria-hidden="true" /> Zum GPS-Testlabor</span>
        <ArrowRight className="h-5 w-5" aria-hidden="true" />
      </Link>
      <Link to="/profile" className="flex min-h-12 items-center gap-2 text-sm font-bold text-violet-200"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Zurück zum Profil</Link>
    </PageFrame>
  );
}
