import type { ReactNode } from 'react';
import { ArrowUpRight, Footprints } from 'lucide-react';
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
 * Shared app frame — the polished, sport-game sequel to the RUNNIT launch
 * illustration. Decorative only: does not read location, session or race data.
 */
export default function PageFrame({ kicker, title, description, icon, children, aside }: Props) {
  return (
    <main className="runnit-street relative min-h-[100dvh] w-full max-w-full overflow-x-clip pb-[calc(8rem+env(safe-area-inset-bottom,0px))] text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -right-28 -top-20 h-72 w-72 rotate-[-30deg] rounded-full bg-fuchsia-500/15 blur-[70px]" />
        <div className="absolute -left-36 top-80 h-64 w-64 rounded-full bg-cyan-400/10 blur-[70px]" />
        <div className="absolute right-[-10%] top-[11rem] h-[2px] w-[55%] -rotate-[23deg] bg-gradient-to-r from-transparent via-cyan-300/65 to-transparent shadow-[0_0_22px_#38edfc]" />
        <div className="absolute right-[-10%] top-[12.4rem] h-[1px] w-[55%] -rotate-[23deg] bg-fuchsia-400/35" />
      </div>
      <div className="relative mx-auto w-full max-w-xl min-w-0 space-y-7 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6 sm:pt-10">
        <header className="relative">
          <div className="flex items-center justify-between gap-3">
            <Link to="/home" aria-label="Zur App-Startseite" className="flex min-h-11 items-center gap-2.5 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              <span className="flex h-10 w-10 -skew-x-6 items-center justify-center rounded-lg border border-cyan-200/65 bg-gradient-to-br from-cyan-300/25 via-violet-400/25 to-fuchsia-500/25 shadow-[0_0_18px_rgba(35,218,255,.23)]">
                <Footprints className="h-5 w-5 skew-x-6 text-cyan-100" aria-hidden="true" />
              </span>
              <span className="runnit-metal text-[1.7rem] font-black italic leading-none tracking-[-0.06em]">RUNNIT</span>
              <ArrowUpRight className="h-3.5 w-3.5 text-cyan-300/65" aria-hidden="true" />
            </Link>
            <span className="runnit-tag whitespace-nowrap text-[9px]">BETA / 00</span>
          </div>
          <div className="runnit-speedline mt-4" aria-hidden="true" />
          <div className="relative mt-8 overflow-hidden rounded-[23px] border border-cyan-300/20 bg-gradient-to-br from-[#1b1649]/95 via-[#101c3d]/90 to-[#082939]/90 p-5 shadow-[0_24px_65px_rgba(0,0,0,.29)] sm:p-6">
            <div className="pointer-events-none absolute inset-0 opacity-20" style={{
              backgroundImage: 'repeating-linear-gradient(135deg,transparent 0px,transparent 22px,rgba(176,248,255,.2) 23px,transparent 24px)',
            }} aria-hidden="true" />
            <div className="pointer-events-none absolute -right-8 -top-12 h-40 w-40 rotate-[25deg] rounded-full border-[22px] border-fuchsia-400/10" aria-hidden="true" />
            <div className="relative flex items-center gap-4">
              {icon && <span className="flex h-12 w-12 shrink-0 -skew-x-6 items-center justify-center rounded-lg border border-cyan-300/40 bg-cyan-300/10 text-cyan-100 shadow-[0_0_22px_rgba(37,230,255,.12)]"><span className="skew-x-6">{icon}</span></span>}
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[.22em] text-cyan-200">{kicker}</p>
                <h1 className="runnit-display runnit-display--shine mt-2 break-normal text-[clamp(1.5rem,6vw,3rem)]">{title}</h1>
              </div>
            </div>
            <p className="relative mt-4 max-w-md border-l-[3px] border-fuchsia-400 pl-3 text-sm leading-6 text-slate-100/80">{description}</p>
          </div>
          {aside && <div className="mt-4">{aside}</div>}
        </header>
        <div className="space-y-7">{children}</div>
      </div>
      <BottomNav />
    </main>
  );
}
