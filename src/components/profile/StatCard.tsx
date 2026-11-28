import { Card } from '../ui/Card';

export function StatCard({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <Card className={`min-h-28 border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.015] p-4 ${className || ''}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/50">{label}</div>
      <div className="mt-3 text-[clamp(1.5rem,6vw,2rem)] font-black tracking-tight tabular-nums text-white">{value}</div>
      <div className="mt-2 h-0.5 w-10 rounded-full bg-gradient-to-r from-violet-400 to-cyan-300" aria-hidden="true" />
    </Card>
  );
}
