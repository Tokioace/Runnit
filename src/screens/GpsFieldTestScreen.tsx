import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { advanceGpsSprint, createGpsSprint, type GpsSample, type GpsSprintState } from '../lib/sprintGps';
import {
  compareWithReferenceSeconds,
  createExperimentalRunReport,
  isFreshStartFix,
  primeGpsSprint,
} from '../lib/gpsField';

type Phase = 'idle' | 'acquiring' | 'ready' | 'running' | 'finished' | 'stopped' | 'error';
type TargetMeters = 50 | 75 | 100;
const GPS_OPTIONS: PositionOptions = { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 };

function formatSeconds(value: number | null): string {
  return value === null ? '—' : value.toFixed(2) + ' s';
}

export default function GpsFieldTestScreen() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [target, setTarget] = useState<TargetMeters>(50);
  const [status, setStatus] = useState('Noch keine Standortfreigabe angefragt.');
  const [latestAccuracy, setLatestAccuracy] = useState<number | null>(null);
  const [measurement, setMeasurement] = useState<GpsSprintState | null>(null);
  const [referenceText, setReferenceText] = useState('');
  const [tick, setTick] = useState(Date.now());
  const [skippedStale, setSkippedStale] = useState(0);

  const phaseRef = useRef<Phase>('idle');
  const watchId = useRef<number | null>(null);
  const readyFixRef = useRef<GpsSample | null>(null);
  const stateRef = useRef<GpsSprintState | null>(null);
  const mountedRef = useRef(true);

  const setCurrentPhase = (next: Phase) => {
    phaseRef.current = next;
    if (mountedRef.current) setPhase(next);
  };

  const stopWatching = () => {
    if (watchId.current !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    const pauseIfBackgrounded = () => {
      if (!document.hidden) return;
      if (watchId.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      if (phaseRef.current === 'running') {
        phaseRef.current = 'stopped';
        setPhase('stopped');
        setStatus('Lauf wegen Hintergrundwechsel abgebrochen. GPS wurde beendet.');
      } else if (phaseRef.current === 'acquiring' || phaseRef.current === 'ready') {
        phaseRef.current = 'idle';
        setPhase('idle');
        setStatus('GPS bei Hintergrundwechsel beendet. Bitte erneut vorbereiten.');
      }
    };
    const stopOnPageHide = () => {
      if (watchId.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      const previous = phaseRef.current;
      if (mountedRef.current && previous === 'running') {
        phaseRef.current = 'stopped';
        setPhase('stopped');
        setStatus('Lauf beim Verlassen der Seite abgebrochen. GPS wurde beendet.');
      } else if (mountedRef.current && (previous === 'acquiring' || previous === 'ready')) {
        phaseRef.current = 'idle';
        setPhase('idle');
        setStatus('GPS beim Verlassen der Seite beendet. Bitte erneut vorbereiten.');
      } else {
        phaseRef.current = 'idle';
      }
    };
    document.addEventListener('visibilitychange', pauseIfBackgrounded);
    window.addEventListener('pagehide', stopOnPageHide);
    return () => {
      mountedRef.current = false;
      document.removeEventListener('visibilitychange', pauseIfBackgrounded);
      window.removeEventListener('pagehide', stopOnPageHide);
      stopOnPageHide();
    };
  }, []);

  useEffect(() => {
    if (phase !== 'running') return;
    const timer = window.setInterval(() => setTick(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [phase]);

  const prepare = () => {
    if (!('geolocation' in navigator)) {
      setStatus('Dieser Browser unterstützt keine GPS-Ortung.');
      setCurrentPhase('error');
      return;
    }
    stopWatching();
    readyFixRef.current = null;
    stateRef.current = null;
    setMeasurement(null);
    setLatestAccuracy(null);
    setSkippedStale(0);
    setReferenceText('');
    setCurrentPhase('acquiring');
    setStatus('Warte auf einen aktuellen, genauen Standort-Fix ...');

    try {
      watchId.current = navigator.geolocation.watchPosition((pos) => {
        if (!mountedRef.current) return;
        const phaseNow = phaseRef.current;
        if (phaseNow !== 'acquiring' && phaseNow !== 'ready' && phaseNow !== 'running') return;

        // GeolocationPosition.timestamp is wall-clock Unix milliseconds.
        const sample: GpsSample = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyM: pos.coords.accuracy,
          timestampMs: pos.timestamp,
        };
        const now = Date.now();
        const freshnessMs = now - sample.timestampMs;
        if (!Number.isFinite(freshnessMs) || freshnessMs < -1000 || freshnessMs > 3000) {
          setSkippedStale((n) => n + 1);
          setStatus('Veralteter GPS-Fix ignoriert. Bitte Bildschirm entsperrt lassen.');
          return;
        }
        if (phaseNow === 'acquiring' || phaseNow === 'ready') {
          setLatestAccuracy(sample.accuracyM);
          if (isFreshStartFix(sample, now)) {
            readyFixRef.current = sample;
            setCurrentPhase('ready');
            setStatus('Startposition bereit. Stelle dich ruhig an die markierte Startlinie.');
          } else {
            readyFixRef.current = null;
            setCurrentPhase('acquiring');
            setStatus('GPS noch zu ungenau (erforderlich: höchstens 15 m). Bitte im Freien warten.');
          }
          return;
        }

        const previous = stateRef.current;
        if (!previous) return;
        const next = advanceGpsSprint(previous, sample);
        stateRef.current = next;
        setMeasurement(next);
        if (next.finishTimestampMs !== null) {
          setCurrentPhase('finished');
          setStatus('Zieleinlauf geschätzt. GPS-Aufzeichnung beendet.');
          stopWatching();
        }
      }, (err) => {
        if (!mountedRef.current) return;
        const message = err.code === 1
          ? 'Standortzugriff verweigert. Bitte Browserberechtigung kontrollieren.'
          : err.code === 2
            ? 'GPS-Position nicht verfügbar. Bitte draußen erneut versuchen.'
            : 'GPS-Zeitüberschreitung. Erneut vorbereiten.';
        setStatus(message);
        setCurrentPhase('error');
        stopWatching();
      }, GPS_OPTIONS);
    } catch {
      setStatus('GPS konnte nicht gestartet werden. Bitte Browserberechtigungen prüfen.');
      setCurrentPhase('error');
      stopWatching();
    }
  };

  const start = () => {
    if (phaseRef.current !== 'ready') return;
    const atMs = Date.now();
    const anchor = readyFixRef.current;
    if (!isFreshStartFix(anchor, atMs)) {
      readyFixRef.current = null;
      setCurrentPhase('acquiring');
      setStatus('Start-Fix ist älter als drei Sekunden. Bitte auf ein neues GPS-Signal warten.');
      return;
    }
    try {
      const primed = primeGpsSprint(createGpsSprint(target, atMs), anchor);
      stateRef.current = primed;
      setMeasurement(primed);
      setTick(atMs);
      setCurrentPhase('running');
      setStatus('Lauf gestartet. Display eingeschaltet lassen und bis hinter die Ziellinie laufen.');
    } catch {
      setCurrentPhase('acquiring');
      setStatus('Startposition ungültig. Bitte GPS neu einmessen.');
    }
  };

  const stop = () => {
    if (phaseRef.current !== 'running') return;
    setCurrentPhase('stopped');
    setStatus('Manuell beendet – kein bestätigter Zieleinlauf.');
    stopWatching();
  };

  const reset = () => {
    stopWatching();
    readyFixRef.current = null;
    stateRef.current = null;
    setCurrentPhase('idle');
    setMeasurement(null);
    setLatestAccuracy(null);
    setStatus('Alle Messdaten dieser Sitzung verworfen.');
    setReferenceText('');
    setSkippedStale(0);
  };

  const report = measurement ? createExperimentalRunReport('device-gps', measurement) : null;
  const referenceValue = referenceText.trim() === ''
    ? null
    : Number(referenceText.replace(',', '.'));
  const comparison = report ? compareWithReferenceSeconds(report, referenceValue) : null;
  const elapsed = phase === 'running' && measurement
    ? Math.max(0, (tick - measurement.startedAtMs) / 1000)
    : null;

  const downloadReport = () => {
    if (!report || phase === 'running') return;
    // A deliberate, user-triggered export with NO raw latitude/longitude or track.
    const exported = {
      schema: 'runnit-gps-field-v1',
      ...report,
      staleFixesIgnored: skippedStale,
      referenceSeconds: comparison === null ? null : referenceValue,
      differenceSeconds: comparison,
      disclaimer: 'Experimental device GPS data. Not valid for leaderboards or verified races.',
    };
    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = 'runnit-gps-testbericht.json';
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(href), 6000);
  };

  return (
    <main className="min-h-screen bg-[#080b13] px-4 py-7 text-white">
      <div className="mx-auto max-w-xl space-y-5 pb-12">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Runnit Engineering · Beta</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">GPS-Feldtest</h1>
          </div>
          <Link to="/gps-lab" className="rounded-xl border border-white/20 px-3 py-2 text-sm text-white/80">Simulation</Link>
        </header>

        <section className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
          <strong>Echte GPS-Position · experimentell · nicht ranglistenfähig.</strong> Erst mit „GPS vorbereiten“
          fragst du Standortzugriff an. Die Messwerte bleiben nur während dieser Sitzung im Browser.
          Keine Übertragung an Runnit, keine Speicherung von GPS-Tracks und keine Duell- oder Ranglistenbuchung.
          Beim Verlassen dieser Seite wird die Ortung beendet.
        </section>

        <section className="rounded-2xl border border-white/15 bg-white/5 p-4 space-y-3">
          <label htmlFor="gps-distance" className="block text-sm font-semibold text-white/80">Abgemessene Teststrecke</label>
          <select id="gps-distance" value={target} onChange={(event) => setTarget(Number(event.target.value) as TargetMeters)}
            disabled={phase !== 'idle' && phase !== 'error'}
            className="w-full rounded-xl border border-white/20 bg-[#141b2a] p-3 text-white disabled:opacity-60">
            <option value={50}>50 Meter</option>
            <option value={75}>75 Meter</option>
            <option value={100}>100 Meter</option>
          </select>
          <p className="text-xs leading-5 text-white/60">Im Freien auf einer tatsächlich abgemessenen, möglichst geraden Strecke testen. Den Startpunkt vor dem Lauf fixieren.</p>

          {(phase === 'idle' || phase === 'error') && (
            <button type="button" onClick={prepare} className="w-full rounded-xl bg-cyan-400 px-4 py-4 font-extrabold text-slate-950">
              GPS vorbereiten
            </button>
          )}
          {phase === 'acquiring' && (
            <div className="rounded-xl bg-cyan-500/10 p-4 text-center font-semibold text-cyan-200">GPS wird eingemessen …</div>
          )}
          {phase === 'ready' && (
            <button type="button" onClick={start} className="w-full rounded-xl bg-emerald-400 px-4 py-5 text-lg font-extrabold text-slate-950">
              Jetzt Testlauf starten
            </button>
          )}
          {phase === 'running' && (
            <button type="button" onClick={stop} className="w-full rounded-xl bg-rose-600 px-4 py-4 font-bold text-white">
              Test abbrechen
            </button>
          )}
          {(phase !== 'idle') && (
            <button type="button" onClick={reset} className="w-full rounded-xl border border-white/25 px-4 py-3 text-sm font-semibold text-white/80">
              Zurücksetzen und Messwerte verwerfen
            </button>
          )}
          <p role="status" className="text-sm leading-6 text-white/75">{status}</p>
          {latestAccuracy !== null && (
            <p className="text-xs text-white/60">Letzte Start-Fix-Genauigkeit: ±{latestAccuracy.toFixed(1)} m (geschätzter Browserwert)</p>
          )}
        </section>

        <section className="rounded-3xl border border-white/15 bg-white/5 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">Messung · Quelle: Geräte-GPS</p>
          <p className="mt-3 text-4xl font-black tabular-nums">
            {report?.durationSeconds !== null && report?.durationSeconds !== undefined
              ? formatSeconds(report.durationSeconds)
              : elapsed !== null ? elapsed.toFixed(1) + ' s' : '—'}
          </p>
          <p className="mt-2 text-sm text-white/65">
            {phase === 'finished' ? 'Zieleinlauf experimentell erkannt' :
              phase === 'stopped' ? 'Testlauf ohne bestätigten Zieleinlauf abgebrochen' :
                phase === 'running' ? 'Lauf läuft …' : 'Noch kein abgeschlossener Lauf'}
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-white/55">Luftlinie ab Start</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{(report?.observedDistanceMeters ?? 0).toFixed(1)} m</dd></div>
            <div><dt className="text-white/55">Max. GPS-Tempo</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{(report?.maxSpeedMps ?? 0).toFixed(1)} m/s</dd></div>
            <div><dt className="text-white/55">Angenommene Messpunkte</dt><dd className="mt-1 text-xl font-semibold">{report?.acceptedSamples ?? 0}</dd></div>
            <div><dt className="text-white/55">Verworfene Messpunkte</dt><dd className="mt-1 text-xl font-semibold">{(report?.rejectedSamples ?? 0) + skippedStale}</dd></div>
          </dl>
          <div className="mt-5 rounded-xl border border-rose-300/30 bg-rose-400/10 px-3 py-3 text-sm font-semibold text-rose-200">
            Status: nicht verifiziert · Ranglistenfreigabe gesperrt
          </div>
        </section>

        {(phase === 'finished' || phase === 'stopped') && report && (
          <section className="rounded-2xl border border-white/15 bg-white/5 p-4 space-y-4">
            <div>
              <h2 className="text-lg font-bold">Referenzzeit vergleichen</h2>
              <p className="mt-2 text-sm leading-6 text-white/65">
                Optional die unabhängig gestoppte Zeit derselben Strecke eingeben. Start- und Zielereignisse müssen vergleichbar sein.
                Ein Vergleich allein validiert die GPS-Messung noch nicht.
              </p>
            </div>
            <label htmlFor="gps-reference" className="block text-sm font-semibold">Referenzzeit in Sekunden</label>
            <input id="gps-reference" type="text" inputMode="decimal" autoComplete="off"
              placeholder="z. B. 7,24" value={referenceText}
              onChange={(e) => setReferenceText(e.target.value)}
              className="w-full rounded-xl border border-white/20 bg-[#111827] p-3 text-white" />
            <p className="text-sm text-white/80">
              {comparison === null ? 'Keine auswertbare Referenzzeit vorhanden.' :
                'Abweichung GPS minus Referenz: ' + (comparison >= 0 ? '+' : '') + comparison.toFixed(2) + ' s'}
            </p>
            <button type="button" onClick={downloadReport}
              className="w-full rounded-xl border border-cyan-300/50 bg-cyan-400/10 px-4 py-3 font-semibold text-cyan-100">
              Anonymisierten Testbericht speichern (JSON)
            </button>
            <p className="text-xs leading-5 text-white/55">
              Der Bericht enthält nur Messkennzahlen, Quelle und Vergleichszeit – keine Koordinaten oder GPS-Spur.
              Das Speichern erfolgt ausschließlich nach Tippen auf die Schaltfläche.
            </p>
          </section>
        )}

        <p className="text-xs leading-6 text-white/55">
          Grenzen: Die erste Startposition hat bereits GPS-Unsicherheit. Der Button-Start ist kein präziser
          Bewegungsstart, und die Browser-Ortung kann zwischen einzelnen Fixes mehrere Sekunden warten.
          Die Zielzeit wird aus Positionspunkten interpoliert, nicht per Lichtschranke gemessen.
          Bei schlechten GPS-Daten wird möglicherweise kein Zieleinlauf erkannt.
        </p>
      </div>
    </main>
  );
}
