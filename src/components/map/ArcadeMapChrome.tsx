import { ArrowLeft, ChevronRight, Flag, Footprints, List, Map as MapIcon, MapPin, Swords, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { mapHeadingForCamera, type MapCameraScope } from '../../lib/mapHeadingScope';
import OpenEventCountdown from './OpenEventCountdown';

export type ArcadeMapView = 'map' | 'list';
export type ArcadeMapEntry = {
  id: string;
  hostUsername: string;
  distanceMeters: number;
  distanceAwayMeters: number | null;
  isOwn: boolean;
  isDemo: boolean;
  expiresAt?: string;
};
type Props = {
  view: ArcadeMapView;
  onViewChange: (next: ArcadeMapView) => void;
  cityName: string | null;
  hasGps: boolean;
  camera: MapCameraScope;
  entries: readonly ArcadeMapEntry[];
  selectedId: string | null;
  onJoin: (id: string) => void;
  onCancel: (id: string) => void;
  loading: boolean;
  live?: boolean;
};
function distanceLabel(meters: number | null): string {
  if (meters === null || !Number.isFinite(meters) || meters < 0) return 'Abstand nicht verfügbar';
  if (meters >= 1000) return (meters / 1000).toFixed(1).replace('.', ',') + ' km entfernt';
  return Math.round(meters) + ' m entfernt';
}
export function ArcadeRunCard({ entry, onJoin, onCancel, selected = false, variant = 'list' }: {
  entry: ArcadeMapEntry;
  onJoin: (id: string) => void;
  onCancel: (id: string) => void;
  selected?: boolean;
  variant?: 'list' | 'popup';
}) {
  return (
    <article className={'runnit-arcade-map-race ' + (variant === 'popup' ? 'is-popup-card' : 'is-list-card') + (selected ? ' is-selected' : '')} aria-label={'1v1-Duell, ' + entry.distanceMeters + ' Meter'}>
      <div className="runnit-arcade-map-race-thumb" aria-hidden="true"><Swords /></div>
      <div className="runnit-arcade-map-race-info">
        <div className="runnit-arcade-map-race-title">1v1 <span>DUELL</span></div>
        <p><MapPin aria-hidden="true" /> {distanceLabel(entry.distanceAwayMeters)}</p>
        <p><Users aria-hidden="true" /> 1/2 · {entry.distanceMeters} m · @{entry.hostUsername}</p>
        {entry.expiresAt && <p className="runnit-open-countdown-list"><span>ENDET IN</span><OpenEventCountdown expiresAt={entry.expiresAt} /></p>}
        {entry.isDemo && <strong className="runnit-arcade-demo-tag">DEMO · FIKTIVER GEGNER</strong>}
        {entry.isOwn && <strong className="runnit-arcade-own-tag">DEIN OFFENES RENNEN</strong>}
      </div>
      <div className="runnit-arcade-map-race-actions">
        {entry.isOwn ? (
          <button className="runnit-arcade-map-action is-cancel" type="button" onClick={() => onCancel(entry.id)}>ABSAGEN</button>
        ) : (
          <button className="runnit-arcade-map-action" type="button" onClick={() => onJoin(entry.id)}>BEITRETEN <ChevronRight aria-hidden="true" /></button>
        )}
      </div>
    </article>
  );
}
export default function ArcadeMapChrome({
  view, onViewChange, cityName, hasGps, camera, entries, selectedId, onJoin, onCancel, loading, live = false,
}: Props) {
  // Never reorder the list on an event tap: that moves the reader's scroll position.
  const orderedEntries = entries;
  const heading = mapHeadingForCamera(camera, cityName, hasGps, view);
  return (
    <>
      <header className="runnit-arcade-map-header" aria-label={heading.title}>
        <div className="runnit-arcade-map-heading">
          <Link to="/home" aria-label="Zurück zur Startseite" className="runnit-arcade-map-back"><ArrowLeft aria-hidden="true" /></Link>
          <div className="runnit-arcade-map-heading-copy">
            <span>RUNNIT / STREET CHALLENGE</span>
            <h1>{heading.title}</h1>
            <p>{heading.subtitle}</p>
          </div>
          <span className="runnit-arcade-map-title-mark" aria-hidden="true">R</span>
        </div>
        <div role="group" aria-label="Kartenansicht wählen" className="runnit-arcade-map-switch">
          <button type="button" aria-pressed={view === 'map'} onClick={() => onViewChange('map')} className={view === 'map' ? 'is-active' : ''}><MapIcon aria-hidden="true" /> KARTE</button>
          <button type="button" aria-pressed={view === 'list'} onClick={() => onViewChange('list')} className={view === 'list' ? 'is-active' : ''}><List aria-hidden="true" /> LISTE</button>
        </div>
      </header>

      {view === 'list' && (
        <section aria-label="Rennen als Liste" className="runnit-arcade-map-list">
          <div className="runnit-arcade-map-list-heading"><Flag aria-hidden="true" /> OFFENE HERAUSFORDERUNGEN <small>{live && <span className="runnit-arcade-live-dot" aria-label="Live-Aktualisierung aktiv">LIVE</span>}{entries.length} angezeigt</small></div>
          <p className="runnit-arcade-map-list-hint">Neues Rennen? Halte einen Punkt innerhalb deines 500-m-Radars in der Karte gedrückt.</p>
          <Link to="/sprint-lab" className="runnit-arcade-map-lab-link">Renn-Grafik testen · Nur Simulation <ChevronRight aria-hidden="true" /></Link>
          {loading && entries.length === 0 && <p className="runnit-arcade-map-list-hint" role="status">Rennen werden erstmalig geladen …</p>}
          {!loading && entries.length === 0 && (
            <div className="runnit-arcade-map-empty">
              <Footprints aria-hidden="true" />
              <h2>NOCH KEINE RENNEN</h2>
              <p>In der aktuellen Ansicht sind keine offenen Herausforderungen verfügbar.</p>
            </div>
          )}
          {orderedEntries.map((entry) => (
            <ArcadeRunCard key={entry.id} entry={entry} selected={entry.id === selectedId} onJoin={onJoin} onCancel={onCancel} />
          ))}
        </section>
      )}
    </>
  );
}
