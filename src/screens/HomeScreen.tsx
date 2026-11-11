import { Ghost, MapPinned, Swords, ArrowRight, UserRound, UserPlus, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

type Props = {
  isSignedIn: boolean;
  guestAccess: boolean;
  onStart: () => void;
  onContinueAsGuest: () => void;
};

/**
 * Full-bleed launch/home screen for ALL session states. All controls are real
 * DOM elements rather than hitboxes on top of the concept art, so buttons
 * remain accessible on iPhone minis, tall phones and desktop/tablet layouts.
 * The artwork contains no functional controls; the lower region is masked.
 */
export default function HomeScreen({ isSignedIn, guestAccess, onStart, onContinueAsGuest }: Props) {
  return (
    <main className="relative isolate flex min-h-[100dvh] w-full items-end overflow-hidden bg-[#070d21] text-white">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <img
          src="/runnit-launch-hero.webp"
          alt=""
          width="160"
          height="284"
          decoding="async"
          className="absolute inset-0 h-full w-full object-contain object-top opacity-95"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#040a1b]/10 via-transparent via-[48%] to-[#070d21] to-[78%]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_28%,rgba(6,9,28,0.44)_100%)]" />
      </div>

      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[34rem] flex-col justify-end px-[clamp(14px,4.5vw,28px)] pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
        <h1 className="sr-only">RUNNIT – Challenge. Race. Beat.</h1>

        <section aria-label="RUNNIT entdecken" className="mt-auto space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <Link to="/map" className="flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-2xl border border-cyan-300/55 bg-[#08152e]/90 px-1 py-2 text-center shadow-[0_0_18px_rgba(34,211,238,0.12)] backdrop-blur-sm transition-colors hover:bg-cyan-400/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
              <Swords className="h-5 w-5 text-cyan-200" aria-hidden="true" />
              <span className="text-[clamp(10px,2.6vw,12px)] font-black uppercase tracking-tight">1v1 DUELL</span>
            </Link>
            <Link to="/sprint-lab" className="flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-2xl border border-fuchsia-300/50 bg-[#170d2f]/90 px-1 py-2 text-center shadow-[0_0_18px_rgba(217,70,239,0.1)] backdrop-blur-sm transition-colors hover:bg-fuchsia-400/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" aria-label="Ghost-Run Vorschau im Sprintlabor ansehen">
              <Ghost className="h-5 w-5 text-fuchsia-200" aria-hidden="true" />
              <span className="text-[clamp(10px,2.6vw,12px)] font-black uppercase tracking-tight">GHOST-RUN</span>
              <span className="text-[9px] font-bold text-fuchsia-100/70">Vorschau</span>
            </Link>
            <Link to="/map" className="flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-2xl border border-amber-300/50 bg-[#1c1424]/90 px-1 py-2 text-center shadow-[0_0_18px_rgba(251,191,36,0.1)] backdrop-blur-sm transition-colors hover:bg-amber-400/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
              <MapPinned className="h-5 w-5 text-amber-200" aria-hidden="true" />
              <span className="text-[clamp(9px,2.5vw,12px)] font-black uppercase leading-tight">IN DEINER NÄHE</span>
            </Link>
          </div>

          <p className="mx-auto max-w-[28rem] text-center text-xs font-bold leading-5 tracking-wide text-slate-100 drop-shadow-[0_2px_5px_rgba(0,0,0,1)] sm:text-sm">
            FORDERE ECHTE LEUTE ZUM LAUF-DUELL HERAUS.
          </p>

          <button
            type="button"
            onClick={onStart}
            className="group flex min-h-[62px] w-full items-center justify-center gap-3 rounded-[18px] border-2 border-cyan-100/75 bg-gradient-to-r from-[#03def0] via-[#07dce8] to-[#8174fb] px-4 text-[clamp(1.35rem,6vw,2rem)] font-black italic tracking-[0.09em] text-[#07112c] shadow-[0_0_0_3px_rgba(217,70,239,0.35),0_10px_38px_rgba(8,222,240,0.35)] transition-transform hover:brightness-110 active:scale-[0.985] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            <Zap className="h-6 w-6 fill-current" aria-hidden="true" />
            STARTEN
            <ArrowRight className="h-6 w-6 transition-transform group-hover:translate-x-1" aria-hidden="true" />
          </button>

          {isSignedIn ? (
            <p className="py-2 text-center text-xs font-bold text-emerald-200">
              <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-300" aria-hidden="true" />
              Angemeldet · Direkt zur Rennkarte
            </p>
          ) : (
            <div className="space-y-1">
              <nav aria-label="Kontoaktionen" className="grid grid-cols-2 gap-2">
                <Link to="/login?mode=signin" className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-cyan-300/25 bg-[#0b1831]/80 px-2 text-[clamp(11px,3vw,14px)] font-black uppercase tracking-wide text-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
                  <UserRound className="h-4 w-4 shrink-0" aria-hidden="true" />
                  ANMELDEN
                </Link>
                <Link to="/login?mode=signup" className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-fuchsia-300/25 bg-[#17112b]/85 px-2 text-[clamp(11px,3vw,14px)] font-black uppercase tracking-wide text-fuchsia-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
                  <UserPlus className="h-4 w-4 shrink-0" aria-hidden="true" />
                  REGISTRIEREN
                </Link>
              </nav>
              <button type="button" onClick={onContinueAsGuest}
                className="flex min-h-11 w-full items-center justify-center rounded-xl px-3 text-sm font-bold text-white/80 underline decoration-white/35 underline-offset-4 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
                {guestAccess ? 'Als Gast zur Karte' : 'Als Gast fortfahren'}
              </button>
            </div>
          )}
          <p className="text-center text-[10px] font-semibold leading-4 text-white/45">
            {isSignedIn ? 'Rennkarte · Profil · Herausforderungen' : 'Ohne Anmeldung entdecken. Für echte Rennen ist ein Konto erforderlich.'}
          </p>
        </section>
      </div>
    </main>
  );
}
