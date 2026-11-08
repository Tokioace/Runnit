import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Footprints, LoaderCircle } from 'lucide-react';
import MapScreen from './screens/MapScreen';
import HomeScreen from './screens/HomeScreen';
import LeaderboardScreen from './screens/LeaderboardScreen';
import ProfileScreen from './screens/ProfileScreen';
import GpsLabScreen from './screens/GpsLabScreen';
import WelcomeAuthScreen from './components/auth/WelcomeAuthScreen';
import AuthCallbackScreen from './components/auth/AuthCallbackScreen';
import { AUTH_CALLBACK_PATH } from './lib/authRedirect';
import { useSupabaseUser } from './hooks/useSupabaseUser';

/**
 * Client-side navigation gate only. It prevents browsing app pages without a
 * session; actual database authorization must still be enforced with RLS/RPC
 * on the Supabase server.
 */
export default function App() {
  const auth = useSupabaseUser();
  const location = useLocation();

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

  // The callback path can be shown without a session so that cancelled/failed
  // OAuth attempts have a safe recovery page rather than exposing app content.
  if (location.pathname === AUTH_CALLBACK_PATH) {
    return auth.user ? <Navigate to="/" replace /> : <AuthCallbackScreen />;
  }

  // No guest access: every app route is protected by the same onboarding UI.
  if (!auth.user) {
    return (
      <WelcomeAuthScreen
        signInWithProvider={auth.signInWithProvider}
        sendMagicLink={auth.sendMagicLink}
        verifyEmailOtp={auth.verifyEmailOtp}
        signIn={auth.signIn}
        signUp={auth.signUp}
        loadError={auth.loadError}
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
