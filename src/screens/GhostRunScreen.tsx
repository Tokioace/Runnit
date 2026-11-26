import { isUncertainGhostSave } from '../lib/ghostSaveResponse';
import { createLatestRead } from '../lib/latestRead';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Download, Flag, Footprints, Gauge, PauseCircle, Play, ShieldCheck, Timer, WifiOff } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import type { UseSupabaseUserReturn } from '../hooks/useSupabaseUser';
import { createMeasurementLifetime, measurementAccountCurrent } from '../lib/measurementLifetime';
import { createGpsSprint, advanceLiveGpsSprint, type GpsSprintState, type GpsSample } from '../lib/sprintGps';
import { ghostSummary, ghostFinishMotion, safeNumber, type DiagnosticSummary, type MotionPermission } from '../lib/ghostRunSummary';
import { isFreshStartFix, primeGpsSprint } from '../lib/gpsField';
import { inspectGhostGpsFix, ghostGpsFixNotice, type GhostGpsFixIssue } from '../lib/ghostGpsReadiness';
import { LiveStepPeakCounter } from '../lib/liveStepPeaks';
import { motionEventSample } from '../lib/duelMotionEvidence';
import { useScreenWakeLock } from '../hooks/useScreenWakeLock';
import { screenWakeLockMessage } from '../lib/screenWakeLock';
import { unlockRaceAudio, playArcadeFinishSfx, setRaceAudioMuted } from '../lib/arcadeRaceAudio';
import RaceCountdown, { ARCADE_COUNTDOWN_SECONDS } from '../components/race/RaceCountdown';
import '../styles/raceArcade.css';
import '../styles/ghostRun.css';

type Phase = 'idle' | 'acquiring' | 'ready' | 'countdown' | 'running' | 'finished' | 'stopped' | 'error';
type Target = 50 | 75 | 100;
type GpsTrace = { t_ms: number; east_m: number | null; north_m: number | null; accuracy_m: number; distance_m: number; decision: string };
type MotionTrace = { t_ms: number; ax: number; ay: number; az: number; magnitude: number; steps: number };
type SavedRun = {
  id: string; created_at: string; target_distance_m: number; run_state: 'finished' | 'stopped';
  elapsed_ms: number | null; steps_count: number; observed_distance_m: number;
};
const GPS_OPTIONS: PositionOptions = { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 };
const MAX_MOTION_SAMPLES = 30000;
const MAX_GPS_SAMPLES = 3000;
const MAX_RUN_MS = 5 * 60 * 1000;

export default function GhostRunScreen({ auth }: { auth: UseSupabaseUserReturn }) {
  const { user, loading, beginAccountMutation } = auth;
  const [phase, setPhase] = useState<Phase>('idle');
  const [target, setTarget] = useState<Target>(50);
  const [notice, setNotice] = useState('Ghost Run: allein laufen und echte Sensordaten sammeln.');
  const [accuracyM, setAccuracyM] = useState<number | null>(null);
  const [fixTimestampMs, setFixTimestampMs] = useState<number | null>(null);
  const [fixIssue, setFixIssue] = useState<GhostGpsFixIssue>('missing');
  const [motionPermission, setMotionPermission] = useState<MotionPermission>('unavailable');
  const [soundEnabled, setSoundEnabled] = useState(true);
  // AudioContext is shared with 1v1, but the controls are screen-local.
  // Apply this screen's preference before its countdown effects can run.
  useLayoutEffect(() => { setRaceAudioMuted(!soundEnabled); }, [soundEnabled]);
  const [countdownAt, setCountdownAt] = useState<number | null>(null);
  const [live, setLive] = useState<GpsSprintState | null>(null);
  const [stepCount, setStepCount] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [summary, setSummary] = useState<DiagnosticSummary | null>(null);
  const [interrupted, setInterrupted] = useState(false);
  const [saveToAccount, setSaveToAccount] = useState(true);
  const saveEnabledRef = useRef(true);
  const [saveStatus, setSaveStatus] = useState<'idle'|'saving'|'saved'|'error'|'unknown'>('idle');
  const [savedRuns, setSavedRuns] = useState<SavedRun[]>([]);
  const savedRunsRead = useRef(createLatestRead<SavedRun[]>());
  const [savedMessage, setSavedMessage] = useState('');
  const [motionGaps, setMotionGaps] = useState(0);
  const phaseRef = useRef<Phase>('idle');
  const watchRef = useRef<number | null>(null);
  const activeRef = useRef<GpsSprintState | null>(null);
  const readyRef = useRef<GpsSample | null>(null);
  const startedRef = useRef<number | null>(null);
  const stepRef = useRef(new LiveStepPeakCounter());
  const gpsTraceRef = useRef<GpsTrace[]>([]);
  const motionTraceRef = useRef<MotionTrace[]>([]);
  const lastMotionAt = useRef<number | null>(null);
  const gapCountRef = useRef(0);
  const interruptedRef = useRef(false);
  const motionPermissionRef = useRef<MotionPermission>('unavailable');
  const savedRef = useRef(false);
  const savePendingRef = useRef(false);
  const lifetime = useRef(createMeasurementLifetime());
  const gpsLifetime = useRef(createMeasurementLifetime());
  const preparingRef = useRef(false);
  const unmountedRef = useRef(false);
  const audioPlayedRef = useRef(false);
  const wakeStatus = useScreenWakeLock(phase === 'running' || phase === 'countdown');

  const setCurrentPhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    if (!unmountedRef.current) setPhase(p);
  }, []);
  const stopGps = useCallback(() => {
    gpsLifetime.current.close(); // retire queued watch and one-shot callbacks first
    if (watchRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
  }, []);

  const refreshSaved = useCallback(async () => {
    if (!user?.id || !lifetime.current.isActive()) return;
    const isLive = lifetime.current.capture();
    await savedRunsRead.current.run(isLive, async () => {
      const { data, error } = await supabase.from('ghost_run_sessions')
        .select('id,created_at,target_distance_m,run_state,elapsed_ms,steps_count,observed_distance_m')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(6);
      if (error || !Array.isArray(data)) return null;
      return data as SavedRun[];
    }, setSavedRuns);
  }, [user?.id]);
  useEffect(() => { void refreshSaved(); }, [refreshSaved]);
  useEffect(() => { saveEnabledRef.current = saveToAccount; }, [saveToAccount]);

  const saveSummary = useCallback(async (item: DiagnosticSummary) => {
    if (!saveEnabledRef.current || !user?.id || savedRef.current || !lifetime.current.isActive()) return;
    const isLive = lifetime.current.capture();
    let assertAccount: () => void;
    try { assertAccount = beginAccountMutation(); } catch { return; }
    if (!measurementAccountCurrent(isLive, assertAccount)) return;
    savedRef.current = true; // suppress duplicate callbacks for this run
    savePendingRef.current = true;
    setSaveStatus('saving');
    setSavedMessage('');
    let error: unknown = null;
    let uncertain = false;
    try {
      const response = await supabase.from('ghost_run_sessions').insert({
        user_id: user.id, ...item, source: 'ios-web-beta',
      });
      error = response.error;
      // A transport or gateway failure may arrive after the insert committed.
      uncertain = isUncertainGhostSave(response.status, response.error);
    } catch {
      uncertain = true;
    }
    if (!measurementAccountCurrent(isLive, assertAccount)) return;
    savePendingRef.current = false;
    if (uncertain) {
      setSaveStatus('unknown');
      setSavedMessage('Speicherstatus unklar. Bitte JSON exportieren und deine letzten Solo-Messungen prüfen. Kein erneutes Speichern ohne Bestätigung.');
      void refreshSaved().catch(() => {});
    } else if (error) {
      savedRef.current = false;
      setSaveStatus('error');
      setSavedMessage('Privates Speichern fehlgeschlagen. Du kannst erneut speichern oder JSON exportieren.');
    } else {
      setSaveStatus('saved');
      setSavedMessage('Messzusammenfassung privat im Konto gespeichert. Keine Ranglistenwertung.');
      void refreshSaved().catch(() => {});
    }
  }, [user?.id, refreshSaved, beginAccountMutation]);

  const stopRun = useCallback((reason: 'finished'|'stopped', message: string) => {
    if (!lifetime.current.isActive() || phaseRef.current !== 'running') return;
    const state = activeRef.current;
    if (!state) return;
    setCurrentPhase(reason);
    stopGps();
    let finalSteps = stepRef.current.count;
    if (reason === 'finished' && state.finishTimestampMs !== null) {
      const motion = ghostFinishMotion(motionTraceRef.current, stepRef.current.timestampsMs,
        state.startedAtMs, state.finishTimestampMs);
      motionTraceRef.current = motion.trace;
      finalSteps = motion.steps;
      gapCountRef.current = motion.gaps;
      setStepCount(finalSteps);
      setMotionGaps(motion.gaps);
    }
    const summaryRow = ghostSummary(state, finalSteps,
      motionTraceRef.current.length, gapCountRef.current,
      motionPermissionRef.current, interruptedRef.current,
      reason === 'finished');
    setSummary(summaryRow);
    setLive(state);
    setNotice(message);
    if (reason === 'finished' && !audioPlayedRef.current) {
      audioPlayedRef.current = true;
      if (soundEnabled) playArcadeFinishSfx();
    }
    void saveSummary(summaryRow);
  }, [setCurrentPhase, stopGps, saveSummary, soundEnabled]);

  const onGps = useCallback((pos: GeolocationPosition) => {
    if (unmountedRef.current) return;
    const sample: GpsSample = {
      latitude: pos.coords.latitude, longitude: pos.coords.longitude,
      accuracyM: pos.coords.accuracy, timestampMs: pos.timestamp,
    };
    const current = phaseRef.current;
    const observedNow = Date.now();
    if (current === 'acquiring' || current === 'ready' || current === 'countdown') {
      // watchPosition and getCurrentPosition may return out of order. Do not
      // replace a newer valid anchor with an older cached Safari callback.
      if (readyRef.current && sample.timestampMs < readyRef.current.timestampMs) return;
      const info = inspectGhostGpsFix(sample, observedNow);
      setAccuracyM(sample.accuracyM);
      setFixTimestampMs(Number.isFinite(sample.timestampMs) ? sample.timestampMs : null);
      setFixIssue(info.issue);
      if (info.issue === 'ready' && isFreshStartFix(sample, observedNow)) {
        readyRef.current = sample;
        if (current === 'acquiring') {
          setCurrentPhase('ready');
          setNotice('GPS bereit. An die Startlinie stellen und Ghost Run starten.');
        }
      } else if (current !== 'countdown') {
        readyRef.current = null;
        setCurrentPhase('acquiring');
        setNotice(ghostGpsFixNotice(info));
      }
      return;
    }
    if (current !== 'running' || !activeRef.current) return;
    const prior = activeRef.current;
    const next = advanceLiveGpsSprint(prior, sample, observedNow);
    activeRef.current = next;
    setLive(next);
    if (gpsTraceRef.current.length < MAX_GPS_SAMPLES) {
      const origin = next.origin;
      const radians = Math.PI / 180;
      gpsTraceRef.current.push({
        t_ms: Math.max(0, sample.timestampMs - next.startedAtMs),
        east_m: origin ? safeNumber((sample.longitude - origin.longitude) * 111320 * Math.cos(origin.latitude * radians)) : null,
        north_m: origin ? safeNumber((sample.latitude - origin.latitude) * 111320) : null,
        accuracy_m: safeNumber(sample.accuracyM),
        distance_m: safeNumber(next.distanceM),
        decision: next.lastDecision ?? 'unknown',
      });
    }
    if (next.finishTimestampMs !== null) {
      stopRun('finished', 'ZIEL ERREICHT! Ghost Run abgeschlossen.');
    }
  }, [setCurrentPhase, stopRun]);

  const onGpsError = useCallback((err: GeolocationPositionError) => {
    if (unmountedRef.current) return;
    const text = err.code === 1 ? 'Standort verweigert. Bitte Safari-Ortungsfreigabe prüfen.'
      : err.code === 2 ? 'GPS vorübergehend nicht verfügbar.'
        : 'GPS-Zeitüberschreitung. Bitte im Freien erneut versuchen.';
    if (phaseRef.current === 'running') {
      interruptedRef.current = true;
      setInterrupted(true);
      stopRun('stopped', text + ' Der Lauf wurde nicht als Zielankunft gewertet.');
    } else if (phaseRef.current !== 'finished' && phaseRef.current !== 'stopped') {
      setCurrentPhase('error');
      setNotice(text);
      stopGps();
    }
  }, [stopRun, setCurrentPhase, stopGps]);

  const prepare = async () => {
    if (!user) { setNotice('Zum Speichern und Laufen bitte zuerst anmelden.'); return; }
    if (!window.isSecureContext || !navigator.geolocation) {
      setCurrentPhase('error'); setNotice('GPS benötigt HTTPS und ein Gerät mit Ortungsdiensten.'); return;
    }
    if (preparingRef.current || !lifetime.current.isActive()) return;
    const isLive = lifetime.current.capture();
    let assertAccount: () => void;
    try { assertAccount = beginAccountMutation(); } catch { return; }
    preparingRef.current = true;
    try {
    // iOS gesture: request motion permission before any await or timers.
    let motion: MotionPermission = 'unavailable';
    try {
      const motionEvent = typeof DeviceMotionEvent !== 'undefined'
        ? DeviceMotionEvent as typeof DeviceMotionEvent & { requestPermission?: () => Promise<'granted'|'denied'> }
        : null;
      if (motionEvent) {
        motion = typeof motionEvent.requestPermission === 'function'
          ? await motionEvent.requestPermission() : 'granted';
      }
    } catch { motion = 'denied'; }
    if (!measurementAccountCurrent(isLive, assertAccount)) return;
    motionPermissionRef.current = motion;
    setMotionPermission(motion);
    const { data: activeDuels, error: duelsError } = await supabase.from('duels')
      .select('id').or(`host_user_id.eq.${user.id},challenger_user_id.eq.${user.id}`)
      .in('status', ['open', 'matched']).limit(1);
    if (!measurementAccountCurrent(isLive, assertAccount)) return;
    if (duelsError) {
      setCurrentPhase('error');
      setNotice('Aktive Rennen konnten nicht geprüft werden. Bitte erneut versuchen.');
      return;
    }
    if (activeDuels?.length) {
      setCurrentPhase('error');
      setNotice('Du hast noch ein aktives 1v1-Duell. Beende oder storniere es vor deinem Solo-Test.');
      return;
    }
    readyRef.current = null;
    setFixTimestampMs(null);
    setFixIssue('missing');
    setAccuracyM(null);
    setCurrentPhase('acquiring');
    setNotice(motion === 'granted'
      ? 'Sensormessung erlaubt. Warte auf einen aktuellen GPS-Fix.'
      : 'Schrittmessung nicht verfügbar. GPS kann separat gemessen werden.');
    stopGps();
    gpsLifetime.current.open();
    const isGpsLive = gpsLifetime.current.capture();
    try {
      watchRef.current = navigator.geolocation.watchPosition(
        pos => { if (isGpsLive()) onGps(pos); },
        err => { if (isGpsLive()) onGpsError(err); },
        GPS_OPTIONS,
      );
    } catch {
      stopGps();
      setCurrentPhase('error');
      setNotice('GPS konnte nicht gestartet werden.');
    }
    } catch {
      if (measurementAccountCurrent(isLive, assertAccount)) {
        setCurrentPhase('error');
        setNotice('Vorbereitung fehlgeschlagen. Bitte erneut versuchen.');
      }
    } finally { if (isLive()) preparingRef.current = false; }
  };

  // iOS may keep reporting an accurate *old* fix when the runner is standing
  // still. Request independent fresh fixes while acquiring, without bypassing
  // isFreshStartFix or changing GPS timestamps.
  useEffect(() => {
    if (phase !== 'acquiring' || !navigator.geolocation) return;
    let cancelled = false;
    let pending = false;
    const isGpsLive = gpsLifetime.current.capture();
    const requestFreshFix = () => {
      if (cancelled || pending || !isGpsLive() || phaseRef.current !== 'acquiring' || document.visibilityState !== 'visible') return;
      pending = true;
      try {
        navigator.geolocation.getCurrentPosition(
          pos => { pending = false; if (!cancelled && isGpsLive() && phaseRef.current === 'acquiring') onGps(pos); },
          () => { pending = false; },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 7000 },
        );
      } catch { pending = false; }
    };
    requestFreshFix();
    const interval = window.setInterval(requestFreshFix, 5000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [phase, onGps]);

  useEffect(() => {
    if (phase !== 'acquiring' && phase !== 'ready' && phase !== 'countdown') return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  const requestGpsRefresh = () => {
    if (!navigator.geolocation || !gpsLifetime.current.isActive()) return;
    const isGpsLive = gpsLifetime.current.capture();
    const stillPreparing = () => isGpsLive() &&
      (phaseRef.current === 'acquiring' || phaseRef.current === 'ready');
    const failed = () => {
      if (stillPreparing()) setNotice('Noch kein frischer GPS-Fix. Bitte möglichst draußen erneut versuchen.');
    };
    setNotice('Fordere eine neue GPS-Position an. Ein alter 4-m-Fix reicht für einen Sprintstart nicht aus.');
    try {
      navigator.geolocation.getCurrentPosition(
        pos => { if (stillPreparing()) onGps(pos); },
        failed,
        { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 },
      );
    } catch { failed(); }
  };

  const beginCountdown = () => {
    if (!lifetime.current.isActive() || phaseRef.current !== 'ready') return;
    if (!isFreshStartFix(readyRef.current, Date.now())) {
      setCurrentPhase('acquiring');
      setNotice('GPS-Fix ist nicht mehr aktuell. Bitte auf ein neues Signal warten.');
      return;
    }
    if (soundEnabled) unlockRaceAudio(); // User gesture; do not require sound permission later.
    const start = Date.now() + ARCADE_COUNTDOWN_SECONDS * 1000;
    setCountdownAt(start);
    setCurrentPhase('countdown');
  };

  // While stationary iOS may throttle watchPosition. Ask for a genuinely
  // current GPS fix shortly before GO; never fabricate a newer timestamp.
  useEffect(() => {
    if (phase !== 'countdown' || countdownAt === null || !navigator.geolocation) return;
    let cancelled = false;
    const isGpsLive = gpsLifetime.current.capture();
    const stillCounting = () => !cancelled && isGpsLive() && phaseRef.current === 'countdown';
    const timer = window.setTimeout(() => {
      if (!stillCounting()) return;
      try {
        navigator.geolocation.getCurrentPosition(
          pos => { if (stillCounting()) onGps(pos); },
          () => {}, // existing watch remains authoritative on error
          { enableHighAccuracy: true, maximumAge: 0, timeout: 2500 },
        );
      } catch { /* existing watch remains authoritative */ }
    }, Math.max(0, countdownAt - Date.now() - 2300));
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [phase, countdownAt, onGps]);

  const beginRun = (): boolean => {
    if (!lifetime.current.isActive() || phaseRef.current !== 'countdown') return false;
    const startMs = Date.now(); // actual clock when the countdown finishes, never a stale Safari timer
    const anchor = readyRef.current;
    // Countdown could have suspended in Safari. Do not silently start from stale GPS.
    if (!isFreshStartFix(anchor, Date.now())) {
      setCountdownAt(null);
      setCurrentPhase('acquiring');
      setNotice('Startposition nach Countdown nicht mehr frisch. Bitte neuen GPS-Fix abwarten.');
      return false;
    }
    let first: GpsSprintState;
    try {
      first = primeGpsSprint(createGpsSprint(target, startMs), anchor);
    } catch {
      setCurrentPhase('acquiring'); setNotice('GPS-Start fehlgeschlagen. Neu vorbereiten.'); return false;
    }
    activeRef.current = first;
    startedRef.current = startMs;
    gpsTraceRef.current = [];
    motionTraceRef.current = [];
    gapCountRef.current = 0;
    lastMotionAt.current = null;
    stepRef.current.reset();
    savedRef.current = false;
    interruptedRef.current = false;
    audioPlayedRef.current = false;
    setMotionGaps(0); setStepCount(0); setSummary(null); setInterrupted(false); setSaveStatus('idle');
    setSavedMessage(''); setLive(first); setCurrentPhase('running');
    setNotice('RUN! Distanz über GPS, Schritte über Bewegungssensoren. Display eingeschaltet lassen.');
    return true;
  };

  useEffect(() => {
    if (phase !== 'running') return;
    const handler = (event: DeviceMotionEvent) => {
      if (!lifetime.current.isActive() || phaseRef.current !== 'running') return;
      const a = event.acceleration;
      if (!a || a.x == null || a.y == null || a.z == null) return;
      const sample = motionEventSample(event, performance.timeOrigin, performance.now());
      const start = startedRef.current;
      if (!sample || start === null || sample.timestampMs < start) return;
      const stamp = sample.timestampMs;
      const last = lastMotionAt.current;
      if (last !== null && stamp <= last) return;
      if (last !== null && stamp - last > 250) {
        gapCountRef.current += 1;
        setMotionGaps(gapCountRef.current);
      }
      lastMotionAt.current = stamp;
      const magnitude = sample.accelerationMagnitudeMps2;
      const updated = stepRef.current.push(sample);
      if (updated !== null) setStepCount(updated);
      if (motionTraceRef.current.length < MAX_MOTION_SAMPLES) {
        motionTraceRef.current.push({
          t_ms: stamp - start,
          ax: safeNumber(a.x), ay: safeNumber(a.y), az: safeNumber(a.z),
          magnitude: safeNumber(magnitude), steps: stepRef.current.count,
        });
      }
    };
    window.addEventListener('devicemotion', handler, { passive: true });
    return () => window.removeEventListener('devicemotion', handler);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'running') return;
    const timer = window.setInterval(() => {
      const moment = Date.now();
      setNow(moment);
      if (moment - (startedRef.current ?? moment) > MAX_RUN_MS) {
        stopRun('stopped', 'Maximale Messdauer erreicht. Unvollständiger Testlauf.');
      }
    }, 75);
    return () => window.clearInterval(timer);
  }, [phase, stopRun]);

  useEffect(() => {
    const hidden = () => {
      if (document.visibilityState === 'visible') return;
      if (phaseRef.current === 'running') {
        interruptedRef.current = true;
        setInterrupted(true);
        stopRun('stopped', 'Safari wurde in den Hintergrund versetzt. Lauf nicht als beendet gewertet.');
      } else if (phaseRef.current === 'countdown') {
        setCurrentPhase('acquiring');
        setCountdownAt(null);
        setNotice('Countdown nach Hintergrundwechsel gestoppt. GPS erneut bestätigen.');
      }
    };
    const pageHide = () => {
      if (phaseRef.current === 'running') {
        interruptedRef.current = true;
        stopRun('stopped', 'Seite verlassen; Messung unvollständig.');
      }
    };
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', pageHide);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', pageHide);
    };
  }, [stopRun, setCurrentPhase]);
  useLayoutEffect(() => {
    lifetime.current.open();
    unmountedRef.current = false;
    preparingRef.current = false;
    return () => {
      lifetime.current.close();
      unmountedRef.current = true;
      phaseRef.current = 'idle';
      stopGps();
      readyRef.current = null;
      activeRef.current = null;
      gpsTraceRef.current = [];
      motionTraceRef.current = [];
    };
  }, [stopGps]);

  const exportJson = () => {
    if (!summary) return;
    // Export has no absolute GPS positions, user ID, email, or device identifier.
    const report = {
      schema: 'runnit-ghost-diagnostic-v1',
      note: 'Experimentelle Messung, weder offizieller Rekord noch Anti-Cheat-Nachweis.',
      raw_location_included: false,
      ...summary,
      recorded_at: new Date().toISOString(),
      gps: gpsTraceRef.current,
      motion: motionTraceRef.current,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'runnit-ghost-run-' + summary.target_distance_m + 'm.json';
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2500);
  };

  const reset = () => {
    if (savePendingRef.current || phaseRef.current === 'running' || phaseRef.current === 'countdown') return;
    stopGps(); readyRef.current = null; activeRef.current = null;
    setCountdownAt(null); setLive(null); setSummary(null); setStepCount(0);
    setAccuracyM(null); setSavedMessage(''); setSaveStatus('idle'); setMotionGaps(0);
    setCurrentPhase('idle'); setNotice('Bereit für deinen nächsten Ghost Run.');
  };
  const elapsedMs = summary?.elapsed_ms ?? (phase === 'running'
    ? Math.max(0, now - (startedRef.current ?? now)) : null);
  const phaseLabel = phase === 'finished' ? 'ZIEL ERREICHT!' : phase === 'stopped'
    ? 'LAUF ABGEBROCHEN' : phase === 'running' ? 'FULL SPEED!' : 'GHOST RUN';
  const isActive = phase === 'running' || phase === 'countdown';
  const showSummary = (phase === 'finished' || phase === 'stopped') && summary;
  const gpsState = live;
  const distance = gpsState?.distanceM ?? 0;
  const progress = Math.min(100, Math.max(0, distance / target * 100));

  return (
    <main className="runnit-ghost-page">
      <div className="runnit-ghost-wrap">
        <header className="runnit-ghost-top">
          {isActive
            ? <span className="runnit-ghost-back" aria-label="Lauf aktiv, Zurück erst nach Abbruch"><Flag size={19} /></span>
            : <Link to="/home" className="runnit-ghost-back" aria-label="Zur Startseite"><ArrowLeft size={20} /></Link>}
          <span>RUNNIT // SOLO LAB</span>
          <span className="runnit-ghost-beta">GHOST BETA</span>
        </header>
        <div className="runnit-ghost-hero">
          <p>TRAIN SOLO / BEAT YOURSELF</p>
          <h1>{phaseLabel}</h1>
          <span>Y2K ARCADE · GPS + LIVE IMU</span>
        </div>

        {loading ? <p role="status">Anmeldung wird geprüft …</p> : !user ? (
          <section className="runnit-ghost-card">
            <h2>ANMELDUNG ERFORDERLICH</h2>
            <p>Ghost-Runs erfassen persönliche Trainingsdaten und benötigen dein Konto.</p>
            <Link className="race-arcade-primary" to="/login?next=%2Fghost-run">ANMELDEN »</Link>
          </section>
        ) : (
          <>
            {!isActive && !showSummary && (
              <section className="runnit-ghost-card">
                <p className="runnit-ghost-kicker">01 // WÄHLE DEINE DISTANZ</p>
                <div className="runnit-ghost-targets" role="group" aria-label="Distanz">
                  {([50,75,100] as const).map(meters => (
                    <button type="button" key={meters} onClick={() => setTarget(meters)}
                      className={target === meters ? 'selected' : ''}
                      disabled={phase === 'acquiring'} aria-pressed={target === meters}>
                      {meters}<small>M</small>
                    </button>
                  ))}
                </div>
                <p className="runnit-ghost-kicker">02 // SENSOR-CHECK</p>
                <div className="runnit-ghost-metric"><span>GPS GENAUIGKEIT</span><strong>{accuracyM === null ? '—' : safeNumber(accuracyM,1) + ' m'}</strong></div>
                <div className="runnit-ghost-metric">
                  <span>LETZTER GPS-FIX</span>
                  <strong>{fixTimestampMs === null ? '—' : Math.max(0, (now - fixTimestampMs) / 1000).toFixed(1) + ' s alt'}</strong>
                </div>
                {fixIssue !== 'ready' && fixIssue !== 'missing' && (
                  <p className="runnit-ghost-small" role="status">{ghostGpsFixNotice({ issue: fixIssue,
                    ageMs: fixTimestampMs === null ? null : now - fixTimestampMs, accuracyM })}</p>
                )}
                <div className="runnit-ghost-metric"><span>BEWEGUNGSSENSOR</span><strong>{motionPermission.toUpperCase()}</strong></div>
                {phase !== 'ready' ? (
                  <button className="race-arcade-primary" type="button"
                    onClick={() => { if (phase === 'acquiring') requestGpsRefresh(); else void prepare(); }}>
                    {phase === 'acquiring' ? 'FRISCHEN GPS-FIX ANFORDERN »' : 'SENSOREN FREIGEBEN »'}
                  </button>
                ) : (
                  <button className="race-arcade-primary" type="button" onClick={beginCountdown}>
                    <Play size={20} className="inline mr-2" /> GHOST RUN STARTEN »
                  </button>
                )}
                <button type="button" className="runnit-ghost-secondary"
                  onClick={() => setSoundEnabled(value => !value)}>
                  START- UND ZIELTON: {soundEnabled ? 'AN' : 'AUS'}
                </button>
                <label className="runnit-ghost-optin">
                  <input type="checkbox" checked={saveToAccount} onChange={event => setSaveToAccount(event.target.checked)} />
                  Private Messzusammenfassung nach Laufende in meinem Konto speichern.
                </label>
                <p className="runnit-ghost-small">Keine Ranglistenwertung. Keine Roh-GPS-Koordinaten oder IMU-Rohdaten auf dem Server. Den vollständigen Messverlauf kannst du anschließend als JSON herunterladen.</p>
              </section>
            )}

            {phase === 'running' && (
              <section className="runnit-ghost-card runnit-ghost-running">
                <p className="runnit-ghost-kicker">LIVE // TRAINING</p>
                <div className="runnit-ghost-timer">{(Math.max(0,elapsedMs ?? 0)/1000).toFixed(2)}<small>s</small></div>
                <div className="runnit-ghost-distance">{distance.toFixed(1)} <span>/ {target} M</span></div>
                <div className="runnit-ghost-progress" role="progressbar" aria-label="Distanz" aria-valuemin={0} aria-valuemax={target} aria-valuenow={Math.min(target,Math.round(distance))}>
                  <span style={{width: progress + '%'}} />
                </div>
                <div className="runnit-ghost-grid">
                  <div><Footprints size={19} /><strong>{stepCount}</strong><small>LIVE STEPS</small></div>
                  <div><Gauge size={19} /><strong>{(gpsState?.maxSpeedMps ?? 0).toFixed(1)}</strong><small>MAX M/S</small></div>
                  <div><Flag size={19} /><strong>{gpsState?.acceptedSamples ?? 0}</strong><small>GPS FIXES</small></div>
                  <div><WifiOff size={19} /><strong>{motionGaps}</strong><small>IMU GAPS</small></div>
                </div>
                <p className="runnit-ghost-small">{wakeStatus === 'idle' ? 'Bildschirm bitte eingeschaltet lassen.' : screenWakeLockMessage(wakeStatus)}</p>
                <button className="race-arcade-danger-link" type="button" onClick={() => stopRun('stopped','Manuell beendet. Kein bestätigter Zieleinlauf.')}>
                  <PauseCircle size={17} className="inline mr-2" /> TESTLAUF ABBRECHEN
                </button>
              </section>
            )}

            {showSummary && (
              <section className="runnit-ghost-card runnit-ghost-finish">
                <p className="runnit-ghost-kicker">{showSummary.run_state === 'finished' ? 'RUN COMPLETED' : 'INCOMPLETE TEST'}</p>
                <div className="runnit-ghost-timer">{showSummary.elapsed_ms === null ? '—' : (showSummary.elapsed_ms/1000).toFixed(2)}<small>s</small></div>
                <div className="runnit-ghost-distance">{showSummary.observed_distance_m.toFixed(1)} <span>/ {target} M</span></div>
                <div className="runnit-ghost-grid">
                  <div><Footprints size={19}/><strong>{showSummary.steps_count}</strong><small>SCHRITTE</small></div>
                  <div><Gauge size={19}/><strong>{showSummary.max_speed_mps.toFixed(1)}</strong><small>MAX M/S</small></div>
                  <div><CheckCircle2 size={19}/><strong>{showSummary.gps_accepted}</strong><small>GPS OK</small></div>
                  <div><WifiOff size={19}/><strong>{showSummary.gps_rejected}</strong><small>GPS VERWORFEN</small></div>
                </div>
                <p className="runnit-ghost-small" role="status">{savedMessage || (saveStatus === 'saving' ? 'Speichere private Zusammenfassung …' : 'Messung abgeschlossen.')}</p>
                {interrupted && <p className="runnit-ghost-alert">Safari-Unterbrechung erkannt. Sensorwerte können fehlen.</p>}
                {saveStatus === 'error' && <button type="button" className="race-arcade-danger-link" onClick={() => { void saveSummary(showSummary); }}>SPEICHERN ERNEUT VERSUCHEN</button>}
                <button type="button" className="race-arcade-primary" onClick={exportJson}><Download size={18} className="inline mr-2" /> DIAGNOSE-JSON EXPORTIEREN »</button>
                <button type="button" className="runnit-ghost-secondary" onClick={reset} disabled={saveStatus === 'saving'}>NEUER GHOST RUN</button>
                <Link to="/map" className="runnit-ghost-secondary">ZUR KARTE</Link>
              </section>
            )}

            {!isActive && !showSummary && savedRuns.length > 0 && (
              <section className="runnit-ghost-card">
                <h2>DEINE LETZTEN SOLO-MESSUNGEN</h2>
                {savedRuns.map(run => (
                  <div key={run.id} className="runnit-ghost-metric">
                    <span><Timer size={15} className="inline mr-1" /> {run.target_distance_m} M · {run.run_state === 'finished' ? 'ZIEL' : 'ABGEBROCHEN'}</span>
                    <strong>{run.elapsed_ms ? (run.elapsed_ms/1000).toFixed(2)+'s' : '—'}</strong>
                  </div>
                ))}
              </section>
            )}
            <p className="runnit-ghost-status" role="status">{notice}</p>
            <p className="runnit-ghost-disclaimer"><ShieldCheck size={17} className="shrink-0" /> Nicht verifiziert. Schrittzahlen sind experimentell; fehlende Schritte beweisen keinen Stillstand. iOS kann die Messung bei gesperrtem Bildschirm unterbrechen. Bitte nur auf einer sicheren, freien Strecke laufen, nicht beim Rennen aufs Display schauen.</p>
          </>
        )}
      </div>
      {phase === 'countdown' && countdownAt !== null && (
        <RaceCountdown startsAt={countdownAt} targetDistanceM={target} wakeStatus={wakeStatus}
          soundEnabled={soundEnabled} onDone={beginRun} onAbort={async () => {
            setCountdownAt(null); setCurrentPhase('ready');
            setNotice('Solo-Countdown abgebrochen, kein Rennen gespeichert.');
          }} />
      )}
    </main>
  );
}
