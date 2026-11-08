import type { ReactNode } from 'react';
import { Footprints } from 'lucide-react';
import { Link } from 'react-router-dom';
import BottomNav from './BottomNav';

type Props = {
  kicker: string;
  title: string;
  description: string;
  icon?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
};

/**
 * Shared visual language, matching the home page. Purely presentational:
 * no GPS access, Supabase queries or persistent user state.
 */
export default function PageFrame({ kicker, title, description, icon, children, aside }: Props) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#090b13] pb-32 text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -right-36 -top-28 h-96 w-96 rounded-full bg-violet-600/20 blur-[90px]" />
        <div className="absolute -left-40 top-[26rem] h-80 w-80 rounded-full bg-cyan-500/10 blur-[85px]" />
        <div className="absolute inset-x-0 top-0 h-[26rem] opacity-25"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px)',
            backgroundSize: '38px 38px',
            maskImage: 'linear-gradient(to bottom, black, transparent)',
          }}
        />
      </div>
      <div className="relative mx-auto max-w-xl space-y-7 px-5 pt-8 sm:pt-12">
        <header>
          <div className="flex items-center justify-between gap-3">
            <Link to="/" aria-label="Zur Startseite" className="flex items-center gap-2.5 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-300/30 bg-violet-500/20">
                <Footprints className="h-5 w-5 text-violet-200" aria-hidden="true" />
              </span>
              <span className="text-lg font-black tracking-[0.09em]">RUNNIT<span className="text-emerald-300">.</span></span>
            </Link>
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white/60">BETA</span>
          </div>
          <div className="mt-10 flex items-start gap-4">
            {icon && <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-violet-300/25 bg-gradient-to-br from-violet-500/25 to-cyan-500/10 text-violet-200 shadow-[0_0_35px_rgba(139,92,246,.15)]">{icon}</div>}
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-emerald-300/90">{kicker}</p>
              <h1 className="mt-2 text-[clamp(2rem,8vw,2.8rem)] font-black leading-[1.05] tracking-[-0.055em]">{title}</h1>
              <p className="mt-3 max-w-md text-sm leading-6 text-white/60">{description}</p>
            </div>
          </div>
          {aside && <div className="mt-5">{aside}</div>}
        </header>
        {children}
      </div>
      <BottomNav />
    </main>
  );
}
