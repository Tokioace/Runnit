import { useMemo, useState } from 'react';
import { ArrowRight, Gauge, MapPinned, Radio, ShieldAlert, Timer, Waves, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageFrame from '../components/ui/PageFrame';
import { runGpsSimulation, syntheticPoint, type GpsSample } from '../lib/sprintGps';

type Scenario = '50m' | '75m' | '100m' | 'still' | 'spike' | 'poor';
const START = 1_800_000_000_000;
const OPTIONS: { id: Scenario; label: string; description: string; icon: typeof Timer }[] = [
  { id: '50m', label: '50 Meter', description: '8 m/s', icon: Timer },
  { id: '75m', label: '75 Meter', description: '7,5 m/s', icon: Zap },
  { id: '100m', label: '100 Meter', description: '10 m/s', icon: Gauge },
  { id: 'still', label: 'GPS-Rauschen', description: 'Stillstand', icon: Waves },
  { id: 'spike', label: 'GPS-Sprung', description: 'Positionsfehler', icon: MapPinned },
  { id: 'poor', label: 'Schwaches GPS', description: 'Ungenaue Daten', icon: Radio },
];

function buildScenario(scenario: Scenario): { samples: GpsSample[]; target: number; expectedSeconds: number | null } {
  const point = (distance: number, seconds: number, accuracy = 3) =>
    syntheticPoint(distance, START + seconds * 1000, accuracy);
  if (scenario === 'still') {
    return { target: 50, expectedSeconds: null, samples: Array.from({ length: 75 }, (_, i) => point(i % 2 ? 1.5 : -1.5, i)) };
  }
  if (scenario === 'spike') {
    return { target: 50, expectedSeconds: null, samples: [point(0, 0), point(8, 1), point(75, 2), point(16, 2), point(24, 3)] };
  }
  if (scenario === 'poor') {
    return { target: 50, expectedSeconds: null, samples: [point(0, 0), point(9, 1, 40), point(18, 2, 35), point(9, 3)] };
  }
  const target = scenario === '50m' ? 50 : scenario === '75m' ? 75 : 100;
  const speed = target === 50 ? 8 : target === 75 ? 7.5 : 10;
  const count = Math.ceil(target / speed) + 2;
  return { target, expectedSeconds: target / speed, samples: Array.from({ length: count }, (_, i) => point(i * speed, i)) };
}

export default function GpsLabScreen() {
  const [scenario, setScenario] = useState<Scenario>('50m');
  const { source, result } = useMemo(() => {
    const source = buildScenario(scenario);
    return { source, result: runGpsSimulation(source.target, START, source.samples) };
  }, [scenario]);
  const finishSeconds = result.finishTimestampMs === null
    ? null
    : (result.finishTimestampMs - START) / 1000;
  const progress = Math.max(0, Math.min(100, (result.distanceM / source.target) * 100));

  return (
    <PageFrame
      kicker="RUNNIT ENGINEERING"
      title="GPS-Testlabor."
      description="Prüfe, wie unsere Sprintlogik auf Geschwindigkeit, Rauschen und Messfehler reagiert – ganz ohne echte Standortdaten."
      icon={<Timer className="h-7 w-7" aria-hidden="true" />}
    >
      <div role="note" className="flex gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.075] p-4">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />
        <div className="text-xs leading-6 text-amber-100/85">
          <strong className="block text-sm text-amber-100">Simulation · kein echter Lauf</strong>
          Alle Koordinaten und Zeiten sind künstlich. Diese Ergebnisse sind nicht für Duelle oder Ranglisten zulässig.
        </div>
      </div>

      <section className="space-y-4" aria-labelledby="scenario-heading">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-300">SELECT A TEST</p>
            <h2 id="scenario-heading" className="mt-1 text-xl font-extrabold">Wähle dein Szenario</h2>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/45">6 Tests</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {OPTIONS.map(({ id, label, description, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={scenario === id}
              onClick={() => setScenario(id)}
              className={`group flex min-h-32 flex-col items-start justify-between rounded-[22px] border p-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                scenario === id
                  ? 'border-violet-300/60 bg-gradient-to-br from-violet-500/30 to-indigo-500/10 shadow-[0_0_30px_rgba(139,92,246,.12)]'
                  : 'border-white/10 bg-white/[0.045] hover:border-white/25 hover:bg-white/[0.07]'
              }`}
            >
              <Icon className={`h-6 w-6 ${scenario === id ? 'text-emerald-300' : 'text-violet-300/70'}`} aria-hidden="true" />
              <div>
                <span className="block text-sm font-extrabold">{label}</span>
                <span className="mt-1 block text-[11px] text-white/55">{description}</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section aria-live="polite" aria-label="Simulationsergebnis" className="overflow-hidden rounded-[28px] border border-violet-300/20 bg-gradient-to-br from-violet-600/20 via-[#141627] to-cyan-500/[0.07] p-5 shadow-[0_20px_60px_rgba(0,0,0,.22)]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-cyan-200">SIMULATION RESULT</p>
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-bold text-white/60">{source.target} m</span>
        </div>
        <div className="mt-7">
          <p className="text-xs font-semibold text-white/50">Geschätzte Zielzeit</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-5xl font-black tracking-[-0.07em] tabular-nums text-white sm:text-6xl">
              {finishSeconds === null ? '—' : finishSeconds.toFixed(2)}
            </span>
            <span className="text-xl font-bold text-emerald-300">s</span>
          </div>
          <p className="mt-3 text-xs leading-5 text-white/55">
            {finishSeconds === null
              ? 'Kein gültiger Zieleinlauf erkannt – genau das ist bei manchen Fehlerfällen erwünscht.'
              : `Künstlicher Idealwert: ${source.expectedSeconds?.toFixed(2) ?? '—'} s`}
          </p>
        </div>
        <div className="mt-7">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold">
            <span className="text-white/60">Gemessene Luftlinie</span>
            <span className="tabular-nums text-emerald-200">{result.distanceM.toFixed(1)} / {source.target} m</span>
          </div>
          <div role="progressbar" aria-label="Simulierte Distanz" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}
            className="h-2.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-violet-400 via-cyan-300 to-emerald-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </section>

      <section aria-label="GPS-Messwerte" className="grid grid-cols-2 gap-3">
        {[
          { label: 'Maximales Tempo', value: `${result.maxSpeedMps.toFixed(1)} m/s` },
          { label: 'Akzeptierte Punkte', value: String(result.acceptedSamples) },
          { label: 'Verworfene Punkte', value: String(result.rejectedSamples) },
          { label: 'Simulation', value: finishSeconds === null ? 'Offen' : 'Ziel erkannt' },
        ].map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
            <p className="text-[11px] font-semibold text-white/50">{metric.label}</p>
            <p className="mt-2 text-xl font-black tabular-nums tracking-tight text-white">{metric.value}</p>
          </div>
        ))}
      </section>

      <Link to="/map" className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-violet-300/20 bg-white/[0.05] px-5 py-4 font-bold transition hover:bg-white/[0.08]">
        <span className="flex items-center gap-3"><MapPinned className="h-5 w-5 text-violet-200" aria-hidden="true" /> Zur Karte</span>
        <ArrowRight className="h-5 w-5 text-emerald-200" aria-hidden="true" />
      </Link>
      <p className="text-xs leading-6 text-white/45">
        Das Labor nutzt GPS-Zeitstempel, filtert Genauigkeiten über 15 m und Temposprünge
        über 12 m/s. Zwei akzeptierte Messpunkte jenseits der Ziellinie sind erforderlich.
        Simulationen belegen keine Genauigkeit bei echten Kurzstrecken.
      </p>
    </PageFrame>
  );
}
