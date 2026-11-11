import { useMemo, useState } from 'react';
import { Activity, ArrowLeft, ArrowRight, Footprints, MapPinned, RadioTower, RotateCcw, ShieldAlert, Waves } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageFrame from '../components/ui/PageFrame';
import { reconcileWalkingDistance, type FusionMode } from '../lib/walkingDistanceFusion';
import { syntheticPoint } from '../lib/sprintGps';

type Scenario = 'clean' | 'weak-gps' | 'gps-jump' | 'imu-gap' | 'curve';
const SCENARIOS: { id: Scenario; label: string; subtitle: string }[] = [
  { id: 'clean', label: 'Saubere Messung', subtitle: 'GPS und Schritte stimmen überein' },
  { id: 'weak-gps', label: 'Schwaches GPS', subtitle: 'Nur IMU-Schätzung' },
  { id: 'gps-jump', label: 'GPS-Sprung', subtitle: 'Widerspruch erkennen' },
  { id: 'imu-gap', label: 'Sensorlücke', subtitle: 'Kein Überbrücken' },
  { id: 'curve', label: 'Kurvige Strecke', subtitle: 'Luftlinie nicht als Weg verkaufen' },
];

const MODE: Record<FusionMode, { title: string; color: string; border: string }> = {
  combined: { title: 'GPS + IMU vereinbar', color: 'text-emerald-200', border: 'border-emerald-300/30' },
  'steps-only': { title: 'Nur Schrittschätzung', color: 'text-cyan-200', border: 'border-cyan-300/30' },
  'gps-only': { title: 'Nur GPS-Luftlinie', color: 'text-violet-200', border: 'border-violet-300/30' },
  conflict: { title: 'Signale widersprechen sich', color: 'text-amber-200', border: 'border-amber-300/30' },
  paused: { title: 'Sensoraufnahme unterbrochen', color: 'text-amber-200', border: 'border-amber-300/30' },
  unavailable: { title: 'Keine zuverlässige Grundlage', color: 'text-rose-200', border: 'border-rose-300/30' },
};

const DEMO_STRIDE_M = 0.72;
const TOTAL_STEPS = 50;
const fmt = (value: number | null) => value === null ? '—' : value.toFixed(1) + ' m';

export default function FusionLabScreen() {
  const [scenario, setScenario] = useState<Scenario>('clean');
  const [steps, setSteps] = useState(0);
  const sim = useMemo(() => {
    const timeMs = steps * 520;
    const baseM = steps * DEMO_STRIDE_M;
    const gpsOffset = scenario === 'gps-jump' && steps >= 10 ? 18 : steps === 0 ? 0 : -0.4;
    const gpsAccuracy = scenario === 'weak-gps' ? 30 : 2;
    const start = syntheticPoint(0, 0, 2);
    const point = syntheticPoint(baseM + gpsOffset, timeMs, gpsAccuracy);
    const result = reconcileWalkingDistance({
      walkingStrideM: DEMO_STRIDE_M, stepCount: steps,
      startGps: start, currentGps: point,
      nowMs: timeMs + 300,
      sensorContinuous: scenario !== 'imu-gap' || steps < 20,
      straightRoute: scenario !== 'curve',
    });
    return { result, baseM, point };
  }, [scenario, steps]);
  const mode = MODE[sim.result.mode];
  const setScenarioAndReset = (id: Scenario) => { setScenario(id); setSteps(0); };
  const advance = () => setSteps(value => Math.min(TOTAL_STEPS, value + 10));
  const progress = steps / TOTAL_STEPS * 100;

  return (
    <PageFrame kicker="SENSOR FUSION LAB" title="Zwei Sensoren. Ein Lauf."
      description="Ein interaktives Trainingslabor für GPS und IMU – auch drinnen nutzbar, weil ausschließlich künstliche Daten verwendet werden."
      icon={<Activity className="h-7 w-7" aria-hidden="true" />}>
      <section aria-label="Simulation, keine reale Messung"
        className="relative overflow-hidden rounded-[30px] border border-violet-300/20 bg-gradient-to-br from-[#27174b] via-[#101e37] to-[#0b2931] p-5 shadow-[0_20px_65px_rgba(0,0,0,.3)]">
        <div className="pointer-events-none absolute -right-12 -top-14 h-52 w-52 rounded-full bg-fuchsia-500/20 blur-[45px]" aria-hidden="true" />
        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-200">RUNNIT // DUAL SIGNAL</p>
            <span className="rounded-full border border-amber-300/35 bg-amber-300/10 px-3 py-1 text-[10px] font-black tracking-wider text-amber-100">
              SIMULATION · KEINE ECHTEN GPS-DATEN
            </span>
          </div>
          <div className="mt-7 flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/55">Experimentelle Distanz</p>
              <p className="mt-2 text-[clamp(2.9rem,12vw,4.8rem)] font-black leading-none tabular-nums tracking-[-0.08em] text-white">
                {sim.result.estimatedDistanceM === null ? '—' : sim.result.estimatedDistanceM.toFixed(1)}
                <span className="ml-2 text-xl tracking-normal text-cyan-200">m</span>
              </p>
            </div>
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] border border-cyan-300/25 bg-cyan-300/10 text-cyan-200 shadow-[0_0_28px_rgba(103,232,249,.14)]">
              <RadioTower className="h-8 w-8" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-7 flex items-center justify-between gap-4 text-xs font-extrabold">
            <span className="text-white/70">START</span>
            <span className="tabular-nums text-emerald-200">{steps} / {TOTAL_STEPS} Schritte</span>
            <span className="text-white/70">ZIEL</span>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full border border-white/10 bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 via-cyan-300 to-emerald-300 transition-[width] duration-300"
              style={{ width: progress + '%' }} />
          </div>
          <div className={`mt-6 rounded-2xl border bg-[#070c19]/50 p-4 ${mode.border}`} role="status" aria-live="polite">
            <p className={`text-sm font-black ${mode.color}`}>{mode.title}</p>
            <p className="mt-1.5 text-xs leading-5 text-white/65">{sim.result.reason}</p>
          </div>
        </div>
      </section>

      <section aria-label="Messdaten-Vergleich" className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.07] p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-cyan-200"><Footprints className="h-4 w-4" aria-hidden="true" /> IMU / SCHRITTE</div>
          <p className="mt-3 text-2xl font-black tabular-nums text-white">{fmt(sim.result.stepDistanceM)}</p>
          <p className="mt-1 text-[11px] leading-5 text-white/50">50 Schritte × 0,72 m bei vollständigem Test</p>
        </div>
        <div className="rounded-2xl border border-violet-300/15 bg-violet-400/[0.07] p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-violet-200"><MapPinned className="h-4 w-4" aria-hidden="true" /> GPS / LUFTLINIE</div>
          <p className="mt-3 text-2xl font-black tabular-nums text-white">{fmt(sim.result.gpsDisplacementM)}</p>
          <p className="mt-1 text-[11px] leading-5 text-white/50">Künstliche Position mit einstellbarem GPS-Fehler</p>
        </div>
      </section>

      <section aria-label="Simulationsszenario auswählen" className="space-y-4">
        <div>
          <h2 className="text-xl font-black tracking-tight">Signal-Stresstest</h2>
          <p className="mt-1 text-xs leading-6 text-white/55">Wähle einen Fehlerfall und simuliere jeweils zehn weitere Gehschritte.</p>
        </div>
        <div className="grid gap-2">
          {SCENARIOS.map(option => (
            <button key={option.id} type="button" onClick={() => setScenarioAndReset(option.id)}
              aria-pressed={scenario === option.id}
              className={`flex min-h-16 items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${scenario === option.id
                ? 'border-emerald-300/40 bg-emerald-300/10 text-white'
                : 'border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/[0.08]'}`}>
              <span className="min-w-0">
                <span className="block text-sm font-extrabold">{option.label}</span>
                <span className="mt-1 block text-[11px] leading-5 text-white/50">{option.subtitle}</span>
              </span>
              <span className={`h-4 w-4 shrink-0 rounded-full border-2 ${scenario === option.id ? 'border-emerald-300 bg-emerald-300' : 'border-white/40'}`} aria-hidden="true" />
            </button>
          ))}
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <button type="button" onClick={advance} disabled={steps >= TOTAL_STEPS}
            className="flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500 px-4 text-sm font-black text-white shadow-[0_10px_40px_rgba(59,130,246,.2)] disabled:opacity-45">
            +10 simulierte Schritte <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => setSteps(0)} aria-label="Simulation zurücksetzen"
            className="flex min-h-14 min-w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-white/80">
            <RotateCcw className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </section>

      <div className="flex items-start gap-3 rounded-2xl border border-amber-300/15 bg-amber-300/[0.045] p-4">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" aria-hidden="true" />
        <div className="space-y-2 text-xs leading-6 text-white/65">
          <p><strong className="text-amber-100">Keine Rennwertung:</strong> Die dargestellten Schritte sind simuliert; die 72 cm Schrittlänge ist ein Beispiel. Diese Berechnung verändert weder GPS-Zieldetektion noch FairPlay oder Ranglisten.</p>
          <p>Das Verfahren ist vorerst nur für geradliniges <strong>Gehen</strong> gedacht. GPS und kalibrierte Schrittlänge sind nicht unabhängig voneinander; echte Genauigkeit muss später mit Referenzstrecken validiert werden.</p>
        </div>
      </div>
      <Link to="/gps-lab" className="flex min-h-14 items-center justify-between rounded-2xl border border-emerald-300/25 bg-gradient-to-r from-emerald-500/15 to-cyan-500/10 px-5 text-sm font-extrabold text-emerald-100">
        <span className="flex items-center gap-2"><Footprints className="h-5 w-5" aria-hidden="true" /> Echte Sensorfusion im Geh-Test prüfen</span>
        <ArrowRight className="h-5 w-5" aria-hidden="true" />
      </Link>
      <Link to="/calibration" className="flex min-h-14 items-center justify-between rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.065] px-5 text-sm font-extrabold text-cyan-100">
        <span className="flex items-center gap-2"><Waves className="h-5 w-5" aria-hidden="true" /> Zur persönlichen Gehkalibrierung</span>
        <ArrowRight className="h-5 w-5" aria-hidden="true" />
      </Link>
      <Link to="/profile" className="flex min-h-12 items-center gap-2 text-sm font-bold text-violet-200">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Zurück zum Profil
      </Link>
    </PageFrame>
  );
}
