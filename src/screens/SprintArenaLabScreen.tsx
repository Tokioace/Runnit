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

// Synthetic runner positions are expressed as percentages of track width.
// Translation by the same percentage of the marker's width keeps both start
// and finish markers entirely inside a clipped lane, even on narrow iPhones.
function RaceTrackLane({ title, distanceM, targetMeters, finished, rival }: {
  title: string; distanceM: number; targetMeters: DemoRaceMeters;
  finished: boolean; rival?: boolean;
}) {
  const progress = percent(distanceM, targetMeters);
  return (
    <div className="space-y-2" aria-label={`${title}: ${distanceM.toFixed(1)} von ${targetMeters} Metern`}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
        <span className={`whitespace-nowrap font-black uppercase tracking-[0.10em] ${rival ? 'text-fuchsia-200' : 'text-cyan-100'}`}>
          {title} {finished && <span className="ml-1 text-emerald-300">· FINISH</span>}
        </span>
        <span className={`whitespace-nowrap font-black tabular-nums ${rival ? 'text-fuchsia-200' : 'text-cyan-200'}`}>
          {distanceM.toFixed(1)} / {targetMeters} m
        </span>
      </div>
      <div className="relative h-14 overflow-hidden rounded-xl border border-white/10 bg-gradient-to-r from-[#121a34] to-[#122239]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-25"
          style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent 0, transparent 18%, rgba(255,255,255,.4) 18.3%, transparent 18.6%)' }} />
        <span aria-hidden="true" className="absolute bottom-1 left-2 text-[9px] font-black tracking-widest text-white/35">START</span>
        <span aria-hidden="true" className="absolute bottom-1 right-2 text-[9px] font-black tracking-widest text-white/50">ZIEL</span>
        <div aria-hidden="true" className="absolute bottom-0 right-4 top-0 w-1.5 opacity-75"
          style={{ backgroundImage: 'repeating-linear-gradient(180deg,#ffffff 0,#ffffff 6px,#26243b 6px,#26243b 12px)' }} />
        <div aria-hidden="true" className={`absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full transition-[width] duration-75 motion-reduce:transition-none ${rival ? 'bg-fuchsia-300/60' : 'bg-cyan-300/70'}`}
          style={{ width: `${progress}%` }} />
        <span aria-hidden="true" className={`absolute top-2 flex h-8 w-8 items-center justify-center rounded-full border text-xl shadow-[0_0_18px_rgba(0,0,0,.35)] transition-[left,transform] duration-75 ease-linear motion-reduce:transition-none ${rival ? 'border-fuchsia-300/70 bg-fuchsia-600' : 'border-cyan-200/70 bg-blue-600'} ${finished ? 'ring-2 ring-emerald-300/50' : ''}`}
          style={{ left: `${progress}%`, transform: `translateX(-${progress}%)` }}>
          🏃
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
        <div style={{ width: progress + '%' }}
          className={`h-full rounded-full transition-[width] duration-75 motion-reduce:transition-none ${rival ? 'bg-gradient-to-r from-violet-500 to-fuchsia-300' : 'bg-gradient-to-r from-fuchsia-500 via-blue-400 to-cyan-300'}`} />
      </div>
    </div>
  );
}

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
  const firstFinishLabel = race.firstFinisher === 'you'
    ? 'Du warst zuerst im Ziel'
    : race.firstFinisher === 'rival' ? 'Gegner zuerst im Ziel' : 'Gleichzeitig im Ziel';
  const liveLead = Math.abs(race.leadMeters) < 0.05
    ? 'Kopf an Kopf · 0,0 m'
    : `${Math.abs(race.leadMeters).toFixed(1)} m · ${race.leadMeters > 0 ? 'Du liegst vorn' : 'Gegner liegt vorn'}`;
  const countdownNumber = Math.max(1, Math.ceil((startEpochMs ?? nowMs) / 1000 - nowMs / 1000));

  useEffect(() => {
    if (startEpochMs === null || race.finished) return;
    // Only this synthetic clock advances. The personal stopwatch in the HUD
    // freezes independently at yourFinishMs, even while the opponent is running.
    const id = window.setInterval(() => setNowMs(Date.now()), 80);
    return () => window.clearInterval(id);
  }, [startEpochMs, race.finished]);

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
            <div className={`flex flex-col items-end rounded-xl border px-3 py-2 ${race.youFinished ? 'border-emerald-300/60 bg-emerald-300/10' : 'border-white/15 bg-[#07101d]/50'}`}>
              <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-white/60">
                <Timer className="h-4 w-4 text-cyan-300" aria-hidden="true" />
                {race.youFinished ? 'DEINE ZIELZEIT' : 'DEINE UHR'}
              </span>
              <span className={`mt-0.5 font-mono text-xl font-black tabular-nums ${race.youFinished ? 'text-emerald-200' : 'text-white'}`}>
                {seconds(race.yourElapsedMs)}s
              </span>
            </div>
          </div>
          <div className="mt-7 space-y-5 rounded-[24px] border border-white/10 bg-[#080e21]/55 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">
                DUAL LANE // LIVE DEMO
              </span>
              <span className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[10px] font-black text-white/65">
                ZIEL {distance} M
              </span>
            </div>
            <RaceTrackLane title="YOU" distanceM={race.youMeters} targetMeters={distance} finished={race.youFinished} />
            <RaceTrackLane title="RIVAL · SIM" distanceM={race.rivalMeters} targetMeters={distance} finished={race.rivalFinished} rival />
            <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-xs font-bold text-white/70" aria-live="polite">
              {race.firstFinisher !== null
                ? <div className="space-y-1">
                    <p className="font-black text-emerald-200">{firstFinishLabel}</p>
                    <p>
                      {race.firstFinisher === 'tie'
                        ? 'Beim Zieleinlauf gleichauf'
                        : `Abstand beim ersten Zieleinlauf: ${race.firstFinishGapM?.toFixed(1)} m`}
                      {race.finishMarginMs !== null && ` · Zeitunterschied: ${seconds(race.finishMarginMs)} s`}
                    </p>
                  </div>
                : active && !isCountdown ? liveLead : 'Beide Figuren warten am Start'}
            </div>
          </div>
          <div className="mt-5 flex min-h-20 items-center justify-center rounded-2xl border border-emerald-300/25 bg-[#08182a]/70 p-4 text-center" aria-live="polite">
            {isCountdown ? <p className="text-6xl font-black tabular-nums tracking-[-0.1em] text-amber-200">{countdownNumber}</p> :
              isFinished ? <div className="space-y-1">
                <p className="flex items-center justify-center gap-2 text-xl font-black text-emerald-200">
                  <Trophy className="h-5 w-5" aria-hidden="true" />
                  {race.winner === 'you' ? 'DEMO-SIEG' : race.winner === 'rival' ? 'DEMO-NIEDERLAGE' : 'DEMO-GLEICHSTAND'}
                </p>
                <p className="text-xs text-white/65">Du: {seconds(race.yourFinishMs)} s · Gegner: {seconds(race.rivalFinishMs)} s (künstliche Zeiten)</p>
                <p className="text-xs font-black text-cyan-200">Zeitunterschied: {seconds(Math.abs(race.yourFinishMs - race.rivalFinishMs))} s</p>
              </div> : isRunning ? (
                <div className="space-y-1">
                  {race.firstFinisher ? (
                    <p className="text-2xl font-black italic tracking-[0.05em] text-emerald-300">FINISH! <span className="text-sm not-italic">{firstFinishLabel}</span></p>
                  ) : <p className="text-3xl font-black italic tracking-[0.07em] text-emerald-300">GO! GO! GO!</p>}
                  {race.youFinished && !race.rivalFinished && <p className="text-xs font-bold text-white/70">Deine Uhr steht. Gegner läuft noch.</p>}
                  {race.rivalFinished && !race.youFinished && <p className="text-xs font-bold text-white/70">Gegner im Ziel. Deine Uhr läuft weiter.</p>}
                </div>
              )
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
