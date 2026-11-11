import { ArrowRight, FlagTriangleRight, Ghost, MapPin, ShieldCheck, UserRound, UserPlus, Zap } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import splashArtwork from '../assets/runnitSplashArt';

type Props = {
  signedIn: boolean;
  sessionCheckFailed?: boolean;
  onStartAsGuest: (destination?: string) => void;
};

/**
 * A real, responsive launcher, not a screenshot with unclickable pseudo-buttons.
 * The illustrated artwork is decorative; every interactive control lives in
 * HTML and therefore works with keyboard, touch and screen readers.
 * The only required action is STARTEN. Guest exploration stays opt-in.
 */
export default function HomeScreen({ signedIn, sessionCheckFailed, onStartAsGuest }: Props) {
  const navigate = useNavigate();

  const enter = (destination = '/map') => {
    if (signedIn) navigate(destination);
    else onStartAsGuest(destination);
  };

  return (
    <main className="relative isolate min-h-[100svh] min-h-[100dvh] w-full overflow-x-hidden bg-[#071125] text-white md:grid md:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden md:relative md:inset-auto" aria-hidden="true">
        <img src={splashArtwork} alt="" fetchPriority="high" decoding="async"
          className="absolute inset-0 h-full w-full object-cover object-[center_16%] md:object-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#060a19]/10 via-transparent via-40% to-[#071125] md:bg-gradient-to-r md:from-transparent md:to-[#071125]/50" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[100svh] min-h-[100dvh] w-full max-w-xl flex-col justify-end px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-7 md:justify-center md:px-8 lg:px-12">
        <div className="flex-1 md:hidden" aria-hidden="true" />

        <div className="relative rounded-[26px] border border-cyan-300/20 bg-[#081025]/90 p-4 shadow-[0_22px_80px_rgba(0,0,0,.55)] backdrop-blur-xl sm:p-6 md:bg-[#0c1426]/94">
          <div className="mb-4 md:mb-7">
            <h1 className="font-black italic tracking-[-0.06em] text-[clamp(2rem,9vw,3.5rem)] leading-none text-white md:text-[clamp(2.8rem,5vw,5rem)]">
              RUNNIT<span className="text-cyan-300">.</span>
            </h1>
            <p className="mt-2 text-xs font-black uppercase tracking-[0.13em] text-cyan-200 sm:text-sm">
              CHALLENGE. RACE. BEAT.
            </p>
            <p className="mt-3 text-xs leading-5 text-white/75 sm:text-sm">
              Fordere echte Menschen in deiner Nähe zu einem Sprint-Duell heraus.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2" aria-label="Runnit entdecken">
            <button type="button" onClick={() => enter('/map')}
              className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border border-cyan-300/45 bg-cyan-300/10 px-1.5 py-2 text-center text-[10px] font-black uppercase tracking-wide text-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white sm:text-xs">
              <FlagTriangleRight className="h-6 w-6 text-cyan-200" aria-hidden="true" />
              1v1 Duell
            </button>
            <button type="button" onClick={() => enter('/sprint-lab')}
              className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border border-fuchsia-300/45 bg-fuchsia-300/10 px-1.5 py-2 text-center text-[10px] font-black uppercase tracking-wide text-fuchsia-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white sm:text-xs">
              <Ghost className="h-6 w-6 text-fuchsia-200" aria-hidden="true" />
              <span>Ghost-Run <span className="block text-[9px] text-white/60">Vorschau</span></span>
            </button>
            <button type="button" onClick={() => enter('/map')}
              className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border border-amber-300/45 bg-amber-300/10 px-1.5 py-2 text-center text-[10px] font-black uppercase tracking-wide text-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white sm:text-xs">
              <MapPin className="h-6 w-6 text-amber-200" aria-hidden="true" />
              In deiner Nähe
            </button>
          </div>

          <button type="button" onClick={() => enter('/map')}
            className="mt-4 flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl border border-cyan-100/60 bg-gradient-to-r from-cyan-300 via-sky-400 to-violet-500 px-4 py-3 text-lg font-black italic tracking-[0.05em] text-[#071329] shadow-[0_0_32px_rgba(0,220,255,.36)] transition-transform active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:min-h-16 sm:text-xl">
            <Zap className="h-6 w-6" aria-hidden="true" />
            STARTEN
            <ArrowRight className="h-6 w-6" aria-hidden="true" />
          </button>

          {signedIn ? (
            <p className="mt-3 flex items-center justify-center gap-2 text-center text-[11px] font-semibold text-emerald-200">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Angemeldet · direkt zur Rennkarte
            </p>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link to="/login?mode=signin&next=%2Fmap"
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-2 text-xs font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white sm:text-sm">
                  <UserRound className="h-4 w-4" aria-hidden="true" /> Anmelden
                </Link>
                <Link to="/login?mode=signup&next=%2Fmap"
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-2 text-xs font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white sm:text-sm">
                  <UserPlus className="h-4 w-4" aria-hidden="true" /> Registrieren
                </Link>
              </div>
              <button type="button" onClick={() => onStartAsGuest('/map')}
                className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg text-xs font-bold text-cyan-100 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
                Als Gast fortfahren <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <p className="mt-1 text-center text-[10px] leading-4 text-white/55">
                Ohne Konto erkunden. Für echte Rennen wird eine Anmeldung benötigt.
              </p>
            </>
          )}
          {sessionCheckFailed && !signedIn && (
            <p role="status" className="mt-3 text-center text-xs text-amber-200">
              Deine bestehende Sitzung konnte nicht geprüft werden. Melde dich bei Bedarf erneut an.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
