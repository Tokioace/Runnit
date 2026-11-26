import type { GpsSprintState } from './sprintGps.ts';
import { isFreshLiveGpsFix } from './sprintGps.ts';

/** Local feedback only. A missing fix must not authorize a result or abort. */
export function duelGpsErrorNotice(code: number): string {
  if (code === 1) return 'Standortzugriff verweigert. Bitte Berechtigung prüfen.';
  if (code === 2) return 'GPS-Position nicht verfügbar. Warte auf ein neues Signal.';
  if (code === 3) return 'GPS-Zeitüberschreitung. Warte auf ein neues Signal.';
  return 'GPS-Fehler. Warte auf ein neues Signal.';
}

export function duelGpsLiveNotice(state: GpsSprintState, nowMs: number, error: string | null): string | null {
  if (error !== null) return error;
  if (!state.lastAccepted) return 'Warte auf den ersten gültigen GPS-Fix.';
  if (!isFreshLiveGpsFix(state.lastAccepted, nowMs))
    return 'Kein aktueller gültiger GPS-Fix. Distanzmessung wartet auf ein neues Signal.';
  return null;
}
