import { useState } from 'react';
import { Trophy } from 'lucide-react';
import {
  partitionLeaderboard,
  type LeaderboardSource,
} from '../../lib/leaderboardProvenance';
import { LeaderboardRow } from './Row';

export type LeaderboardDisplayEntry = {
  rank: number;
  name: string;
  time: string;
  distance: string;
  source: LeaderboardSource;
};

export function LeaderboardSheet({
  city,
  entries,
}: {
  city: string;
  entries: LeaderboardDisplayEntry[];
}) {
  const [activeTab, setActiveTab] = useState<'city' | 'national' | 'global'>('city');
  const sections = partitionLeaderboard(entries);
  const tabs = [
    { key: 'city' as const, label: 'Stadt' },
    { key: 'national' as const, label: 'Deutschland' },
    { key: 'global' as const, label: 'Welt' },
  ];
  const categories = [
    { id: 'stored', title: 'Gespeicherte Zeiten', note: 'Aus der Datenbank, noch nicht auf Echtheit geprüft', data: sections.stored },
    { id: 'local', title: 'Lokale Ergebnisse', note: 'Nur in dieser Sitzung, nicht verifiziert', data: sections.local },
    { id: 'demo', title: 'Beispieldaten', note: 'Frei erfundene Zeiten und Namen, kein echter Wettbewerb', data: sections.demo },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-lg font-semibold text-text">
        <Trophy className="h-5 w-5 text-primary" aria-hidden="true" />
        <span>{city}</span>
      </div>

      <div className="flex gap-2" role="group" aria-label="Ranglisten-Bereich">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            aria-pressed={activeTab === key}
            onClick={() => setActiveTab(key)}
            className={`rounded-full px-3 py-2 text-sm transition-colors ${
              activeTab === key
                ? 'bg-primary text-white'
                : 'bg-white/5 text-muted hover:bg-white/10 hover:text-text'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="rounded-xl border border-amber-300/30 bg-amber-400/10 p-3 text-xs leading-5 text-amber-100">
        Noch keine offiziell verifizierten Sprint-Ranglisten. Gespeicherte Daten sind nicht automatisch
        geprüft. Demozeiten zählen niemals als echte Leistungen.
      </p>

      {activeTab !== 'city' ? (
        <div role="status" className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-text">
          Für {activeTab === 'national' ? 'Deutschland' : 'die Welt'} gibt es derzeit noch keine
          verifizierte Rangliste. Stadtwerte werden hier nicht als nationale oder weltweite Platzierung
          wiederverwendet.
        </div>
      ) : (
        <div className="max-h-[48vh] space-y-5 overflow-y-auto pr-1">
          {categories.map(({ id, title, note, data }) => data.length > 0 && (
            <section key={id} aria-label={title} className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-text">{title}</h3>
                <span className="text-xs text-muted">{data.length} Einträge</span>
              </div>
              <p className="text-xs leading-5 text-muted">{note}</p>
              {data.slice(0, 10).map((entry, index) => (
                <LeaderboardRow
                  key={`${id}-${entry.name}-${index}`}
                  {...entry}
                  rank={index + 1}
                />
              ))}
              {data.length > 10 && (
                <p className="text-xs text-muted">Es werden die ersten 10 Einträge dieser Kategorie gezeigt.</p>
              )}
            </section>
          ))}
          {entries.length === 0 && (
            <p className="rounded-xl border border-white/10 p-4 text-sm text-muted">
              Noch keine gespeicherten, lokalen oder Demo-Ergebnisse vorhanden.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
