import { useState } from 'react';
import { Globe2, LockKeyhole, MapPinned, ShieldAlert, Trophy } from 'lucide-react';
import { LeaderboardRow } from '../components/leaderboard/Row';
import PageFrame from '../components/ui/PageFrame';

// Fictional fixtures for the design preview; never represent real athletes.
const demoEntries = [
  { name: 'SpeedRunner23', time: '8.92s', distance: '100m' },
  { name: 'FlashFeet', time: '9.33s', distance: '100m' },
  { name: 'RocketRunner', time: '9.45s', distance: '100m' },
  { name: 'TurboTom', time: '9.67s', distance: '100m' },
  { name: 'LightningLisa', time: '9.89s', distance: '100m' },
];

type Tab = 'city' | 'national' | 'global';
const tabs: { key: Tab; label: string; icon: typeof MapPinned }[] = [
  { key: 'city', label: 'Stadt', icon: MapPinned },
  { key: 'national', label: 'Land', icon: ShieldAlert },
  { key: 'global', label: 'Welt', icon: Globe2 },
];

export default function LeaderboardScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('city');

  return (
    <PageFrame
      kicker="CHASE YOUR BEST"
      title="Ranglisten."
      titleClassName="whitespace-nowrap text-[clamp(1.45rem,6.3vw,2.8rem)]"
      description="Deine Konkurrenz im Blick. Echte Leistungen zählen erst, wenn die Messung zuverlässig überprüft ist."
      icon={<Trophy className="h-7 w-7" aria-hidden="true" />}
    >
      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-white/[0.045] p-1.5" role="group" aria-label="Ranglistenbereich">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            aria-pressed={activeTab === key}
            onClick={() => setActiveTab(key)}
            className={`flex min-h-12 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-bold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:text-sm ${
              activeTab === key
                ? 'bg-gradient-to-r from-violet-500 to-indigo-600 text-white shadow-[0_10px_25px_rgba(99,102,241,.18)]'
                : 'text-white/55 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />{label}
          </button>
        ))}
      </div>

      <div role="note" className="flex gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.075] p-4">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />
        <div className="text-xs leading-6 text-amber-100/85">
          <strong className="block text-sm text-amber-100">Vorschau ohne offizielle Wertung</strong>
          Die dargestellten Zeiten und Namen sind erfunden. Aktuell gibt es keine bestätigten Sprint-Rekorde.
        </div>
      </div>

      {activeTab === 'city' ? (
        <section className="space-y-3" aria-label="Fiktive Demo-Rangliste">
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">SHOWCASE</p>
              <h2 className="mt-1 text-xl font-extrabold tracking-tight">Beispiel-Ranking</h2>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/50">100 m · Demo</span>
          </div>
          <div className="space-y-2.5">
            {demoEntries.map((entry, index) => (
              <LeaderboardRow key={entry.name} rank={index + 1} {...entry} source="demo" />
            ))}
          </div>
        </section>
      ) : (
        <section role="status" className="flex min-h-64 flex-col items-center justify-center rounded-3xl border border-violet-300/15 bg-gradient-to-br from-violet-500/10 to-white/[0.025] px-6 py-9 text-center">
          <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
            <LockKeyhole className="h-8 w-8 text-cyan-200" aria-hidden="true" />
          </span>
          <h2 className="text-xl font-extrabold">Hier entsteht der Wettbewerb.</h2>
          <p className="mt-3 max-w-xs text-sm leading-6 text-white/55">
            {activeTab === 'national' ? 'Deutschland' : 'Die Welt'} bekommt eine eigene Rangliste,
            sobald echte Ergebnisse zuverlässig geprüft werden können.
          </p>
          <p className="mt-5 rounded-full bg-emerald-300/10 px-3 py-1.5 text-xs font-bold text-emerald-200">
            Fair Play hat Vorrang.
          </p>
        </section>
      )}
    </PageFrame>
  );
}
