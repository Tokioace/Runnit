import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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
};

type OpenRun = {
  id: string;
  hostUsername: string;
  distanceMeters: number;
  location: Coordinates;
};

type CurrentUser = {
  id: string;
  username: string;
  location?: Coordinates;
};

// Minimal i18n helper (EN only for now)
type TranslationDict = Record<string, string>;
const en: TranslationDict = {
  'buttons.ghostRun': 'Ghost Run',
  'buttons.hostRun': 'Host Run',
  'buttons.cancel': 'Cancel',
  'buttons.joinRun': 'Join Run',

  'leaderboard.title': 'Top 100 in your city',
  'leaderboard.rank': 'Rank',
  'leaderboard.username': 'Username',
  'leaderboard.bestTime': 'Best',
  'leaderboard.distance': 'Distance',
  'leaderboard.you': 'You',

  'host.title': 'Host a 1v1 Sprint',
  'host.distanceLabel': 'Distance',
  'host.selectDistance': 'Select distance',
  'host.distance.50': '50 m',
  'host.distance.75': '75 m',
  'host.distance.100': '100 m',
};

function useI18n() {
  const t = (key: string): string => {
    return en[key] ?? key;
  };
  return { t };
}

// Geolocation hook
function useUserLocation() {
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      return;
    }

    const success = (pos: GeolocationPosition) => {
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    };

    const error = (err: GeolocationPositionError) => {
      if (err.code === err.PERMISSION_DENIED) {
        setPermissionDenied(true);
      }
    };

    // Try watchPosition for continuous updates
    try {
      watchIdRef.current = navigator.geolocation.watchPosition(success, error, {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 8000,
      });
    } catch (_e) {
      // ignore
    }

    // Fallback: single read if no updates yet
    if (!coords) {
      navigator.geolocation.getCurrentPosition(success, error, {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 8000,
      });
    }

    return () => {
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        try {
          navigator.geolocation.clearWatch(watchIdRef.current);
        } catch (_e) {
          // ignore
        }
      }
    };
  }, []);

  return { coords, permissionDenied };
}

// Utility: format seconds to 0.00s string
function formatSecondsToTimeString(seconds: number): string {
  return `${seconds.toFixed(2)}s`;
}

// Utility: create badge-like DivIcon (no external assets)
type BadgeIconOptions = {
  backgroundHex: string;
  ringHex?: string;
  contentHtml?: string; // inner HTML (emoji/text)
  sizePx?: number;
  showPing?: boolean;
  pingColorHex?: string;
  extraClassNames?: string;
};

function createBadgeDivIcon(options: BadgeIconOptions): L.DivIcon {
  const {
    backgroundHex,
    ringHex = '#111827',
    contentHtml = '',
    sizePx = 36,
    showPing = false,
    pingColorHex = backgroundHex,
    extraClassNames = '',
  } = options;

  const diameter = sizePx;
  const half = diameter / 2;

  // Use minimal inline styles to avoid external CSS
  const html = `
    <div style="position: relative; width: ${diameter}px; height: ${diameter}px;">
      ${
        showPing
          ? `<span style="position:absolute; inset:0; border-radius:9999px; background:${pingColorHex}; opacity:0.35; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>`
          : ''
      }
      <div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; border-radius:9999px; background:${backgroundHex}; box-shadow: 0 0 0 3px ${ringHex}; color:#fff; font-size:${Math.max(12, Math.floor(sizePx/2.75))}px; font-weight:700;">
        ${contentHtml}
      </div>
    </div>
  `;

  // Attach keyframes for ping if not already present
  if (typeof document !== 'undefined') {
    const styleId = 'runnit-ping-keyframes';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `@keyframes ping { 0% { transform: scale(1); opacity: 0.6; } 75%, 100% { transform: scale(2.25); opacity: 0; } }`;
      document.head.appendChild(style);
    }
  }

  return L.divIcon({
    html,
    className: `runnit-badge ${extraClassNames}`,
    iconSize: [diameter, diameter],
    iconAnchor: [half, half],
    popupAnchor: [0, -half],
  });
}

// Marker utility component
type MapBadgeMarkerProps = {
  position: LatLngExpression;
  iconOptions: BadgeIconOptions;
  children?: React.ReactNode;
};

function MapBadgeMarker(props: MapBadgeMarkerProps) {
  const { position, iconOptions, children } = props;
  const icon = useMemo(() => createBadgeDivIcon(iconOptions), [iconOptions]);
  return <Marker position={position} icon={icon}>{children}</Marker>;
}

// Recenter map when position changes initially
function RecenterOnUser({ position }: { position: Coordinates | null }) {
  const map = useMap();
  const hasCenteredRef = useRef(false);

  useEffect(() => {
    if (position && !hasCenteredRef.current) {
      map.setView([position.lat, position.lng], Math.max(map.getZoom(), 16), {
        animate: true,
      });
      hasCenteredRef.current = true;
    }
  }, [map, position]);

  return null;
}

// Data generators (placeholder deterministic content; replace with API later)
function seededRandom(seed: number) {
  let t = seed + 0x6D2B79F5;
  return function () {
    t += 0x9E3779B9;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), 1 | x);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function generateTopPlayers(center: Coordinates): Player[] {
  const rand = seededRandom(42);
  const players: Player[] = [];
  const distances = [50, 75, 100];
  for (let i = 1; i <= 100; i++) {
    const d = distances[Math.floor(rand() * distances.length)];
    const jitterLat = (rand() - 0.5) * 0.02;
    const jitterLng = (rand() - 0.5) * 0.02;
    const best = 6.7 + rand() * 3.2; // 6.7s .. ~9.9s
    const color = `hsl(${Math.floor(rand() * 360)} 70% 45%)`;
    players.push({
      id: `p_${i}`,
      username: `runner${String(i).padStart(2, '0')}`,
      rank: i,
      bestTimeSeconds: best,
      distanceMeters: d,
      location: { lat: center.lat + jitterLat, lng: center.lng + jitterLng },
      colorHex: colorToHex(color),
    });
  }
  return players;
}

function generateOpenRuns(center: Coordinates): OpenRun[] {
  const rand = seededRandom(7);
  const runs: OpenRun[] = [];
  const distances = [50, 75, 100];
  const num = 6;
  for (let i = 0; i < num; i++) {
    const jitterLat = (rand() - 0.5) * 0.01;
    const jitterLng = (rand() - 0.5) * 0.01;
    runs.push({
      id: `run_${i + 1}`,
      hostUsername: `host_${i + 1}`,
      distanceMeters: distances[Math.floor(rand() * distances.length)],
      location: { lat: center.lat + jitterLat, lng: center.lng + jitterLng },
    });
  }
  return runs;
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

// Ghost Leaderboard Modal
function GhostLeaderboardModal({
  open,
  onClose,
  players,
  currentUser,
}: {
  open: boolean;
  onClose: () => void;
  players: Player[];
  currentUser: CurrentUser | null;
}) {
  const { t } = useI18n();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/60">
      <div className="w-full max-w-md rounded-t-2xl bg-[#0b0b0d] p-4 shadow-2xl ring-1 ring-white/10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">{t('leaderboard.title')}</h2>
          <button
            onClick={onClose}
            className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/30"
            aria-label="Close leaderboard"
          >
            ✕
          </button>
        </div>
        <div className="mb-2 grid grid-cols-12 gap-2 px-1 text-[11px] uppercase tracking-wide text-white/60">
          <div className="col-span-2">{t('leaderboard.rank')}</div>
          <div className="col-span-5">{t('leaderboard.username')}</div>
          <div className="col-span-3">{t('leaderboard.bestTime')}</div>
          <div className="col-span-2 text-right">{t('leaderboard.distance')}</div>
        </div>
        <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
          {players.slice(0, 100).map((p) => (
            <div
              key={p.id}
              className="grid grid-cols-12 items-center gap-2 rounded-lg bg-white/5 p-2 ring-1 ring-white/5"
            >
              <div className="col-span-2 text-sm font-semibold text-white/90">#{p.rank}</div>
              <div className="col-span-5 flex items-center gap-2 text-sm text-white">
                <Avatar name={p.username} colorHex={p.colorHex} />
                <span className="truncate">{p.username}</span>
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
            <div className="mb-1 text-[10px] uppercase tracking-wide text-white/50">{t('leaderboard.you')}</div>
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
  defaultDistance,
}: {
  open: boolean;
  onClose: () => void;
  onHost: (distanceMeters: number) => void;
  defaultDistance?: number;
}) {
  const { t } = useI18n();
  const [distance, setDistance] = useState<number>(defaultDistance ?? 50);

  useEffect(() => {
    if (open) {
      setDistance(defaultDistance ?? 50);
    }
  }, [open, defaultDistance]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/60">
      <div className="w-full max-w-md rounded-t-2xl bg-[#0b0b0d] p-4 shadow-2xl ring-1 ring-white/10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">{t('host.title')}</h2>
          <button
            onClick={onClose}
            className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/30"
            aria-label="Close host dialog"
          >
            ✕
          </button>
        </div>
        <label className="mb-2 block text-sm font-medium text-white/80">
          {t('host.distanceLabel')}
        </label>
        <div className="mb-5">
          <select
            value={distance}
            onChange={(e) => setDistance(parseInt(e.target.value))}
            className="w-full rounded-lg bg-white/5 p-3 text-white outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-indigo-500"
            aria-label={t('host.selectDistance')}
          >
            <option value={50}>{t('host.distance.50')}</option>
            <option value={75}>{t('host.distance.75')}</option>
            <option value={100}>{t('host.distance.100')}</option>
          </select>
        </div>
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/30"
          >
            {t('buttons.cancel')}
          </button>
          <button
            onClick={() => {
              onHost(distance);
              onClose();
            }}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {t('buttons.hostRun')}
          </button>
        </div>
      </div>
    </div>
  );
}

// Main Screen
export default function MapScreen() {
  const { t } = useI18n();
  const { coords: userCoords } = useUserLocation();

  const defaultCenter = useMemo<Coordinates>(() => ({ lat: 52.520008, lng: 13.404954 }), []); // Berlin
  const center = userCoords ?? defaultCenter;

  const [currentUser] = useState<CurrentUser>({ id: 'me', username: 'you' });
  const [ghostOpen, setGhostOpen] = useState(false);
  const [hostOpen, setHostOpen] = useState(false);

  const [players, setPlayers] = useState<Player[]>(() => generateTopPlayers(center));
  const [openRuns, setOpenRuns] = useState<OpenRun[]>(() => generateOpenRuns(center));

  // If user location is obtained later, update generated data near them once (for relevance)
  const playersInitializedRef = useRef(false);
  const runsInitializedRef = useRef(false);
  useEffect(() => {
    if (userCoords && !playersInitializedRef.current) {
      setPlayers(generateTopPlayers(userCoords));
      playersInitializedRef.current = true;
    }
  }, [userCoords]);
  useEffect(() => {
    if (userCoords && !runsInitializedRef.current) {
      setOpenRuns(generateOpenRuns(userCoords));
      runsInitializedRef.current = true;
    }
  }, [userCoords]);

  // Host a run: create local open run marker at user location
  const handleHostRun = (distanceMeters: number) => {
    if (!userCoords) return;
    const newRun: OpenRun = {
      id: `run_local_${Date.now()}`,
      hostUsername: currentUser.username,
      distanceMeters,
      location: { ...userCoords },
    };
    setOpenRuns((prev) => [newRun, ...prev]);
  };

  // Icons
  const userIconOptions: BadgeIconOptions = useMemo(
    () => ({
      backgroundHex: '#2563eb',
      ringHex: '#0b0b0d',
      contentHtml: '',
      sizePx: 18,
      showPing: true,
      pingColorHex: '#3b82f6',
      extraClassNames: 'user-badge',
    }),
    []
  );

  function getPlayerIconOptions(player: Player): BadgeIconOptions {
    const isTop3 = player.rank <= 3;
    const medal = player.rank === 1 ? '🥇' : player.rank === 2 ? '🥈' : player.rank === 3 ? '🥉' : '';
    return {
      backgroundHex: isTop3 ? '#111827' : '#1f2937',
      ringHex: isTop3 ? '#fbbf24' : '#111827',
      contentHtml: isTop3 ? medal : player.username[0]?.toUpperCase() ?? 'R',
      sizePx: isTop3 ? 36 : 28,
      showPing: false,
      extraClassNames: 'player-badge',
    };
  }

  function getOpenRunIconOptions(): BadgeIconOptions {
    return {
      backgroundHex: '#b91c1c',
      ringHex: '#111827',
      contentHtml: '🏁',
      sizePx: 28,
      showPing: true,
      pingColorHex: '#ef4444',
      extraClassNames: 'openrun-badge',
    };
  }

  return (
    <div className="relative h-screen w-screen bg-black">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={14}
        zoomControl={false}
        style={{ height: '100%', width: '100%' }}
        preferCanvas
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        <RecenterOnUser position={userCoords} />

        {userCoords ? (
          <MapBadgeMarker
            position={[userCoords.lat, userCoords.lng]}
            iconOptions={userIconOptions}
          />
        ) : null}

        {players.map((p) => (
          <MapBadgeMarker
            key={p.id}
            position={[p.location.lat, p.location.lng]}
            iconOptions={getPlayerIconOptions(p)}
          >
            <Popup>
              <div className="min-w-[180px] space-y-1 text-[13px] text-white">
                <div className="flex items-center gap-2">
                  <Avatar name={p.username} colorHex={p.colorHex} />
                  <div className="flex flex-col">
                    <span className="font-semibold">{p.username}</span>
                    <span className="text-white/60">#{p.rank}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-white/80">
                  <span>{formatSecondsToTimeString(p.bestTimeSeconds)}</span>
                  <span>{p.distanceMeters}m</span>
                </div>
              </div>
            </Popup>
          </MapBadgeMarker>
        ))}

        {openRuns.map((r) => (
          <MapBadgeMarker
            key={r.id}
            position={[r.location.lat, r.location.lng]}
            iconOptions={getOpenRunIconOptions()}
          >
            <Popup>
              <div className="min-w-[200px] space-y-2 text-[13px] text-white">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">@{r.hostUsername}</div>
                  <div className="text-white/70">{r.distanceMeters}m</div>
                </div>
                <button
                  className="w-full rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-400"
                >
                  {t('buttons.joinRun')}
                </button>
              </div>
            </Popup>
          </MapBadgeMarker>
        ))}
      </MapContainer>

      {/* Ghost Run main button */}
      <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center">
        <button
          onClick={() => setGhostOpen(true)}
          className="pointer-events-auto inline-flex items-center justify-center rounded-full bg-indigo-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-indigo-900/40 ring-1 ring-white/10 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          aria-label={t('buttons.ghostRun')}
        >
          {t('buttons.ghostRun')}
        </button>
      </div>

      {/* Host 1v1 FAB */}
      <div className="pointer-events-none absolute bottom-5 right-5">
        <button
          onClick={() => setHostOpen(true)}
          className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-2xl shadow-lg ring-1 ring-white/15 backdrop-blur hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/30"
          aria-label={t('buttons.hostRun')}
        >
          🏁
        </button>
      </div>

      <GhostLeaderboardModal
        open={ghostOpen}
        onClose={() => setGhostOpen(false)}
        players={players}
        currentUser={currentUser}
      />

      <HostRunDialog
        open={hostOpen}
        onClose={() => setHostOpen(false)}
        onHost={handleHostRun}
        defaultDistance={50}
      />
    </div>
  );
}

