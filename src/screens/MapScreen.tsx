import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ArcadeMapLibreView from '../components/map/ArcadeMapLibreView';
import { LocateFixed } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useSupabaseUser } from '../hooks/useSupabaseUser';
import { createDuel } from '../db/createDuel';
import { getNearbyDuels } from '../db/getNearbyDuels';
import { joinDuel } from '../db/joinDuel';
import { getTopGhostRuns } from '../db/getTopGhostRuns';
import { submitDuelResult, type DuelMetrics } from '../db/submitDuelResult';
import { readyForDuel } from '../db/readyForDuel';
import { getDuelResults } from '../db/getDuelResults';
import BottomNav from '../components/ui/BottomNav';
import { BottomSheet } from '../components/ui/BottomSheet';
import { LeaderboardSheet } from '../components/leaderboard/Sheet';
import { leaderboardSourceLabel, type LeaderboardSource } from '../lib/leaderboardProvenance';
import ArcadeMapChrome, { type ArcadeMapEntry, type ArcadeMapView } from '../components/map/ArcadeMapChrome';
import { parseGeographyPoint } from '../lib/duelLocation';
import { reconcileOpenRaces } from '../lib/reconcileOpenRaces';
import { cancelHostedOpenDuel, cancelHostedDuelMessage, listHostedOpenDuels, type HostedOpenDuel } from '../db/cancelHostedDuel';
import { LiveStepPeakCounter } from '../lib/liveStepPeaks';
import { useScreenWakeLock } from '../hooks/useScreenWakeLock';
import { screenWakeLockMessage, type ScreenWakeLockStatus } from '../lib/screenWakeLock';
import { canHostAt, HOST_PLACEMENT_RADIUS_METERS, mapDistanceMeters } from '../lib/mapHostPlacement';

// Types
type Coordinates = {
  lat: number;
  lng: number;
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
  targetDistanceM?: number;
};

type CurrentUser = {
  id: string;
  username: string;
  location?: Coordinates;
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
    setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
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
      if (code === '42501' || message.includes('row-level security') || message.includes('permission denied')) {
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
          <p className="runnit-host-setup-note">OFFENE CHALLENGE · START ERST, WENN EIN ZWEITER LÄUFER BEITRITT.</p>
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
export default function MapScreen() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { coords: userCoords, locationError, locating, requestOnce, insecureContext, unsupported } = useUserLocation();
  const liveUserCoordsRef = useRef(userCoords);
  liveUserCoordsRef.current = userCoords;
  const { user: authUser, loading: authLoading, signIn, signUp, signOut } = useSupabaseUser();

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
  const [regionalRuns, setRegionalRuns] = useState<Array<{ id: string; location: Coordinates }>>([]);
  const [wideMapView, setWideMapView] = useState(false);
  const [arcadeMapView, setArcadeMapView] = useState<ArcadeMapView>('map');
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
  const [userTimes, setUserTimes] = useState<number[]>([]);
  const [matchOverlay, setMatchOverlay] = useState<{ duelId: string; startsAt: number; targetDistanceM: number } | null>(null);
  const [race, setRace] = useState<
    | { status: 'idle' }
    | { status: 'countdown'; duelId: string; startsAt: number; targetDistanceM: number }
    | { status: 'running'; duelId: string; startedAt: number; targetDistanceM: number }
    | { status: 'finished'; duelId: string; startedAt: number; endedAt: number; targetDistanceM: number }
  >({ status: 'idle' });
  // Browser motion and GPS callbacks can be suspended when iOS locks the screen.
  // Keep it awake for the entire countdown and race, not just the step sampler.
  const wakeStatus = useScreenWakeLock(Boolean(matchOverlay) || race.status === 'countdown' || race.status === 'running');

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

  // Stable city demo data generator
  const generateCityPlayers = useMemo(() => {
    const seed = `city-${cityName || 'Berlin'}-${Math.floor(center.lat * 1000)}-${Math.floor(center.lng * 1000)}`;
    const rng = seededRandom(seed);
    const demoNames = [
      'SpeedRunner23', 'FlashFeet', 'RocketRunner', 'TurboTom', 'LightningLisa',
      'FastFreddy', 'QuickQuinn', 'RapidRyan', 'SwiftSarah', 'ZoomZoe',
      'BlazeRunner', 'VelocityVic', 'DashDave', 'RushRita', 'BoltBen'
    ];
    
    return Array.from({ length: 15 }, (_, i) => ({
      id: `city-demo-${i}`,
      username: demoNames[i] || `CityRunner${String(i + 1).padStart(2, '0')}`,
      rank: i + 1,
      bestTimeSeconds: 9.2 + (i * 0.4) + (rng() * 0.3),
      distanceMeters: 100,
      location: { 
        lat: center.lat + (rng() - 0.5) * 0.01, 
        lng: center.lng + (rng() - 0.5) * 0.01 
      },
      colorHex: colorForUsernameToHex(demoNames[i] || `CityRunner${String(i + 1).padStart(2, '0')}`),
      source: 'demo' as const,
    }));
  }, [cityName, Math.floor(center.lat * 1000), Math.floor(center.lng * 1000)]);

  // Guests explore labeled demo previews without querying protected run data.
  // Database policies do not allow anonymous access to runner records.
  // Load leaderboard (ghost runs) for city - with demo data fallback
  useEffect(() => {
    if (!authUser) {
      setPlayers(generateCityPlayers);
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
        } else {
          // Use stable demo data for city leaderboard
          newPlayers = generateCityPlayers;
        }
        
        if (!isActive) return;
        setPlayers(newPlayers);
      } finally {
        if (isActive) setLoadingGhosts(false);
      }
    })();
    return () => {
      isActive = false;
    };
  }, [generateCityPlayers, cityName, authUser?.id]);

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

  // Keep sample race locations stable while the user pans/zooms or GPS drifts.
  // Regenerate only after a substantial actual move, never per ~10 m GPS fix.
  const [demoOrigin, setDemoOrigin] = useState<Coordinates | null>(null);
  useEffect(() => {
    if (!userCoords) return;
    setDemoOrigin(previous => {
      if (!previous ||
          haversineM(previous.lat, previous.lng, userCoords.lat, userCoords.lng) > 750) {
        return { lat: userCoords.lat, lng: userCoords.lng };
      }
      return previous;
    });
  }, [userCoords?.lat, userCoords?.lng]);

  // Stable demo runs generator
  const generateDemoRuns = useMemo(() => {
    if (!demoOrigin) return [];

    const seed = `demo-runs-${Math.floor(demoOrigin.lat * 10000)}-${Math.floor(demoOrigin.lng * 10000)}`;
    const rng = seededRandom(seed);
    const demoHosts = ['ChallengeMaster', 'RaceKing', 'SprintQueen'];
    const distances = [50, 75, 100];
    
    return Array.from({ length: 3 }, (_, i) => ({
      id: `demo-run-${i}`,
      hostUserId: `demo-host-${i}`,
      hostUsername: demoHosts[i],
      distanceMeters: distances[i],
      location: {
        lat: demoOrigin.lat + (rng() - 0.5) * 0.005, // ~250m radius
        lng: demoOrigin.lng + (rng() - 0.5) * 0.005,
      },
      createdAt: new Date(Date.now() - rng() * 300000).toISOString(), // Stable time in last 5 min
      targetDistanceM: distances[i],
    }));
  }, [demoOrigin?.lat, demoOrigin?.lng]);

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

  // Guests see clearly labeled sample challenges, not private Supabase rows.
  // First load may show a placeholder; background refreshes are completely silent.
  useEffect(() => {
    if (!authUser) {
      discoveryLoadedRef.current = false;
      setOpenRuns(generateDemoRuns);
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
            .filter((d: any) => d.status === 'open')
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
                targetDistanceM: d.target_distance_m || undefined,
              } as OpenRun;
            })
            .filter((run): run is OpenRun => run !== null);
        } else {
          mapped = generateDemoRuns;
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
  }, [generateDemoRuns, discoveryCoords?.lat, discoveryCoords?.lng, authUser?.id, discoveryRefreshTick]);

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
        .select('id, location')
        .eq('status', 'open')
        .limit(500);
      if (!active || error) return;
      setRegionalRuns((data ?? []).flatMap(row => {
        const location = parseGeographyPoint(row.location);
        return location ? [{ id: row.id as string, location }] : [];
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

  // No Realtime subscription while exploring as an unauthenticated guest.
  // Realtime updates for duels
  useEffect(() => {
    if (!authUser) { setRealtimeConnected(false); return; }
    setRealtimeConnected(false);
    const channel = supabase
      .channel('duels-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'duels' },
        async (payload: any) => {
          const row: any = payload.new ?? payload.old;
          if (!row) return;

          // Show match overlay if this duel becomes matched and involves current user
          if (
            payload.eventType === 'UPDATE' &&
            (row.status === 'matched' || (row.start_at && row.status === 'matched')) &&
            authUser &&
            (row.host_user_id === authUser.id || row.challenger_user_id === authUser.id)
          ) {
            const serverStart = row.start_at ? new Date(row.start_at).getTime() : Date.now() + 3000;
            const startsAt = Math.max(Date.now() + 1000, serverStart); // ensure at least 1s buffer
            const targetM = row.target_distance_m || 50;
            setMatchOverlay({ duelId: row.id, startsAt, targetDistanceM: targetM });
            setRace({ status: 'countdown', duelId: row.id, startsAt, targetDistanceM: targetM });
          }

          setOpenRuns((prev) => {
            const copy = [...prev];
            if (payload.eventType === 'DELETE' || (payload.eventType === 'UPDATE' && row.status !== 'open')) {
              return copy.filter((r) => r.id !== row.id);
            }
            // INSERT or UPDATE open
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
      .subscribe(status => setRealtimeConnected(status === 'SUBSCRIBED'));
    return () => {
      supabase.removeChannel(channel);
    };
  }, [authUser?.id]);

  // Auto-expire duels older than 30 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      const cutoff = Date.now() - 30 * 60 * 1000;
      setOpenRuns((prev) => prev.filter((r) => !r.createdAt || new Date(r.createdAt).getTime() >= cutoff));
    }, 60 * 1000);
    return () => clearInterval(interval);
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

    const { data, error } = await createDuel(supabase, {
      hostUserId: authUser.id,
      location: hostLocation,
      distanceKm: 1,
      targetDistanceM: distanceMeters,
    });
    if (error) throw error;
    if (!data?.id || data.status !== 'open') {
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
      targetDistanceM: distanceMeters,
    };
    setOpenRuns(previous => [created, ...previous.filter(run => run.id !== created.id)]);
    setHostedOpenDuels(previous => [
      { id: created.id, hostUserId: authUser.id, distanceMeters,
        createdAt: created.createdAt ?? null, location: created.location },
      ...previous.filter(run => run.id !== created.id),
    ]);
    setHostedDuelsLoadError(false);
    setRaceNotice(`Dein ${distanceMeters}-m-Rennen wurde erstellt. Warte auf einen zweiten Läufer; dann startet der Countdown.`);
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
        // Refresh own lobby statuses after a possible concurrent challenger join.
        void listHostedOpenDuels(supabase, authUser.id)
          .then(runs => { setHostedOpenDuels(runs); setHostedDuelsLoadError(false); })
          .catch(() => setHostedDuelsLoadError(true));
      }
    } finally {
      setCancellingRunId(null);
    }
  };

  // Joining and starting races are exclusively for signed-in accounts.
  const handleJoinRun = async (run: OpenRun) => {
    if (!requireRaceAccount()) return;
    if (!currentUser) return;

    // Signed-in runners may try explicitly labeled, non-scored sample races.
    if (run.id.startsWith('demo-run-')) {
      const startsAt = Date.now() + 3000; // 3 seconds countdown
      setMatchOverlay({ duelId: run.id, startsAt, targetDistanceM: run.targetDistanceM || run.distanceMeters });
      setRace({ status: 'countdown', duelId: run.id, startsAt, targetDistanceM: run.targetDistanceM || run.distanceMeters });
      // Remove the run from open runs
      setOpenRuns(prev => prev.filter(r => r.id !== run.id));
      return;
    }
    
    try {
      await joinDuel(supabase as any, run.id);
      // Success will trigger realtime update (status -> matched) and remove from open list
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to join duel', e);
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
        onWideViewChange={setWideMapView}
        hostDialogOpen={hostOpen}
        hostLocation={hostLocation}
        runs={openRuns.map((run, index) => ({
          ...arcadeRuns[index],
          location: run.location,
        }))}
        onSelectRun={setSelectedRunId}
        onJoinRun={joinArcadeRun}
        onCancelRun={cancelArcadeRun}
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
      {arcadeMapView === 'map' && (players.some((player) => player.source === 'demo') ||
        openRuns.some((run) => run.id.startsWith('demo-run-'))) && (
        <div className="runnit-arcade-demo-chip" role="status"
          title="Demo-Modus: einige Spieler oder Rennen sind frei erfunden">
          DEMO · BEISPIELRENNEN
        </div>
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
      {arcadeMapView === 'map' && wideMapView && (
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
        entries={arcadeRuns}
        selectedId={selectedRunId}
        onJoin={joinArcadeRun}
        onCancel={cancelArcadeRun}
        loading={loadingDuels && !discoveryLoadedRef.current}
        live={realtimeConnected}
      />

      {/* Map-only controls must not float over scrollable race cards. */}
      {arcadeMapView === 'map' && <div className="pointer-events-auto absolute right-4 top-[calc(9.4rem+env(safe-area-inset-top))] z-[950]">
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

      {/* Match countdown overlay */}
      {matchOverlay && (
        <MatchCountdownOverlay
          wakeStatus={wakeStatus}
          startsAt={matchOverlay.startsAt}
          onReady={async () => {
            if (!authUser) {
              setMatchOverlay(null);
              setRace({ status: 'idle' });
              navigate('/login?next=%2Fmap');
              return;
            }
            if (matchOverlay.duelId.startsWith('demo-run-')) return;
            try { await readyForDuel(supabase as any, matchOverlay.duelId); } catch (_e) {}
          }}
          onDone={() => {
            setMatchOverlay(null);
            if (!authUser) {
              setRace({ status: 'idle' });
              navigate('/login?next=%2Fmap');
              return;
            }
            if (race.status === 'countdown') {
              setRace({ status: 'running', duelId: race.duelId, startedAt: Date.now(), targetDistanceM: race.targetDistanceM });
            }
          }}
        />
      )}

      {race.status === 'running' && authUser && (
        <RaceOverlay
          wakeStatus={wakeStatus}
          startedAt={race.startedAt}
          targetDistanceM={race.targetDistanceM}
          onFinish={async (endedAt, metrics) => {
            const timeMs = endedAt - race.startedAt;
            // try submit result; ignore failure for now
            if (authUser && !race.duelId.startsWith('demo-run-')) {
              try {
                await submitDuelResult(supabase as any, race.duelId, timeMs, metrics);
              } catch (_e) {}
            }
            setRace({ status: 'finished', duelId: race.duelId, startedAt: race.startedAt, endedAt, targetDistanceM: race.targetDistanceM });
          }}
        />
      )}

      {race.status === 'finished' && authUser && (
        <RaceFinishedOverlay
          startedAt={race.startedAt}
          endedAt={race.endedAt}
          targetDistanceM={race.targetDistanceM}
          duelId={race.duelId}
          currentUser={currentUser}
          cityName={cityName}
          onAddToLeaderboard={(time) => {
            if (!authUser) return;
            setUserTimes(prev => [...prev, time]);
            // Add user to city leaderboard if they have a good time
            if (currentUser && time < 15) { // Only add if time is reasonable
              const newPlayer: Player = {
                id: currentUser.id,
                username: currentUser.username,
                rank: 1, // Will be recalculated
                bestTimeSeconds: time,
                distanceMeters: race.targetDistanceM,
                location: userCoords || { lat: 0, lng: 0 },
                colorHex: colorForUsernameToHex(currentUser.username),
                source: 'local-unverified',
              };
              setPlayers(prev => {
                const filtered = prev.filter(p => p.id !== currentUser.id);
                const updated = [newPlayer, ...filtered].sort((a, b) => a.bestTimeSeconds - b.bestTimeSeconds);
                return updated.map((p, i) => ({ ...p, rank: i + 1 }));
              });
            }
          }}
          onClose={() => {
            setRace({ status: 'idle' });
            // Optionally open leaderboard after race
            setTimeout(() => setGhostOpen(true), 500);
          }}
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
              <h2 id="cancel-hosted-title">Rennen wirklich <em>absagen?</em></h2>
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

function MatchCountdownOverlay({ startsAt, wakeStatus, onReady, onDone }: { startsAt: number; wakeStatus: ScreenWakeLockStatus | 'idle'; onReady: () => void; onDone: () => void }) {
  const [remainingMs, setRemainingMs] = useState(Math.max(0, startsAt - Date.now()));
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    onReady();
    // Simple audio sequence: 3,2,1, go
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playBeep = (t: number, freq: number, durMs: number, gain=0.2) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        g.gain.value = gain;
        osc.connect(g).connect(ctx.destination);
        osc.start(ctx.currentTime + t);
        osc.stop(ctx.currentTime + t + durMs / 1000);
      };
      const total = Math.max(0, (startsAt - Date.now()) / 1000);
      // schedule beeps at 3,2,1,go within the remaining timeframe
      // fallback if short: only final go
      if (total > 2.5) {
        playBeep(total - 3, 600, 120);
        playBeep(total - 2, 650, 120);
        playBeep(total - 1, 700, 120);
        playBeep(total - 0.02, 900, 240, 0.25);
      } else if (total > 0.8) {
        playBeep(total - 1, 700, 120);
        playBeep(total - 0.02, 900, 240, 0.25);
      } else {
        playBeep(0, 900, 200, 0.25);
      }
    } catch {}
    const id = setInterval(() => {
      const ms = Math.max(0, startsAt - Date.now());
      setRemainingMs(ms);
      if (ms <= 0) {
        clearInterval(id);
        onDone();
      }
    }, 50);
    return () => clearInterval(id);
  }, [startsAt, onDone]);
  const seconds = Math.ceil(remainingMs / 1000);
  return (
    <div className="fixed inset-0 z-[1250] flex flex-col items-center justify-center bg-[#070913]/90 px-5 text-white backdrop-blur-xl">
      <p className="mb-8 text-xs font-black uppercase tracking-[0.32em] text-emerald-300">RUNNIT · READY</p>
      <div className="flex h-44 w-44 items-center justify-center rounded-[48px] border border-violet-300/40 bg-gradient-to-br from-violet-500/35 to-cyan-500/10 text-7xl font-black tabular-nums shadow-[0_0_90px_rgba(139,92,246,.24)]">
        {seconds}
      </div>
      <p className="mt-8 text-sm font-semibold text-white/60">Mach dich bereit.</p>
      {wakeStatus !== 'idle' && <p role="status" className={wakeStatus === 'held' ? 'mt-3 max-w-sm text-center text-xs text-emerald-200' : 'mt-3 max-w-sm text-center text-xs text-amber-200'}>{screenWakeLockMessage(wakeStatus)}</p>}
    </div>
  );
}

function RaceOverlay({ startedAt, targetDistanceM, wakeStatus, onFinish }: { startedAt: number; targetDistanceM: number; wakeStatus: ScreenWakeLockStatus | 'idle'; onFinish: (endedAt: number, metrics?: DuelMetrics) => void }) {
  const [elapsedMs, setElapsedMs] = useState(Math.max(0, Date.now() - startedAt));
  const [acceptedDistanceM, setAcceptedDistanceM] = useState(0);
  const [displayDistanceM, setDisplayDistanceM] = useState(0);
  const [maxSpeed, setMaxSpeed] = useState(0);
  const [maxAccel, setMaxAccel] = useState(0);
  const [accumAccuracyM, setAccumAccuracyM] = useState(0);
  const [samplesUsed, setSamplesUsed] = useState(0);
  const lastSampleRef = useRef<{ t: number; lat: number; lng: number; v: number } | null>(null);
  const liveStepCounter = useRef(new LiveStepPeakCounter());
  const [liveStepCount, setLiveStepCount] = useState(0);
  const overTargetStreakRef = useRef(0);
  const finishedRef = useRef(false);
  const watchIdRef = useRef<number | null>(null);
  useEffect(() => {
    const id = setInterval(() => {
      setElapsedMs(Math.max(0, Date.now() - startedAt));
    }, 50);
    return () => clearInterval(id);
  }, [startedAt]);

  // Very simple GPS sampler with accuracy filter, EMA smoothing, and sanity caps
  useEffect(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) return;
    const handle = (pos: GeolocationPosition) => {
      if (finishedRef.current) return;
      const t = Date.now();
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const acc = typeof pos.coords.accuracy === 'number' ? pos.coords.accuracy : 9999;
      // Filter: require reasonable accuracy
      const MAX_ACC_M = 15;
      if (acc > MAX_ACC_M) return;
      const prev = lastSampleRef.current;
      if (prev) {
        const dt = (t - prev.t) / 1000;
        const MIN_DT = 0.2;
        if (dt < MIN_DT) return;
        const d = haversineM(prev.lat, prev.lng, lat, lng);
        const v = d / Math.max(dt, 1e-3);
        // Speed cap (~43 km/h)
        const MAX_V = 12; // m/s
        if (v > MAX_V) {
          // Skip unrealistic spikes
          lastSampleRef.current = { t, lat, lng, v: prev.v };
          return;
        }
        const a = (v - prev.v) / Math.max(dt, 1e-3);
        // Accept sample
        setMaxSpeed((x) => Math.max(x, v));
        setMaxAccel((x) => Math.max(x, Math.abs(a)));
        setSamplesUsed((n) => n + 1);
        setAccumAccuracyM((s) => s + acc);
        setAcceptedDistanceM((prevDist) => {
          const nextDist = prevDist + d;
          // EMA smoothing for display
          const ALPHA = 0.35;
          setDisplayDistanceM((disp) => disp + ALPHA * (nextDist - disp));
          // Finish check: require two consecutive accepted samples over target
          const margin = 0.5;
          if (nextDist >= Math.max(1, targetDistanceM - margin)) {
            overTargetStreakRef.current += 1;
          } else {
            overTargetStreakRef.current = 0;
          }
          if (overTargetStreakRef.current >= 2 && !finishedRef.current) {
            finishedRef.current = true;
            try {
              const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const osc = ctx.createOscillator();
              const g = ctx.createGain();
              osc.type = 'triangle';
              osc.frequency.value = 950;
              g.gain.value = 0.25;
              osc.connect(g).connect(ctx.destination);
              osc.start();
              osc.stop(ctx.currentTime + 0.22);
            } catch {}
            const steps = liveStepCounter.current.count;
            const stepLen = steps > 0 ? nextDist / steps : undefined;
            onFinish(Date.now(), {
              stepsCount: steps,
              stepLengthAvgM: stepLen,
              maxSpeedMps: Math.max(maxSpeed, v),
              maxAccelMps2: maxAccel,
              distanceM: nextDist,
              metricsJson: { avgAccuracyM: (accumAccuracyM + acc) / Math.max(1, samplesUsed + 1), samplesUsed: samplesUsed + 1 },
            });
          }
          return nextDist;
        });
        lastSampleRef.current = { t, lat, lng, v };
      } else {
        lastSampleRef.current = { t, lat, lng, v: 0 };
      }
    };
    try {
      watchIdRef.current = navigator.geolocation.watchPosition(handle, () => {}, {
        enableHighAccuracy: true,
        maximumAge: 500,
        timeout: 5000,
      });
    } catch {}
    return () => {
      if (watchIdRef.current !== null) {
        try { navigator.geolocation.clearWatch(watchIdRef.current); } catch {}
      }
    };
  }, []);

  // Shared foreground peak detector; no extrapolation across iOS sensor suspensions.
  useEffect(() => {
    const handler = (event: DeviceMotionEvent) => {
      if (finishedRef.current) return;
      const a = event.acceleration;
      if (!a || a.x === null || a.y === null || a.z === null) return;
      const magnitude = Math.hypot(a.x, a.y, a.z);
      const updated = liveStepCounter.current.push({
        timestampMs: performance.now(),
        accelerationMagnitudeMps2: magnitude,
      });
      if (updated !== null) setLiveStepCount(updated);
    };
    window.addEventListener('devicemotion', handler, { passive: true });
    return () => window.removeEventListener('devicemotion', handler);
  }, []);

  // Auto-finish moved into GPS sampler for accuracy-stable detection
  const seconds = (elapsedMs / 1000).toFixed(2);
  return (
    <div className="fixed inset-0 z-[1250] flex flex-col items-center justify-center gap-6 bg-[#070913]/90 px-5 text-white backdrop-blur-xl">
      <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-300">RUNNIT · LIVE RACE</p>
      {wakeStatus !== 'idle' && <p role="status" className={wakeStatus === 'held' ? 'max-w-sm text-center text-xs text-emerald-200' : 'max-w-sm text-center text-xs text-amber-200'}>{screenWakeLockMessage(wakeStatus)}</p>}
      <div className="w-full max-w-sm rounded-[32px] border border-violet-300/25 bg-gradient-to-br from-violet-500/25 to-cyan-500/10 p-8 text-center shadow-[0_0_60px_rgba(139,92,246,.13)]">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/50">Laufzeit</p>
        <p className="mt-3 text-6xl font-black tracking-[-0.07em] tabular-nums text-white">{seconds}<span className="ml-1 text-2xl text-emerald-300">s</span></p>
        <p className="mt-5 text-sm font-semibold tabular-nums text-white/65">{displayDistanceM.toFixed(1)} / {targetDistanceM} m</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-violet-400 via-cyan-300 to-emerald-300" style={{ width: `${Math.max(0, Math.min(100, displayDistanceM / targetDistanceM * 100))}%` }} />
        </div>
        <div role="status" aria-live="polite" aria-atomic="true" className="mt-5 border-t border-white/15 pt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-cyan-200">Live-Schrittspitzen · experimentell</p>
          <p className="mt-1 text-4xl font-black tabular-nums text-white">{liveStepCount}</p>
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3 text-center text-xs font-semibold tabular-nums text-white/55">
        GPS Max. {maxSpeed.toFixed(2)} m/s · Beschleunigung {maxAccel.toFixed(2)} m/s²
      </div>
      <button
        onClick={() => {
          const steps = liveStepCounter.current.count;
          const stepLen = steps > 0 ? acceptedDistanceM / steps : undefined;
          onFinish(Date.now(), {
            stepsCount: steps,
            stepLengthAvgM: stepLen,
            maxSpeedMps: maxSpeed,
            maxAccelMps2: maxAccel,
            distanceM: acceptedDistanceM,
          });
        }}
        className="min-h-14 w-full max-w-sm rounded-2xl border border-rose-300/30 bg-rose-500/20 px-6 py-4 text-sm font-extrabold text-white transition hover:bg-rose-500/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        Lauf beenden
      </button>
    </div>
  );
}

function RaceFinishedOverlay({ 
  startedAt, 
  endedAt, 
  targetDistanceM, 
  duelId, 
  onClose,
  currentUser,
  cityName,
  onAddToLeaderboard 
}: { 
  startedAt: number; 
  endedAt: number; 
  targetDistanceM: number; 
  duelId: string; 
  onClose: () => void;
  currentUser: CurrentUser | null;
  cityName: string | null;
  onAddToLeaderboard?: (time: number) => void;
}) {
  const seconds = ((endedAt - startedAt) / 1000).toFixed(2);
  const timeInSeconds = (endedAt - startedAt) / 1000;
  
  // Avoid repeatedly inserting a locally displayed result on parent re-renders.
  const recordedLocalResultRef = useRef(false);
  useEffect(() => {
    if (recordedLocalResultRef.current || !currentUser || !onAddToLeaderboard) return;
    recordedLocalResultRef.current = true;
    onAddToLeaderboard(timeInSeconds);
  }, [currentUser, onAddToLeaderboard, timeInSeconds]);

  return (
    <div className="fixed inset-0 z-[1250] flex items-center justify-center bg-[#050611]/90 px-4 text-white backdrop-blur-xl">
      <div className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-[30px] border border-violet-300/20 bg-gradient-to-br from-[#1b1a32] to-[#101322] p-6 shadow-[0_20px_70px_rgba(0,0,0,.5)]">
        <div className="mb-3 text-center text-[11px] font-extrabold uppercase tracking-[0.25em] text-emerald-300">RUNNIT · FINISH</div>
        <h2 className="text-center text-xl font-extrabold">🏁 Rennen beendet!</h2>
        <div className="mb-2 mt-4 text-center text-5xl font-black tracking-tight tabular-nums text-emerald-300">{seconds}<span className="ml-1 text-xl">s</span></div>
        <div className="mb-4 text-center text-xs text-white/70">Zieldistanz: {targetDistanceM}m · Ergebnis nicht verifiziert</div>
        
        {/* Local display does not establish eligibility for any official ranking. */}
        <div className="mb-4 rounded-lg border border-amber-300/30 bg-amber-400/10 p-3 text-center">
          <div className="text-sm font-semibold text-amber-200">
            Laufzeit noch nicht verifiziert
          </div>
          <div className="mt-1 text-xs leading-5 text-amber-100">
            Das Ergebnis kann als lokale, ungeprüfte Zeit angezeigt werden.
            Eine offizielle Stadt-, Deutschland- oder Weltplatzierung ist nicht bestätigt.
          </div>
        </div>

        <SideBySideResults duelId={duelId} />
        
        <div className="mt-5 space-y-2">
          <button
            onClick={() => {
              // Show leaderboards after race
              onClose();
            }}
            className="w-full rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 px-5 py-3 text-sm font-extrabold text-white shadow-[0_12px_28px_rgba(99,102,241,.20)] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            📊 Leaderboards anzeigen
          </button>
          <button
            onClick={onClose}
            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-bold text-white/75 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}

function SideBySideResults({ duelId }: { duelId?: string }) {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => {
    (async () => {
      if (!duelId) return;
      const { data } = await getDuelResults(supabase as any, duelId);
      setRows(data || null);
    })();
  }, [duelId]);
  return (
    <div className="rounded-lg bg-white/5 p-3 ring-1 ring-white/10">
      <div className="mb-2 grid grid-cols-2 gap-2 text-xs uppercase tracking-wide text-white/60">
        <div>{rows?.[0]?.username || 'Runner A'}</div>
        <div className="text-right">{rows?.[1]?.username || 'Runner B'}</div>
      </div>
      <div className="space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md bg-white/10 p-2">Time: {rows?.[0]?.time_ms ? (rows[0].time_ms/1000).toFixed(2)+'s' : '—'}</div>
          <div className="rounded-md bg-white/10 p-2 text-right">Time: {rows?.[1]?.time_ms ? (rows[1].time_ms/1000).toFixed(2)+'s' : '—'}</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md bg-white/10 p-2">Max v: {rows?.[0]?.max_speed_mps ? rows[0].max_speed_mps.toFixed(2)+' m/s' : '—'}</div>
          <div className="rounded-md bg-white/10 p-2 text-right">Max v: {rows?.[1]?.max_speed_mps ? rows[1].max_speed_mps.toFixed(2)+' m/s' : '—'}</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md bg-white/10 p-2">Max a: {rows?.[0]?.max_accel_mps2 ? rows[0].max_accel_mps2.toFixed(2)+' m/s²' : '—'}</div>
          <div className="rounded-md bg-white/10 p-2 text-right">Max a: {rows?.[1]?.max_accel_mps2 ? rows[1].max_accel_mps2.toFixed(2)+' m/s²' : '—'}</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md bg-white/10 p-2">Steps: {rows?.[0]?.steps_count ?? '—'}</div>
          <div className="rounded-md bg-white/10 p-2 text-right">Steps: {rows?.[1]?.steps_count ?? '—'}</div>
        </div>
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

