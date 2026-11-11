import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  ChevronRight,
  Footprints,
  MapPinned,
  Navigation,
  ShieldCheck,
  Timer,
  Trophy,
  Zap,
} from 'lucide-react';
import BottomNav from '../components/ui/BottomNav';

/**
 * This is Runnit's original in-app dashboard, separate from the launch splash.
 * It remains independent of Supabase and geolocation.
 * Visiting the landing page must not request location permissions or invent
 * live opponents, achievements, rankings or race results.
 */
export default function DashboardScreen() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#090b13] pb-28 text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -right-32 -top-28 h-96 w-96 rounded-full bg-violet-600/20 blur-[90px]" />
        <div className="absolute -left-40 top-[26rem] h-80 w-80 rounded-full bg-cyan-500/10 blur-[85px]" />
        <div className="absolute inset-x-0 top-0 h-[28rem] opacity-30"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px)', backgroundSize: '38px 38px', maskImage: 'linear-gradient(to bottom, black, transparent)' }} />
      </div>

      <div className="relative mx-auto max-w-xl px-5 pt-8 sm:pt-12">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-300/30 bg-violet-500/20 shadow-[0_0_30px_rgba(139,92,246,.17)]">
              <Footprints className="h-6 w-6 text-violet-200" aria-hidden="true" />
            </div>
            <div>
              <span className="block text-xl font-black tracking-[0.1em] text-white">RUNNIT<span className="text-emerald-300">.</span></span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">Sprint · Duell · Community</span>
            </div>
          </div>
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-white/65">BETA</span>
        </header>

        <section className="relative mt-12 sm:mt-16" aria-labelledby="home-title">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
            Bereit für deinen nächsten Sprint?
          </div>
          <h1 id="home-title" className="max-w-md text-[clamp(2.8rem,12vw,4.8rem)] font-black leading-[0.99] tracking-[-0.055em]">
            DEIN<br />
            TEMPO.<br />
            <span className="bg-gradient-to-r from-violet-300 via-cyan-200 to-emerald-300 bg-clip-text text-transparent">DEIN LAUF.</span>
          </h1>
          <p className="mt-6 max-w-sm text-sm leading-7 text-white/65 sm:text-base">
            Erkunde Sprint-Herausforderungen, probiere die Zeitmessung aus und begleite
            die Entwicklung von Runnit – Schritt für Schritt.
          </p>
        </section>

        <section className="mt-9 space-y-3" aria-label="Dein Einstieg">
          <Link to="/map" className="group flex min-h-16 items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-600 px-5 py-4 shadow-[0_14px_45px_rgba(99,102,241,.23)] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            <span className="flex items-center gap-3">
              <MapPinned className="h-6 w-6 shrink-0" aria-hidden="true" />
              <span>
                <span className="block font-bold">Karte erkunden</span>
                <span className="block text-xs text-white/80">Herausforderungen auf der Karte · Beta</span>
              </span>
            </span>
            <ArrowRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1" aria-hidden="true" />
          </Link>
          <Link to="/gps-lab" className="group flex min-h-16 items-center justify-between gap-4 rounded-2xl border border-emerald-200/25 bg-emerald-300/10 px-5 py-4 transition hover:bg-emerald-300/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            <span className="flex items-center gap-3">
              <Timer className="h-6 w-6 shrink-0 text-emerald-200" aria-hidden="true" />
              <span>
                <span className="block font-bold">GPS-Testlabor</span>
                <span className="block text-xs text-white/65">50, 75 und 100 Meter simulieren</span>
              </span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-emerald-200" aria-hidden="true" />
          </Link>
        </section>

        <section className="mt-10" aria-labelledby="explore-heading">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="explore-heading" className="text-lg font-extrabold">Entdecke Runnit</h2>
            <span className="text-xs font-medium text-white/40">Entwicklungsstand</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/leaderboard" className="group flex min-h-40 flex-col justify-between rounded-3xl border border-white/10 bg-white/[0.045] p-4 transition hover:border-violet-300/30 hover:bg-white/[0.075]">
              <Trophy className="h-6 w-6 text-violet-300" aria-hidden="true" />
              <div>
                <h3 className="font-bold">Ranglisten</h3>
                <p className="mt-1 text-xs leading-5 text-white/50">Datenquellen transparent · noch ohne offizielle Wertung</p>
              </div>
            </Link>
            <Link to="/profile" className="group flex min-h-40 flex-col justify-between rounded-3xl border border-white/10 bg-white/[0.045] p-4 transition hover:border-cyan-300/30 hover:bg-white/[0.075]">
              <Activity className="h-6 w-6 text-cyan-300" aria-hidden="true" />
              <div>
                <h3 className="font-bold">Mein Profil</h3>
                <p className="mt-1 text-xs leading-5 text-white/50">Dein Konto, Anzeigename und künftige Leistungen</p>
              </div>
            </Link>
          </div>
        </section>

        <div className="mt-8 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden="true" />
          <p className="text-xs leading-6 text-white/55">
            Dein Standort wird auf dieser Startseite nicht angefragt. Die Kartenfunktion
            verwendet Standortdienste erst, wenn du sie öffnest. GPS-Zeiten sind derzeit
            experimentell und nicht offiziell verifiziert.
          </p>
        </div>

        <div className="mt-7 flex items-center justify-center gap-5 text-[11px] font-medium text-white/35">
          <span className="flex items-center gap-1.5"><Zap className="h-3 w-3" aria-hidden="true" /> Sprint</span>
          <span className="flex items-center gap-1.5"><Navigation className="h-3 w-3" aria-hidden="true" /> Entdecken</span>
          <span className="flex items-center gap-1.5"><ShieldCheck className="h-3 w-3" aria-hidden="true" /> Fair Play</span>
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
