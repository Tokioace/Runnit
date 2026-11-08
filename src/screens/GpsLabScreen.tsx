import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { runGpsSimulation, syntheticPoint, type GpsSample } from '../lib/sprintGps';

type Scenario = '50m' | '75m' | '100m' | 'still' | 'spike' | 'poor';
const START = 1_800_000_000_000;
const OPTIONS: { id: Scenario; label: string; description: string }[] = [
  { id: '50m', label: '50 m Sprint', description: 'Konstante 8 m/s' },
  { id: '75m', label: '75 m Sprint', description: 'Konstante 7,5 m/s' },
  { id: '100m', label: '100 m Sprint', description: 'Konstante 10 m/s' },
  { id: 'still', label: 'GPS-Rauschen', description: 'Stillstand mit schwankenden Koordinaten' },
  { id: 'spike', label: 'Positionssprung', description: 'Unrealistischer GPS-Sprung' },
  { id: 'poor', label: 'Schwacher Empfang', description: 'Ungenaue Fixes herausfiltern' },
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
  const finishLabel = result.finishTimestampMs === null
    ? 'Kein gültiger Zieleinlauf erkannt'
    : 'Geschätzter Zieleinlauf: ' + ((result.finishTimestampMs - START) / 1000).toFixed(2) + ' s';

  return (
    <main className="min-h-screen bg-[#080b13] px-4 py-8 text-white">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300">Runnit Engineering</div>
            <h1 className="mt-2 text-3xl font-black tracking-tight">GPS Testlabor</h1>
          </div>
          <Link to="/" className="rounded-xl border border-white/20 px-3 py-2 text-sm text-white/80">Zur Karte</Link>
        </div>
        <div role="alert" className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
          <strong>Nur Simulation – keine echte Zeitmessung.</strong> Alle Positionen und Zeiten sind künstlich.
          Ergebnisse dürfen nicht für Ranglisten, Duelle oder GPS-Genauigkeitsversprechen verwendet werden.
        </div>
        <section className="space-y-3" aria-label="Testszenario auswählen">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white/70">Testszenario</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {OPTIONS.map((option) => (
              <button key={option.id} type="button" aria-pressed={scenario === option.id}
                onClick={() => setScenario(option.id)}
                className={'min-h-24 rounded-2xl border p-3 text-left transition-colors ' +
                  (scenario === option.id ? 'border-cyan-300 bg-cyan-300/15' : 'border-white/15 bg-white/5 hover:bg-white/10')}>
                <div className="font-bold">{option.label}</div>
                <div className="mt-2 text-xs leading-5 text-white/65">{option.description}</div>
              </button>
            ))}
          </div>
        </section>
        <section className="rounded-3xl border border-white/15 bg-white/5 p-5" aria-live="polite">
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Simulationsergebnis</p>
          <h2 className="mt-3 text-xl font-bold">{finishLabel}</h2>
          {source.expectedSeconds !== null && <p className="mt-1 text-sm text-white/60">Idealwert der Testdaten: {source.expectedSeconds.toFixed(2)} s</p>}
          <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-white/55">Luftlinie ab Start</dt><dd className="mt-1 text-xl font-semibold">{result.distanceM.toFixed(1)} m</dd></div>
            <div><dt className="text-white/55">Maximaltempo</dt><dd className="mt-1 text-xl font-semibold">{result.maxSpeedMps.toFixed(1)} m/s</dd></div>
            <div><dt className="text-white/55">Angenommene Fixes</dt><dd className="mt-1 text-xl font-semibold">{result.acceptedSamples}</dd></div>
            <div><dt className="text-white/55">Verworfene Fixes</dt><dd className="mt-1 text-xl font-semibold">{result.rejectedSamples}</dd></div>
          </dl>
        </section>
        <p className="text-sm leading-6 text-white/55">
          Das Labor nutzt GPS-Zeitstempel, filtert Genauigkeitswerte über 15 m und
          Geschwindigkeiten über 12 m/s. Erst zwei aufeinanderfolgende Messpunkte
          jenseits der Ziellinie bestätigen den Zieleinlauf. Simulationen beweisen
          keine reale Genauigkeit für Kurzstrecken.
        </p>
      </div>
    </main>
  );
}
