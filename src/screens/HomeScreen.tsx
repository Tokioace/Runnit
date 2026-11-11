import { Link } from 'react-router-dom';

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
 * The illustration fills the viewport including the iOS safe-area; matching
 * percentage positioning ensures the touch regions scale with the artwork.
 */
export default function HomeScreen({ isSignedIn, guestAccess, onStart, onContinueAsGuest }: Props) {
  return (
    <main className="relative isolate min-h-[100dvh] w-full overflow-hidden bg-[#070c20] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,#2c1157_0%,#050b21_75%)]" aria-hidden="true" />
      <div className="relative mx-auto h-[100dvh] w-full max-w-[600px] overflow-hidden bg-[#070c20]">
        <img
          src="/runnit-launch-portrait.avif"
          alt=""
          width={941}
          height={1672}
          decoding="async"
          fetchPriority="high"
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-fill"
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
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[8.5%] bg-gradient-to-b from-[#08152e] via-[#061029] to-[#04091d]" aria-label="Du bist angemeldet">
            <span className="sr-only">Du bist angemeldet. Anmelden und Registrieren sind nicht erforderlich.</span>
          </div>
        ) : (
          <nav aria-label="Kontoaktionen" className="pointer-events-none absolute inset-0">
            <Link
              to="/login?mode=signin"
              aria-label="ANMELDEN"
              className="absolute left-[9.2%] top-[91.6%] h-[6.3%] w-[27%] pointer-events-auto rounded-md bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-100"
            >
              <span className="sr-only">ANMELDEN</span>
            </Link>
            <Link
              to="/login?mode=signup"
              aria-label="REGISTRIEREN"
              className="absolute left-[37%] top-[91.6%] h-[6.3%] w-[28.5%] pointer-events-auto rounded-md bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-100"
            >
              <span className="sr-only">REGISTRIEREN</span>
            </a>
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
    </main>
  );
}
