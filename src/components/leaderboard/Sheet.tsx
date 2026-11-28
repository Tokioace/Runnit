import { useState } from 'react';
import { Globe2, MapPin, ShieldAlert, Trophy } from 'lucide-react';
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
    { key: 'national' as const, label: 'Land' },
    { key: 'global' as const, label: 'Welt' },
  ];
  const categories = [
    { id: 'stored', title: 'Gespeicherte Zeiten', note: 'Aus der Datenbank – sportliche Echtheit nicht geprüft', data: sections.stored },
    { id: 'local', title: 'Lokale Ergebnisse', note: 'Nur in dieser Sitzung, nicht verifiziert', data: sections.local },
    { id: 'demo', title: 'Beispieldaten', note: 'Frei erfundene Namen und Zeiten', data: sections.demo },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-violet-300/15 bg-gradient-to-r from-violet-500/15 to-cyan-500/[0.07] p-4">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-300">LEADERBOARD · PREVIEW</p>
        <div className="mt-2 flex items-center gap-2 text-lg font-extrabold">
          <MapPin className="h-5 w-5 text-violet-200" aria-hidden="true" />
          <span className="min-w-0 truncate">{city}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-white/10 bg-white/[0.045] p-1.5" role="group" aria-label="Ranglisten-Bereich">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            aria-pressed={activeTab === key}
            onClick={() => setActiveTab(key)}
            className={`min-h-11 rounded-xl px-3 py-2 text-xs font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
              activeTab === key
                ? 'bg-gradient-to-r from-violet-500 to-indigo-600 text-white'
                : 'text-white/55 hover:bg-white/10 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.075] p-4">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />
        <p className="text-xs leading-5 text-amber-100/85">
          Es gibt noch keine verifizierten Sprint-Ranglisten.
          Gespeicherte Zeiten sind nicht automatisch geprüft und Demozeiten zählen nicht.
        </p>
      </div>

      {activeTab !== 'city' ? (
        <div role="status" className="flex min-h-44 flex-col items-center justify-center rounded-3xl border border-violet-300/15 bg-white/[0.035] px-5 py-8 text-center">
          <Globe2 className="mb-4 h-9 w-9 text-cyan-200" aria-hidden="true" />
          <h3 className="text-base font-extrabold">Noch keine geprüften Ergebnisse</h3>
          <p className="mt-2 max-w-sm text-xs leading-6 text-white/55">
            Für {activeTab === 'national' ? 'Deutschland' : 'die Welt'} wird noch keine verifizierte Rangliste geführt.
            Stadtzeiten werden hier nicht als offizielle Platzierung ausgegeben.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {categories.map(({ id, title, note, data }) => data.length > 0 && (
            <section key={id} aria-label={title} className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-extrabold">{title}</h3>
                  <p className="mt-1 text-xs text-white/45">{note}</p>
                </div>
                <span className="shrink-0 rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-white/50">{data.length}</span>
              </div>
              {data.slice(0, 10).map((entry, index) => (
                <LeaderboardRow key={`${id}-${entry.name}-${index}`} {...entry} rank={index + 1} />
              ))}
              {data.length > 10 && <p className="text-xs text-white/40">Die ersten 10 Einträge dieser Gruppe werden angezeigt.</p>}
            </section>
          ))}
          {entries.length === 0 && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.035] px-5 py-8 text-center">
              <Trophy className="mx-auto mb-4 h-8 w-8 text-violet-200/70" aria-hidden="true" />
              <p className="text-sm font-semibold text-white/65">Noch keine Ergebnisse vorhanden.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
