import { Activity, Award, BarChart3, ShieldAlert, Sparkles, Target, TrendingUp } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { StatCard } from '../components/profile/StatCard';
import PageFrame from '../components/ui/PageFrame';

/** Static design mock. No actual user records or achievements are queried. */
export default function ProfileScreen() {
  return (
    <PageFrame
      kicker="YOUR RUNNING STORY"
      title="Mein Profil."
      description="Hier entsteht dein persönlicher Sprint-Hub – bis echte Leistungen angeschlossen sind, zeigen wir eine gekennzeichnete Vorschau."
      icon={<Activity className="h-7 w-7" aria-hidden="true" />}
    >
      <div role="note" className="flex gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.075] p-4 text-amber-100/85">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />
        <p className="text-xs leading-6"><strong className="block text-sm text-amber-100">Demo-Profil</strong>Alle Zahlen, Platzierungen, Medaillen und Diagramme auf dieser Seite sind frei erfundene Designbeispiele.</p>
      </div>

      <section aria-label="Beispiel-Athletenprofil">
        <ProfileHeader username="Runner8" level={12} progress={65} />
      </section>

      <section className="space-y-3" aria-labelledby="profile-stats">
        <div className="flex items-center justify-between gap-3">
          <h2 id="profile-stats" className="text-xl font-extrabold tracking-tight">Deine Stats <span className="text-xs font-medium text-white/40">· Vorschau</span></h2>
          <Target className="h-5 w-5 text-emerald-300" aria-hidden="true" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Bestzeit · 100 m" value="9.33 s" />
          <StatCard label="Stadtplatz" value="#12" />
          <StatCard label="Beispiel-Rennen" value="47" />
          <StatCard label="Gewinnquote" value="68 %" />
        </div>
      </section>

      <section aria-labelledby="performance-title">
        <Card className="overflow-hidden border-violet-300/15 bg-gradient-to-br from-violet-500/[0.11] via-[#151526] to-[#0f1521] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-200">PERFORMANCE LAB</p>
              <h2 id="performance-title" className="mt-2 text-lg font-extrabold">Leistungsentwicklung</h2>
              <p className="mt-1 text-xs text-white/50">Illustrierter Verlauf · keine echten Messwerte</p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
              <TrendingUp className="h-5 w-5" aria-hidden="true" />
            </span>
          </div>
          <svg aria-label="Beispielhafte Leistungsentwicklung" role="img" className="mt-6 h-32 w-full" viewBox="0 0 300 112" preserveAspectRatio="none">
            <defs>
              <linearGradient id="profileTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#818cf8" stopOpacity="0.24" />
                <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="profileTrendStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#a78bfa" />
                <stop offset="55%" stopColor="#67e8f9" />
                <stop offset="100%" stopColor="#6ee7b7" />
              </linearGradient>
            </defs>
            <path d="M0 94H300 M0 58H300 M0 22H300" stroke="#ffffff" strokeOpacity=".08" strokeDasharray="3 5" />
            <path d="M0 90 C28 86 38 72 59 74 S99 51 121 57 S160 43 180 48 S220 19 241 27 S276 14 300 12 V112 H0Z" fill="url(#profileTrendFill)" />
            <path d="M0 90 C28 86 38 72 59 74 S99 51 121 57 S160 43 180 48 S220 19 241 27 S276 14 300 12" fill="none" stroke="url(#profileTrendStroke)" strokeWidth="3.5" strokeLinecap="round" />
            <circle cx="300" cy="12" r="5" fill="#6ee7b7" />
          </svg>
          <div className="flex items-center justify-between border-t border-white/10 pt-3 text-[11px] font-semibold text-white/35">
            <span>Woche 1</span><span>Illustration</span><span>Woche 6</span>
          </div>
        </Card>
      </section>

      <section aria-labelledby="medal-heading">
        <Card className="border-white/10 bg-white/[0.045] p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-300/20 bg-violet-300/10 text-violet-200">
              <Award className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="flex-1">
              <h2 id="medal-heading" className="font-extrabold">Meilensteine</h2>
              <p className="mt-1 text-xs text-white/45">Demomedaillen · noch nicht verdient</p>
            </div>
            <Sparkles className="h-5 w-5 text-emerald-200/70" aria-hidden="true" />
          </div>
          <div className="mt-5 grid grid-cols-5 gap-2" aria-label="Fünf illustrative Medaillen">
            {['🥇','🥈','🥉','🏅','🎖️'].map((medal, i) => (
              <div key={i} className="flex aspect-square items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] text-2xl grayscale-[0.35]">{medal}</div>
            ))}
          </div>
        </Card>
      </section>

      <div className="flex items-start gap-3 rounded-xl border border-emerald-200/10 bg-emerald-200/[0.045] p-4 text-xs leading-6 text-white/50">
        <BarChart3 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-200/70" aria-hidden="true" />
        Wenn echte und geprüfte Sprintdaten verfügbar sind, können hier persönliche Fortschritte statt Beispielwerten erscheinen.
      </div>
    </PageFrame>
  );
}
