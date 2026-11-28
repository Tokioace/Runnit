# Geschützte Web-Beta: eindeutige Versionszuordnung (R01/R08)

Nur ein Vercel-Preview-Build vom Branch develop mit gültigem Git-Commit aus den Vercel-Systemvariablen enthält /runnit-build.json. Der Inhalt ist ausschließlich Schema, Branch und vollständiger Commit-SHA. Keine Nutzerkennung, Geheimnisse oder Backend-Konfiguration. Produktions- und gewöhnliche lokale Builds erzeugen diese Datei nicht.

Vor einer Testeinladung:
1. Den gewählten Commit und die exakte Deployment-URL in Vercel prüfen; READY allein beweist keine Erreichbarkeit.
2. Über den bereits autorisierten Zugang die Datei /runnit-build.json vom exakten Deployment laden (nicht von einem wechselnden Branch-Alias), JSON-Inhalt und erwarteten Commit vergleichen. Keine Vercel-Zugangsdaten in die Ergebnisdatei übernehmen.
3. Lokal prüfen: node --experimental-strip-types scripts/verify-preview-build-identity.mjs runnit-build.json <erwarteter-commit-sha>
4. Den SHA im Testprotokoll und in Fehlerberichten angeben, zusammen mit OS/Browser, reproduzierbaren Schritten, erwartetem und tatsächlichem Ergebnis. Keine E-Mails, Auth-Tokens oder Roh-GPS in GitHub.
5. Testzugang, getrennte Testdatenbank, Datenschutz und sichere Testbedingungen separat freigeben. Keine öffentliche Freigabe der geschützten Preview allein aufgrund der Build-Kennung.

CI überprüft die Erzeugung und das Fehlen der Datei in einem Produktions-ähnlichen Build. Das ist keine kryptographische Attestation, keine Bestätigung eines tatsächlich erreichbaren Deployments und kein Nachweis der Freigabe für externe Personen. Fehlende oder falsche Metadaten dürfen nicht als bestätigter Kandidat gelten. Bestehende Zugriffsregeln werden nicht geändert.

## Opt-in Schutz für externe Beta

Die bestehende geschützte Develop-Preview ist keine freigegebene externe Beta. Erst nach separater Betreiberfreigabe eines isolierten Projekts, Prüfung der RLS/API/Auth-Grenzen und Freigabe der Rechtstexte darf der Betreiber für den Develop-Preview-Build folgende Einstellungen vornehmen:

- `RUNNIT_EXTERNAL_BETA=true` (nur für den Develop-Preview-Zielbereich)
- `RUNNIT_EXTERNAL_BETA_PROJECT_REF`: bestätigte separate Projekt-ID, niemals das Produktionsprojekt
- `RUNNIT_EXTERNAL_BETA_ISOLATION_CONFIRMED=true`: erst nach tatsächlicher Prüfung
- `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY`: Develop-spezifische Test-URL und Publishable Key, kein Admin-Schlüssel
- `VITE_LEGAL_PAGES_ENABLED=true` und `VITE_APPROVED_LEGAL_PAGES_JSON`: tatsächlich freigegebene Rechtstexte

Der Build verweigert eine aktivierte externe Beta bei fehlender oder widersprüchlicher Konfiguration. Die Produktionsreferenz ist explizit gesperrt. Dies ist eine opt-in Konfigurationsprüfung, keine Zugriffssperre und kein Nachweis der tatsächlichen Datenisolation. Bei deaktivierter Option bleiben private Preview und Produktion unverändert. Keine externen Tester einladen und keine Preview-Zugriffskontrolle lockern, bis Backend, Datenschutz und sichere Testbedingungen ausdrücklich bestätigt sind. Die Vorprüfung am 28.11.2026 zeigte gemeinsame Vercel-Verbindungsvariablen für Preview/Produktion und kein separat bestätigtes aktives RUNNIT-Beta-Projekt. Ein altes inaktives Projekt darf nicht ohne Freigabe als Testprojekt umgewidmet werden.
