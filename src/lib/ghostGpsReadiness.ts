import type { GpsSample } from './sprintGps';

export type GhostGpsFixIssue = 'missing' | 'invalid' | 'poor-accuracy' | 'stale' | 'future-timestamp' | 'ready';
export type GhostGpsFixInfo = Readonly<{
  issue: GhostGpsFixIssue;
  ageMs: number | null;
  accuracyM: number | null;
}>;

/**
 * Explain why GPS cannot yet be used as a sprint start line.
 * A visually good accuracy estimate is not evidence of a fresh fix.
 * Never change/replace GeolocationPosition.timestamp to make a stale fix pass.
 */
export function inspectGhostGpsFix(sample: GpsSample | null, atMs: number): GhostGpsFixInfo {
  if (!sample) return { issue: 'missing', ageMs: null, accuracyM: null };
  const accuracyM = Number.isFinite(sample.accuracyM) ? sample.accuracyM : null;
  const ageMs = Number.isFinite(atMs) && Number.isFinite(sample.timestampMs)
    ? atMs - sample.timestampMs : null;
  if (!Number.isFinite(atMs) || !Number.isFinite(sample.latitude) ||
      sample.latitude < -90 || sample.latitude > 90 ||
      !Number.isFinite(sample.longitude) || sample.longitude < -180 || sample.longitude > 180 ||
      accuracyM === null || accuracyM < 0 || ageMs === null)
    return { issue: 'invalid', ageMs, accuracyM };
  if (accuracyM > 15) return { issue: 'poor-accuracy', ageMs, accuracyM };
  if (ageMs < 0) return { issue: 'future-timestamp', ageMs, accuracyM };
  if (ageMs > 3000) return { issue: 'stale', ageMs, accuracyM };
  // GhostRunScreen also checks isFreshStartFix; this helper only explains its failure.
  return { issue: 'ready', ageMs, accuracyM };
}

export function ghostGpsFixNotice(info: GhostGpsFixInfo): string {
  switch (info.issue) {
    case 'ready': return 'GPS-Fix ist aktuell und genau. Du kannst starten.';
    case 'missing': return 'Noch kein GPS-Fix empfangen. Bitte möglichst ins Freie gehen.';
    case 'stale': return 'GPS-Position ist zwar genau, aber älter als 3 Sekunden. Es wird ein neuer Fix angefordert.';
    case 'future-timestamp': return 'GPS-Zeitstempel liegt vor der Handy-Uhr. Bitte Zeiteinstellung prüfen und GPS neu erfassen.';
    case 'poor-accuracy': return 'GPS-Genauigkeit über 15 m. Bitte im Freien auf ein präziseres Signal warten.';
    default: return 'GPS-Daten sind unvollständig oder ungültig. Neuer Standort-Fix wird angefordert.';
  }
}
