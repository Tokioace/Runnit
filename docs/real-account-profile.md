# Runnit – verpflichtendes Onboarding und echte Benutzerkonten (Beta)

## Produktverhalten
- Runnit öffnet ohne aktive Supabase-Session immer die Willkommens- und
  Anmeldeseite. Auch direkte Aufrufe von `/map`, `/profile`, `/gps-lab`
  oder `/leaderboard` werden nicht freigegeben.
- Die Startseite bleibt nach erfolgreicher Anmeldung erhalten.
- Bei späteren App-Starts prüft Supabase seine gespeicherte Session; solange
  diese gültig ist, entfällt ein erneutes Login.
- **Kein Gastzugang.** Statt Demo-Profilen sehen eingeloggte Nutzer ihre
  echten Kontoangaben und keine erfundenen Sportrekorde.

## Anmeldung und Registrierung
- **Apple / Google / Facebook:** Web-OAuth über
  `supabase.auth.signInWithOAuth` mit Rücksprung nach `/auth/callback`.
  **Die drei Anbieter sind erst nach externer Einrichtung nutzbar.**
  Fehlkonfigurationen führen zu einer sichtbaren Fehlermeldung, nicht zu
  einer fiktiven erfolgreichen Anmeldung.
- **E-Mail ohne Passwort:** `supabase.auth.signInWithOtp` sendet
  standardmäßig einen einmaligen Magic Link. Nicht existente Konten können
  damit automatisch erstellt werden, wenn Registrierungen erlaubt sind.
- **E-Mail mit Passwort:** Bleibt als Alternative für bestehende Konten
  und für Nutzer erhalten, die ein Passwort bevorzugen.
- Der Anzeigename ist frei editierbar, nicht identitätsgeprüft und nicht
  global eindeutig. E-Mail-Adressen werden nicht mehr als Spielernamen
  auf der Karte verwendet.

## Externe Einrichtung – vor Freigabe nötig
1. Im Supabase Dashboard unter **Authentication → Sign In / Providers**
   Apple, Google und Facebook einzeln aktivieren und die jeweilige
   Anbieter-App konfigurieren. Die erforderlichen Client-IDs und
   Secrets kommen vom entsprechenden Apple-Developer-/Google-Cloud-/
   Meta-Developer-Konto. **Keine Secrets im Browsercode, GitHub oder Chat speichern.**
2. Die von Supabase angezeigte OAuth-Rückrufadresse
   `https://<SUPABASE-PROJECT-REF>.supabase.co/auth/v1/callback`
   bei den einzelnen externen Anbietern hinterlegen. Dies ist NICHT
   dieselbe Adresse wie der Rücksprung in die Runnit-App.
3. Unter **Supabase → Authentication → URL Configuration** folgende
   App-Redirects für die Beta auf die Allowlist setzen:
   - `https://runnit-git-feature-real-account-profile-tokioaces-projects.vercel.app/auth/callback`
   - `https://runnit-git-develop-tokioaces-projects.vercel.app/auth/callback`
   - gegebenenfalls weitere bewusst freigegebene App-Domains für
     `main`/spätere Produktion
   Wildcard-Redirects nur eingeschränkt und bewusst für Previews nutzen.
   Für Produktion die genaue Domain eintragen.
4. Supabase E-Mail-Anmeldungen, passende E-Mail-Vorlagen, SMTP-Limits,
   Ablaufzeit und Bot-/Rate-Limiting-Einstellungen prüfen.
5. Echte Anmeldung mit Testkonten **für jeden Anbieter separat**
   prüfen: erstes Registrieren, späteres Anmelden, Abbruch, E-Mail-
   Bestätigung, Session-Neustart, Abmelden, Wechsel der Browser-App.

**Wichtig:** Diese Repository-Arbeit hat keinen Zugriff auf die
Anbieter-Dashboards oder deren Geheimnisse; deren Konfiguration und
Freischaltung ist nicht Bestandteil des PRs und bisher nicht bestätigt.
Apple kann außerdem zusätzliche Plattform-/Developer-Voraussetzungen
haben, Facebook eine App-Review-/Live-Modus-Konfiguration.

## Sicherheit
Die Client-Sitzungssperre ist **nur eine UI-Zugangssperre**, kein
serverseitiger Schutz. Supabase RLS und RPC-Berechtigungen müssen
**separat** für jede persönliche Datenbankaktion geprüft werden.
OAuth-/Magic-Link-Rücksprung erfolgt ausschließlich zum aktuellen
App-Origin und dem festen Pfad `/auth/callback`.
Der Callback rendert keine fremden Fehlerdetails oder Access Tokens.
Keine eigenen Passwortspeicher, keine Admin-/Service-Role-Keys im Frontend.

## Abnahme auf iPhone und Browser
1. Frischer privater Browser: Sofort Willkommensbildschirm statt Karte;
   kein Gast- oder Überspringen-Button.
2. Direkte URL `/map` oder `/leaderboard`: ebenfalls Anmeldebildschirm.
3. E-Mail-Link anfordern, Link anklicken, App-Session prüfen.
4. Mit Testkonten Google, Apple und Facebook einzeln testen, nachdem
   sie tatsächlich konfiguriert sind.
5. Danach sind Startseite, Karte, Rangliste und das echte Konto erreichbar.
6. Seite schließen und erneut öffnen: gültige Session bleibt aktiv.
7. Abmelden: alle App-Routen wieder gesperrt.
8. Account-Anzeigenamen ändern: neuer Name auf Profil und Karte,
   keine private E-Mail in öffentlichen Teilnehmerbezeichnungen.
9. Ungültige Links, Provider-Abbruch und schlechte Netzverbindungen
   prüfen. Keine rohen Tokens oder fremde Fehlermeldungen anzeigen.

## Noch offen
- Keine serverseitige offizielle Sportdaten-Validierung oder Ergebnisfreigabe.
- Der separate experimentelle GPS-Feldtest aus PR #21 muss nach
  dessen Übernahme ebenfalls durch den gemeinsamen Login-Gate laufen.
- Vor einer öffentlichen Beta sind Datenschutzinformationen,
  Nutzerkontolöschung und Nutzungsbedingungen gesondert zu bearbeiten.
