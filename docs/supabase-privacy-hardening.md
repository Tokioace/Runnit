# Runnit Supabase privacy hardening — 2026-11-09

## Ziel und Geltungsbereich
Die SQL-Migration `supabase/migrations/20261109_001_auth_privacy_hardening.sql`
ist ausschließlich für das Supabase-Projekt `Runnit` (Referenz
`fcbffqcmvgdojsdfwgyt`) gedacht. Bestehende Nutzerdatensätze wurden bei der
Analyse **nicht** ausgelesen. Die Migration enthält keine Datenlöschung und
verändert weder gespeicherte GPS-Werte noch vergangene Rennergebnisse.

## Änderungen
- Keine direkten Tabellenrechte mehr für `anon` auf `users`, `duels`,
  `duel_results`, `ghost_runs`. Eine Frontend-Anmeldesperre allein
  schützt keine PostgREST- oder GraphQL-Endpunkte.
- Bei `authenticated` sind direkte `SELECT`-Abfragen von `public.users`
  auf die Spalten `id` und `username` begrenzt. Damit bleiben
  Teilnehmernamen auf der Karte nutzbar, aber gespeicherte Standorte,
  Stadt/Land und Mitgliedsdatum nicht lesbar.
- Laufhistorie in `ghost_runs`: normale Tabellenabfragen nur für
  den jeweiligen Besitzer. Die separate Ranglisten-RPC gibt für angemeldete
  Nutzer weiterhin Nickname/Zeit aus, aber **keine Koordinaten oder interne
  Benutzer-ID**. Bestehende Ausgabe-Spalten bleiben mit NULL erhalten, damit
  die Frontend-Typen nicht brechen.
- `duels`: offene Herausforderungen bleiben für angemeldete Nutzer
  sichtbar; gematchte/abgeschlossene nur für Teilnehmer.
- `get_duel_results`: nur der Host bzw. Herausforderer bekommt
  Ergebnisse des betreffenden Duells. Rohes `metrics_json` des Gegners wird
  nicht übertragen.
- `submit_duel_result`: nur Duellteilnehmer nach gesetztem Startzeitpunkt,
  keine anonyme oder beliebige fremde Ergebniseinreichung. Dies ist
  **keine Anti-Cheat-/GPS-Verifizierung**.
- App-RPCs können nicht von `anon` aufgerufen werden;
  `handle_new_auth_user` bleibt interner Trigger.
- Neue Auth-User werden nicht mehr standardmäßig aus dem E-Mail-Präfix
  öffentlich benannt. Der Nickname wird aus `display_name` oder neutralem
  Platzhalter übernommen. Vorhandene Namen bleiben unverändert.
- Keine strukturellen Eingriffe in die PostGIS-Erweiterung
  (bewusst: vermeidet Breaking Changes an Karten-/Geofunktionen).

## Grenzen und restliche Prüfung
- Kein E2E-Test von 2 angemeldeten Testgeräten/Beta-Accounts während
  dieser reinen Datenbankmigration. Gezielte Tests: Auth, anonyme RPC
  gesperrt, Karte lädt Nicknames, Host/Join/Ready, Ergebnisvergleich,
  eigene/fremde Profil-Lesezugriffe, Ghost-Leaderboard.
- Die Anzeige von offenen Duell-Standorten ist weiterhin beabsichtigt.
  Sie muss produktseitig mit Einwilligung und Datenschutzhinweisen
  geregelt werden.
- Der RLS-/Advisor-Bericht kann weiterhin Warnungen für PostGIS
  in `public` (`spatial_ref_sys`, Extensions) anzeigen.
  Diese Systemobjekte werden nicht ungeprüft verschoben oder verändert.
- Bestehende `supabase/schema.sql` und `supabase/duel_functions.sql`
  stammen aus einer älteren Bootstrap-Version. **Nicht nach dieser
  Migration erneut als Ganzes ausführen**, da sie ältere, breitere
  Richtlinien und Funktionen erneut anlegen können. Die versionierte
  Migration ist maßgeblich.
- Konto-Anmeldung über Apple, Google und Facebook erfordert nach wie
  vor eigene Provider-Konfigurationen im Supabase Auth Dashboard.

## Prüf-SQL nach der Migration (nur Katalog; keine Nutzerdaten)
```sql
SELECT c.relname, a.attname,
  has_column_privilege('authenticated',c.oid,a.attnum,'SELECT') AS can_read
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum > 0 AND NOT a.attisdropped
WHERE n.nspname='public' AND c.relname='users'
ORDER BY a.attnum;

SELECT p.proname, has_function_privilege('anon',p.oid,'EXECUTE') AS anon_exec
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN (
  'get_top_ghost_runs','get_duel_results','join_duel',
  'ready_for_duel','submit_duel_result','handle_new_auth_user'
);
```
