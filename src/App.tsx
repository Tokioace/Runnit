import { useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Footprints, LoaderCircle } from 'lucide-react';
import MapScreen from './screens/MapScreen';
import HomeScreen from './screens/HomeScreen';
import DashboardScreen from './screens/DashboardScreen';
import LeaderboardScreen from './screens/LeaderboardScreen';
import ProfileScreen from './screens/ProfileScreen';
import GpsLabScreen from './screens/GpsLabScreen';
import GpsFieldTestScreen from './screens/GpsFieldTestScreen';
import StrideCalibrationScreen from './screens/StrideCalibrationScreen';
import FusionLabScreen from './screens/FusionLabScreen';
import SprintArenaLabScreen from './screens/SprintArenaLabScreen';
import WelcomeAuthScreen from './components/auth/WelcomeAuthScreen';
import AuthCallbackScreen from './components/auth/AuthCallbackScreen';
import { AUTH_CALLBACK_PATH } from './lib/authRedirect';
import { useSupabaseUser } from './hooks/useSupabaseUser';

const GUEST_SESSION_KEY = 'runnit:guest-mode';
const APP_PATHS = new Set(['/', '/home', '/map', '/leaderboard', '/profile', '/gps-lab', '/gps-field-test', '/calibration', '/fusion-lab', '/sprint-lab']);

/**
 * Guest mode is a local UI preference, NOT a Supabase authentication identity.
 * Database permissions and RPC checks remain authoritative: guests have no
 * permission to create, join or start a race or access private runner records.
 */
function wasGuestModeChosen(): boolean {
  try {
    return window.sessionStorage.getItem(GUEST_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

function safeLoginReturnPath(search: string): string {
  const next = new URLSearchParams(search).get('next');
  return next && APP_PATHS.has(next) ? next : '/home';
}

export default function App() {
  const auth = useSupabaseUser();
  const location = useLocation();
  const navigate = useNavigate();
  const [guestAccess, setGuestAccess] = useState(wasGuestModeChosen);
  const previousSignedInId = useRef<string | null>(null);

  // On navigation, do not retain the previous screen's scroll position.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const enterGuestMode = () => {
    // This is only a browsing preference. It never creates an Auth user.
    try { window.sessionStorage.setItem(GUEST_SESSION_KEY, '1'); } catch { /* Safari can restrict storage. */ }
    setGuestAccess(true);
    navigate('/home');
  };

  const enterApp = () => {
    if (auth.user) {
      navigate('/home');
    } else {
      enterGuestMode();
    }
  };

  useEffect(() => {
    if (auth.loading) return;
    // Only a real signed-in -> signed-out transition returns to the welcome
    // screen. An unauthenticated first launch is not an implicit logout.
    if (previousSignedInId.current && !auth.user) {
      navigate('/', { replace: true });
    }
    previousSignedInId.current = auth.user?.id ?? null;
  }, [auth.loading, auth.user?.id, navigate]);

  if (auth.loading) {
    return (
      <main role="status" aria-live="polite" className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 bg-[#090b13] px-6 text-white">
        <div className="flex h-16 w-16 items-center justify-center rounded-[20px] border border-violet-300/30 bg-violet-500/20">
          <Footprints className="h-8 w-8 text-violet-200" aria-hidden="true" />
        </div>
        <LoaderCircle className="h-6 w-6 animate-spin text-emerald-300" aria-hidden="true" />
        <p className="text-sm font-semibold text-white/60">Deine Anmeldung wird geprüft …</p>
      </main>
    );
  }

  if (location.pathname === AUTH_CALLBACK_PATH) {
    return auth.user ? <Navigate to="/home" replace /> : <AuthCallbackScreen onContinueAsGuest={enterGuestMode} />;
  }

  // Dedicated routes for the two intents. Keep the previous
  // /login?mode=signup link supported for existing bookmarks.
  const accountPage = location.pathname === '/login' || location.pathname === '/register';
  const accountMode = location.pathname === '/register' ||
    new URLSearchParams(location.search).get('mode') === 'signup' ? 'signup' : 'signin';

  // Authenticated users do not need a second account or login.
  if (auth.user && accountPage) {
    return <Navigate to={safeLoginReturnPath(location.search)} replace />;
  }

  if (!auth.user && accountPage) {
    return (
      <WelcomeAuthScreen
        key={accountMode}
        initialMode={accountMode}
        signInWithProvider={auth.signInWithProvider}
        sendMagicLink={auth.sendMagicLink}
        verifyEmailOtp={auth.verifyEmailOtp}
        signIn={auth.signIn}
        signUp={auth.signUp}
        loadError={auth.loadError}
        onContinueAsGuest={enterGuestMode}
      />
    );
  }

  return (
    <div className="dark">
      <Routes>
        <Route path="/" element={<HomeScreen isSignedIn={Boolean(auth.user)} guestAccess={guestAccess} onStart={enterApp} onContinueAsGuest={enterGuestMode} />} />
        <Route path="/home" element={<DashboardScreen />} />
        <Route path="/map" element={<MapScreen />} />
        <Route path="/leaderboard" element={<LeaderboardScreen />} />
        <Route path="/profile" element={<ProfileScreen />} />
        <Route path="/gps-lab" element={<GpsLabScreen />} />
        <Route path="/gps-field-test" element={<GpsFieldTestScreen />} />
        <Route path="/calibration" element={<StrideCalibrationScreen />} />
        <Route path="/fusion-lab" element={<FusionLabScreen />} />
        <Route path="/sprint-lab" element={<SprintArenaLabScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
