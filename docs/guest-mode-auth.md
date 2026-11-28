# Runnit: Gastzugang und Anmeldung (9. November 2026)

## Nutzerverhalten
- Auf dem Einstieg erscheint **Als Gast fortfahren** als gleichwertiger, ausdrücklich auswählbarer Weg.
- Gäste können Startseite, Karte, Demo-/öffentliche Ranglistenübersicht, Gastprofil und
  GPS-Testlabor erreichen. Die Gastentscheidung gilt für den aktuellen Browser-Tab
  (`sessionStorage`), nicht als Supabase-Benutzerkonto.
- Durch den Button **Rennen starten · Anmelden** auf der Karte oder
  **Rennen beitreten** bei einem Marker gelangen Gäste zu `/login?next=%2Fmap`.
  Der Login lässt nach erfolgreicher Anmeldung zum vorherigen Bereich zurückkehren.
- Der Gastmodus legt keine Challenge an, startet keinen Countdown und speichert keine
  Ergebnisse. Server-RLS/RPC bleiben unabhängig von der Anzeige wirksam.
- Beim Profil steht Gästen **Anmelden oder registrieren** zur Verfügung; es werden
  keine erfundenen Erfolgsstatistiken als persönliche Werte angezeigt.
- Angemeldete Läufer können Rennen veranstalten, echte Rennen beitreten und zu
  Testzwecken eindeutig als Demo gekennzeichnete lokale Challenges starten.

## Datenschutzhinweis
Anonyme Supabase-Rollen besitzen absichtlich keine SELECT-Berechtigungen an
`users`, `duels`, `ghost_runs`, `duel_results` und keine Berechtigung für
privilegierte Runnit-RPCs. Daher zeigt die Karte als Gast **synthetische, klar
markierte Demo-Marker** statt authentischer Nutzerstandorte und Live-Duelle.
Dies ist ein bewusst beibehaltenes Datenschutzniveau. Ein späteres öffentliches
Duel-Verzeichnis benötigt eine gesonderte, gezielt freigegebene API mit
datensparsamem Schema und gegebenenfalls Opt-in der Läufer.

## Bestehender Anmeldefehler
Beim Öffnen von E-Mail-Links ist zuvor eine Weiterleitung zu
`localhost:3000` gemeldet worden. Der App-Code sendet
`emailRedirectTo: <aktueller-Origin>/auth/callback`. Ist diese URL in
Supabase **Authentication → URL Configuration** nicht freigegeben oder enthält
die E-Mail-Vorlage einen fest codierten localhost-Link, führt Supabase
möglicherweise stattdessen zur Site URL. Diese Dashboard-Einstellungen sind
nicht über den derzeitigen Supabase-Connector editierbar.

**Für die stabile develop-Vorschau:**
- Site URL: `https://runnit-git-develop-tokioaces-projects.vercel.app`
- Redirect URL:
  `https://runnit-git-develop-tokioaces-projects.vercel.app/auth/callback`
- Zusätzlich vor dem Test des Guest-Branches dessen **exakte** Vercel-Preview-
  Callback-URL in die Supabase-Redirect-Allowlist aufnehmen.
- Magic-Link-E-Mail-Vorlage nutzt `{{ .ConfirmationURL }}` und sollte
  auch `{{ .Token }}` (sechsstelliger Einmalcode) enthalten. Bei erstmaliger
  Registrierung die Confirm-Signup-Vorlage ebenfalls prüfen.
- Nutzer müssen nach der Dashboard-Korrektur eine **neue E-Mail** anfordern;
  alte Links behalten möglicherweise die alte Rücksprungadresse.
- Wenn iOS einen Link in Edge öffnet, wird die Sitzung zunächst in Edge
  gespeichert; Safari erhält sie nicht automatisch. Der sechsstellige Code
  kann dagegen in der ursprünglichen Runnit-Safari-Seite eingegeben werden.

## Tests und Grenzen
- Node-Testdateien prüfen die Guest-Gates, Login-Rücksprung-Whitelist und
  Entfernung der alten Gast-Rennpfade. TypeScript/Build und CodeQL separat.
- Live-Login, SMTP-/Auth-Mailvorlagen und Rennen mit zwei echten Testgeräten
  können nicht vollständig ohne manuelle Supabase-URL-Konfiguration und einen
  kontrollierten Beta-Test bestätigt werden.
- Keine Änderungen an Auth-Usern, Standorten oder Renn-Ergebnisdatensätzen.
- `main` bleibt für Nutzerfreigaben unverändert. Änderungen sind ausschließlich
  als Feature-Branch/PR gegen `develop` vorgesehen.
