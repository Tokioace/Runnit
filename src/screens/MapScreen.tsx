import { createDuelWriteGate } from '../lib/duelWriteGate';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ArcadeMapLibreView from '../components/map/ArcadeMapLibreView';
import { isOpenEventAvailable } from '../lib/duelExpiry.ts';
import { LocateFixed } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import type { UseSupabaseUserReturn } from '../hooks/useSupabaseUser';
import { createDuel } from '../db/createDuel';
import { getNearbyDuels } from '../db/getNearbyDuels';
import { joinDuel } from '../db/joinDuel';
import { getTopGhostRuns } from '../db/getTopGhostRuns';
import { submitDuelResult, type DuelMetrics } from '../db/submitDuelResult';
import { readyForDuel } from '../db/readyForDuel';
import BottomNav from '../components/ui/BottomNav';
import { BottomSheet } from '../components/ui/BottomSheet';
import { LeaderboardSheet } from '../components/leaderboard/Sheet';
import { leaderboardSourceLabel, type LeaderboardSource } from '../lib/leaderboardProvenance';
import ArcadeMapChrome, { type ArcadeMapEntry, type ArcadeMapView } from '../components/map/ArcadeMapChrome';
import { parseGeographyPoint } from '../lib/duelLocation';
import { duelRealtimeRow, createDuelRealtimeLifetime } from '../lib/duelRealtime';
import { createDuelRecoveryQueue, isCurrentRecovery } from '../lib/duelRecovery';
import { reconcileOpenRaces } from '../lib/reconcileOpenRaces';
import { cancelHostedOpenDuel, cancelHostedDuelMessage, listHostedOpenDuels, type HostedOpenDuel } from '../db/cancelHostedDuel';
import { abortMatchedDuel } from '../db/abortMatchedDuel';
import { readActiveDuelId, rememberActiveDuelId, forgetActiveDuelId } from '../lib/activeDuelStorage';
import { LiveStepPeakCounter } from '../lib/liveStepPeaks';
import { readPendingFinish, rememberPendingFinish, forgetPendingFinish, type PendingFinish } from '../lib/pendingDuelFinish.ts';
import { DuelMotionCapture, requestDuelMotionPermission, motionEventSample } from '../lib/duelMotionEvidence';
import { createDuelGpsMeasurement, advanceDuelGpsMeasurement, duelGpsMetrics } from '../lib/duelGpsMeasurement';
import { useScreenWakeLock } from '../hooks/useScreenWakeLock';
import { screenWakeLockMessage, type ScreenWakeLockStatus } from '../lib/screenWakeLock';
import { canHostAt, HOST_PLACEMENT_RADIUS_METERS, mapDistanceMeters } from '../lib/mapHostPlacement';
import type { HotspotTestCity } from '../lib/mapHotspotSignals';
import ReadyLobby from '../components/race/ReadyLobby';
import RaceCountdown, { ARCADE_COUNTDOWN_SECONDS } from '../components/race/RaceCountdown';
import DuelFinishScreen from '../components/race/DuelFinishScreen';
import { unlockRaceAudio, setRaceAudioMuted } from '../lib/arcadeRaceAudio';
import '../styles/raceArcade.css';

// Types
type Coordinates = {
  lat: number;
  lng: number;
  // Browser-reported GPS accuracy & freshness; never sourced from IP position.
  accuracyMeters?: number;
  sampledAtMs?: number;
};

type Player = {
  id: string;
  username: string;
  rank: number;
  bestTimeSeconds: number;
  distanceMeters: number;
  location: Coordinates;
  colorHex: string;
  source: LeaderboardSource;
};

type OpenRun = {
  id: string;
  hostUserId?: string;
  hostUsername: string;
  distanceMeters: number;
  location: Coordinates;
  createdAt?: string;
  expiresAt?: string;
  targetDistanceM?: number;
};

type CurrentUser = {
  id: string;
  username: string;
  location?: Coordinates;
};

type MatchedDuelState = {
  id: string;
  hostUserId: string;
  challengerUserId: string;
  targetDistanceM: number;
  hostReady: boolean;
  challengerReady: boolean;
  startAt: string | null;
};

// German translations for Runnit
type TranslationDict = Record<string, string>;
const de: TranslationDict = {
  'buttons.ghostRun': 'Rangliste',
  'buttons.hostRun': 'Rennen erstellen',
  'buttons.cancel': 'Abbrechen',
  'buttons.joinRun': 'Rennen beitreten',

  'leaderboard.title': 'Top 100 in deiner Stadt',
  'leaderboard.rank': 'Rang',
  'leaderboard.username': 'Name',
  'leaderboard.bestTime': 'Beste Zeit',
  'leaderboard.distance': 'Distanz',
  'leaderboard.you': 'Du',

  'host.title': '🏃‍♂️ Neues Sprint-Rennen',
  'host.distanceLabel': 'Renndistanz',
  'host.selectDistance': 'Distanz wählen',
  'host.distance.50': '50 m Sprint',
  'host.distance.75': '75 m Sprint',
  'host.distance.100': '100 m Sprint',
};

function useI18n() {
  const t = (key: string): string => {
    return de[key] ?? key;
  };
  return { t };
}

// Geolocation errors are different: denied (1), unavailable (2), timeout (3).
// Do not infer a denial solely from the Permissions API: mobile browsers can
// report an out-of-date permission state after a setting changes.
type LocationError = 'denied' | 'unavailable' | 'timeout' | null;

function useUserLocation() {
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [locationError, setLocationError] = useState<LocationError>(null);
  const [locating, setLocating] = useState(false);
  const [insecureContext, setInsecureContext] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  const onSuccess = React.useCallback((pos: GeolocationPosition) => {
    setCoords({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracyMeters: pos.coords.accuracy,
      sampledAtMs: pos.timestamp,
    });
    setLocationError(null);
    setLocating(false);
  }, []);

  const onError = React.useCallback((err: GeolocationPositionError) => {
    // Use numeric error codes documented by the Geolocation API; relying on
    // instance constants like err.PERMISSION_DENIED is not cross-browser safe.
    switch (err.code) {
      case 1:
        setCoords(null);
        setLocationError('denied');
        break;
      case 2:
        setLocationError('unavailable');
        break;
      case 3:
        setLocationError('timeout');
        break;
      default:
        setLocationError('unavailable');
    }
    setLocating(false);
  }, []);

  const stopWatch = React.useCallback(() => {
    if (watchIdRef.current === null || !navigator.geolocation) return;
    navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
  }, []);

  const requestOnce = React.useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!navigator.geolocation) {
      setUnsupported(true);
      setLocating(false);
      return;
    }
    if (!window.isSecureContext) {
      setInsecureContext(true);
      setLocating(false);
      return;
    }

    // One active watch at a time. A manual retry is a fresh request, which
    // allows Safari to reevaluate permissions changed in iOS Settings.
    stopWatch();
    setLocationError(null);
    setLocating(true);
    try {
      watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 20000,
      });
    } catch {
      setLocationError('unavailable');
      setLocating(false);
    }
  }, [onSuccess, onError, stopWatch]);

  useEffect(() => {
    requestOnce();
    return stopWatch;
  }, [requestOnce, stopWatch]);

  return { coords, locationError, locating, requestOnce, insecureContext, unsupported };
}

// Utility: format seconds to 0.00s string
function formatSecondsToTimeString(seconds: number): string {
  return `${seconds.toFixed(2)}s`;
}

// Utility: convert hsl() to hex via canvas (ensures stable colorHex)
function colorToHex(hsl: string): string {
  if (typeof document === 'undefined') return '#2563eb';
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return '#2563eb';
  ctx.fillStyle = hsl as any;
  const rgb = ctx.fillStyle as unknown as string; // now in rgb(a)
  const match = /rgb[a]?\((\d+),\s*(\d+),\s*(\d+)/i.exec(rgb);
  if (!match) return '#2563eb';
  const r = parseInt(match[1], 10);
  const g = parseInt(match[2], 10);
  const b = parseInt(match[3], 10);
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Deterministic username color
function hashStringToHsl(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 70% 45%)`;
}

function colorForUsernameToHex(username: string): string {
  return colorToHex(hashStringToHsl(username || 'runner'));
}

// Avatar component (initials circle)
function Avatar({ name, colorHex }: { name: string; colorHex: string }) {
  const initials = useMemo(() => {
    const parts = name.split(/[^a-zA-Z0-9]+/).filter(Boolean);
    const first = parts[0]?.[0]?.toUpperCase() ?? 'R';
    const second = parts[1]?.[0]?.toUpperCase() ?? '';
    return `${first}${second}` || first;
  }, [name]);
  return (
    <div
      className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
      style={{ backgroundColor: colorHex }}
      aria-hidden
    >
      {initials}
    </div>
  );
}

// Stable demo data generators using seed-based randomness
function seededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return function() {
    hash = ((hash * 9301) + 49297) % 233280;
    return hash / 233280;
  };
}

// Generate stable demo data once
const generateNationalPlayers = (() => {
  let cached: Player[] | null = null;
  return () => {
    if (cached) return cached;
    const rng = seededRandom('national-germany-leaderboard');
    cached = Array.from({ length: 50 }, (_, i) => ({
      id: `national-${i}`,
      username: `GermanRunner${String(i + 1).padStart(2, '0')}`,
      rank: i + 1,
      bestTimeSeconds: 8.5 + (i * 0.3) + (rng() * 0.5),
      distanceMeters: 100,
      location: { lat: 52.5 + (rng() - 0.5) * 2, lng: 13.4 + (rng() - 0.5) * 2 },
      colorHex: colorForUsernameToHex(`GermanRunner${String(i + 1).padStart(2, '0')}`),
      source: 'demo' as const,
    }));
    return cached;
  };
})();

const generateInternationalPlayers = (() => {
  let cached: Player[] | null = null;
  return () => {
    if (cached) return cached;
    const rng = seededRandom('international-world-leaderboard');
    cached = Array.from({ length: 100 }, (_, i) => ({
      id: `international-${i}`,
      username: `WorldRunner${String(i + 1).padStart(3, '0')}`,
      rank: i + 1,
      bestTimeSeconds: 7.8 + (i * 0.2) + (rng() * 0.3),
      distanceMeters: 100,
      location: { lat: rng() * 180 - 90, lng: rng() * 360 - 180 },
      colorHex: colorForUsernameToHex(`WorldRunner${String(i + 1).padStart(3, '0')}`),
      source: 'demo' as const,
    }));
    return cached;
  };
})();

// Enhanced Leaderboard Modal with City/National/International tabs
function GhostLeaderboardModal({
  open,
  onClose,
  players,
  currentUser,
  cityName,
}: {
  open: boolean;
  onClose: () => void;
  players: Player[];
  currentUser: CurrentUser | null;
  cityName: string | null;
}) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'city' | 'national' | 'international'>('city');
  const [nationalPlayers, setNationalPlayers] = useState<Player[]>([]);
  const [internationalPlayers, setInternationalPlayers] = useState<Player[]>([]);

  // Load stable demo data for national and international leaderboards
  useEffect(() => {
    if (!open) return;
    
    // Use stable generators
    setNationalPlayers(generateNationalPlayers());
    setInternationalPlayers(generateInternationalPlayers());
  }, [open]);

  if (!open) return null;

  const getCurrentPlayers = () => {
    switch (activeTab) {
      case 'city': return players;
      case 'national': return nationalPlayers;
      case 'international': return internationalPlayers;
      default: return players;
    }
  };

  const getTitle = () => {
    switch (activeTab) {
      case 'city': return `🏙️ ${cityName || 'Deine Stadt'}`;
      case 'national': return '🇩🇪 Deutschland';
      case 'international': return '🌍 International';
      default: return 'Leaderboard';
    }
  };

  return (
    <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-[#050611]/75 backdrop-blur-[4px]">
      <div className="w-full max-w-md rounded-t-[30px] border border-violet-300/20 bg-[#101322] p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-white shadow-[0_-25px_80px_rgba(0,0,0,.5)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-extrabold tracking-tight text-white">{getTitle()}</h2>
          <button
            onClick={onClose}
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-bold text-white/70 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            aria-label="Close leaderboard"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="mb-4 flex items-center gap-1 rounded-lg bg-white/5 p-1">
          <button
            onClick={() => setActiveTab('city')}
            className={`flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === 'city'
                ? 'bg-indigo-600 text-white'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            🏙️ Stadt
          </button>
          <button
            onClick={() => setActiveTab('national')}
            className={`flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === 'national'
                ? 'bg-indigo-600 text-white'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            🇩🇪 National
          </button>
          <button
            onClick={() => setActiveTab('international')}
            className={`flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === 'international'
                ? 'bg-indigo-600 text-white'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            🌍 International
          </button>
        </div>

        <p className="mb-3 rounded-lg border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-100">Keine offiziell verifizierten Ergebnisse: Beispieldaten sind erfunden und gespeicherte Laufzeiten nicht geprüft.</p>
        <div className="mb-2 grid grid-cols-12 gap-2 px-1 text-[11px] uppercase tracking-wide text-white/60">
          <div className="col-span-2">Rang</div>
          <div className="col-span-5">Name</div>
          <div className="col-span-3">Zeit</div>
          <div className="col-span-2 text-right">Distanz</div>
        </div>
        <div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
          {getCurrentPlayers().slice(0, 100).map((p) => (
            <div
              key={p.id}
              className={`grid grid-cols-12 items-center gap-2 rounded-lg p-2 ring-1 ${
                p.rank === 1
                  ? 'bg-yellow-600/20 ring-yellow-500/30'
                  : p.rank === 2
                  ? 'bg-gray-400/20 ring-gray-400/30'
                  : p.rank === 3
                  ? 'bg-orange-600/20 ring-orange-500/30'
                  : 'bg-white/5 ring-white/5'
              }`}
            >
              <div className="col-span-2 text-sm font-semibold text-white/90">
                #{p.rank}
              </div>
              <div className="col-span-5 flex items-center gap-2 text-sm text-white">
                <Avatar name={p.username} colorHex={p.colorHex} />
                <span className="min-w-0"><span className="block truncate">{p.username}</span><span className="block text-[10px] text-amber-200">{leaderboardSourceLabel(p.source)}</span></span>
              </div>
              <div className="col-span-3 text-sm text-white/90">
                {formatSecondsToTimeString(p.bestTimeSeconds)}
              </div>
              <div className="col-span-2 text-right text-sm text-white/60">{p.distanceMeters}m</div>
            </div>
          ))}
        </div>
        {currentUser ? (
          <div className="sticky bottom-0 mt-3 rounded-lg bg-[#111113] p-3 ring-1 ring-white/10">
            <div className="mb-1 text-[10px] uppercase tracking-wide text-white/50">Du</div>
            <div className="grid grid-cols-12 items-center gap-2">
              <div className="col-span-2 text-sm font-semibold text-white/90">—</div>
              <div className="col-span-5 flex items-center gap-2 text-sm text-white">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                  {currentUser.username[0]?.toUpperCase() || 'Y'}
                </div>
                <span className="truncate">{currentUser.username}</span>
              </div>
              <div className="col-span-3 text-sm text-white/90">—</div>
              <div className="col-span-2 text-right text-sm text-white/60">—</div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Host Run Dialog
function HostRunDialog({
  open,
  onClose,
  onHost,
  onDemo,
  defaultDistance,
  selectedLocationDistance,
}: {
  open: boolean;
  onClose: () => void;
  onHost: (distanceMeters: number) => Promise<void>;
  onDemo: () => void;
  defaultDistance?: number;
  selectedLocationDistance?: number;
}) {
  const { t } = useI18n();
  const [distance, setDistance] = useState<number>(defaultDistance ?? 50);
  const [submitting, setSubmitting] = useState(false);
  const [hostError, setHostError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDistance(defaultDistance ?? 50);
      setHostError(null);
    }
  }, [open, defaultDistance]);

  const submitHost = async () => {
    if (submitting) return;
    setSubmitting(true);
    setHostError(null);
    try {
      await onHost(distance);
      onClose();
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error
        ? String(error.code) : '';
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      if (code === '23505' || message.includes('aktives event') || message.includes('aktive challenge')) {
        setHostError('Du hast bereits ein aktives Event. Beende oder storniere es, bevor du ein neues erstellst.');
      } else if (code === '42501' || message.includes('row-level security') || message.includes('permission denied')) {
        setHostError('Du hast derzeit keine Berechtigung, ein Rennen zu speichern. Bitte melde dich erneut an.');
      } else if (message.includes('außerhalb') || message.includes('gps-standort')) {
        setHostError(error instanceof Error ? error.message : 'Standort nicht mehr verfügbar.');
      } else if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
        setHostError('Keine Verbindung zur Datenbank. Bitte prüfe deine Internetverbindung und versuche es erneut.');
      } else {
        setHostError('Das Rennen konnte nicht gespeichert werden. Bitte versuche es erneut.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;
  return (
    <div className="runnit-host-setup-backdrop" role="presentation">
      <section className="runnit-host-setup-panel" role="dialog" aria-modal="true" aria-labelledby="runnit-host-setup-title">
        <header className="runnit-host-setup-top">
          <span className="runnit-host-setup-eyebrow">RUNNIT // STREET CHALLENGE</span>
          <button type="button" onClick={onClose} disabled={submitting}
            className="runnit-host-setup-close" aria-label="Rennen-Dialog schließen">✕</button>
          <h2 id="runnit-host-setup-title">1V1 <span>DUELL</span></h2>
          <p>SETZE DEINE CHALLENGE</p>
        </header>
        {selectedLocationDistance !== undefined && (
          <div className="runnit-host-setup-location">
            <span className="runnit-host-setup-beacon" aria-hidden="true" />
            STARTPUNKT FIXIERT <span>· {Math.round(selectedLocationDistance)} M ENTFERNT</span>
          </div>
        )}
        <div className="runnit-host-setup-section">
          <div className="runnit-host-setup-heading">
            <label id="runnit-host-distance-label">{t('host.distanceLabel').toUpperCase()}</label>
            <small>01 / DISTANZ</small>
          </div>
          <div className="runnit-host-setup-distances" role="group" aria-labelledby="runnit-host-distance-label">
            {[50, 75, 100].map(value => (
              <button type="button" key={value} disabled={submitting}
                aria-pressed={distance === value}
                className={distance === value ? 'is-selected' : ''}
                onClick={() => setDistance(value)}>
                <strong>{value}</strong><span>M</span>
              </button>
            ))}
          </div>
          <p className="runnit-host-setup-note">OFFENE CHALLENGE · 60 MINUTEN ZEIT FÜR EINEN GEGNER. NUR EIN AKTIVES EVENT PRO USER.</p>
        </div>
        {hostError && <p role="alert" className="runnit-host-setup-error">{hostError}</p>}
        <button type="button" className="runnit-host-setup-create" onClick={() => { void submitHost(); }}
          disabled={submitting}>{submitting ? 'RENNEN WIRD GESPEICHERT …' : 'CHALLENGE ERSTELLEN  ›'}</button>
        <div className="runnit-host-setup-bottom">
          <button type="button" onClick={onClose} disabled={submitting}>ABBRECHEN</button>
          <button type="button" onClick={onDemo} disabled={submitting}>SIMULATION TESTEN ↗</button>
        </div>
      </section>
    </div>
  );
}

// Authentication modal (email/password)
function AuthModal({
  open,
  onClose,
  mode,
  setMode,
  user,
  onSignIn,
  onSignUp,
  onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  mode: 'signin' | 'signup';
  setMode: (m: 'signin' | 'signup') => void;
  user: { id: string; email?: string } | null;
  onSignIn: (email: string, password: string) => Promise<unknown>;
  onSignUp: (email: string, password: string) => Promise<unknown>;
  onSignOut: () => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async () => {
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      if (mode === 'signin') {
        await onSignIn(email, password);
        onClose();
      } else {
        const result: any = await onSignUp(email, password);
        const hasSession = Boolean(result?.session);
        const hasUser = Boolean(result?.user);
        if (hasSession) {
          onClose();
        } else if (hasUser) {
          setInfo('Account created. Please confirm your email, then sign in.');
          // Switch to sign-in so user can log in after confirming
          setMode('signin');
        } else {
          setInfo('If you did not receive a confirmation email, check spam or retry.');
        }
      }
    } catch (e: any) {
      const msg = String(e?.message || '').toLowerCase();
      if (mode === 'signin' && (msg.includes('invalid') || msg.includes('invalid login credentials'))) {
        setError('E-Mail oder Passwort ist falsch.');
      } else if (mode === 'signin' && msg.includes('email not confirmed')) {
        setError('E-Mail noch nicht bestätigt. Bitte bestätige zuerst deine E-Mail.');
      } else if (mode === 'signup' && msg.includes('password')) {
        setError('Passwortanforderungen nicht erfüllt.');
      } else {
        setError(e?.message || 'Authentication failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    setSubmitting(true);
    try {
      await onSignOut();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Sign out failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-[#050611]/75 backdrop-blur-[4px]">
      <div className="w-full max-w-md rounded-t-[30px] border border-violet-300/20 bg-[#101322] p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-white shadow-[0_-25px_80px_rgba(0,0,0,.5)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-extrabold tracking-tight text-white">
            {user ? 'Account' : mode === 'signin' ? 'Sign in' : 'Sign up'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-bold text-white/70 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            aria-label="Anmeldung schließen"
          >
            ✕
          </button>
        </div>

        {user ? (
          <div className="space-y-4">
            <div className="text-sm text-white/80">Signed in as {user.email || 'user'}</div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={handleSignOut}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-bold text-white/75 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                disabled={submitting}
              >
                Abmelden
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs">
              <button
                className={`rounded-md px-2 py-1 font-medium ${mode === 'signin' ? 'bg-indigo-600 text-white' : 'bg-white/10 text-white/80'} `}
                onClick={() => setMode('signin')}
              >
                Anmelden
              </button>
              <button
                className={`rounded-md px-2 py-1 font-medium ${mode === 'signup' ? 'bg-indigo-600 text-white' : 'bg-white/10 text-white/80'} `}
                onClick={() => setMode('signup')}
              >
                Registrieren
              </button>
            </div>

            <div className="space-y-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full rounded-xl border border-white/15 bg-[#161a2b] p-4 text-white outline-none placeholder:text-white/35 focus:ring-2 focus:ring-violet-400"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full rounded-xl border border-white/15 bg-[#161a2b] p-4 text-white outline-none placeholder:text-white/35 focus:ring-2 focus:ring-violet-400"
              />
            </div>

            {error ? <div className="text-sm text-rose-400">{error}</div> : null}
            {info ? <div className="text-sm text-emerald-400">{info}</div> : null}

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-bold text-white/75 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSubmit}
                className="rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 px-5 py-3 text-sm font-extrabold text-white shadow-[0_12px_28px_rgba(99,102,241,.20)] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                disabled={submitting || !email || !password}
              >
                {mode === 'signin' ? 'Anmelden' : 'Konto erstellen'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Main Screen
export default function MapScreen({ auth }: { auth: UseSupabaseUserReturn }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { coords: userCoords, locationError, locating, requestOnce, insecureContext, unsupported } = useUserLocation();
  const liveUserCoordsRef = useRef(userCoords);
  liveUserCoordsRef.current = userCoords;
  const { user: authUser, signIn, signUp, signOut } = auth;

  // Neutral global overview when neither permission nor network IP lookup succeeds.
  // Do not suggest a real user location without a valid location fix.
  const defaultCenter = useMemo<Coordinates>(() => ({ lat: 22, lng: 0 }), []);
  const [ipCoords, setIpCoords] = useState<Coordinates | null>(null);
  const [recenterTick, setRecenterTick] = useState(0);
  const center = userCoords ?? ipCoords ?? defaultCenter;
  const initialZoom = userCoords ? 14 : ipCoords ? 12 : 2;
  // CARTO returns watermarked tiles without an API key (HTTP success), so
  // tileerror never fires. Use the OSM standard style for our small beta.
  const [tileRetryCount, setTileRetryCount] = useState(0);
  const [mapTilesUnavailable, setMapTilesUnavailable] = useState(false);

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [ghostOpen, setGhostOpen] = useState(false);
  const [hostOpen, setHostOpen] = useState(false);
  const [hostLocation, setHostLocation] = useState<Coordinates | null>(null);
  const [raceNotice, setRaceNotice] = useState<string | null>(null);
  // Only genuine user actions create a notice; dismiss automatically so a
  // previous warning cannot cover the next long-press dialog indefinitely.
  useEffect(() => {
    if (!raceNotice) return;
    const id = window.setTimeout(() => setRaceNotice(null), 4200);
    return () => window.clearTimeout(id);
  }, [raceNotice]);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [cityName, setCityName] = useState<string | null>(null);

  const [players, setPlayers] = useState<Player[]>([]);
  const [openRuns, setOpenRuns] = useState<OpenRun[]>([]);
  const [regionalRuns, setRegionalRuns] = useState<Array<{ id: string; location: Coordinates; expiresAt?: string }>>([]);
  const [wideMapView, setWideMapView] = useState(false);
  // The synthetic load test is opt-in via ?hotspotDemo=1, off for all normal
  // visitors. No synthetic race/player/match is persisted or queried.
  const hotspotTestAvailable = typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('hotspotDemo') === '1';
  const [hotspotDemoEnabled, setHotspotDemoEnabled] = useState(hotspotTestAvailable);
  // The map stays visible by default. An explicit chip opens this test-only HUD.
  const [hotspotLabExpanded, setHotspotLabExpanded] = useState(false);
  const [hotspotFocus, setHotspotFocus] = useState<{ city: HotspotTestCity; tick: number }>({ city: 'all', tick: 0 });
  const [mapCamera, setMapCamera] = useState({ zoom: initialZoom, lat: center.lat, lng: center.lng });
  // The ranking screen's RENNEN dock link opens the existing race list.
  // Creating/starting a race still requires the same account and GPS checks.
  const [arcadeMapView, setArcadeMapView] = useState<ArcadeMapView>(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('view') === 'list'
      ? 'list' : 'map');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  // Own live lobby is visible even when its map popup is closed or GPS changes.
  const [hostedOpenDuels, setHostedOpenDuels] = useState<HostedOpenDuel[]>([]);
  const [hostedDuelsLoadError, setHostedDuelsLoadError] = useState(false);
  const [cancelConfirmation, setCancelConfirmation] = useState<HostedOpenDuel | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancellingRunId, setCancellingRunId] = useState<string | null>(null);
  const [, setLoadingGhosts] = useState(false);
  const [loadingDuels, setLoadingDuels] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const discoveryLoadedRef = useRef(false);
  const [discoveryCoords, setDiscoveryCoords] = useState<Coordinates | null>(null);
  const [discoveryRefreshTick, setDiscoveryRefreshTick] = useState(0);
  const [finishSubmissionError, setFinishSubmissionError] = useState<string | null>(null);
  const latestFinishPayloadRef = useRef<PendingFinish | null>(null);
  const finishSubmittingRef = useRef<PendingFinish | null>(null);
  const duelWriteGate = useRef(createDuelWriteGate());
  // App keys this screen by account. Retire the old instance synchronously
  // during unmount, even before passive subscription cleanup runs.
  const finishAccountRef = useRef<string | null>(authUser?.id ?? null);
  React.useLayoutEffect(() => {
    finishAccountRef.current = authUser?.id ?? null;
    return () => { finishAccountRef.current = null; };
  }, [authUser?.id]);
  const [matchOverlay, setMatchOverlay] = useState<{ duelId: string; startsAt: number; targetDistanceM: number } | null>(null);
  const [matchedDuel, setMatchedDuel] = useState<MatchedDuelState | null>(null);
  const [dismissedMatchId, setDismissedMatchId] = useState<string | null>(null);
  const [readyBusy, setReadyBusy] = useState(false);
  const [readyError, setReadyError] = useState<string | null>(null);
  const [raceSoundEnabled, setRaceSoundEnabled] = useState(true);
  useEffect(() => { setRaceAudioMuted(!raceSoundEnabled); }, [raceSoundEnabled]);
  const [matchedNames, setMatchedNames] = useState<Record<string, string>>({});
  const joiningRunRef = useRef<string | null>(null);
  const matchStartHandledRef = useRef<string | null>(null);
  // Keep the server-confirmed duel ID even after READY hides its lobby.
  const activeDuelIdRef = useRef<string | null>(null);
  const recoveryRevisionRef = useRef(0);
  // Ignore late Realtime/poll responses for duels confirmed as terminated.
  const endedDuelIdsRef = useRef<Set<string>>(new Set());
  const [race, setRace] = useState<
    | { status: 'idle' }
    | { status: 'countdown'; duelId: string; startsAt: number; targetDistanceM: number }
    | { status: 'running'; duelId: string; startedAt: number; targetDistanceM: number }
    | { status: 'finished'; duelId: string; startedAt: number; endedAt: number; targetDistanceM: number }
  >({ status: 'idle' });
  // Browser motion and GPS callbacks can be suspended when iOS locks the screen.
  // Keep it awake for the entire countdown and race, not just the step sampler.
  const wakeStatus = useScreenWakeLock(Boolean(matchOverlay) || race.status === 'countdown' || race.status === 'running');

  const clearAbortedDuel = React.useCallback((duelId: string, remote: boolean) => {
    if (!authUser || finishAccountRef.current !== authUser.id || activeDuelIdRef.current !== duelId) return;
    recoveryRevisionRef.current += 1;
    endedDuelIdsRef.current.add(duelId);
    activeDuelIdRef.current = null;
    if (authUser) {
      forgetActiveDuelId(authUser.id, duelId);
      forgetPendingFinish(authUser.id, duelId);
    }
    if (latestFinishPayloadRef.current?.duelId === duelId) latestFinishPayloadRef.current = null;
    setFinishSubmissionError(null);
    matchStartHandledRef.current = null;
    setMatchOverlay(previous => previous?.duelId === duelId ? null : previous);
    setMatchedDuel(previous => previous?.id === duelId ? null : previous);
    setRace(previous => previous.status !== 'idle' && previous.duelId === duelId
      ? { status: 'idle' } : previous);
    setDismissedMatchId(null);
    setReadyError(null);
    setCancelError(null);
    setCancelConfirmation(previous => previous?.id === duelId ? null : previous);
    setOpenRuns(previous => previous.filter(run => run.id !== duelId));
    setHostedOpenDuels(previous => previous.filter(run => run.id !== duelId));
    setRaceNotice(remote
      ? 'Dein Gegner hat das Duell abgebrochen. Du kannst wieder ein Rennen starten.'
      : 'Duell für beide Spieler abgebrochen. Du kannst ein neues Rennen starten.');
    setDiscoveryRefreshTick(tick => tick + 1);
  }, [authUser?.id]);

  // Once the server confirms completed, both participants must see their
  // results. Do not mark the race as seen until THIS phone closes the overlay.
  const showCompletedDuel = React.useCallback((row: any) => {
    if (!authUser || finishAccountRef.current !== authUser.id || row?.status !== 'completed' || typeof row.id !== 'string' ||
        endedDuelIdsRef.current.has(row.id) ||
        (row.host_user_id !== authUser.id && row.challenger_user_id !== authUser.id)) return;
    const active = activeDuelIdRef.current;
    if (active && active !== row.id) return;
    recoveryRevisionRef.current += 1;
    activeDuelIdRef.current = row.id;
    rememberActiveDuelId(authUser.id, row.id);
    forgetPendingFinish(authUser.id, row.id);
    if (latestFinishPayloadRef.current?.duelId === row.id) latestFinishPayloadRef.current = null;
    setFinishSubmissionError(null);
    setMatchOverlay(previous => previous?.duelId === row.id ? null : previous);
    setMatchedDuel(previous => previous?.id === row.id ? null : previous);
    setDismissedMatchId(null);
    const start = typeof row.start_at === 'string' ? Date.parse(row.start_at) : NaN;
    const startedAt = Number.isFinite(start) ? start : Date.now();
    const targetDistanceM = Number(row.target_distance_m) > 0 ? Number(row.target_distance_m) : 50;
    setRace(previous => previous.status === 'finished' && previous.duelId === row.id
      ? previous : { status: 'finished', duelId: row.id, startedAt,
        endedAt: Date.now(), targetDistanceM });
  }, [authUser?.id]);

  const closeCompletedDuel = React.useCallback((duelId: string) => {
    if (!authUser || finishAccountRef.current !== authUser.id) return;
    recoveryRevisionRef.current += 1;
    endedDuelIdsRef.current.add(duelId);
    if (activeDuelIdRef.current === duelId) activeDuelIdRef.current = null;
    if (authUser) {
      forgetActiveDuelId(authUser.id, duelId);
      forgetPendingFinish(authUser.id, duelId);
    }
    matchStartHandledRef.current = null;
    if (latestFinishPayloadRef.current?.duelId === duelId) latestFinishPayloadRef.current = null;
    setFinishSubmissionError(null);
    setMatchOverlay(previous => previous?.duelId === duelId ? null : previous);
    setMatchedDuel(previous => previous?.id === duelId ? null : previous);
    setDismissedMatchId(null);
    setRace(previous => previous.status !== 'idle' && previous.duelId === duelId
      ? { status: 'idle' } : previous);
    setOpenRuns(previous => previous.filter(run => run.id !== duelId));
    setHostedOpenDuels(previous => previous.filter(run => run.id !== duelId));
    setDiscoveryRefreshTick(tick => tick + 1);
  }, [authUser?.id]);

  // A DB-confirmed match is authoritative. Realtime, a join response and
  // foreground recovery all use this same idempotent transition.
  const applyMatchedDuel = React.useCallback((row: any) => {
    if (!authUser || finishAccountRef.current !== authUser.id || row?.status !== 'matched' || typeof row.id !== 'string' ||
        endedDuelIdsRef.current.has(row.id) ||
        (row.host_user_id !== authUser.id && row.challenger_user_id !== authUser.id)) return;
    recoveryRevisionRef.current += 1;
    activeDuelIdRef.current = row.id;
    rememberActiveDuelId(authUser.id, row.id);
    setOpenRuns(previous => previous.filter(run => run.id !== row.id));
    setHostedOpenDuels(previous => previous.filter(run => run.id !== row.id));
    setCancelConfirmation(previous => previous?.id === row.id ? null : previous);
    setSelectedRunId(previous => previous === row.id ? null : previous);
    const targetDistanceM = Number(row.target_distance_m) > 0 ? Number(row.target_distance_m) : 50;
    const startAt = typeof row.start_at === 'string' ? row.start_at : null;
    if (startAt) {
      const serverStart = Date.parse(startAt);
      const key = row.id + ':' + startAt;
      // A recorded finish takes precedence over restarting an old countdown.
      // Only restore after the server confirms this account and duel are matched.
      const current = latestFinishPayloadRef.current;
      if (current?.userId === authUser.id && current.duelId === row.id) return;
      const pending = readPendingFinish(authUser.id, row.id);
      if (pending && Number.isFinite(serverStart) && serverStart === pending.startedAt &&
          pending.targetDistanceM === targetDistanceM) {
        latestFinishPayloadRef.current = pending;
        matchStartHandledRef.current = key;
        setMatchedDuel(null);
        setMatchOverlay(null);
        setFinishSubmissionError('Zielzeit lokal wiederhergestellt. Falls sie noch fehlt, erneut speichern.');
        setRace({ status: 'finished', duelId: row.id, startedAt: pending.startedAt,
          endedAt: pending.startedAt + pending.timeMs, targetDistanceM });
        return;
      }
      if (Number.isFinite(serverStart) && serverStart > Date.now() - 10_000 &&
          matchStartHandledRef.current !== key) {
        matchStartHandledRef.current = key;
        const startsAt = serverStart; // exact DB timestamp; late devices catch up instead of shifting GO
        setMatchedDuel(null);
        setMatchOverlay({ duelId: row.id, startsAt, targetDistanceM });
        setRace({ status: 'countdown', duelId: row.id, startsAt, targetDistanceM });
      } else if (matchStartHandledRef.current !== key) {
        // Do not start an hours-old duel from a resumed Safari tab.
        setMatchedDuel({
          id: row.id, hostUserId: row.host_user_id,
          challengerUserId: row.challenger_user_id, targetDistanceM,
          hostReady: Boolean(row.host_ready), challengerReady: Boolean(row.challenger_ready), startAt,
        });
      }
      return;
    }
    setMatchedDuel({
      id: row.id, hostUserId: row.host_user_id,
      challengerUserId: row.challenger_user_id, targetDistanceM,
      hostReady: Boolean(row.host_ready), challengerReady: Boolean(row.challenger_ready), startAt: null,
    });
  }, [authUser?.id]);

  // Display only profile nicknames (never email addresses). Names are optional:
  // the lobby still works when public.users is temporarily unavailable.
  useEffect(() => {
    if (!matchedDuel || !authUser) return;
    let active = true;
    void supabase.from('users').select('id, username')
      .in('id', [matchedDuel.hostUserId, matchedDuel.challengerUserId])
      .then(({ data }) => {
        if (!active) return;
        const resolved: Record<string, string> = {};
        for (const row of data ?? []) {
          if (typeof row.id === 'string' && typeof row.username === 'string' && row.username.trim()) {
            resolved[row.id] = row.username.trim().slice(0, 36);
          }
        }
        setMatchedNames(resolved);
      });
    return () => { active = false; };
  }, [matchedDuel?.id, authUser?.id]);

  // Derive current user display - Demo mode with generated user
  useEffect(() => {
    if (authUser) {
      // Use the account's editable nickname, not the private email address.
      setCurrentUser({ id: authUser.id, username: authUser.displayName });
    } else {
      // Demo mode: create a demo user for testing
      const demoUserId = 'demo-user-' + Math.random().toString(36).substr(2, 9);
      const demoUsername = 'Runner' + Math.floor(Math.random() * 999).toString().padStart(3, '0');
      setCurrentUser({ id: demoUserId, username: demoUsername });
    }
  }, [authUser]);

  // Normal map renders only verified activity. The opt-in Hotspot Lab
  // has its own isolated synthetic source and never populates players.
  // Leaderboard rows without verified geographic proof stay off the map.
  useEffect(() => {
    if (!authUser) {
      setPlayers([]);
      setLoadingGhosts(false);
      return;
    }
    let isActive = true;
    const city = cityName || 'Berlin';
    (async () => {
      if (!isActive) return;
      setLoadingGhosts(true);
      try {
        // Try to load from database first
        const { data: ghostRows, error } = await getTopGhostRuns(supabase, city);
        if (!isActive) return;
        
        let newPlayers: Player[] = [];
        
        // If database has data, use it
        if (!error && ghostRows && ghostRows.length > 0) {
          newPlayers = (ghostRows || []).map((r: any, idx: number) => {
            const username: string = r.username || `runner${String(idx + 1).padStart(2, '0')}`;
            const lat = typeof r.user_lat === 'number' ? r.user_lat : center.lat;
            const lng = typeof r.user_lng === 'number' ? r.user_lng : center.lng;
            return {
              id: r.id,
              username,
              rank: idx + 1,
              bestTimeSeconds: (r.time_ms ?? 0) / 1000,
              distanceMeters: 100,
              location: { lat, lng },
              colorHex: colorForUsernameToHex(username),
              source: 'server-unverified',
            } as Player;
          });
        }
        // No invented users on the real map if the request is empty or fails.
        
        if (!isActive) return;
        setPlayers(newPlayers);
      } finally {
        if (isActive) setLoadingGhosts(false);
      }
    })();
    return () => {
      isActive = false;
    };
  }, [cityName, authUser?.id]);

  // Fetch approximate IP-based location when precise location is unavailable
  useEffect(() => {
    let cancelled = false;
    if (userCoords || ipCoords || typeof window === 'undefined') return;
    (async () => {
      try {
        const res = await fetch('https://ipapi.co/json/', { headers: { Accept: 'application/json' } });
        if (!res.ok) return;
        const json = await res.json();
        const lat = typeof json?.latitude === 'number' ? json.latitude : Number(json?.latitude);
        const lng = typeof json?.longitude === 'number' ? json.longitude : Number(json?.longitude);
        if (!cancelled && Number.isFinite(lat) && Number.isFinite(lng)) {
          setIpCoords({ lat, lng });
        }
      } catch (_e) {
        // ignore network failures
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userCoords, ipCoords]);

  // Reverse geocode city from user location with simple throttle
  const lastGeocodeRef = useRef<{ lat: number; lng: number; city: string | null; at: number } | null>(null);
  useEffect(() => {
    if (!userCoords) {
      setCityName(null);
      return;
    }
    const now = Date.now();
    const previous = lastGeocodeRef.current;
    const distanceMoved = previous
      ? Math.hypot(userCoords.lat - previous.lat, userCoords.lng - previous.lng)
      : Infinity;
    const timeElapsedMs = previous ? now - previous.at : Infinity;

    // Throttle: only geocode if > 500m approx or > 2 minutes passed
    // Rough degree-to-km: ~111km per degree. 0.0045 deg ~ 500m.
    const DEG_THRESHOLD = 0.0045;
    const TIME_THRESHOLD = 2 * 60 * 1000;
    const shouldGeocode = distanceMoved > DEG_THRESHOLD || timeElapsedMs > TIME_THRESHOLD;
    if (!shouldGeocode) return;

    let cancelled = false;
    const { lat, lng } = userCoords;
    (async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(
          lat
        )}&lon=${encodeURIComponent(lng)}&zoom=10&addressdetails=1`;
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error('Reverse geocoding failed');
        const json = await res.json();
        const addr = json?.address || {};
        const detected =
          addr.city ||
          addr.town ||
          addr.village ||
          addr.municipality ||
          addr.county ||
          addr.state ||
          null;
        if (!cancelled) {
          setCityName(detected);
          lastGeocodeRef.current = { lat, lng, city: detected, at: Date.now() };
        }
      } catch (_e) {
        if (!cancelled) {
          setCityName(null);
          lastGeocodeRef.current = { lat, lng, city: null, at: Date.now() };
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userCoords?.lat, userCoords?.lng]);

  // Reverse geocode city from IP-based location if we do not have precise user location
  useEffect(() => {
    if (userCoords || !ipCoords) return;
    let cancelled = false;
    const { lat, lng } = ipCoords;
    (async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&zoom=10&addressdetails=1`;
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error('Reverse geocoding failed');
        const json = await res.json();
        const addr = json?.address || {};
        const detected = addr.city || addr.town || addr.village || addr.municipality || addr.county || addr.state || null;
        if (!cancelled) {
          setCityName(detected);
        }
      } catch (_e) {
        if (!cancelled) {
          // keep current cityName
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userCoords, ipCoords]);

  // GPS can update every second. Nearby discovery should not flicker or
  // reload for ordinary sensor drift; Realtime handles urgent race changes.
  useEffect(() => {
    if (!userCoords) { setDiscoveryCoords(null); return; }
    setDiscoveryCoords(previous => !previous ||
      haversineM(previous.lat, previous.lng, userCoords.lat, userCoords.lng) >= 100
      ? { lat: userCoords.lat, lng: userCoords.lng } : previous);
  }, [userCoords?.lat, userCoords?.lng]);

  useEffect(() => {
    if (!authUser) return;
    const id = window.setInterval(() => setDiscoveryRefreshTick(value => value + 1), 90_000);
    return () => window.clearInterval(id);
  }, [authUser?.id]);

  // Guests have an empty real challenge feed: protected user/duel data stays private.
  // Background refreshes never inject fabricated example races.
  useEffect(() => {
    if (!authUser) {
      discoveryLoadedRef.current = false;
      setOpenRuns([]);
      setLoadingDuels(false);
      return;
    }
    if (!discoveryCoords) {
      setLoadingDuels(false);
      return;
    }
    let isActive = true;
    (async () => {
      if (!discoveryLoadedRef.current) setLoadingDuels(true);
      try {
        const { data, error } = await getNearbyDuels(supabase, { userLocation: discoveryCoords, radiusKm: 5 });
        if (!isActive || error) return; // never replace real races with demo on a network failure

        let mapped: OpenRun[] = [];
        if (data && data.length > 0) {
          const hostIds = Array.from(new Set(data.map((d: any) => d.host_user_id).filter(Boolean)));
          const { data: hostUsers } = await supabase
            .from('users')
            .select('id, username')
            .in('id', hostIds);
          if (!isActive) return;
          const hostById = new Map<string, any>((hostUsers || []).map((u: any) => [u.id, u]));
          mapped = data
            .filter((d: any) => d.status === 'open' &&
              (typeof d.expires_at !== 'string' || isOpenEventAvailable(d.expires_at)))
            .map((d: any) => {
              const location = parseGeographyPoint(d.location);
              if (!location) return null;
              return {
                id: d.id,
                hostUserId: d.host_user_id,
                hostUsername: hostById.get(d.host_user_id)?.username || 'host',
                distanceMeters: d.target_distance_m || (d.max_distance_km ?? 0) * 1000 || 100,
                location,
                createdAt: d.created_at,
                expiresAt: d.expires_at,
                targetDistanceM: d.target_distance_m || undefined,
              } as OpenRun;
            })
            .filter((run): run is OpenRun => run !== null);
        }

        if (isActive) setOpenRuns(previous => reconcileOpenRaces(previous, mapped, authUser.id));
      } finally {
        if (isActive) {
          discoveryLoadedRef.current = true;
          setLoadingDuels(false);
        }
      }
    })();
    return () => { isActive = false; };
  }, [discoveryCoords?.lat, discoveryCoords?.lng, authUser?.id, discoveryRefreshTick]);

  // A regional view must reflect real open challenges, not invented demo
  // accounts or private users. Existing authenticated RLS permits reading
  // open races. We fetch only ID + geometry, never host identity.
  useEffect(() => {
    if (!authUser || !wideMapView) {
      setRegionalRuns([]);
      return;
    }
    let active = true;
    const refresh = async () => {
      const { data, error } = await supabase
        .from('duels')
        .select('id, location, expires_at')
        .eq('status', 'open')
        .gt('expires_at', new Date().toISOString())
        .limit(500);
      if (!active || error) return;
      setRegionalRuns((data ?? []).flatMap(row => {
        const location = parseGeographyPoint(row.location);
        return location ? [{ id: row.id as string, location, expiresAt: row.expires_at as string }] : [];
      }));
    };
    void refresh();
    const id = window.setInterval(() => void refresh(), 90_000);
    return () => { active = false; window.clearInterval(id); };
  }, [authUser?.id, wideMapView]);

  // Fetch only this authenticated host's open, unjoined lobbies. Keep the
  // cancellation action independent from the 5-km map search and Leaflet popup.
  useEffect(() => {
    if (!authUser) {
      setHostedOpenDuels([]);
      setHostedDuelsLoadError(false);
      setCancelConfirmation(null);
      return;
    }
    let active = true;
    void listHostedOpenDuels(supabase, authUser.id)
      .then(runs => {
        if (!active) return;
        setHostedOpenDuels(runs);
        setOpenRuns(previous => {
          const restored: OpenRun[] = runs
            .filter(run => Boolean(run.location))
            .map(run => ({
              id: run.id,
              hostUserId: authUser.id,
              hostUsername: authUser.displayName,
              distanceMeters: run.distanceMeters,
              location: run.location!,
              createdAt: run.createdAt ?? undefined,
              expiresAt: run.expiresAt ?? undefined,
              targetDistanceM: run.distanceMeters,
            }));
          const others = previous.filter(run => run.hostUserId !== authUser.id);
          return [...restored, ...others];
        });
        setHostedDuelsLoadError(false);
      })
      .catch(() => {
        if (!active) return;
        setHostedDuelsLoadError(true);
      });
    return () => { active = false; };
  }, [authUser?.id]);

  // Mobile Safari may suspend Realtime while the tab is hidden or the screen
  // locks. Recover existing confirmed matches on mount, on focus and during
  // a waiting lobby without relying on a missed websocket message.
  useEffect(() => {
    if (!authUser) {
      setMatchedDuel(null);
      setDismissedMatchId(null);
      return;
    }
    let active = true;
    const queue = createDuelRecoveryQueue(async () => {
      const revision = recoveryRevisionRef.current;
      const current = () => isCurrentRecovery(active, finishAccountRef.current, authUser.id,
        recoveryRevisionRef.current, revision);
      if (!current()) return;
      const { data, error } = await supabase.from('duels')
        .select('id, status, host_user_id, challenger_user_id, target_distance_m, host_ready, challenger_ready, start_at')
        .eq('status', 'matched')
        .or(`host_user_id.eq.${authUser.id},challenger_user_id.eq.${authUser.id}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!current() || error) return;
      if (data) {
        applyMatchedDuel(data);
        return;
      }
      // A race already in countdown/running hides the lobby. The active ref
      // remains and must be checked when another iPhone aborts the match.
      const activeId = activeDuelIdRef.current || readActiveDuelId(authUser.id);
      if (activeId) activeDuelIdRef.current = activeId;
      if (!activeId) {
        setMatchedDuel(null);
        return;
      }
      const { data: latest, error: statusError } = await supabase.from('duels')
        .select('id, status, host_user_id, challenger_user_id, start_at, target_distance_m')
        .eq('id', activeId).maybeSingle();
      if (!current() || statusError || activeDuelIdRef.current !== activeId) return;
      // Never infer termination from a missing row or a failed/RLS-hidden read.
      if (latest && (latest.host_user_id !== authUser.id && latest.challenger_user_id !== authUser.id)) return;
      if (latest?.status === 'abandoned') {
        clearAbortedDuel(activeId, true);
      } else if (latest?.status === 'completed') {
        showCompletedDuel(latest);
      }
    });
    const whenVisible = () => {
      if (document.visibilityState === 'visible') {
        queue.request();
        setDiscoveryRefreshTick(tick => tick + 1);
      }
    };
    queue.request();
    const id = window.setInterval(() => { if (document.visibilityState === 'visible') queue.request(); }, 4_000);
    document.addEventListener('visibilitychange', whenVisible);
    window.addEventListener('focus', whenVisible);
    return () => {
      active = false;
      queue.close();
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', whenVisible);
      window.removeEventListener('focus', whenVisible);
    };
  }, [authUser?.id, applyMatchedDuel, clearAbortedDuel, showCompletedDuel]);

  // No Realtime subscription while exploring as an unauthenticated guest.
  // Realtime updates for duels
  useEffect(() => {
    if (!authUser) { setRealtimeConnected(false); return; }
    setRealtimeConnected(false);
    const lifetime = createDuelRealtimeLifetime();
    const channel = supabase
      .channel('duels-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'duels' },
        (payload: any) => {
          if (!lifetime.isActive()) return;
          const row: any = duelRealtimeRow(payload);
          if (finishAccountRef.current !== authUser.id) return;
          if (!row) return;

          // DELETE supplies only the old primary key. Remove known local
          // markers; do not infer match completion or participant identity.
          if (payload.eventType === 'DELETE') {
            setOpenRuns(previous => previous.filter(run => run.id !== row.id));
            setHostedOpenDuels(previous => previous.filter(run => run.id !== row.id));
            setRegionalRuns(previous => previous.filter(run => run.id !== row.id));
            return;
          }

          // A second browser/device can join or cancel the host's lobby.
          // Stop the visible open-lobby timer as soon as the server confirms
          // a non-open status; the matched race uses its own start countdown.
          if (row.host_user_id === authUser.id &&
              (payload.eventType === 'DELETE' || row.status !== 'open' ||
               (typeof row.expires_at === 'string' && !isOpenEventAvailable(row.expires_at)))) {
            setHostedOpenDuels(previous => previous.filter(run => run.id !== row.id));
          }

          // Do not invent a 3-second countdown when the database is only
          // matched. A real start_at is created after BOTH players confirm ready.
          if (payload.eventType === 'UPDATE' && row.status === 'matched') {
            applyMatchedDuel(row);
          }
          if (payload.eventType === 'UPDATE' && row.status === 'abandoned') {
            clearAbortedDuel(row.id, true);
          }
          if (payload.eventType === 'UPDATE' && row.status === 'completed') {
            showCompletedDuel(row);
          }

          setOpenRuns((prev) => {
            const copy = [...prev];
            if (payload.eventType === 'DELETE' || (payload.eventType === 'UPDATE' && row.status !== 'open')) {
              return copy.filter((r) => r.id !== row.id);
            }
            // INSERT or UPDATE open; cron or client may deliver an expired
            // event before its status transition is observed.
            if (typeof row.expires_at === 'string' && !isOpenEventAvailable(row.expires_at)) {
              return copy.filter(r => r.id !== row.id);
            }
            const location = parseGeographyPoint(row.location);
            if (!location) return copy;
            // A global open-duels feed must not inject distant events into
            // the local 5-km list. Use the latest GPS fix without rebuilding
            // the Realtime subscription on every geolocation update.
            const gps = liveUserCoordsRef.current;
            const mine = row.host_user_id === authUser.id;
            if (!mine && (!gps ||
              haversineM(gps.lat, gps.lng, location.lat, location.lng) > 5_000)) {
              return copy.filter(r => r.id !== row.id);
            }
            const existingIdx = copy.findIndex((r) => r.id === row.id);
            const updated: OpenRun = {
              id: row.id,
              hostUserId: row.host_user_id,
              hostUsername: 'host',
              distanceMeters: row.target_distance_m || (row.max_distance_km ?? 0) * 1000 || 100,
              location,
              createdAt: row.created_at,
              expiresAt: row.expires_at,
              targetDistanceM: row.target_distance_m || undefined,
            };
            if (existingIdx >= 0) {
              copy[existingIdx] = updated;
            } else {
              // Append new events instead of pushing the user's current list
              // viewport down while they are reading an existing challenge.
              copy.push(updated);
            }
            return copy;
          });
        }
      )
      .subscribe(status => {
        if (!lifetime.isActive() || finishAccountRef.current !== authUser.id) return;
        setRealtimeConnected(status === 'SUBSCRIBED');
        // Reconcile the authoritative discovery list after (re)subscription.
        if (status === 'SUBSCRIBED') setDiscoveryRefreshTick(tick => tick + 1);
      });
    return () => {
      lifetime.close();
      void supabase.removeChannel(channel);
    };
  }, [authUser?.id, applyMatchedDuel, clearAbortedDuel, showCompletedDuel]);

  // The server is the authority for expiration. Client-side pruning only
  // keeps the map truthful until a cron/realtime update arrives, even after
  // waking Safari from the background. No client UPDATE/DELETE is attempted.
  useEffect(() => {
    const pruneExpired = () => {
      const now = Date.now();
      // Return the previous array when nothing expires: a 1Hz deadline
      // check must NOT rerender the entire MapLibre scene every second.
      setOpenRuns(previous => {
        const next = previous.filter(run => !run.expiresAt || isOpenEventAvailable(run.expiresAt, now));
        return next.length === previous.length ? previous : next;
      });
      setHostedOpenDuels(previous => {
        const next = previous.filter(run => !run.expiresAt || isOpenEventAvailable(run.expiresAt, now));
        return next.length === previous.length ? previous : next;
      });
      setRegionalRuns(previous => {
        const next = previous.filter(run => !run.expiresAt || isOpenEventAvailable(run.expiresAt, now));
        return next.length === previous.length ? previous : next;
      });
    };
    pruneExpired();
    const interval = window.setInterval(pruneExpired, 1000);
    document.addEventListener('visibilitychange', pruneExpired);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', pruneExpired);
    };
  }, []);

  // Guest restriction applies to every entry point, including handlers.
  // There is no local guest race creation or guest race countdown.
  const requireRaceAccount = (): boolean => {
    if (authUser) return true;
    navigate('/login?next=%2Fmap');
    return false;
  };

  const openHostRunAt = (point: Coordinates) => {
    if (!requireRaceAccount()) return;
    setRaceNotice(null);
    if (hostedOpenDuels.some(run => !run.expiresAt || isOpenEventAvailable(run.expiresAt))) {
      setRaceNotice('Du hast bereits ein offenes Event. Warte auf einen Gegner oder storniere es zuerst.');
      return;
    }
    if (!userCoords || !canHostAt(userCoords, point)) {
      setRaceNotice(`Wähle einen Punkt innerhalb deines ${HOST_PLACEMENT_RADIUS_METERS}-m-Radars. Dein GPS-Standort muss verfügbar sein.`);
      if (!userCoords) requestOnce();
      return;
    }
    setHostLocation({ lat: point.lat, lng: point.lng });
    setHostOpen(true);
  };

  // A new duel is a lobby: it waits for a challenger before the countdown.
  // Only close the creation dialog after Supabase confirms the inserted row.
  const handleHostRun = async (distanceMeters: number) => {
    if (!requireRaceAccount()) return;
    if (!authUser) {
      throw new Error('Anmeldung erforderlich.');
    }
    if (!userCoords || !hostLocation || !currentUser) {
      throw new Error('GPS-Standort oder gewählter Kartenpunkt nicht verfügbar.');
    }
    if (!canHostAt(userCoords, hostLocation)) {
      throw new Error('Der gewählte Punkt liegt jetzt außerhalb deines 500-m-Radars. Bitte wähle erneut einen Punkt.');
    }

    // Friendly preflight for the UI. The UNIQUE PARTIAL INDEX in Postgres
    // is still the real atomic protection against racing double-clicks,
    // extra tabs, malicious HTTP requests and concurrent devices.
    const { data: activeHosted, error: activeCheckError } = await supabase
      .from('duels')
      .select('id, status')
      .eq('host_user_id', authUser.id)
      .in('status', ['open', 'matched'])
      .limit(1);
    if (finishAccountRef.current !== authUser.id) return;
    if (activeCheckError) throw activeCheckError;
    if (activeHosted?.length) {
      throw new Error('Du hast bereits ein aktives Event. Schließe zuerst dein vorheriges Rennen ab oder storniere es.');
    }

    const { data, error } = await createDuel(supabase, {
      hostUserId: authUser.id,
      location: hostLocation,
      distanceKm: 1,
      targetDistanceM: distanceMeters,
    });
    if (finishAccountRef.current !== authUser.id) return;
    if (error) throw error;
    if (!data?.id || data.status !== 'open' || !data.expires_at) {
      throw new Error('Renn-Erstellung wurde nicht bestätigt.');
    }

    // Display the confirmed creation without depending on realtime delivery.
    const created: OpenRun = {
      id: data.id,
      hostUserId: authUser.id,
      hostUsername: currentUser.username,
      distanceMeters,
      location: hostLocation,
      createdAt: data.created_at,
      expiresAt: data.expires_at,
      targetDistanceM: distanceMeters,
    };
    setOpenRuns(previous => [created, ...previous.filter(run => run.id !== created.id)]);
    setHostedOpenDuels(previous => [
      { id: created.id, hostUserId: authUser.id, distanceMeters,
        createdAt: created.createdAt ?? null, expiresAt: created.expiresAt,
        location: created.location },
      ...previous.filter(run => run.id !== created.id),
    ]);
    setHostedDuelsLoadError(false);
    setRaceNotice(`Dein ${distanceMeters}-m-Event ist 60 Minuten offen. Sobald jemand beitritt, endet das Wartefenster.`);
  };

  const handleCancelHostedRun = (run: HostedOpenDuel) => {
    if (!authUser || run.hostUserId !== authUser.id || run.id.startsWith('demo-run-')) return;
    // No window.confirm: embedded iOS Safari/PWA and Leaflet popups can dismiss
    // the native prompt before the user sees what happened.
    setCancelError(null);
    setCancelConfirmation(run);
  };

  const confirmCancelHostedRun = async () => {
    const run = cancelConfirmation;
    if (!authUser || !run || run.hostUserId !== authUser.id || cancellingRunId) return;
    setCancellingRunId(run.id);
    setCancelError(null);
    setRaceNotice(null);
    try {
      const result = await cancelHostedOpenDuel(supabase, run.id, authUser.id);
      if (finishAccountRef.current !== authUser.id) return;
      const message = cancelHostedDuelMessage(result);
      if (result.status === 'cancelled') {
        setHostedOpenDuels(previous => previous.filter(item => item.id !== run.id));
        setOpenRuns(previous => previous.filter(item => item.id !== run.id));
        setCancelConfirmation(null);
        setRaceNotice(message);
      } else {
        // Do not remove a row unless the server actually returned cancellation.
        setCancelError(message);
        setRaceNotice(message);
        // A zero-row update can mean the opponent already joined. Query the
        // authoritative row, close the stale cancel dialog and recover its match.
        const { data: latest } = await supabase.from('duels')
          .select('id, status, host_user_id, challenger_user_id, target_distance_m, host_ready, challenger_ready, start_at')
          .eq('id', run.id).maybeSingle();
        if (finishAccountRef.current !== authUser.id) return;
        if (latest?.status === 'matched') {
          applyMatchedDuel(latest);
          setCancelError(null);
          setRaceNotice('Dein Gegner ist bereits beigetreten. Das Rennen kann nicht mehr als offene Challenge abgesagt werden.');
        } else if (latest && latest.status !== 'open') {
          setHostedOpenDuels(previous => previous.filter(item => item.id !== run.id));
          setOpenRuns(previous => previous.filter(item => item.id !== run.id));
          setCancelConfirmation(null);
          setCancelError(null);
          setRaceNotice('Dieses Rennen ist nicht mehr offen und wurde von der Karte entfernt.');
        } else {
          void listHostedOpenDuels(supabase, authUser.id)
            .then(runs => { setHostedOpenDuels(runs); setHostedDuelsLoadError(false); })
            .catch(() => setHostedDuelsLoadError(true));
        }
      }
    } finally {
      setCancellingRunId(null);
    }
  };

  const sendFinishedTime = async (payload: PendingFinish) => {
    if (finishSubmittingRef.current || finishAccountRef.current !== payload.userId ||
        latestFinishPayloadRef.current !== payload || endedDuelIdsRef.current.has(payload.duelId)) return;
    const releaseWrite = duelWriteGate.current.tryAcquire(payload.duelId);
    if (!releaseWrite) return;
    finishSubmittingRef.current = payload;
    const stillCurrent = () => finishAccountRef.current === payload.userId &&
      latestFinishPayloadRef.current === payload && !endedDuelIdsRef.current.has(payload.duelId);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (!stillCurrent()) return;
      if (sessionError || sessionData.session?.user.id !== payload.userId) {
        setFinishSubmissionError('Bitte erneut anmelden, bevor du deine Zielzeit speicherst.');
        return;
      }
      const { error } = await submitDuelResult(supabase, payload.duelId, payload.timeMs, payload.metrics);
      if (!stillCurrent()) return;
      if (error) {
        if (error.code === '23514') {
          setFinishSubmissionError('Der Server hat die Messung nicht akzeptiert. Bitte Rennstatus prüfen.');
        } else {
          setFinishSubmissionError('Zielzeit nicht gespeichert. Bitte erneut versuchen.');
        }
        return;
      }
      // Retain the local finish until both players complete or the duel is
      // abandoned. A lost response/reload can safely retry the same payload.
      setFinishSubmissionError(null);
    } catch {
      if (stillCurrent()) setFinishSubmissionError('Netzwerkfehler. Bitte Zielzeit erneut speichern.');
    } finally {
      if (finishSubmittingRef.current === payload) finishSubmittingRef.current = null;
      releaseWrite();
    }
  };

  const retryFinishedTime = async () => {
    const payload = latestFinishPayloadRef.current;
    if (payload) await sendFinishedTime(payload);
  };

  const confirmAbortMatchedDuel = async (duelId: string) => {
    if (!authUser || !duelId || duelId.startsWith('demo-run-')) {
      throw new Error('Du musst angemeldet sein, um dieses Rennen abzubrechen.');
    }
    const releaseWrite = duelWriteGate.current.tryAcquire(duelId);
    if (!releaseWrite) throw new Error('Für dieses Duell läuft bereits eine Änderung. Bitte erneut versuchen.');
    try {
      // Leave the countdown/race visible until Supabase confirms termination.
      const confirmed = await abortMatchedDuel(supabase, duelId);
      if (finishAccountRef.current !== authUser.id) return;
      if (confirmed.id !== duelId || confirmed.status !== 'abandoned') {
        throw new Error('Der Server hat den Abbruch nicht bestätigt.');
      }
      clearAbortedDuel(duelId, false);
    } finally {
      releaseWrite();
    }
  };

  const confirmMatchReady = async () => {
    if (!matchedDuel || !authUser || readyBusy || matchedDuel.startAt) return;
    const mine = matchedDuel.hostUserId === authUser.id
      ? matchedDuel.hostReady : matchedDuel.challengerReady;
    if (mine) return;
    setReadyBusy(true);
    setReadyError(null);
    try {
      const { data, error } = await readyForDuel(supabase, matchedDuel.id);
      if (finishAccountRef.current !== authUser.id) return;
      if (error) throw error;
      if (!data || data.id !== matchedDuel.id || data.status !== 'matched') {
        throw new Error('Der Server hat den Bereitschaftsstatus nicht bestätigt.');
      }
      applyMatchedDuel(data);
    } catch {
      setReadyError('Bereitschaft konnte nicht gespeichert werden. Bitte erneut versuchen.');
    } finally {
      setReadyBusy(false);
    }
  };

  // Joining and starting races are exclusively for signed-in accounts.
  const handleJoinRun = async (run: OpenRun) => {
    if (!requireRaceAccount()) return;
    if (!currentUser || !authUser || joiningRunRef.current) return;

    // Signed-in runners may try explicitly labeled, non-scored sample races.
    if (run.id.startsWith('demo-run-')) {
      const startsAt = Date.now() + ARCADE_COUNTDOWN_SECONDS * 1000; // local demo only; real time is stored by server
      setMatchOverlay({ duelId: run.id, startsAt, targetDistanceM: run.targetDistanceM || run.distanceMeters });
      setRace({ status: 'countdown', duelId: run.id, startsAt, targetDistanceM: run.targetDistanceM || run.distanceMeters });
      // Remove the run from open runs
      setOpenRuns(prev => prev.filter(r => r.id !== run.id));
      return;
    }
    
    joiningRunRef.current = run.id;
    setRaceNotice('Beitritt wird geprüft …');
    try {
      // Inspect the RPC response, not just a Realtime event which iOS may miss.
      const confirmed = await joinDuel(supabase, run.id);
      if (finishAccountRef.current !== authUser.id) return;
      if (confirmed.challenger_user_id !== authUser.id) {
        throw new Error('Beitritt nicht für dieses Konto bestätigt.');
      }
      applyMatchedDuel(confirmed);
      setRaceNotice(null);
    } catch (e) {
      const message = e instanceof Error ? e.message.toLowerCase() : '';
      if (message.includes('expired') || message.includes('unavailable') ||
          message.includes('already joined') || message.includes('not found')) {
        setOpenRuns(prev => prev.filter(r => r.id !== run.id));
        setDiscoveryRefreshTick(tick => tick + 1);
        setRaceNotice('Dieses Rennen ist bereits besetzt oder nicht mehr verfügbar.');
      } else if (message.includes('login') || message.includes('permission') || message.includes('42501')) {
        setRaceNotice('Bitte melde dich erneut an, um diesem Rennen beizutreten.');
      } else {
        setRaceNotice('Beitritt fehlgeschlagen. Bitte überprüfe die Verbindung und versuche es erneut.');
      }
    } finally {
      joiningRunRef.current = null;
    }
  };

  // Both views use the exact same secure callbacks; the popup never bypasses
  // authentication, server confirmation or the existing cancel dialog.
  const joinArcadeRun = (id: string) => {
    const run = openRuns.find((item) => item.id === id);
    if (run) { void handleJoinRun(run); }
  };
  const cancelArcadeRun = (id: string) => {
    const run = openRuns.find((item) => item.id === id);
    if (run && authUser?.id === run.hostUserId) {
      handleCancelHostedRun({
        id: run.id,
        hostUserId: run.hostUserId ?? '',
        distanceMeters: run.distanceMeters,
        createdAt: run.createdAt ?? null,
        expiresAt: run.expiresAt,
      });
    }
  };

  const arcadeRuns: ArcadeMapEntry[] = openRuns.map((run) => ({
    id: run.id,
    hostUsername: run.hostUsername,
    distanceMeters: run.distanceMeters,
    distanceAwayMeters: userCoords ? haversineM(userCoords.lat, userCoords.lng, run.location.lat, run.location.lng) : null,
    isOwn: Boolean(authUser && (run.hostUserId === authUser.id || hostedOpenDuels.some(own => own.id === run.id))),
    isDemo: run.id.startsWith('demo-run-'),
    expiresAt: run.expiresAt,
  }));

  return (
    <div className="runnit-map runnit-map-arcade relative h-[100dvh] w-full max-w-full overflow-hidden bg-[#090b13] text-white">
      <ArcadeMapLibreView
        initialCenter={center}
        initialZoom={initialZoom}
        userCoords={userCoords}
        ipCoords={ipCoords}
        recenterTick={recenterTick}
        retryTick={tileRetryCount}
        view={arcadeMapView}
        players={players.filter((player) => player.source !== 'server-unverified').map((player) => ({
          id: player.id,
          location: player.location,
          colorHex: player.colorHex,
          source: player.source,
        }))}
        regionalRuns={regionalRuns}
        hotspotDemoEnabled={hotspotDemoEnabled}
        hotspotFocus={hotspotFocus}
        onWideViewChange={setWideMapView}
        onCameraChange={setMapCamera}
        hostDialogOpen={hostOpen}
        hostLocation={hostLocation}
        runs={openRuns.map((run, index) => ({
          ...arcadeRuns[index],
          location: run.location,
        }))}
        onSelectRun={setSelectedRunId}
        onJoinRun={joinArcadeRun}
        onCancelRun={cancelArcadeRun}
        onRunExpired={(id) => {
          // Device-only instant cleanup; Supabase cron is authoritative.
          setOpenRuns(previous => previous.filter(run => run.id !== id));
          setHostedOpenDuels(previous => previous.filter(run => run.id !== id));
          setRegionalRuns(previous => previous.filter(run => run.id !== id));
          setDiscoveryRefreshTick(tick => tick + 1);
        }}
        onOpenRunGroup={() => setArcadeMapView('list')}
        onGhostClick={() => setGhostOpen(true)}
        onHostAt={openHostRunAt}
        onInvalidHostAt={setRaceNotice}
        onTilesLoaded={() => setMapTilesUnavailable(false)}
        onTilesError={() => setMapTilesUnavailable(true)}
      />

      {arcadeMapView === 'list' && hostedDuelsLoadError && (
        <p className="pointer-events-none absolute inset-x-4 bottom-36 z-[931] mx-auto max-w-sm rounded-lg border border-amber-300/30 bg-[#111827]/95 p-2 text-center text-xs text-amber-100">
          Deine eigenen offenen Rennen konnten nicht aktualisiert werden. Bitte verbinde dich erneut.
        </p>
      )}
      {hotspotTestAvailable && arcadeMapView === 'map' && !hostOpen && (
        <section className={'runnit-hotspot-test-console' + (hotspotLabExpanded ? ' is-expanded' : '')}
          aria-label="Simulierter Community-Hotspot-Test">
          <button type="button" className="runnit-hotspot-test-expander"
            aria-expanded={hotspotLabExpanded}
            aria-controls="runnit-hotspot-test-details"
            onClick={() => setHotspotLabExpanded(value => !value)}>
            <span className="runnit-hotspot-test-title">HOTSPOT LAB <span>· DEMO</span></span>
            <span className="runnit-hotspot-test-toggle-icon" aria-hidden="true">{hotspotLabExpanded ? '−' : '+'}</span>
          </button>
          {hotspotLabExpanded && (
            <div id="runnit-hotspot-test-details" className="runnit-hotspot-test-details">
              <div className="runnit-hotspot-test-top">
                <p className="runnit-hotspot-test-disclaimer">SIMULATION · KEINE ECHTEN SPIELER ODER MATCHES</p>
                <button type="button" className="runnit-hotspot-test-power"
                  onClick={() => {
                    setHotspotDemoEnabled(value => !value);
                    setHotspotLabExpanded(false);
                  }} aria-pressed={hotspotDemoEnabled}>
                  {hotspotDemoEnabled ? 'AUS' : 'TESTEN'}
                </button>
              </div>
              {hotspotDemoEnabled && (
                <>
                  <div className="runnit-hotspot-test-keys" aria-label="Simulierte Testaktivität">
                    <span><i className="is-open" /> 3 OFFENE</span>
                    <span><i className="is-runner" /> 10 RUNNER</span>
                    <span><i className="is-match" /> 25 MATCHES</span>
                  </div>
                  <div className="runnit-hotspot-test-cities">
                    {([
                      ['all', 'ALLE'],
                      ['backnang', 'BACKNANG'],
                      ['stuttgart', 'STUTTGART'],
                      ['munich', 'MÜNCHEN'],
                    ] as const).map(([city, label]) => (
                      <button type="button" key={city} aria-pressed={hotspotFocus.city === city}
                        onClick={() => {
                          setHotspotFocus(previous => ({ city, tick: previous.tick + 1 }));
                          setHotspotLabExpanded(false);
                        }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      )}

      {mapTilesUnavailable && (
        <div role="alert" className="runnit-arcade-alert pointer-events-auto absolute inset-x-4 top-24 z-[950] mx-auto max-w-sm rounded-2xl border border-rose-300/40 bg-[#1a1321]/95 p-4 text-sm text-white shadow-xl backdrop-blur">
          <p className="font-bold">Die Karte kann gerade nicht geladen werden.</p>
          <p className="mt-2 text-xs leading-5 text-white/70">
            Prüfe deine Internetverbindung. Der Vektorkartendienst konnte gerade keine Kartendaten liefern.
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => { setMapTilesUnavailable(false); setTileRetryCount((count) => count + 1); }}
              className="rounded-lg bg-white/15 px-3 py-2 text-xs font-bold text-white">Erneut versuchen</button>
            <a href="/" className="rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-white">Zur Startseite</a>
          </div>
        </div>
      )}
      {!userCoords && !ipCoords && !locationError && !insecureContext && !unsupported && !locating && (
        <div className="runnit-arcade-gps-prompt pointer-events-auto absolute inset-x-4 bottom-44 z-[950] mx-auto max-w-sm rounded-xl border border-white/20 bg-[#111827]/90 px-4 py-3 text-center text-xs leading-5 text-white/80 shadow-lg backdrop-blur">
          <p className="font-semibold text-white">Noch kein Standort ermittelt</p>
          <p className="mt-1">Du siehst die Weltübersicht. Für Herausforderungen in deiner Nähe kannst du deinen Standort aktivieren.</p>
          <button type="button" onClick={() => { requestOnce(); setRecenterTick(x => x + 1); }} className="mt-2 rounded-lg bg-violet-500 px-3 py-2 font-bold text-white">Standort erneut suchen</button>
        </div>
      )}
      {/* Background updates are silent; a fixed LIVE chip never shifts content. */}
      {arcadeMapView === 'map' && wideMapView && !hotspotDemoEnabled && (
        <div className="runnit-community-map-legend" aria-label="Übersicht über echte offene Rennen">
          <span className="runnit-community-map-signal" aria-hidden="true" />
          {!authUser ? 'NETWORK · LIVE-RENNEN NACH ANMELDUNG'
            : regionalRuns.length > 0
              ? `LIVE SIGNAL · ${regionalRuns.length} ${regionalRuns.length === 1 ? 'CHALLENGE' : 'CHALLENGES'}`
              : 'NETWORK · KEINE LIVE-CHALLENGES'}
        </div>
      )}

      {/* KARTE stays unobstructed. LISTE contains the interactive run cards. */}
      <ArcadeMapChrome
        view={arcadeMapView}
        onViewChange={setArcadeMapView}
        cityName={cityName}
        hasGps={Boolean(userCoords)}
        camera={mapCamera}
        entries={arcadeRuns}
        selectedId={selectedRunId}
        onJoin={joinArcadeRun}
        onCancel={cancelArcadeRun}
        loading={loadingDuels && !discoveryLoadedRef.current}
        live={realtimeConnected}
      />

      {/* Map-only controls must not float over scrollable race cards. */}
      {arcadeMapView === 'map' && <div className="runnit-map-locate-slot pointer-events-auto absolute z-[950]">
        <button
          onClick={() => { requestOnce(); setRecenterTick((x) => x + 1); }}
          className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/70 bg-[#10254f]/90 text-cyan-100 shadow-[0_12px_35px_rgba(0,0,0,.4)] backdrop-blur-xl transition hover:bg-violet-500/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          aria-label="Meinen Standort anzeigen"
          title="Standort suchen"
        >
          <LocateFixed className="h-6 w-6" aria-hidden="true" />
        </button>
      </div>}

      {/* Location notices */}
      {insecureContext && (
        <div className="pointer-events-auto absolute left-1/2 top-16 z-[950] -translate-x-1/2 rounded-lg bg-amber-600/90 px-4 py-2 text-sm text-white ring-1 ring-white/20">
          <div className="flex items-center gap-3">
            <span>Die Standortsuche benötigt eine sichere HTTPS-Verbindung. Bitte öffne Runnit über HTTPS und versuche es erneut.</span>
            <button
              onClick={() => { requestOnce(); setRecenterTick((x) => x + 1); }}
              className="rounded-md bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
            >
              Retry
            </button>
          </div>
        </div>
      )}
      {unsupported && !insecureContext && (
        <div className="pointer-events-auto absolute left-1/2 top-16 z-[950] -translate-x-1/2 rounded-lg bg-rose-600/90 px-4 py-2 text-sm text-white ring-1 ring-white/20">
          <div className="flex items-center gap-3">
            <span>Dieser Browser unterstützt keine Standortermittlung.</span>
          </div>
        </div>
      )}
      {!insecureContext && !unsupported && !userCoords && locationError && (
        <div role="alert" className="runnit-arcade-alert pointer-events-auto absolute inset-x-4 top-28 z-[950] mx-auto max-w-sm rounded-2xl border border-rose-300/40 bg-[#201321]/95 p-4 text-sm text-white shadow-xl backdrop-blur">
          <p className="font-extrabold">
            {locationError === 'denied' ? 'Standortzugriff vom Gerät verweigert (GPS 1)' :
              locationError === 'timeout' ? 'Standortsuche hat zu lange gedauert (GPS 3)' :
              'Standort aktuell nicht verfügbar (GPS 2)'}
          </p>
          <p className="mt-2 text-xs leading-5 text-white/85">
            {locationError === 'denied'
              ? 'Selbst wenn Safari für diese Website „Erlauben“ zeigt: Prüfe auf dem iPhone unter Einstellungen → Datenschutz & Sicherheit → Ortungsdienste → Safari-Websites, ob der Zugriff beim Verwenden erlaubt und „Genauer Standort“ aktiviert ist.'
              : locationError === 'timeout'
                ? 'Safari hat innerhalb von 20 Sekunden keine GPS-Position erhalten. Prüfe WLAN/Mobilfunk und versuche es möglichst draußen erneut.'
                : 'Die Ortungsdienste konnten keine Position liefern. Prüfe die Ortungsdienste des iPhones, deine Verbindung und versuche es erneut.'}
          </p>
          <button type="button" disabled={locating}
            onClick={() => { requestOnce(); setRecenterTick((x) => x + 1); }}
            className="mt-3 min-h-11 rounded-xl bg-violet-500 px-4 py-2 text-xs font-extrabold text-white disabled:opacity-60">
            {locating ? 'Standort wird gesucht …' : 'Standort erneut prüfen'}
          </button>
        </div>
      )}

      {/* Server-confirmed matched lobby: explicit readiness on both phones.
          A matched duel is not a running race until the server supplies start_at. */}
      {matchedDuel && !matchOverlay && race.status === 'idle' &&
        dismissedMatchId !== matchedDuel.id && (
        <ReadyLobby
          hostName={matchedDuel.hostUserId === authUser?.id
            ? (authUser?.displayName || 'HOST')
            : (matchedNames[matchedDuel.hostUserId] || 'HOST')}
          challengerName={matchedDuel.challengerUserId === authUser?.id
            ? (authUser?.displayName || 'RUNNER')
            : (matchedNames[matchedDuel.challengerUserId] || 'CHALLENGER')}
          hostReady={matchedDuel.hostReady}
          challengerReady={matchedDuel.challengerReady}
          isHost={matchedDuel.hostUserId === authUser?.id}
          targetDistanceM={matchedDuel.targetDistanceM}
          readyBusy={readyBusy}
          readyError={readyError}
          soundEnabled={raceSoundEnabled}
          onReady={() => {
            // Unlock audio before the async Ready RPC (iOS user-gesture rule).
            if (raceSoundEnabled) unlockRaceAudio();
            // iOS requires the permission request to begin in this user gesture.
            // Denial or unavailable sensors never block server readiness.
            void requestDuelMotionPermission();
            void confirmMatchReady();
          }}
          onSoundToggle={() => {
            const next = !raceSoundEnabled;
            setRaceSoundEnabled(next);
            setRaceAudioMuted(!next);
            if (next) unlockRaceAudio();
          }}
          onBack={() => setDismissedMatchId(matchedDuel.id)}
          onAbort={() => confirmAbortMatchedDuel(matchedDuel.id)}
        />
      )}
      {matchedDuel && dismissedMatchId === matchedDuel.id && race.status === 'idle' && (
        <button type="button" onClick={() => setDismissedMatchId(null)}
          className="absolute inset-x-4 bottom-28 z-[1050] rounded-xl border border-cyan-300 bg-[#13204b] p-3 text-sm font-extrabold text-white shadow-xl">
          DUELL GEFUNDEN · BEREITSCHAFT ÖFFNEN
        </button>
      )}

      {/* Server-synchronized countdown, never triggered before both READY. */}
      {matchOverlay && (
        <RaceCountdown
          key={matchOverlay.duelId}
          wakeStatus={wakeStatus}
          startsAt={matchOverlay.startsAt}
          targetDistanceM={matchOverlay.targetDistanceM}
          soundEnabled={raceSoundEnabled}
          onAbort={() => confirmAbortMatchedDuel(matchOverlay.duelId)}
          onDone={() => {
            if (!authUser) {
              setMatchOverlay(null);
              setRace({ status: 'idle' });
              navigate('/login?next=%2Fmap');
              return false;
            }
            setMatchOverlay(null);
            if (race.status === 'countdown' && race.duelId === matchOverlay.duelId &&
                race.startsAt === matchOverlay.startsAt && !endedDuelIdsRef.current.has(race.duelId)) {
              // Use the exact server start timestamp rather than each phone's
              // callback timestamp for a synchronized, fair elapsed time.
              setRace({ status: 'running', duelId: race.duelId,
                startedAt: race.startsAt, targetDistanceM: race.targetDistanceM });
              return true;
            }
            return false;
          }}
        />
      )}

      {race.status === 'running' && authUser && (
        <RaceOverlay
          key={race.duelId}
          startFix={userCoords}
          wakeStatus={wakeStatus}
          startedAt={race.startedAt}
          targetDistanceM={race.targetDistanceM}
          onAbort={() => confirmAbortMatchedDuel(race.duelId)}
          onFinish={(endedAt, metrics) => {
            if (finishAccountRef.current !== authUser.id || endedDuelIdsRef.current.has(race.duelId)) return;
            const timeMs = Math.max(1, endedAt - race.startedAt);
            setRace({ status: 'finished', duelId: race.duelId,
              startedAt: race.startedAt, endedAt, targetDistanceM: race.targetDistanceM });
            setFinishSubmissionError(null);
            if (!race.duelId.startsWith('demo-run-')) {
              const payload: PendingFinish = { userId: authUser.id, duelId: race.duelId,
                timeMs: Math.round(timeMs), startedAt: race.startedAt,
                targetDistanceM: race.targetDistanceM, metrics };
              latestFinishPayloadRef.current = payload;
              rememberPendingFinish(payload);
              void sendFinishedTime(payload);
            }
          }}
        />
      )}

      {race.status === 'finished' && authUser && (
        <DuelFinishScreen
          key={race.duelId}
          supabase={supabase}
          duelId={race.duelId}
          userId={authUser.id}
          targetDistanceM={race.targetDistanceM}
          isDemo={race.duelId.startsWith('demo-run-')}
          submissionError={finishSubmissionError}
          onRetrySubmit={retryFinishedTime}
          onAbort={() => confirmAbortMatchedDuel(race.duelId)}
          onClose={() => closeCompletedDuel(race.duelId)}
        />
      )}

      {raceNotice && (
        <div role="status" className="runnit-arcade-race-notice pointer-events-none absolute inset-x-4 top-[calc(145px+env(safe-area-inset-top,0px))] z-[938] mx-auto max-w-sm rounded-xl border border-amber-300/25 bg-[#191827]/90 px-3 py-2 text-center text-xs leading-5 text-amber-100 shadow-lg">
          {raceNotice}
        </div>
      )}

      {/* New Bottom Sheet for Leaderboards */}
      <BottomSheet 
        open={ghostOpen} 
        onClose={() => setGhostOpen(false)} 
        title={cityName || 'Leaderboard'}
      >
        <LeaderboardSheet 
          city={cityName || 'Your City'} 
          entries={players.map(p => ({
            rank: p.rank,
            name: p.username,
            time: `${p.bestTimeSeconds.toFixed(2)}s`,
            distance: `${p.distanceMeters}m`,
            source: p.source
          }))} 
        />
      </BottomSheet>

      {cancelConfirmation && (
        <div className="runnit-cancel-overlay">
          <section role="dialog" aria-modal="true" aria-labelledby="cancel-hosted-title"
            className="runnit-cancel-panel">
            <div className="runnit-cancel-header">
              <span>RUNNIT // RACE CONTROL</span>
              <span className="runnit-cancel-warning" aria-hidden="true">!</span>
              <h2 id="cancel-hosted-title">Rennen wirklich absagen?</h2>
            </div>
            <div className="runnit-cancel-run-info">
              <strong>1V1 DUELL · {cancelConfirmation.distanceMeters} M</strong>
              <span>WARTET AUF GEGNER</span>
            </div>
            <p className="runnit-cancel-explainer">
              Absagen ist nur möglich, solange noch niemand beigetreten ist.
              Danach verschwindet die offene Challenge von der Karte.
            </p>
            {cancelError && <p role="alert" className="runnit-cancel-error">{cancelError}</p>}
            <button type="button" disabled={Boolean(cancellingRunId)}
              onClick={() => { void confirmCancelHostedRun(); }}
              className="runnit-cancel-confirm">
              {cancellingRunId ? 'ABSAGE WIRD BESTÄTIGT …' : 'JA, RENNEN ABSAGEN ›'}
            </button>
            <button type="button" disabled={Boolean(cancellingRunId)}
              onClick={() => { setCancelConfirmation(null); setCancelError(null); }}
              className="runnit-cancel-keep">NEIN, RENNEN BEHALTEN</button>
          </section>
        </div>
      )}

      <HostRunDialog
        open={hostOpen && Boolean(authUser)}
        onClose={() => { setHostOpen(false); setHostLocation(null); }}
        onHost={handleHostRun}
        selectedLocationDistance={hostLocation && userCoords ? mapDistanceMeters(userCoords, hostLocation) : undefined}
        onDemo={() => { setHostOpen(false); navigate('/sprint-lab'); }}
        defaultDistance={50}
      />

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        mode={authMode}
        setMode={setAuthMode}
        user={authUser}
        onSignIn={async (email, password) => {
          await signIn(email, password);
        }}
        onSignUp={async (email, password) => {
          await signUp(email, password);
        }}
        onSignOut={async () => {
          await signOut();
        }}
      />
      
      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}

function RaceOverlay({ startedAt, targetDistanceM, startFix, wakeStatus, onFinish, onAbort }: { startedAt: number; targetDistanceM: number; startFix: Coordinates | null; wakeStatus: ScreenWakeLockStatus | 'idle'; onFinish: (endedAt: number, metrics?: DuelMetrics) => void; onAbort: () => Promise<void> }) {
  const [elapsedMs, setElapsedMs] = useState(Math.max(0, Date.now() - startedAt));
  const [displayDistanceM, setDisplayDistanceM] = useState(0);
  const [maxSpeed, setMaxSpeed] = useState(0);
  const [initialMeasurement] = useState(() => createDuelGpsMeasurement(targetDistanceM, startedAt, startFix ? {
    latitude: startFix.lat,
    longitude: startFix.lng,
    accuracyM: startFix.accuracyMeters ?? NaN,
    timestampMs: startFix.sampledAtMs ?? NaN,
  } : null));
  const measurementRef = useRef(initialMeasurement);
  const finishCallbackRef = useRef(onFinish);
  finishCallbackRef.current = onFinish;
  const liveStepCounter = useRef(new LiveStepPeakCounter());
  const motionCapture = useRef(new DuelMotionCapture(startedAt));
  const [liveStepCount, setLiveStepCount] = useState(0);
  const finishedRef = useRef(false);
  const [confirmAbort, setConfirmAbort] = useState(false);
  const [abortBusy, setAbortBusy] = useState(false);
  const [abortError, setAbortError] = useState<string | null>(null);
  const abortBusyRef = useRef(false);
  const doAbort = async () => {
    if (abortBusyRef.current || finishedRef.current) return;
    abortBusyRef.current = true;
    finishedRef.current = true; // do not count GPS distance during termination
    setAbortBusy(true);
    setAbortError(null);
    try {
      await onAbort(); // the parent clears race UI only after Supabase confirms
    } catch {
      finishedRef.current = false;
      abortBusyRef.current = false;
      setAbortBusy(false);
      setAbortError('Rennabbruch nicht bestätigt. Bitte Verbindung prüfen und erneut versuchen.');
    }
  };
  const watchIdRef = useRef<number | null>(null);
  useEffect(() => {
    const id = setInterval(() => {
      setElapsedMs(Math.max(0, Date.now() - startedAt));
    }, 50);
    return () => clearInterval(id);
  }, [startedAt]);

  // Use GPS fix timestamps, not callback arrival times. Keep measurement and
  // completion side effects outside React state updaters (which may be replayed).
  useEffect(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) return;
    let active = true;
    const handle = (pos: GeolocationPosition) => {
      if (!active || finishedRef.current) return;
      const next = advanceDuelGpsMeasurement(measurementRef.current, {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracyM: pos.coords.accuracy,
        timestampMs: pos.timestamp,
      }, Date.now());
      measurementRef.current = next;
      if (next.sprint.lastDecision !== 'accepted') return;
      setMaxSpeed(next.sprint.maxSpeedMps);
      const distance = next.sprint.distanceM;
      setDisplayDistanceM(previous => previous + 0.35 * (distance - previous));
      if (next.sprint.finishTimestampMs !== null) {
        finishedRef.current = true;
        setDisplayDistanceM(distance);
        finishCallbackRef.current(next.sprint.finishTimestampMs,
          duelGpsMetrics(next, liveStepCounter.current.timestampsMs.filter(t => t <= next.sprint.finishTimestampMs!).length,
            motionCapture.current.summarize(next.sprint.finishTimestampMs, next.sprint.targetMeters)));
      }
    };
    try {
      watchIdRef.current = navigator.geolocation.watchPosition(handle, () => {}, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000,
      });
    } catch {}
    return () => {
      active = false;
      if (watchIdRef.current !== null) {
        try { navigator.geolocation.clearWatch(watchIdRef.current); } catch {}
        watchIdRef.current = null;
      }
    };
  }, []);

  // Shared foreground peak detector; no extrapolation across iOS sensor suspensions.
  useEffect(() => {
    const handler = (event: DeviceMotionEvent) => {
      if (finishedRef.current) return;
      if (document.visibilityState !== 'visible') return;
      const sample = motionEventSample(event, performance.timeOrigin, performance.now());
      if (!sample || !motionCapture.current.push(sample)) return;
      const updated = liveStepCounter.current.push(sample);
      if (updated !== null) setLiveStepCount(updated);
    };
    window.addEventListener('devicemotion', handler, { passive: true });
    return () => window.removeEventListener('devicemotion', handler);
  }, []);

  // GPS remains authoritative for measured distance. Live steps are diagnostics.
  const seconds = (elapsedMs / 1000).toFixed(2);
  const progress = Math.max(0, Math.min(100, displayDistanceM / targetDistanceM * 100));
  return (
    <div className="race-arcade-screen race-arcade-live">
      <div className="race-arcade-light race-arcade-light-a" aria-hidden="true" />
      <div className="race-arcade-light race-arcade-light-b" aria-hidden="true" />
      <div className="race-arcade-shell">
        <div className="race-arcade-topline"><span>RUNNIT // LIVE RACE</span><span>● LIVE</span></div>
        <div className="race-arcade-headline">
          <h2>FULL SPEED!</h2>
          <div className="race-arcade-duel-tag">1V1 DUELL <b>· {targetDistanceM} M</b></div>
        </div>
        <div className="race-arcade-live-panel">
          <p className="race-arcade-eyebrow">LIVE TIMER</p>
          <p className="race-arcade-live-big">{seconds}<span style={{ fontSize: '.38em', color: '#d0ff25' }}>s</span></p>
          <p className="race-arcade-live-distance">{displayDistanceM.toFixed(1)} / {targetDistanceM} M</p>
          <div className="race-arcade-live-meter" role="progressbar" aria-label="Gelaufene Distanz"
            aria-valuemin={0} aria-valuemax={targetDistanceM}
            aria-valuenow={Math.min(targetDistanceM, Math.round(displayDistanceM))}>
            <span style={{ width: `${progress}%` }} />
          </div>
          <div className="race-arcade-mini-stat">
            <span>LIVE STEPS · EXPERIMENTELL</span><strong>{liveStepCount}</strong>
          </div>
          <div className="race-arcade-mini-stat">
            <span>GPS MAX SPEED</span><strong>{maxSpeed.toFixed(1)} m/s</strong>
          </div>
          <p className="race-arcade-wake">GPS-Bewertung experimentell · nicht verifiziert</p>
        </div>
        {wakeStatus !== 'idle' && <p className="race-arcade-wake">{screenWakeLockMessage(wakeStatus)}</p>}
        {confirmAbort ? (
          <div className="race-arcade-confirm" role="alertdialog" aria-label="Rennen abbrechen">
            <p>RENNEN WIRKLICH ABBRECHEN? Beide Spieler werden zurück zur Karte geschickt. Der Lauf zählt nicht.</p>
            <div className="race-arcade-confirm-actions">
              <button type="button" disabled={abortBusy} onClick={() => setConfirmAbort(false)}>
                NEIN, WEITER RENNEN
              </button>
              <button type="button" disabled={abortBusy} onClick={() => { void doAbort(); }}>
                {abortBusy ? 'WIRD ABGEBROCHEN…' : 'JA, FÜR BEIDE ABBRECHEN'}
              </button>
            </div>
            {abortError && <p role="alert" className="race-arcade-error">{abortError}</p>}
          </div>
        ) : (
          <button type="button" className="race-arcade-danger-link" onClick={() => setConfirmAbort(true)}>
            RENNEN ABBRECHEN
          </button>
        )}
      </div>
    </div>
  );
}

// Haversine distance in meters
function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // meters
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

