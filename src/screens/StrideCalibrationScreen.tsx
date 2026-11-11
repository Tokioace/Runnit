import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Footprints, MapPinned, ShieldAlert, Ruler } from 'lucide-react';
import PageFrame from '../components/ui/PageFrame';
import { useSupabaseUser } from '../hooks/useSupabaseUser';
import { supabase } from '../lib/supabaseClient';
import { LiveStepPeakCounter } from '../lib/liveStepPeaks';
import {
  assessWalkingCalibration, makeWalkingCalibration, estimateWalkingStrideFromHeight,
  type CalibrationFix, type CalibrationAssessment,
} from '../lib/strideCalibration';

type Phase = 'idle' | 'start' | 'walking' | 'end' | 'review' | 'saved';
type PermissionDeviceMotionEvent = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

export default function StrideCalibrationScreen() {
  const { user } = useSupabaseUser();
  const [height, setHeight] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const phaseRef = useRef<Phase>('idle');
  const [startFixes, setStartFixes] = useState<CalibrationFix[]>([]);
  const [endFixes, setEndFixes] = useState<CalibrationFix[]>([]);
  const [steps, setSteps] = useState(0);
  const counter = useRef(new LiveStepPeakCounter(67));
  const [interrupted, setInterrupted] = useState(false);
  const interruptedRef = useRef(false);
  const [assessment, setAssessment] = useState<CalibrationAssessment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const locationWatch = useRef<number | null>(null);
  const motionListener = useRef<((event: DeviceMotionEvent) => void) | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const setPhaseBoth = (next: Phase) => { phaseRef.current = next; setPhase(next); };
  const stopSensors = () => {
    if (locationWatch.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(locationWatch.current);
      locationWatch.current = null;
    }
    if (motionListener.current) {
      window.removeEventListener('devicemotion', motionListener.current);
      motionListener.current = null;
    }
  };

  useEffect(() => {
    const hidden = () => {
      if (document.visibilityState === 'hidden' && phaseRef.current === 'walking') {
        interruptedRef.current = true;
        setInterrupted(true);
      }
    };
    document.addEventListener('visibilitychange', hidden);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      if (locationWatch.current !== null && navigator.geolocation)
        navigator.geolocation.clearWatch(locationWatch.current);
      if (motionListener.current) window.removeEventListener('devicemotion', motionListener.current);
    };
  }, []);

  const reset = () => {
    stopSensors();
    counter.current.reset();
    setStartFixes([]);
    setEndFixes([]);
    setSteps(0);
    setAssessment(null);
    setGpsError(null);
    setError(null);
    setInterrupted(false);
    interruptedRef.current = false;
    setPhaseBoth('idle');
  };

  const start = async () => {
    if (!user || pending || phaseRef.current !== 'idle') return;
    if (estimateWalkingStrideFromHeight(Number(height)) === null || height.trim() === '') {
      setError('Bitte zuerst deine Körpergröße in Zentimetern eingeben.');
      return;
    }
    if (!window.isSecureContext || !navigator.geolocation || typeof DeviceMotionEvent === 'undefined') {
      setError('Für die Kalibrierung benötigst du HTTPS, GPS und den Bewegungssensor deines Smartphones.');
      return;
    }
    setPending(true);
    setError(null);
    setGpsError(null);
    try {
      const motion = DeviceMotionEvent as PermissionDeviceMotionEvent;
      if (motion.requestPermission && await motion.requestPermission() !== 'granted') {
        setError('Bitte den Zugriff auf Bewegungssensoren erlauben.');
        return;
      }
      counter.current.reset();
      setSteps(0);
      setStartFixes([]);
      setEndFixes([]);
      interruptedRef.current = false;
      setInterrupted(false);
      setAssessment(null);
      setPhaseBoth('start');
      const handleMotion = (event: DeviceMotionEvent) => {
        if (phaseRef.current !== 'walking') return;
        const a = event.acceleration;
        if (!a || a.x === null || a.y === null || a.z === null) return;
        const magnitude = Math.hypot(a.x, a.y, a.z);
        if (!Number.isFinite(magnitude)) return;
        const next = counter.current.push({ timestampMs: performance.now(), accelerationMagnitudeMps2: magnitude });
        if (next !== null) setSteps(next);
      };
      motionListener.current = handleMotion;
      window.addEventListener('devicemotion', handleMotion);
      locationWatch.current = navigator.geolocation.watchPosition(position => {
        const currentPhase = phaseRef.current;
        if (currentPhase !== 'start' && currentPhase !== 'end') return;
        const c = position.coords;
        const fix: CalibrationFix = {
          latitude: c.latitude, longitude: c.longitude,
          accuracyM: c.accuracy, timestampMs: position.timestamp,
        };
        if (!Number.isFinite(fix.accuracyM) || fix.accuracyM <= 0 || fix.accuracyM > 8) return;
        const update = (previous: CalibrationFix[]) => {
          // Ignore cached and non-monotonic GPS callbacks and limit local buffers.
          if (previous.some(p => p.timestampMs >= fix.timestampMs)) return previous;
          return [...previous, fix].slice(-8);
        };
        if (currentPhase === 'start') setStartFixes(update);
        else setEndFixes(update);
        setGpsError(null);
      }, e => {
        setGpsError(e.code === 1
          ? 'Standortfreigabe fehlt. Bitte in den iPhone-Einstellungen aktivieren.'
          : 'GPS derzeit nicht verfügbar. Für die Kalibrierung benötigst du freien Himmel.');
      }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
    } catch {
      stopSensors();
      setPhaseBoth('idle');
      setError('Sensoren konnten nicht gestartet werden. Bitte Berechtigungen prüfen.');
    } finally {
      setPending(false);
    }
  };

  const beginWalking = () => {
    if (phaseRef.current !== 'start' || startFixes.length < 3 ||
      startFixes[startFixes.length - 1].timestampMs - startFixes[0].timestampMs < 1500) return;
    counter.current.reset();
    setSteps(0);
    setPhaseBoth('walking');
  };
  const finishWalking = () => {
    if (phaseRef.current !== 'walking') return;
    setSteps(counter.current.count);
    setEndFixes([]);
    setPhaseBoth('end');
  };
  const finishCalibration = () => {
    if (phaseRef.current !== 'end') return;
    const result = assessWalkingCalibration({
      heightCm: Number(height), stepCount: counter.current.count,
      startFixes, endFixes, sensorInterrupted: interruptedRef.current,
    });
    setAssessment(result);
    setPhaseBoth('review');
    stopSensors();
  };
  const save = async () => {
    if (!user || !assessment?.accepted || pending) return;
    setPending(true);
    setError(null);
    try {
      const calibration = makeWalkingCalibration({
        assessment, heightCm: Number(height),
        stepCount: counter.current.count, nowIso: new Date().toISOString(),
      });
      // Only these derived values, never raw GPS coordinates, are saved in
      // the current account's editable profile metadata. Not an auth/anti-cheat claim.
      const { error: saveError } = await supabase.auth.updateUser({
        data: { walking_calibration: calibration },
      });
      if (saveError) throw saveError;
      setPhaseBoth('saved');
    } catch {
      setError('Kalibrierung konnte nicht gespeichert werden. Bitte deine Anmeldung prüfen und erneut versuchen.');
    } finally {
      setPending(false);
    }
  };

  const startReady = startFixes.length >= 3 &&
    startFixes[startFixes.length - 1].timestampMs - startFixes[0].timestampMs >= 1500;
  const endReady = endFixes.length >= 3 &&
    endFixes[endFixes.length - 1].timestampMs - endFixes[0].timestampMs >= 1500;
  const progress = Math.min(100, Math.round(steps / 50 * 100));

  return (
    <PageFrame kicker="RUNNIT SETUP" title="Dein Schritt. Deine Distanz."
      description="Persönliche Gehkalibrierung mit Körpergröße, Live-Schritten und GPS-Endpunkten – noch kein Sprint-Nachweis."
      icon={<Ruler className="h-7 w-7" aria-hidden="true" />}>
      <section className="space-y-5 rounded-[28px] border border-cyan-300/20 bg-gradient-to-br from-[#1c1a32] via-[#141727] to-[#102b30] p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">WALKING CALIBRATION · BETA</p>
        {user ? (
          <>
            <div>
              <label htmlFor="stride-height" className="block text-sm font-bold text-white">Deine Körpergröße (cm)</label>
              <input id="stride-height" type="number" min={100} max={230} inputMode="numeric" value={height}
                onChange={e => setHeight(e.target.value)} disabled={phase !== 'idle'}
                placeholder="z. B. 175"
                className="mt-2 min-h-14 w-full rounded-xl border border-white/20 bg-[#0d1524] px-4 text-lg font-bold text-white" />
              <p className="mt-2 text-xs leading-5 text-white/55">
                Die Größe prüft nur, ob ein Ergebnis plausibel ist. Sie ersetzt keine Messung.
              </p>
            </div>
            {phase === 'idle' && (
              <>
                <div className="space-y-2 text-sm leading-6 text-white/75">
                  <p>1. Draußen auf einer möglichst geraden, offenen Strecke stehen bleiben.</p>
                  <p>2. GPS-Startpunkt im Stand erfassen, dann 40–50 Schritte geradeaus gehen.</p>
                  <p>3. Stehen bleiben, GPS-Zielpunkt erfassen und das Ergebnis prüfen.</p>
                </div>
                <p className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">
                  Das Display muss während der Messung anbleiben. Bei Regen oder schlechtem GPS kannst du die Kalibrierung später durchführen.
                </p>
                <button type="button" disabled={pending} onClick={() => { void start(); }}
                  className="min-h-14 w-full rounded-2xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 font-black">
                  {pending ? 'Berechtigungen prüfen …' : 'GPS & Bewegungssensor aktivieren'}
                </button>
              </>
            )}
            {phase === 'start' && (
              <div className="space-y-4">
                <p className="font-bold text-cyan-200">Startpunkt: Bitte stehen bleiben.</p>
                <p className="text-sm text-white/70">Gute GPS-Messwerte: {startFixes.length} / mindestens 3</p>
                <button type="button" disabled={!startReady} onClick={beginWalking}
                  className="min-h-14 w-full rounded-2xl bg-emerald-500 px-4 font-black text-[#0a1720] disabled:opacity-40">
                  Gehen starten
                </button>
              </div>
            )}
            {phase === 'walking' && (
              <div className="space-y-4">
                <div className="text-center"><p className="text-6xl font-black tabular-nums text-emerald-300">{steps}</p>
                  <p className="text-xs font-bold uppercase tracking-widest text-white/60">live erkannte Schritte</p></div>
                <div className="h-3 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full bg-gradient-to-r from-violet-500 to-emerald-300" style={{ width: progress + '%' }} />
                </div>
                <p className="text-sm text-white/65">Etwa 50 Schritte in einer möglichst geraden Linie gehen. Nicht sprinten. Danach stehen bleiben und stoppen.</p>
                <button type="button" onClick={finishWalking}
                  className="min-h-14 w-full rounded-2xl bg-emerald-500 px-4 font-black text-[#0a1720]">
                  Schritte stoppen
                </button>
              </div>
            )}
            {phase === 'end' && (
              <div className="space-y-4">
                <p className="font-bold text-cyan-200">Zielpunkt: Jetzt stehen bleiben.</p>
                <p className="text-sm text-white/70">Erkannte Schritte: {steps} · gute GPS-Werte: {endFixes.length} / mindestens 3</p>
                <button type="button" disabled={!endReady} onClick={finishCalibration}
                  className="min-h-14 w-full rounded-2xl bg-emerald-500 px-4 font-black text-[#0a1720] disabled:opacity-40">
                  Kalibrierung auswerten
                </button>
              </div>
            )}
            {phase === 'review' && assessment && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  {assessment.accepted ? <CheckCircle2 className="h-6 w-6 text-emerald-300" /> : <ShieldAlert className="h-6 w-6 text-amber-300" />}
                  <h2 className="text-xl font-black">{assessment.accepted ? 'Messung plausibel' : 'Messung wiederholen'}</h2>
                </div>
                <p className="text-sm leading-6 text-white/75">{assessment.reason}</p>
                {assessment.distanceM !== null && <p className="text-sm text-white/70">
                  GPS-Luftlinie: {assessment.distanceM.toFixed(1)} m · Schritte: {steps}
                </p>}
                {assessment.walkingStrideM !== null && <p className="text-4xl font-black tabular-nums text-emerald-300">
                  {(assessment.walkingStrideM * 100).toFixed(1)} cm <span className="text-sm font-normal text-white/55">je Gehschritt</span>
                </p>}
                {assessment.endpointAccuracyRatio !== null && <p className="text-xs leading-5 text-white/50">
                  GPS-Qualitätsindikator: {(assessment.endpointAccuracyRatio * 100).toFixed(0)} % der Distanz; keine exakte Fehlergrenze.
                </p>}
                {assessment.accepted && <button type="button" disabled={pending} onClick={() => { void save(); }}
                  className="min-h-14 w-full rounded-2xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 font-black">
                  {pending ? 'Speichern …' : 'Gehschrittlänge im Profil speichern'}
                </button>}
                <button type="button" onClick={reset} className="min-h-12 w-full rounded-xl border border-white/15 bg-white/5 text-sm font-bold">
                  Neue Messung
                </button>
              </div>
            )}
            {phase === 'saved' && (
              <div className="space-y-4">
                <p className="flex items-center gap-3 font-bold text-emerald-200"><CheckCircle2 className="h-6 w-6" /> Gehkalibrierung im Konto gespeichert.</p>
                <p className="text-xs text-white/65">Noch nicht für offizielle Renndistanzen oder Sprintschritte freigeschaltet.</p>
                <Link to="/profile" className="flex min-h-14 items-center justify-center rounded-2xl bg-violet-600 font-bold">Zum Profil</Link>
              </div>
            )}
            {gpsError && <p role="alert" className="text-xs leading-5 text-amber-200">{gpsError}</p>}
            {interrupted && <p role="alert" className="text-xs leading-5 text-amber-200">Die App war im Hintergrund – diese Messung wird verworfen.</p>}
            {error && <p role="alert" className="text-xs leading-5 text-rose-200">{error}</p>}
            {phase !== 'idle' && phase !== 'review' && phase !== 'saved' && (
              <button type="button" onClick={reset} className="min-h-12 w-full rounded-xl border border-white/15 bg-white/5 text-sm font-bold text-white/70">Abbrechen</button>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-white/70">Die persönliche Kalibrierung wird nur in deinem eigenen Runnit-Konto gespeichert. Melde dich zuerst an.</p>
            <Link to="/login?next=%2Fcalibration" className="flex min-h-14 items-center justify-center rounded-xl bg-violet-600 font-bold">Anmelden</Link>
          </div>
        )}
      </section>
      <p className="flex items-start gap-2 text-xs leading-6 text-white/50">
        <MapPinned className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
        Das Verfahren nutzt die direkte Entfernung zwischen zwei möglichst ruhigen GPS-Endpunkten. Kurven, schlechtes GPS und Handbewegungen können das Ergebnis verfälschen.
        Nur das abgeleitete Ergebnis und deine Körpergröße werden nach ausdrücklichem Speichern übertragen.
      </p>
      <Link to="/profile" className="flex min-h-12 items-center gap-2 text-sm font-bold text-violet-200">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Zurück zum Profil
      </Link>
      <p className="sr-only"><Footprints className="h-4 w-4" aria-hidden="true" /> Nur Vorabkalibrierung Gehen</p>
    </PageFrame>
  );
}
