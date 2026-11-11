import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Footprints, LoaderCircle } from 'lucide-react';
import MapScreen from './screens/MapScreen';
import HomeScreen from './screens/HomeScreen';
import LeaderboardScreen from './screens/LeaderboardScreen';
import ProfileScreen from './screens/ProfileScreen';
import GpsLabScreen from './screens/GpsLabScreen';
import StrideCalibrationScreen from './screens/StrideCalibrationScreen';
import FusionLabScreen from './screens/FusionLabScreen';
import SprintArenaLabScreen from './screens/SprintArenaLabScreen';
import WelcomeAuthScreen from './components/auth/WelcomeAuthScreen';
import AuthCallbackScreen from './components/auth/AuthCallbackScreen';
import { AUTH_CALLBACK_PATH } from './lib/authRedirect';
import { useSupabaseUser } from './hooks/useSupabaseUser';
import { supabase } from './lib/supabaseClient';

const GUEST_SESSION_KEY = 'runnit:guest-mode';
const APP_PATHS = new Set(['/', '/map', '/leaderboard', '/profile', '/gps-lab', '/calibration', '/fusion-lab', '/sprint-lab']);

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
  return next && APP_PATHS.has(next) ? next : '/map';
}

export default function App() {
  const auth = useSupabaseUser();
  const location = useLocation();
  const navigate = useNavigate();
  const [guestAccess, setGuestAccess] = useState(wasGuestModeChosen);

  // Explicit sign-out always resets the guest choice as well. This prevents
  // reopening private screens accidentally after leaving an account.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== 'SIGNED_OUT') return;
      try { window.sessionStorage.removeItem(GUEST_SESSION_KEY); } catch { /* Storage unavailable. */ }
      setGuestAccess(false);
      navigate('/', { replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  const enterGuestMode = () => {
    try { window.sessionStorage.setItem(GUEST_SESSION_KEY, '1'); } catch { /* Private browsing may block storage. */ }
    setGuestAccess(true);
    if (location.pathname === '/login' || location.pathname === AUTH_CALLBACK_PATH) {
      navigate(location.pathname === AUTH_CALLBACK_PATH ? '/map' : safeLoginReturnPath(location.search), { replace: true });
    }
  };

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
    return auth.user ? <Navigate to="/map" replace /> : <AuthCallbackScreen onContinueAsGuest={enterGuestMode} />;
  }

  // An explicit login request is the only place the complete auth form lives.
  // Opening the app no longer forces unauthenticated visitors into signup.
  if (auth.user && location.pathname === '/login') {
    return <Navigate to={safeLoginReturnPath(location.search)} replace />;
  }

  if (!auth.user && location.pathname === '/login') {
    return (
      <WelcomeAuthScreen
        key={new URLSearchParams(location.search).get('mode') === 'signup' ? 'signup' : 'signin'}
        initialIntent={new URLSearchParams(location.search).get('mode') === 'signup' ? 'signup' : 'signin'}
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

  // First-time visitors see the hero screen, not an auth wall.
  // Authenticated users bypass this gate without losing their persisted session.
  if (!auth.user && !guestAccess && location.pathname !== '/') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="dark">
      <Routes>
        <Route path="/" element={<HomeScreen signedIn={Boolean(auth.user)} onStartAsGuest={enterGuestMode} sessionCheckFailed={auth.loadError} />} />
        <Route path="/map" element={<MapScreen />} />
        <Route path="/leaderboard" element={<LeaderboardScreen />} />
        <Route path="/profile" element={<ProfileScreen />} />
        <Route path="/gps-lab" element={<GpsLabScreen />} />
        <Route path="/calibration" element={<StrideCalibrationScreen />} />
        <Route path="/fusion-lab" element={<FusionLabScreen />} />
        <Route path="/sprint-lab" element={<SprintArenaLabScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
