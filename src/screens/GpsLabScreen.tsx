import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Gauge, MapPinned, Radio, ShieldAlert, Timer, Waves, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageFrame from '../components/ui/PageFrame';
import { assessFairPlay, type MotionSample, type PositionSample } from '../lib/fairPlay';
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

type MotionEventWithPermission = typeof DeviceMotionEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };
function WalkingLab() {
  const [active, setActive] = useState(false);
  const [pocketLock, setPocketLock] = useState(false);
  const [holdingStop, setHoldingStop] = useState(false);
  const [status, setStatus] = useState('Bereit – Sensorzugriff erst nach Start');
  const [elapsed, setElapsed] = useState(0);
  const [count, setCount] = useState({ gps: 0, imu: 0 });
  const [report, setReport] = useState<ReturnType<typeof assessFairPlay> | null>(null);
  const gps = useRef<PositionSample[]>([]);
  const imu = useRef<MotionSample[]>([]);
  const watch = useRef<number | null>(null);
  const start = useRef(0);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const motionHandler = useRef<((event: DeviceMotionEvent) => void) | null>(null);
  const running = useRef(false);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelStopHold = () => {
    if (stopTimer.current !== null) clearTimeout(stopTimer.current);
    stopTimer.current = null;
    setHoldingStop(false);
  };
  const beginStopHold = () => {
    if (!running.current || pocketLock || stopTimer.current !== null) return;
    setHoldingStop(true);
    stopTimer.current = setTimeout(() => { stopTimer.current = null; stop(); }, 2000);
  };
  const pending = useRef(false);
  const mounted = useRef(true);
  const stop = () => {
    cancelStopHold();
    setPocketLock(false);
    running.current = false;
    pending.current = false;
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
    if (motionHandler.current) window.removeEventListener('devicemotion', motionHandler.current);
    motionHandler.current = null;
    if (ticker.current !== null) clearInterval(ticker.current);
    ticker.current = null;
    setActive(false);
    setReport(assessFairPlay(gps.current, imu.current));
    setStatus('Geh-Test beendet · Bericht nur auf diesem Bildschirm, nicht gespeichert');
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
    mounted.current = false;
    if (stopTimer.current !== null) clearTimeout(stopTimer.current);
    pending.current = false;
    running.current = false;
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    if (motionHandler.current) window.removeEventListener('devicemotion', motionHandler.current);
    if (ticker.current !== null) clearInterval(ticker.current);
    };
  }, []);
  const begin = async () => {
    if (running.current || pending.current) return;
    pending.current = true;
    if (!window.isSecureContext || !navigator.geolocation) {
      pending.current = false;
      setStatus('HTTPS und Standortunterstützung erforderlich'); return;
    }
    // iOS requires permission from a direct user gesture.
    let motionAllowed = false;
    try {
      if (typeof DeviceMotionEvent !== 'undefined') {
        const deviceMotion = DeviceMotionEvent as MotionEventWithPermission;
        motionAllowed = deviceMotion.requestPermission
          ? (await deviceMotion.requestPermission()) === 'granted' : true;
      }
    } catch { motionAllowed = false; }
    if (!mounted.current || !pending.current) return;
    pending.current = false;
    gps.current = []; imu.current = []; setCount({ gps: 0, imu: 0 });
    setReport(null); setElapsed(0); setPocketLock(false); start.current = performance.now();
    running.current = true; setActive(true);
    setStatus(motionAllowed ? 'GPS und Bewegungssensor aktiv · Bildschirm eingeschaltet lassen' : 'Nur GPS · Bewegungssensor nicht verfügbar oder verweigert');
    if (motionAllowed) {
      const onMotion = (event: DeviceMotionEvent) => {
        if (!running.current) return;
        const a = event.acceleration;
        if (!a || a.x === null || a.y === null || a.z === null) return;
        const magnitude = Math.hypot(a.x, a.y, a.z);
        if (!Number.isFinite(magnitude)) return;
        imu.current.push({ timestampMs: performance.now(), accelerationMagnitudeMps2: magnitude });
        if (imu.current.length > 60000) imu.current.shift();
        setCount(v => ({ ...v, imu: imu.current.length }));
      };
      motionHandler.current = onMotion;
      window.addEventListener('devicemotion', onMotion);
    }
    try {
    watch.current = navigator.geolocation.watchPosition(p => {
      if (!running.current) return;
      // Geolocation timestamps are epoch milliseconds, convert to performance clock.
      const timestampMs = p.timestamp - performance.timeOrigin;
      if (!Number.isFinite(timestampMs) || timestampMs < start.current - 5000) return;
      gps.current.push({ timestampMs, latitude: p.coords.latitude, longitude: p.coords.longitude, accuracyM: p.coords.accuracy });
      if (gps.current.length > 10000) gps.current.shift();
      setCount(v => ({ ...v, gps: gps.current.length }));
    }, error => {
      if (!running.current) return;
      setStatus('Standortfehler: ' + error.message + ' · Berechtigung/Empfang prüfen');
      if (error.code === 1) stop();
    }, {
      enableHighAccuracy: true, maximumAge: 0, timeout: 15000,
    });
    } catch {
      stop();
      setStatus('GPS konnte nicht gestartet werden · Berechtigung/Browser prüfen');
      return;
    }
    ticker.current = setInterval(() => setElapsed(Math.round((performance.now() - start.current) / 1000)), 1000);
  };
  const live = active ? assessFairPlay(gps.current, imu.current) : report;
  const quality = !live ? 'Noch keine Messung' : live.reasons.includes('gps-position-jump') ? 'GPS-Sprung erkannt · Messung unsicher, kein Betrugsnachweis' : live.reasons.includes('insufficient-gps') || live.reasons.includes('poor-gps-accuracy') ? 'GPS-Daten fehlen oder sind ungenau' : live.reasons.includes('insufficient-motion-coverage') ? 'Bewegungssensordaten fehlen oder sind lückenhaft' : live.reasons.includes('walking-cadence-needs-calibration') ? 'Schrittfrequenz für normales Gehen ungewöhnlich hoch · Handbewegungen möglich, bitte in Hosentasche vergleichen' : 'Keine auffälligen Messfehler erkannt (unkalibriert)';
  return (
    <section aria-label="Echter Geh-Einzellauf – experimentell" className="space-y-4 rounded-[28px] border border-cyan-300/30 bg-gradient-to-br from-indigo-800/40 to-[#101827] p-5">
      <p className="text-xs font-black uppercase tracking-widest text-cyan-200">FAIRPLAY LAB · WALKING TEST · NICHT GEWERTET</p>
      <h2 className="text-2xl font-black">Geh-Einzellauf</h2>
      <p className="text-sm text-white/70">Normal gehen, nicht sprinten. Kein Duell, keine 50-m-Zeit, keine Rangliste. GPS und Bewegungssensor werden nur im Arbeitsspeicher ausgewertet und beim Verlassen verworfen. Kein Mikrofon.</p>
      <p role="status" className="text-sm text-amber-200">{status}</p>
      {!active ? (
        <button type="button" onClick={() => { void begin(); }} className="min-h-14 w-full rounded-xl bg-cyan-300 px-5 font-black text-slate-950">
          Geh-Test starten · Sensorzugriff erlauben
        </button>
      ) : pocketLock ? (
        <div className="space-y-3 rounded-xl border border-cyan-300/40 bg-slate-950/80 p-4 text-center">
          <p className="font-black text-cyan-200">Taschensperre aktiv · Messung läuft weiter</p>
          <p className="text-sm text-white/70">Zum Entsperren den Regler bewusst nach rechts bewegen. Normales Tippen beendet den Test nicht.</p>
          <input type="range" min="0" max="100" defaultValue="0" aria-label="Taschensperre entsperren" className="w-full accent-cyan-300" onChange={event => {
            if (Number(event.currentTarget.value) >= 95) { setPocketLock(false); event.currentTarget.value = '0'; }
          }} />
        </div>
      ) : (
        <div className="space-y-2">
          <button type="button" onClick={() => { cancelStopHold(); setPocketLock(true); }} className="min-h-12 w-full rounded-xl border border-cyan-300/50 bg-cyan-300/10 font-bold text-cyan-100">
            Taschensperre aktivieren
          </button>
          <button type="button" onPointerDown={beginStopHold} onPointerUp={cancelStopHold} onPointerCancel={cancelStopHold} onPointerLeave={cancelStopHold} onContextMenu={event => event.preventDefault()} className="min-h-14 w-full select-none touch-none rounded-xl bg-amber-300 px-5 font-black text-slate-950">
            {holdingStop ? 'Weiter halten – 2 Sekunden zum Beenden' : '2 Sekunden halten: Test stoppen und Bericht anzeigen'}
          </button>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        <div><strong className="block text-xl">{elapsed}s</strong>Zeit</div>
        <div><strong className="block text-xl">{count.gps}</strong>GPS-Fixes</div>
        <div><strong className="block text-xl">{count.imu}</strong>IMU-Samples</div>
      </div>
      {live && <div aria-live="polite" className="space-y-2 rounded-xl bg-white/5 p-4 text-sm">
        <p className="font-bold">Lokaler {active ? 'Zwischenstand' : 'Geh-Testbericht'}: {live.verdict === 'plausible' ? 'Plausibel (experimentell)' : 'Unsicher / nicht ausreichend belegt'}</p>
        <p>GPS-Strecke (Schätzung): {live.gpsDistanceM?.toFixed(1) ?? '—'} m · Tempo: {live.gpsSpeedMps?.toFixed(2) ?? '—'} m/s</p>
        <p>GPS-Mediangenauigkeit: {live.gpsAccuracyMedianM?.toFixed(1) ?? '—'} m · Bewegungssensor-Abdeckung: {Math.round(live.motionCoverage * 100)}%</p>
        <p>Erkannte Schritte: {live.detectedSteps} · Kadenz: {live.cadenceSpm?.toFixed(0) ?? '—'} Schritte/min</p>
        <p>Messqualität: {quality}</p>
        <p>Hinweise: {live.reasons.length ? live.reasons.join(', ') : 'Keine automatischen Auffälligkeiten'}</p>
      </div>}
      <p className="text-xs text-white/55">Bildschirmsperre, Energiesparen und iOS können Sensorupdates stoppen. Schrittzählung und GPS-Distanz sind unkalibrierte Schätzungen. Fehlende Schritte sind kein Betrugsnachweis.</p>
    </section>
  );
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

      <WalkingLab />

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
