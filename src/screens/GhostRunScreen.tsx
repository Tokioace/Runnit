import { canStartGhostCountdown } from '../lib/ghostCountdown';
import { createFinishRefresh } from '../lib/finishRefresh';
import { isUncertainGhostSave, isGhostSaveConflict, matchesGhostSave, ownsGhostSaveReport } from '../lib/ghostSaveResponse';
import { createLatestRead } from '../lib/latestRead';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Download, Flag, Footprints, Gauge, PauseCircle, Play, ShieldCheck, Timer, WifiOff } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import type { UseSupabaseUserReturn } from '../hooks/useSupabaseUser';
import { createMeasurementLifetime, measurementAccountCurrent } from '../lib/measurementLifetime';
import { createGpsSprint, advanceLiveGpsSprint, type GpsSprintState, type GpsSample } from '../lib/sprintGps';
import { ghostSummary, ghostFinishMotion, ghostRelativeGpsFix, ghostTraceDiagnostics, safeNumber, type DiagnosticSummary, type MotionPermission } from '../lib/ghostRunSummary';
import { isFreshStartFix, primeGpsSprint, gpsFieldDurationReached } from '../lib/gpsField';
import { inspectGhostGpsFix, ghostGpsFixNotice, ghostFixOrder, type GhostGpsFixIssue } from '../lib/ghostGpsReadiness';
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
type GpsTrace = { t_ms: number | null; east_m: number | null; north_m: number | null; accuracy_m: number | null; distance_m: number; decision: string };
type MotionTrace = { t_ms: number; ax: number; ay: number; az: number; magnitude: number; steps: number };
type SavedRun = {
  id: string; created_at: string; target_distance_m: number; run_state: 'finished' | 'stopped';
  elapsed_ms: number | null; steps_count: number; observed_distance_m: number;
};
const GPS_OPTIONS: PositionOptions = { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 };
const MAX_MOTION_SAMPLES = 30000;
const MAX_GPS_SAMPLES = 3000;

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
  const soundEnabledRef = useRef(true);
  const toggleSound = () => {
    const enabled = !soundEnabledRef.current;
    soundEnabledRef.current = enabled;
    setRaceAudioMuted(!enabled);
    setSoundEnabled(enabled);
  };
  // AudioContext is shared with 1v1, but the controls are screen-local.
  // Apply this screen's preference before its countdown effects can run.
  useLayoutEffect(() => { setRaceAudioMuted(!soundEnabled); }, [soundEnabled]);
  const [countdownAt, setCountdownAt] = useState<number | null>(null);
  const countdownAtRef = useRef<number | null>(null);
  const [live, setLive] = useState<GpsSprintState | null>(null);
  const [stepCount, setStepCount] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [summary, setSummary] = useState<DiagnosticSummary | null>(null);
  const terminalReportRef = useRef<{ summary: DiagnosticSummary; recordedAt: string } | null>(null);
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
  const latestPreparationFixMs = useRef<number | null>(null);
  const manualGpsRequestRef = useRef<symbol | null>(null);
  const startedRef = useRef<number | null>(null);
  const stepRef = useRef(new LiveStepPeakCounter());
  const gpsTraceRef = useRef<GpsTrace[]>([]);
  const motionTraceRef = useRef<MotionTrace[]>([]);
  const gpsTraceOmittedRef = useRef(0);
  const firstMotionOmittedMsRef = useRef<number | null>(null);
  const lastMotionAt = useRef<number | null>(null);
  const gapCountRef = useRef(0);
  const interruptedRef = useRef(false);
  const motionPermissionRef = useRef<MotionPermission>('unavailable');
  const savedRef = useRef(false);
  const saveIdRef = useRef<string | null>(null);
  const uncertainSaveRef = useRef<(DiagnosticSummary & { id: string; user_id: string; source: string }) | null>(null);
  const savePendingRef = useRef(false);
  const lifetime = useRef(createMeasurementLifetime());
  const gpsLifetime = useRef(createMeasurementLifetime());
  const preparingRef = useRef(false);
  const preparationLifetime = useRef(createMeasurementLifetime());
  const unmountedRef = useRef(false);
  const audioPlayedRef = useRef(false);
  const wakeStatus = useScreenWakeLock(phase === 'running' || phase === 'countdown');

  const setCurrentPhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    if (!unmountedRef.current) setPhase(p);
  }, []);
  const stopGps = useCallback(() => {
    gpsLifetime.current.close(); // retire queued watch and one-shot callbacks first
    latestPreparationFixMs.current = null;
    const id = watchRef.current;
    watchRef.current = null;
    manualGpsRequestRef.current = null;
    if (id !== null && navigator.geolocation) {
      try { navigator.geolocation.clearWatch(id); } catch { /* already retired */ }
    }
  }, []);

  const refreshSaved = useCallback(async () => {
    if (!user?.id || !lifetime.current.isActive()) return;
    const isScreenLive = lifetime.current.capture();
    let assertAccount: () => void;
    try { assertAccount = beginAccountMutation(); } catch { return; }
    const isLive = () => measurementAccountCurrent(isScreenLive, assertAccount);
    await savedRunsRead.current.run(isLive, async () => {
      const { data, error } = await supabase.from('ghost_run_sessions')
        .select('id,created_at,target_distance_m,run_state,elapsed_ms,steps_count,observed_distance_m')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(6);
      if (error || !Array.isArray(data)) return null;
      return data as SavedRun[];
    }, setSavedRuns);
  }, [user?.id, beginAccountMutation]);
  useEffect(() => {
    if (!user?.id) return;
    const request = createFinishRefresh(refreshSaved, () => {});
    void request.refresh();
    const whenHistoryVisible = () => {
      if (document.visibilityState === 'visible') void request.refresh(true);
    };
    window.addEventListener('online', whenHistoryVisible);
    document.addEventListener('visibilitychange', whenHistoryVisible);
    return () => {
      request.close();
      window.removeEventListener('online', whenHistoryVisible);
      document.removeEventListener('visibilitychange', whenHistoryVisible);
    };
  }, [user?.id, refreshSaved]);
  const changeSavePreference = (enabled: boolean) => {
    // Apply the user's selection before any queued GPS completion callback.
    saveEnabledRef.current = enabled;
    setSaveToAccount(enabled);
  };

  const saveSummary = useCallback(async (item: DiagnosticSummary) => {
    if (!saveEnabledRef.current || !user?.id || savedRef.current || !lifetime.current.isActive()) return;
    if (!ownsGhostSaveReport(terminalReportRef.current, item, phaseRef.current)) return;
    const isLive = lifetime.current.capture();
    let assertAccount: () => void;
    try { assertAccount = beginAccountMutation(); } catch { return; }
    if (!measurementAccountCurrent(isLive, assertAccount)) return;
    try {
      saveIdRef.current ??= crypto.randomUUID();
    } catch {
      setSaveStatus('error');
      setSavedMessage('Sichere Lauf-ID nicht verfügbar. Bitte JSON exportieren oder erneut versuchen.');
      return;
    }
    const payload = { id: saveIdRef.current, user_id: user.id, ...item, source: 'ios-web-beta' };
    savedRef.current = true; // suppress duplicate callbacks for this run
    savePendingRef.current = true;
    setSaveStatus('saving');
    setSavedMessage('');
    let error: unknown = null;
    let uncertain = false;
    try {
      const response = await supabase.from('ghost_run_sessions').insert(payload);
      error = response.error;
      // A transport or gateway failure may arrive after the insert committed.
      uncertain = isUncertainGhostSave(response.status, response.error);
      if (isGhostSaveConflict(response.error)) uncertain = true;
    } catch {
      uncertain = true;
    }
    // The primary key identifies this measurement, not a similar recent run.
    // A failed or empty read cannot authorize another blind insert.
    if (uncertain && measurementAccountCurrent(isLive, assertAccount)) {
      try {
        const { data, error: readError } = await supabase.from('ghost_run_sessions')
          .select('id,user_id,target_distance_m,run_state,elapsed_ms,observed_distance_m,steps_count,gps_accepted,gps_rejected,motion_samples,motion_gaps,max_speed_mps,motion_permission,interrupted,source')
          .eq('user_id', user.id).eq('id', payload.id).maybeSingle();
        if (!readError && matchesGhostSave(payload, data)) {
          uncertain = false;
          error = null;
        }
      } catch { /* keep ambiguous status */ }
    }
    if (!measurementAccountCurrent(isLive, assertAccount)) return;
    savePendingRef.current = false;
    if (uncertain) {
      uncertainSaveRef.current = payload;
      setSaveStatus('unknown');
      setSavedMessage('Speicherstatus unklar. Beim Wiederverbinden wird der Lauf erneut geprüft. Bitte bei Bedarf JSON exportieren.');
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
    terminalReportRef.current = { summary: summaryRow, recordedAt: new Date().toISOString() };
    setSummary(summaryRow);
    setLive(state);
    setNotice(message);
    if (reason === 'finished' && !audioPlayedRef.current) {
      audioPlayedRef.current = true;
      if (soundEnabledRef.current) playArcadeFinishSfx();
    }
    void saveSummary(summaryRow);
  }, [setCurrentPhase, stopGps, saveSummary]);

  const stopAtDurationLimit = useCallback((nowMs = Date.now()): boolean => {
    const state = activeRef.current;
    if (phaseRef.current !== 'running' || !state ||
        !gpsFieldDurationReached(state.startedAtMs, nowMs)) return false;
    stopRun('stopped', 'Maximale Messdauer erreicht. Unvollständiger Testlauf.');
    return true;
  }, [stopRun]);

  const onGps = useCallback((pos: GeolocationPosition) => {
    if (unmountedRef.current) return;
    const sample: GpsSample = {
      latitude: pos.coords.latitude, longitude: pos.coords.longitude,
      accuracyM: pos.coords.accuracy, timestampMs: pos.timestamp,
    };
    const current = phaseRef.current;
    const observedNow = Date.now();
    if (current === 'acquiring' || current === 'ready' || current === 'countdown') {
      // An older callback cannot restore readiness after a newer poor fix.
      const order = ghostFixOrder(latestPreparationFixMs.current, sample, observedNow);
      if (order.ignore) return;
      latestPreparationFixMs.current = order.timestampMs;
      setNow(observedNow);
      const info = inspectGhostGpsFix(sample, observedNow);
      setAccuracyM(info.accuracyM);
      setFixTimestampMs(Number.isFinite(sample.timestampMs) ? sample.timestampMs : null);
      setFixIssue(info.issue);
      if (info.issue === 'ready' && isFreshStartFix(sample, observedNow)) {
        readyRef.current = sample;
        if (current === 'acquiring') {
          setCurrentPhase('ready');
          setNotice('GPS bereit. An die Startlinie stellen und Ghost Run starten.');
        }
      } else {
        // Even during countdown, the last observed poor fix invalidates
        // the old anchor. GO requires a subsequent valid fresh fix.
        readyRef.current = null;
        if (current !== 'countdown') {
          setCurrentPhase('acquiring');
          setNotice(ghostGpsFixNotice(info));
        }
      }
      return;
    }
    if (current !== 'running' || !activeRef.current) return;
    if (stopAtDurationLimit(observedNow)) return;
    const prior = activeRef.current;
    const next = advanceLiveGpsSprint(prior, sample, observedNow);
    activeRef.current = next;
    setLive(next);
    if (gpsTraceRef.current.length < MAX_GPS_SAMPLES) {
      const fix = ghostRelativeGpsFix(sample, next.origin, next.startedAtMs);
      gpsTraceRef.current.push({
        t_ms: fix.t_ms,
        east_m: fix.east_m,
        north_m: fix.north_m,
        accuracy_m: fix.accuracy_m,
        distance_m: safeNumber(next.distanceM),
        decision: next.lastDecision ?? 'unknown',
      });
    } else {
      gpsTraceOmittedRef.current += 1;
    }
    if (next.finishTimestampMs !== null) {
      stopRun('finished', 'ZIEL ERREICHT! Ghost Run abgeschlossen.');
    }
  }, [setCurrentPhase, stopRun, stopAtDurationLimit]);

  const failGpsPreparation = useCallback((message: string) => {
    preparationLifetime.current.close();
    preparingRef.current = false;
    stopGps();
    countdownAtRef.current = null;
    readyRef.current = null;
    setCountdownAt(null);
    setFixTimestampMs(null);
    setFixIssue('missing');
    setAccuracyM(null);
    setCurrentPhase('error');
    setNotice(message);
  }, [stopGps, setCurrentPhase]);

  const onGpsError = useCallback((err: GeolocationPositionError) => {
    if (unmountedRef.current) return;
    const text = err.code === 1 ? 'Standort verweigert. Bitte Safari-Ortungsfreigabe prüfen.'
      : err.code === 2 ? 'GPS vorübergehend nicht verfügbar.'
        : 'GPS-Zeitüberschreitung. Bitte im Freien erneut versuchen.';
    if (phaseRef.current === 'running') {
      interruptedRef.current = true;
      setInterrupted(true);
      stopRun('stopped', text + ' Der Lauf wurde nicht als Zielankunft gewertet.');
    } else if (phaseRef.current === 'acquiring' || phaseRef.current === 'ready' || phaseRef.current === 'countdown') {
      failGpsPreparation(text);
    }
  }, [stopRun, failGpsPreparation]);

  const prepare = async () => {
    if (!user) { setNotice('Zum Speichern und Laufen bitte zuerst anmelden.'); return; }
    if (!window.isSecureContext || !navigator.geolocation) {
      setCurrentPhase('error'); setNotice('GPS benötigt HTTPS und ein Gerät mit Ortungsdiensten.'); return;
    }
    if (preparingRef.current || !lifetime.current.isActive()) return;
    if (document.visibilityState !== 'visible' ||
        (phaseRef.current !== 'idle' && phaseRef.current !== 'error')) return;
    const isScreenLive = lifetime.current.capture();
    let assertAccount: () => void;
    try { assertAccount = beginAccountMutation(); } catch { return; }
    preparationLifetime.current.open();
    const isPreparing = preparationLifetime.current.capture();
    const isLive = () => isScreenLive() && isPreparing() && document.visibilityState === 'visible';
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
    // Only a successful list response can confirm that no duel is active.
    if (duelsError || !Array.isArray(activeDuels)) {
      setCurrentPhase('error');
      setNotice('Aktive Rennen konnten nicht geprüft werden. Bitte erneut versuchen.');
      return;
    }
    if (activeDuels.length) {
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
      failGpsPreparation('GPS konnte nicht gestartet werden.');
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

  const expireReadyFix = useCallback((atMs: number): boolean => {
    if (phaseRef.current !== 'ready' || !gpsLifetime.current.isActive()) return false;
    const anchor = readyRef.current;
    if (isFreshStartFix(anchor, atMs)) return false;
    const info = inspectGhostGpsFix(anchor, atMs);
    readyRef.current = null;
    setFixIssue(info.issue);
    setNow(atMs);
    setCurrentPhase('acquiring');
    setNotice(ghostGpsFixNotice(info));
    return true;
  }, [setCurrentPhase]);

  useEffect(() => {
    if (phase !== 'acquiring' && phase !== 'ready' && phase !== 'countdown') return;
    const isGpsLive = gpsLifetime.current.capture();
    const tick = () => {
      if (!isGpsLive() || document.visibilityState !== 'visible' ||
          (phaseRef.current !== 'acquiring' && phaseRef.current !== 'ready' && phaseRef.current !== 'countdown')) return;
      const atMs = Date.now();
      if (!expireReadyFix(atMs)) setNow(atMs);
    };
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [phase, expireReadyFix]);

  const requestGpsRefresh = () => {
    if (!navigator.geolocation || !gpsLifetime.current.isActive() ||
        phaseRef.current !== 'acquiring' || document.visibilityState !== 'visible' ||
        manualGpsRequestRef.current !== null) return;
    const isGpsLive = gpsLifetime.current.capture();
    const token = Symbol('manual GPS refresh');
    manualGpsRequestRef.current = token;
    const stillPreparing = () => isGpsLive() &&
      (phaseRef.current === 'acquiring' || phaseRef.current === 'ready') &&
      manualGpsRequestRef.current === token && document.visibilityState === 'visible';
    const release = () => {
      if (manualGpsRequestRef.current === token) manualGpsRequestRef.current = null;
    };
    const failed = () => {
      if (stillPreparing() && phaseRef.current === 'acquiring') {
        setNotice('Noch kein frischer GPS-Fix. Bitte möglichst draußen erneut versuchen.');
      }
      release();
    };
    setNotice('Fordere eine neue GPS-Position an. Ein alter 4-m-Fix reicht für einen Sprintstart nicht aus.');
    try {
      navigator.geolocation.getCurrentPosition(
        pos => {
          const current = stillPreparing();
          release();
          if (current) onGps(pos);
        },
        failed,
        { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 },
      );
    } catch { failed(); }
  };

  const beginCountdown = () => {
    if (!lifetime.current.isActive() || phaseRef.current !== 'ready') return;
    if (!gpsLifetime.current.isActive() || document.visibilityState !== 'visible') return;
    if (expireReadyFix(Date.now())) return;
    if (soundEnabledRef.current) unlockRaceAudio(); // User gesture; do not require sound permission later.
    const start = Date.now() + ARCADE_COUNTDOWN_SECONDS * 1000;
    manualGpsRequestRef.current = null;
    countdownAtRef.current = start;
    setCountdownAt(start);
    setCurrentPhase('countdown');
  };

  // While stationary iOS may throttle watchPosition. Ask for a genuinely
  // current GPS fix shortly before GO; never fabricate a newer timestamp.
  useEffect(() => {
    if (phase !== 'countdown' || countdownAt === null || !navigator.geolocation) return;
    let cancelled = false;
    const isGpsLive = gpsLifetime.current.capture();
    const stillCounting = () => !cancelled && isGpsLive() && phaseRef.current === 'countdown' &&
      countdownAtRef.current === countdownAt && document.visibilityState === 'visible';
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
    if (countdownAt === null || countdownAtRef.current !== countdownAt) return false;
    if (!gpsLifetime.current.isActive()) {
      failGpsPreparation('GPS-Aufzeichnung beendet. Bitte Sensoren erneut freigeben.');
      return false;
    }
    const startMs = Date.now();
    countdownAtRef.current = null;
    if (!canStartGhostCountdown(countdownAt, startMs, document.visibilityState === 'visible')) {
      readyRef.current = null;
      setFixIssue('missing');
      setFixTimestampMs(null);
      setAccuracyM(null);
      setNow(startMs);
      setCountdownAt(null);
      setCurrentPhase('acquiring');
      setNotice('Countdown unterbrochen oder zu spät beendet. Bitte GPS erneut bestätigen und neu starten.');
      return false;
    }
    const anchor = readyRef.current;
    // Countdown could have suspended in Safari. Do not silently start from stale GPS.
    if (!isFreshStartFix(anchor, startMs)) {
      readyRef.current = null;
      setFixIssue(inspectGhostGpsFix(anchor, startMs).issue);
      setNow(startMs);
      setCountdownAt(null);
      setCurrentPhase('acquiring');
      setNotice('Startposition nach Countdown nicht mehr frisch. Bitte neuen GPS-Fix abwarten.');
      return false;
    }
    let first: GpsSprintState;
    try {
      first = primeGpsSprint(createGpsSprint(target, startMs), anchor);
    } catch {
      readyRef.current = null;
      setFixIssue('missing');
      setFixTimestampMs(null);
      setAccuracyM(null);
      setNow(startMs);
      setCountdownAt(null);
      setCurrentPhase('acquiring'); setNotice('GPS-Start fehlgeschlagen. Neu vorbereiten.'); return false;
    }
    setCountdownAt(null);
    activeRef.current = first;
    terminalReportRef.current = null;
    startedRef.current = startMs;
    gpsTraceRef.current = [];
    motionTraceRef.current = [];
    gpsTraceOmittedRef.current = 0;
    firstMotionOmittedMsRef.current = null;
    gapCountRef.current = 0;
    lastMotionAt.current = null;
    stepRef.current.reset();
    savedRef.current = false;
    saveIdRef.current = null;
    uncertainSaveRef.current = null;
    interruptedRef.current = false;
    audioPlayedRef.current = false;
    setMotionGaps(0); setStepCount(0); setSummary(null); setInterrupted(false); setSaveStatus('idle');
    setSavedMessage(''); setLive(first); setCurrentPhase('running');
    setNotice('RUN! Distanz über GPS, Schritte über Bewegungssensoren. Display eingeschaltet lassen.');
    return true;
  };

  useEffect(() => {
    if (phase !== 'running') return;
    const isGpsLive = gpsLifetime.current.capture();
    const handler = (event: DeviceMotionEvent) => {
      if (!lifetime.current.isActive() || phaseRef.current !== 'running' || !isGpsLive()) return;
      if (stopAtDurationLimit()) return;
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
      } else if (firstMotionOmittedMsRef.current === null) {
        firstMotionOmittedMsRef.current = stamp - start;
      }
    };
    window.addEventListener('devicemotion', handler, { passive: true });
    return () => window.removeEventListener('devicemotion', handler);
  }, [phase, stopAtDurationLimit]);

  useEffect(() => {
    if (phase !== 'running') return;
    const isGpsLive = gpsLifetime.current.capture();
    const timer = window.setInterval(() => {
      if (!isGpsLive() || phaseRef.current !== 'running') return;
      const moment = Date.now();
      if (!stopAtDurationLimit(moment)) setNow(moment);
    }, 75);
    return () => window.clearInterval(timer);
  }, [phase, stopAtDurationLimit]);

  useLayoutEffect(() => {
    const retirePreparation = (message: string) => {
      preparationLifetime.current.close();
      preparingRef.current = false;
      stopGps();
      readyRef.current = null;
      setFixTimestampMs(null);
      setFixIssue('missing');
      setAccuracyM(null);
      setCurrentPhase('idle');
      setNotice(message);
    };
    const hidden = () => {
      if (document.visibilityState === 'visible') return;
      if (phaseRef.current === 'running') {
        interruptedRef.current = true;
        setInterrupted(true);
        stopRun('stopped', 'Safari wurde in den Hintergrund versetzt. Lauf nicht als beendet gewertet.');
      } else if (phaseRef.current === 'countdown') {
        countdownAtRef.current = null;
        readyRef.current = null;
        setCountdownAt(null);
        retirePreparation('Countdown nach Hintergrundwechsel gestoppt. Bitte Sensoren erneut freigeben.');
      } else if (preparingRef.current || phaseRef.current === 'acquiring' || phaseRef.current === 'ready') {
        retirePreparation('GPS bei Hintergrundwechsel beendet. Bitte Sensoren erneut freigeben.');
      }
    };
    const pageHide = () => {
      if (phaseRef.current === 'running') {
        interruptedRef.current = true;
        setInterrupted(true);
        stopRun('stopped', 'Seite verlassen; Messung unvollständig.');
      } else if (phaseRef.current === 'countdown') {
        countdownAtRef.current = null;
        readyRef.current = null;
        setCountdownAt(null);
        retirePreparation('Countdown beim Verlassen der Seite gestoppt. Bitte Sensoren erneut freigeben.');
      } else if (preparingRef.current || phaseRef.current === 'acquiring' || phaseRef.current === 'ready') {
        retirePreparation('GPS beim Verlassen der Seite beendet. Bitte Sensoren erneut freigeben.');
      }
    };
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', pageHide);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', pageHide);
    };
  }, [stopRun, setCurrentPhase, stopGps]);
  useLayoutEffect(() => {
    lifetime.current.open();
    unmountedRef.current = false;
    preparingRef.current = false;
    return () => {
      lifetime.current.close();
      unmountedRef.current = true;
      phaseRef.current = 'idle';
      stopGps();
      countdownAtRef.current = null;
      preparationLifetime.current.close();
      preparingRef.current = false;
      readyRef.current = null;
      activeRef.current = null;
      terminalReportRef.current = null;
      startedRef.current = null;
      stepRef.current.reset();
      lastMotionAt.current = null;
      gapCountRef.current = 0;
      gpsTraceRef.current = [];
      motionTraceRef.current = [];
      gpsTraceOmittedRef.current = 0;
      firstMotionOmittedMsRef.current = null;
      uncertainSaveRef.current = null;
    };
  }, [stopGps]);

  // A lost response can also prevent the initial readback. Recheck only the
  // exact unresolved payload on reconnect or foreground, without new writes.
  useEffect(() => {
    const payload = uncertainSaveRef.current;
    if (saveStatus !== 'unknown' || !payload || payload.user_id !== user?.id ||
        !lifetime.current.isActive()) return;
    const isLive = lifetime.current.capture();
    let assertAccount: () => void;
    try { assertAccount = beginAccountMutation(); } catch { return; }
    let active = true;
    const current = () => active && uncertainSaveRef.current === payload &&
      measurementAccountCurrent(isLive, assertAccount);
    const refresh = createFinishRefresh(async () => {
      if (!current() || document.visibilityState !== 'visible') return;
      const { data, error } = await supabase.from('ghost_run_sessions')
        .select('id,user_id,target_distance_m,run_state,elapsed_ms,observed_distance_m,steps_count,gps_accepted,gps_rejected,motion_samples,motion_gaps,max_speed_mps,motion_permission,interrupted,source')
        .eq('user_id', payload.user_id).eq('id', payload.id).maybeSingle();
      if (!current() || error || !matchesGhostSave(payload, data)) return;
      uncertainSaveRef.current = null;
      setSaveStatus('saved');
      setSavedMessage('Messzusammenfassung privat im Konto gespeichert. Keine Ranglistenwertung.');
      void refreshSaved().catch(() => {});
    }, () => { /* retain unknown status */ });
    const whenVisible = () => {
      if (document.visibilityState === 'visible' && current()) void refresh.refresh(true);
    };
    window.addEventListener('online', whenVisible);
    window.addEventListener('focus', whenVisible);
    document.addEventListener('visibilitychange', whenVisible);
    // Explicit recovery queues one follow-up; routine polling drops overlap.
    // The reader rechecks visibility and exact payload before any queued read.
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && current()) void refresh.refresh();
    }, 15_000);
    whenVisible();
    return () => {
      active = false;
      refresh.close();
      window.clearInterval(timer);
      window.removeEventListener('online', whenVisible);
      window.removeEventListener('focus', whenVisible);
      document.removeEventListener('visibilitychange', whenVisible);
    };
  }, [saveStatus, user?.id, beginAccountMutation, refreshSaved]);

  const exportJson = () => {
    if (!summary) return;
    const terminal = terminalReportRef.current;
    if (!terminal || terminal.summary !== summary) return;
    const state = activeRef.current;
    if (!state || (phaseRef.current !== 'finished' && phaseRef.current !== 'stopped')) return;
    // Export has no absolute GPS positions, user ID, email, or device identifier.
    const report = {
      schema: 'runnit-ghost-diagnostic-v1',
      note: 'Experimentelle Messung, weder offizieller Rekord noch Anti-Cheat-Nachweis.',
      raw_location_included: false,
      ...summary,
      recorded_at: terminal.recordedAt,
      diagnostics: ghostTraceDiagnostics(state, gpsTraceOmittedRef.current, firstMotionOmittedMsRef.current),
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
    uncertainSaveRef.current = null;
    stopGps(); readyRef.current = null; activeRef.current = null;
    terminalReportRef.current = null;
    startedRef.current = null;
    saveIdRef.current = null;
    savedRef.current = false;
    gpsTraceRef.current = [];
    motionTraceRef.current = [];
    gpsTraceOmittedRef.current = 0;
    firstMotionOmittedMsRef.current = null;
    stepRef.current.reset();
    lastMotionAt.current = null;
    gapCountRef.current = 0;
    setCountdownAt(null); setLive(null); setSummary(null); setStepCount(0);
    setFixTimestampMs(null); setFixIssue('missing');
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
                  onClick={toggleSound}>
                  START- UND ZIELTON: {soundEnabled ? 'AN' : 'AUS'}
                </button>
                <label className="runnit-ghost-optin">
                  <input type="checkbox" checked={saveToAccount} onChange={event => changeSavePreference(event.target.checked)} />
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
        <RaceCountdown key={countdownAt} startsAt={countdownAt} targetDistanceM={target} wakeStatus={wakeStatus} mode="ghost"
          soundEnabled={soundEnabled} onDone={beginRun} onAbort={async () => {
            if (phaseRef.current !== 'countdown' || countdownAtRef.current !== countdownAt) return;
            countdownAtRef.current = null;
            setCountdownAt(null);
            const fresh = isFreshStartFix(readyRef.current, Date.now());
            if (!fresh) readyRef.current = null;
            setCurrentPhase(fresh ? 'ready' : 'acquiring');
            setNotice(fresh ? 'Solo-Countdown abgebrochen, kein Rennen gespeichert.'
              : 'Solo-Countdown abgebrochen. Bitte auf einen neuen GPS-Fix warten.');
          }} />
      )}
    </main>
  );
}
