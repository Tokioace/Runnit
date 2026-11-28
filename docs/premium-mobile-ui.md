# Runnit – visueller Stilstandard (ab Premium-Mobile-UI-Preview)

## Ausgangspunkt
Die bereits positiv bewertete Startseite bleibt in dieser Arbeit unverändert.
Die folgenden Seiten und Overlay-Elemente übernehmen ihren Gestaltungsansatz:
`/leaderboard`, `/profile`, `/gps-lab`, `/map`, Karten-Ranglistendialog,
Host-/Login-Dialoge, Countdown, laufender Sprint und Sprintabschluss.

## Designsystem
- **Flächen:** Basis `#090b13`, Karten/Dialoge `#101322` und dunkle
  halbtransparente Panels mit feiner heller Kontur.
- **Akzente:** Violett/Indigo für primäre Aktionen, Cyan für Messwerte/Details,
  Mint/Grün für positive Akzente und Fortschritt, Bernstein nur für
  ausdrücklich wichtige Demo-/Unverifiziert-Hinweise.
- **Typografie:** Große kompakte Headlines, starke Zahlen mit
  `font-black` und `tabular-nums`, kurze Beschreibungen mit
  dezentem Kontrast. Die Hauptnavigation heißt Start, Karte, Rangliste, Profil.
- **Form:** Große mobile Touchflächen, Karten mit 16–30 px Radius,
  ausreichend Abstand und Fokusindikatoren für Tastaturbedienung.
- **Kartenstil:** Standard-OSM-Tiles bleiben unverändert vom selben
  zulässigen Anbieter bezogen. Eine reine CSS-Filterung der Rasterkacheln
  passt das Kartenbild der dunklen App an; Marker, Popups und Attribution
  werden davon ausgenommen.
- **Dialogebenen:** Die `BottomSheet`-Ebene liegt oberhalb der Karte
  und berücksichtigt die iOS-Safe-Area am unteren Bildschirmrand.

## Funktionale Grenzen
Diese Arbeit ist eine **UI-Überarbeitung**, keine neue Routen-, GPS-,
Datenbank-, Anti-Cheat- oder Duellimplementierung. Beispieldaten bleiben
deutlich als Demo gekennzeichnet, und GPS-Simulationen erhalten keine
Ranglistenberechtigung. Keine persönlichen Standortdaten werden in der
Startseite oder den neuen UI-Komponenten verarbeitet.

## Manuelle mobile Sichtprüfung vor Übernahme
1. Auf einem iPhone Startseite, Ranglisten, Profil und GPS-Labor öffnen.
   Darauf achten, dass keine Texte überlaufen und die Tabs gut erreichbar sind.
2. Demo-Warnungen bei der Rangliste und die noch nicht verfügbaren Sportwerte im authentifizierten Profil prüfen. In den nationalen
   und weltweiten Tabs dürfen keine künstlichen echten Platzierungen erscheinen.
3. Im GPS-Labor alle sechs Szenarien umschalten, Zahlen und Fortschritt
   kontrollieren. Diese Simulation darf keinen Standortzugriff anfordern.
4. Karte öffnen und prüfen, dass OSM-Straßen lesbar bleiben, die Marker
   getrennt und die OSM-Quellenangabe sichtbar sind.
5. Karten-Rangliste öffnen und schließen, auch über den Schließen-Button;
   auf die Ebenenreihenfolge über Kartenmarkern achten.
6. Host- und Anmelde-Dialoge an Größe und Kontrast testen;
   keine echte Anmeldung ist dafür erforderlich.
7. Countdown, Live-Rennanzeige und Ergebnisansicht erst in einer
   kontrollierten Testumgebung prüfen: Renn-/Supabase-Funktion wurde
   absichtlich nicht geändert.
8. Test der iOS-Safe-Area und der Bildschirmtastatur für Dialoge durchführen.

## Noch offen
Der eigenständige iPhone-GPS-Feldtest auf PR #21 befindet sich weiterhin
separat in Prüfung. Nach der Zusammenführung muss dessen Screen visuell
angepasst werden, ohne den Standortzugriff oder die Berichtsfunktion
zu verändern. Eine grüne GitHub-CI bestätigt keinen visuellen iPhone-Test.
