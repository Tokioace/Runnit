import { Link } from 'react-router-dom';
import { CheckCircle2, Trophy, UserRound } from 'lucide-react';

type Props = {
  isSignedIn: boolean;
  guestAccess: boolean;
  onStart: () => void;
  onContinueAsGuest: () => void;
};

/**
 * The approved RUNNIT artwork IS the UI on this launch screen.
 *
 * Feature badges and neon borders are pixels in the illustration, not interactive
 * elements. Four transparent semantic controls sit on the exact percentages of
 * the image's STARTEN / ANMELDEN / REGISTRIEREN / ALS GAST lettering.
 *
 * The art retains its ORIGINAL 941:1672 aspect ratio and all touch targets
 * share the same image coordinates. On narrow portrait phones it fills the
 * entire visual viewport without stretching (small side crops are expected).
 * Other viewports retain a contained image with an atmospheric backdrop.
 */
export default function HomeScreen({ isSignedIn, guestAccess, onStart, onContinueAsGuest }: Props) {
  return (
    <main className="relative isolate h-[100dvh] w-full overflow-hidden bg-[#070c20] text-white">
      {/* Fill any unused space on very tall / wide screens with atmospheric
          color, rather than distorting or cutting off the actual artwork. */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
        <img
          src="/runnit-launch-portrait.avif"
          alt=""
          className="h-full w-full scale-110 object-cover object-center opacity-35 blur-[30px]"
          draggable={false}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#070c20]/30 via-[#080c24]/55 to-[#070c20]/95" />
      </div>
      <div className="relative z-10 mx-auto flex h-full w-full items-center justify-center overflow-hidden">
        <div
          className="runnit-launch-art relative aspect-[941/1672] w-full shrink-0 overflow-hidden bg-[#070c20]"
        >
        <img
          src="/runnit-launch-portrait.avif"
          alt=""
          width={941}
          height={1672}
          decoding="async"
          fetchPriority="high"
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
          draggable={false}
          aria-hidden="true"
        />

        <h1 className="sr-only">RUNNIT – Challenge. Race. Beat.</h1>
        <p className="sr-only">
          1v1 Duell, Ghost-Run und Rennen in deiner Nähe. Die drei Abbildungen
          beschreiben die Idee der App und sind keine Schaltflächen.
        </p>

        <button
          type="button"
          aria-label="STARTEN – zur Runnit-Startseite"
          title="Runnit starten"
          onClick={onStart}
          className="absolute left-[10%] top-[81.9%] h-[9%] w-[80%] cursor-pointer rounded-2xl bg-transparent focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-cyan-100"
        >
          <span className="sr-only">STARTEN</span>
        </button>

        {isSignedIn ? (
          <nav
            aria-label="Schnellzugriff für angemeldete Nutzer"
            className="absolute inset-x-0 bottom-0 z-10 grid h-[7.4%] grid-cols-3 items-center gap-1 border-t border-cyan-300/20 bg-gradient-to-b from-[#101334] via-[#090f2b] to-[#070b20] px-[3%] shadow-[0_-5px_22px_rgba(5,9,36,0.8)]"
          >
            <Link
              to="/profile"
              className="flex h-full min-w-0 items-center justify-center gap-1 rounded-md text-[clamp(9px,2.5vw,12px)] font-extrabold italic text-cyan-100 underline decoration-cyan-400/60 underline-offset-[6px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-100"
            >
              <UserRound aria-hidden="true" className="h-4 w-4 shrink-0 text-cyan-300" />
              PROFIL
            </Link>
            <Link
              to="/leaderboard"
              className="flex h-full min-w-0 items-center justify-center gap-1 rounded-md text-[clamp(9px,2.5vw,12px)] font-extrabold italic text-fuchsia-100 underline decoration-fuchsia-400/60 underline-offset-[6px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-fuchsia-100"
            >
              <Trophy aria-hidden="true" className="h-4 w-4 shrink-0 text-fuchsia-300" />
              RANGLISTE
            </Link>
            <span className="flex min-w-0 items-center justify-center gap-1 text-[clamp(9px,2.5vw,12px)] font-bold text-emerald-200" aria-label="Angemeldet">
              <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />
              ANGEMELDET
            </span>
          </nav>
        ) : (
          <nav aria-label="Kontoaktionen" className="pointer-events-none absolute inset-0">
            <Link
              to="/login"
              aria-label="ANMELDEN"
              className="absolute left-[9.2%] top-[91.6%] h-[6.3%] w-[27%] pointer-events-auto rounded-md bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-100"
            >
              <span className="sr-only">ANMELDEN</span>
            </Link>
            <Link
              to="/register"
              aria-label="REGISTRIEREN"
              className="absolute left-[37%] top-[91.6%] h-[6.3%] w-[28.5%] pointer-events-auto rounded-md bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-100"
            >
              <span className="sr-only">REGISTRIEREN</span>
            </Link>
            <button
              type="button"
              aria-label="ALS GAST fortfahren"
              onClick={onContinueAsGuest}
              className="absolute left-[68.5%] top-[91.6%] h-[6.3%] w-[25%] pointer-events-auto rounded-md bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-100"
            >
              <span className="sr-only">{guestAccess ? 'ALS GAST weiter' : 'ALS GAST fortfahren'}</span>
            </button>
          </nav>
        )}
        </div>
      </div>
    </main>
  );
}
