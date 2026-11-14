import { ArrowLeft, ChevronRight, Flag, Footprints, List, Map as MapIcon, MapPin, Swords, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

export type ArcadeMapView = 'map' | 'list';
export type ArcadeMapEntry = {
  id: string;
  hostUsername: string;
  distanceMeters: number;
  distanceAwayMeters: number | null;
  isOwn: boolean;
  isDemo: boolean;
};
type Props = {
  view: ArcadeMapView;
  onViewChange: (next: ArcadeMapView) => void;
  cityName: string | null;
  hasGps: boolean;
  entries: readonly ArcadeMapEntry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onJoin: (id: string) => void;
  onCancel: (id: string) => void;
  onHost: () => void;
  loading: boolean;
};
function distanceLabel(meters: number | null): string {
  if (meters === null || !Number.isFinite(meters) || meters < 0) return 'Abstand nicht verfügbar';
  if (meters >= 1000) return (meters / 1000).toFixed(1).replace('.', ',') + ' km entfernt';
  return Math.round(meters) + ' m entfernt';
}
function ArcadeRunCard({ entry, onJoin, onCancel, onSelect, compact = false }: {
  entry: ArcadeMapEntry;
  onJoin: (id: string) => void;
  onCancel: (id: string) => void;
  onSelect?: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <article className={'runnit-arcade-map-race ' + (compact ? 'is-list-card' : 'is-preview-card')} aria-label={'1v1-Duell, ' + entry.distanceMeters + ' Meter'}>
      <div className="runnit-arcade-map-race-thumb" aria-hidden="true"><Swords /></div>
      <div className="runnit-arcade-map-race-info">
        <div className="runnit-arcade-map-race-title">1v1 <span>DUELL</span></div>
        <p><MapPin aria-hidden="true" /> {distanceLabel(entry.distanceAwayMeters)}</p>
        <p><Users aria-hidden="true" /> 1/2 · {entry.distanceMeters} m · @{entry.hostUsername}</p>
        {entry.isDemo && <strong className="runnit-arcade-demo-tag">DEMO · FIKTIVER GEGNER</strong>}
        {entry.isOwn && <strong className="runnit-arcade-own-tag">DEIN OFFENES RENNEN</strong>}
      </div>
      <div className="runnit-arcade-map-race-actions">
        {entry.isOwn ? (
          <button className="runnit-arcade-map-action is-cancel" type="button" onClick={() => onCancel(entry.id)}>ABSAGEN</button>
        ) : (
          <button className="runnit-arcade-map-action" type="button" onClick={() => onJoin(entry.id)}>BEITRETEN <ChevronRight aria-hidden="true" /></button>
        )}
        {compact && onSelect && (
          <button type="button" className="runnit-arcade-map-show" onClick={() => onSelect(entry.id)}>Auf Karte <MapIcon aria-hidden="true" /></button>
        )}
      </div>
    </article>
  );
}
export default function ArcadeMapChrome({
  view, onViewChange, cityName, hasGps, entries, selectedId, onSelect, onJoin, onCancel, onHost, loading,
}: Props) {
  const chosen = entries.find((entry) => entry.id === selectedId) ?? entries[0] ?? null;
  return (
    <>
      <header className="runnit-arcade-map-header" aria-label="Rennen in deiner Nähe">
        <div className="runnit-arcade-map-heading">
          <Link to="/home" aria-label="Zurück zur Startseite" className="runnit-arcade-map-back"><ArrowLeft aria-hidden="true" /></Link>
          <div className="runnit-arcade-map-heading-copy">
            <span>RUNNIT / STREET CHALLENGE</span>
            <h1>RENNEN IN DEINER NÄHE</h1>
            <p>{hasGps ? (cityName || 'GPS-Standort ermittelt') : 'Standort für genaue Entfernungen aktivieren'}</p>
          </div>
          <span className="runnit-arcade-map-title-mark" aria-hidden="true">R</span>
        </div>
        <div role="group" aria-label="Kartenansicht wählen" className="runnit-arcade-map-switch">
          <button type="button" aria-pressed={view === 'map'} onClick={() => onViewChange('map')} className={view === 'map' ? 'is-active' : ''}><MapIcon aria-hidden="true" /> KARTE</button>
          <button type="button" aria-pressed={view === 'list'} onClick={() => onViewChange('list')} className={view === 'list' ? 'is-active' : ''}><List aria-hidden="true" /> LISTE</button>
        </div>
      </header>

      {view === 'list' ? (
        <section aria-label="Rennen als Liste" className="runnit-arcade-map-list">
          <div className="runnit-arcade-map-list-heading"><Flag aria-hidden="true" /> OFFENE HERAUSFORDERUNGEN <small>{entries.length} angezeigt</small></div>
          {loading && <p className="runnit-arcade-map-list-hint" role="status">Rennen werden geladen …</p>}
          {!loading && entries.length === 0 && (
            <div className="runnit-arcade-map-empty">
              <Footprints aria-hidden="true" />
              <h2>NOCH KEINE RENNEN</h2>
              <p>In der aktuellen Ansicht sind keine offenen Herausforderungen verfügbar.</p>
              <button type="button" onClick={onHost}>RENNEN VERANSTALTEN <ChevronRight aria-hidden="true" /></button>
            </div>
          )}
          {entries.map((entry) => (
            <ArcadeRunCard key={entry.id} entry={entry} compact onJoin={onJoin} onCancel={onCancel} onSelect={(id) => { onSelect(id); onViewChange('map'); }} />
          ))}
        </section>
      ) : (
        <aside aria-label="Ausgewähltes Rennen" className="runnit-arcade-map-preview">
          {chosen ? (
            <ArcadeRunCard entry={chosen} onJoin={onJoin} onCancel={onCancel} />
          ) : (
            <div className="runnit-arcade-map-preview-empty">
              <Footprints aria-hidden="true" />
              <span><strong>NOCH KEIN DUELL</strong><small>{loading ? 'Lade Rennen …' : 'Keine offenen Rennen in der aktuellen Ansicht'}</small></span>
              <button type="button" onClick={onHost}>ERSTELLEN <ChevronRight aria-hidden="true" /></button>
            </div>
          )}
        </aside>
      )}
    </>
  );
}
