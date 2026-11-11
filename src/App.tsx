import { useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Footprints, LoaderCircle } from 'lucide-react';
import MapScreen from './screens/MapScreen';
import HomeScreen from './screens/HomeScreen';
import LeaderboardScreen from './screens/LeaderboardScreen';
import ProfileScreen from './screens/ProfileScreen';
import GpsLabScreen from './screens/GpsLabScreen';
import StrideCalibrationScreen from './screens/StrideCalibrationScreen';
import WelcomeAuthScreen from './components/auth/WelcomeAuthScreen';
import AuthCallbackScreen from './components/auth/AuthCallbackScreen';
import { AUTH_CALLBACK_PATH } from './lib/authRedirect';
import { useSupabaseUser } from './hooks/useSupabaseUser';

const GUEST_SESSION_KEY = 'runnit:guest-mode';
const APP_PATHS = new Set(['/', '/map', '/leaderboard', '/profile', '/gps-lab', '/calibration']);

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

  // Explicit login requests always open the account screen, even after a
  // guest has already entered the app. Only known local routes can be used
  // as a post-login destination.
  if (auth.user && location.pathname === '/login') {
    return <Navigate to={safeLoginReturnPath(location.search)} replace />;
  }

  if (!auth.user && (!guestAccess || location.pathname === '/login')) {
    return (
      <WelcomeAuthScreen
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
        <Route path="/" element={<HomeScreen />} />
        <Route path="/map" element={<MapScreen />} />
        <Route path="/leaderboard" element={<LeaderboardScreen />} />
        <Route path="/profile" element={<ProfileScreen />} />
        <Route path="/gps-lab" element={<GpsLabScreen />} />
        <Route path="/calibration" element={<StrideCalibrationScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
