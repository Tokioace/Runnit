# Runnit – React-Fehleransicht (unabhängiges Stabilitätspaket)

## Ziel
Wenn eine React-Komponente beim Rendern oder in einem Lifecycle einen
unerwarteten Fehler wirft, soll kein vollständig leerer Bildschirm bleiben.
Die gesamte Anwendung wird in `src/main.tsx` außerhalb des Routers durch
`AppErrorBoundary` umschlossen.

## Geplantes Verhalten
- Nutzer sieht eine verständliche deutsche Fehlermeldung.
- **Erneut versuchen** startet die React-Ansicht neu, ohne einen vollständigen Seiten-Reload.
- **App neu laden** fordert einen vollständigen Reload an.
- Die Fehleransicht setzt keine Standortberechtigung voraus und verwendet
  weder Supabase noch React Router.
- Exception, Stack Trace, Nutzerdaten und Standorte werden weder in die
  Fehlermeldung übernommen noch automatisch an eine externe Stelle versandt.

## Grenzen
React Error Boundaries erfassen Render- und Lifecycle-Fehler ihrer
Kindkomponenten. Sie fangen **keine** asynchronen Fehler, Netzwerkprobleme,
fehlgeschlagene Bundle-Downloads, Browserabstürze oder Exceptions in
Event-Handlern außerhalb von Render/Lifecycle. Dieses Paket löst daher
nicht sämtliche Ursachen eines schwarzen Bildschirms.

## Manuelle QA in der Entwicklungsumgebung
1. Die Anwendung normal öffnen: Karte und Navigation sollen unverändert funktionieren.
2. **Nur lokal** eine Test-Komponente einschieben, die beim Rendern eine
   `Error('synthetic render failure')` auslöst. Verifizieren, dass die
   Recovery-Ansicht statt eines weißen/schwarzen Bildschirms erscheint.
3. Fehlermeldung kontrollieren: kein Stack Trace und keine technischen
   Details sichtbar.
4. **Erneut versuchen** und **App neu laden** separat testen.
5. Test-Komponente wieder entfernen. Keine absichtliche Fehlerroute
   auf Produktions- oder Preview-URLs veröffentlichen.
6. Auf iOS Safari und Desktop prüfen, dass Fokus und Buttons zugänglich sind.

Der vorhandene GitHub-CI-Check prüft TypeScript, GPS-Regressionstests und
Produktions-Build. Das allein bestätigt den visuellen Fehlerfall nicht.
