import { MapPin } from 'lucide-react';

export function MapHUD({ city }: { city: string }) {
  return (
    <div className="pointer-events-none absolute left-4 top-[max(1rem,env(safe-area-inset-top))] z-[940] max-w-[calc(100vw-6.5rem)]">
      <div className="flex items-center gap-2.5 rounded-2xl border border-violet-300/25 bg-[#101322]/90 px-3.5 py-2.5 text-white shadow-[0_12px_35px_rgba(0,0,0,.4)] backdrop-blur-xl">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/20 text-violet-200">
          <MapPin className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-300">MAP VIEW</p>
          <p className="truncate text-sm font-extrabold">{city}</p>
        </div>
      </div>
    </div>
  );
}
