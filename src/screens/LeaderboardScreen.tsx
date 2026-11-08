import { useState } from 'react';
import { LeaderboardRow } from '../components/leaderboard/Row';
import BottomNav from '../components/ui/BottomNav';

// Deliberately fictional examples. This screen has no authenticated or
// server-verified leaderboard feed, so it must never suggest otherwise.
const demoEntries = [
  { name: 'SpeedRunner23', time: '8.92s', distance: '100m' },
  { name: 'FlashFeet', time: '9.33s', distance: '100m' },
  { name: 'RocketRunner', time: '9.45s', distance: '100m' },
  { name: 'TurboTom', time: '9.67s', distance: '100m' },
  { name: 'LightningLisa', time: '9.89s', distance: '100m' },
];

export default function LeaderboardScreen() {
  const [activeTab, setActiveTab] = useState<'city' | 'national' | 'global'>('city');
  const tabs = [
    { key: 'city' as const, label: 'Stadt', emoji: '🏙️' },
    { key: 'national' as const, label: 'Deutschland', emoji: '🇩🇪' },
    { key: 'global' as const, label: 'Welt', emoji: '🌍' },
  ];

  return (
    <div className="min-h-screen bg-bg pb-24">
      <main className="space-y-4 p-4">
        <div className="py-6 text-center">
          <h1 className="mb-2 text-2xl font-bold text-text">Ranglisten</h1>
          <p className="text-sm text-muted">
            Beispielansicht – noch keine offiziell geprüften Sprintzeiten
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-2xl bg-white/5 p-1" role="group" aria-label="Ranglistenbereich">
          {tabs.map(({ key, label, emoji }) => (
            <button
              type="button"
              key={key}
              aria-pressed={activeTab === key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 rounded-xl px-2 py-3 text-xs font-medium transition-colors sm:text-sm ${
                activeTab === key
                  ? 'bg-primary text-white shadow-soft'
                  : 'text-muted hover:bg-white/10 hover:text-text'
              }`}
            >
              <span className="mr-1" aria-hidden="true">{emoji}</span>
              {label}
            </button>
          ))}
        </div>

        <div role="note" className="rounded-xl border border-amber-300/30 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
          Keine dieser Zeiten ist verifiziert. Die Namen und Ergebnisse unten sind frei erfundene
          Beispieldaten – keine Leistungen echter Läufer.
        </div>

        {activeTab === 'city' ? (
          <section aria-label="Fiktive Beispieldaten" className="space-y-3">
            <h2 className="text-base font-bold text-text">Demo-Rangliste</h2>
            <p className="text-xs text-muted">
              Diese Reihenfolge dient ausschließlich der Vorschau des Designs.
            </p>
            {demoEntries.map((entry, index) => (
              <LeaderboardRow key={entry.name} rank={index + 1} {...entry} source="demo" />
            ))}
          </section>
        ) : (
          <section role="status" className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-lg font-bold text-text">Noch keine verifizierte Rangliste</h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              Für {activeTab === 'national' ? 'Deutschland' : 'die Welt'} sind noch keine
              geprüften Sprintzeiten verfügbar. Die fiktiven Stadt-Beispiele werden hier
              nicht als echte Ergebnisse ausgegeben.
            </p>
          </section>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
