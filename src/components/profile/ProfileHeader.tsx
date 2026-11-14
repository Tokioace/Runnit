import { Sparkles, UserRound } from 'lucide-react';
import { Card } from '../ui/Card';

export function ProfileHeader({
  username,
  level,
  progress,
}: {
  username: string;
  level: number;
  progress: number;
}) {
  const safeProgress = Math.min(100, Math.max(0, progress));
  return (
    <Card className="relative overflow-hidden border-violet-300/20 bg-gradient-to-br from-violet-500/20 via-[#171529] to-cyan-500/[0.075] p-5">
      <div className="pointer-events-none absolute -right-12 -top-14 h-44 w-44 rounded-full bg-violet-400/10 blur-3xl" aria-hidden="true" />
      <div className="relative flex items-center gap-4">
        <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-[22px] border border-violet-300/30 bg-violet-400/15 shadow-[0_0_30px_rgba(139,92,246,.18)]">
          <UserRound className="h-8 w-8 text-violet-200" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-300">DEMO ATHLETE</p>
          <h2 className="mt-1 truncate text-2xl font-black tracking-tight text-white">{username}</h2>
          <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-white/55">
            <Sparkles className="h-3.5 w-3.5 text-cyan-200" aria-hidden="true" />
            Demo-Level {level}
          </p>
        </div>
      </div>
      <div className="relative mt-6">
        <div className="mb-2 flex justify-between text-xs">
          <span className="font-semibold text-white/65">Beispiel-Fortschritt</span>
          <span className="font-bold tabular-nums text-emerald-200">{safeProgress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Beispiel-Fortschritt" aria-valuemin={0} aria-valuemax={100} aria-valuenow={safeProgress}>
          <div className="h-full rounded-full bg-gradient-to-r from-violet-400 via-cyan-300 to-emerald-300 transition-all" style={{ width: `${safeProgress}%` }} />
        </div>
      </div>
    </Card>
  );
}
