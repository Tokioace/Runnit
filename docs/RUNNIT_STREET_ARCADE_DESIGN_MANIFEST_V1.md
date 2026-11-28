# RUNNIT — STREET ARCADE
## Design-Manifest und verbindliche Screen-Spezifikation · Version 1.0
**Status:** Soll-Design zur Freigabe. Kein Nachweis, dass alle beschriebenen Funktionen bereits implementiert sind.
**Visuelle Referenz:** vom Auftraggeber bestätigte RUNNIT-Startillustration mit Runner, neonfarbenem Stadtbild, Chrome-Logo, Cyan/Magenta/Violett und Arcade-Sport-Spiel-Ästhetik. Das zuletzt bestätigte Dashboard-Mockup mit **drei kleinen Rangabzeichen** ist Referenz für die Home-Informationsarchitektur.

### 0. Identität: Was RUNNIT sein muss
RUNNIT soll wie ein hochwertiges, urbanes Wettkampf-Spiel aus den frühen 2000ern wirken, aber mit der Präzision und Zuverlässigkeit einer modernen Sport-App. Stilassoziationen: Street-Sport, Hip-Hop, Breakdance, EA-BIG-Ära, glänzender Y2K-Hightech, Frutiger-Aero-Licht und dynamische Stadtlandschaften. Referenzen sind **Atmosphäre**, nicht zu kopierende Logos, Figuren oder geschützte UI-Assets.

**Design-Motto:** CHALLENGE. RACE. BEAT.
- Straßensport und freundschaftlicher Wettkampf statt klinischer Fitness-Wellness.
- Dunkles Navy als ruhige Bühne; lebendige Cyan- und Magentakanten; Violett als Tiefe; Lime als gezielter Wettkampf-Akzent; Gold nur für Auszeichnungen.
- Bewegungsenergie über Schrägen, Speedlines, asymmetrische Flächen, diagonale Highlights und urbanes Licht; nicht durch ständiges Blinken.
- Der genehmigte Runner bleibt Leitfigur; Artwork ist Illustrations-Asset, **keine** erfundene echte Nutzeridentität.
- Daten sind ehrlich: „Demo“ ist immer erkennbar, ungeprüfte Ergebnisse gelten nicht als offizielle Bestzeiten, fehlende Daten erscheinen als „—“.

### 1. Gestaltungsraster und feste Positionierungsregeln
**Design-Referenz:** 390 × 844 CSS-Pixel (Portrait); zusätzlich Pflichtprüfungen 320 × 568, 375 × 812, 428 × 926, Tablet 768 × 1024 und Desktop. Prozentpositionen gelten ausschließlich innerhalb einer Verhältnis-gesperrten Illustration; alle interaktiven Dashboards verwenden echte responsive Layouts.

| Konstante | Vorgabe |
|---|---|
| Safe Areas | Oben und unten mit env(safe-area-inset-top/bottom) respektieren |
| Inhaltsbreite | Mobil 100% minus 16 px Rand links und rechts; Desktop maximal 560 px für einspaltige Inhalte |
| Basisraster | 8 px; 4 px nur für Feinabstände |
| Header | 64–88 px unterhalb der oberen Safe Area, sofern die Seite keinen Vollbildmodus benötigt |
| Kartenradius | 16–22 px, schräg angeschnittene Hervorhebung nur an Hauptaktionen |
| Interaktive Mindestgröße | 44 × 44 CSS-Pixel, primäre Aktionen 52–64 px Höhe |
| Schriftgrößen | Titel 32–46 px; Abschnitt 20–26 px; Metrik 25–42 px; Body 14–16 px; Metadaten mindestens 12 px |
| Hauptnavigation | Unten fixiert, 70–78 px plus untere Safe Area; Scrollinhalt erhält entsprechenden Abstand |
| Seiten-Scroll | Lange Inhalte vertikal scrollbar; beim normalen Seitenwechsel am Seitenanfang |
| Numerische Werte | Tabular-Ziffern, kein Springen der Breite bei Live-Daten |
| Bildrendering | Proportionen beibehalten, kritische Inhalte nicht croppen, nie object-fill für Illustrationen |
| Desktop | Zentrierte App-Shell oder sinnvoller Zweispaltenmodus; kein Hochskalieren von Mobiltext |

**Farben / Tokens (aus der Illustration abgeleitet, Soll):**

| Token | Hex | Einsatz |
|---|---|---|
| Ink | #070B20 | Hintergrund |
| Navy | #101538 | Panels / Schatten |
| Cyan | #35EBFF | primäre Interaktionen, Positionsstatus |
| Magenta | #F146FB | Rivalen, Ghost, Energie |
| Violet | #9268FF | Übergänge, Tiefe |
| Lime | #B7FFB6 | aktive Challenges, Fortschritt, bestätigter Erfolg |
| Gold | #FFCC4B | Podium, Auszeichnungen |
| White | #F9FBFF | Lesetext |
| Muted | #A9B7D2 | Sekundärtext |

**Materialsystem:** Dunkle Glas-/Chrome-Panels mit einer einzigen hellen Kante, kontrolliertem Cyan-/Magenta-Glow, feinen Raster-/Halftone-Schichten, bisweilen 3D-Bevel bei Haupt-CTAs. Jede Seite erhält dieselbe Schrift-Hierarchie, denselben Header-Stil und dieselbe Navigation. Keine fünf gleich starken neonfarbenen Highlights in einem einzigen Viewport. Alle wichtigen Zustände zusätzlich mit Text/Icon – nie Farbe allein. Animationen berücksichtigen prefers-reduced-motion. Lesbarkeit und Bedienbarkeit haben Vorrang vor visuellem Effekt.

### 2. Navigation / App-Architektur
**SPLASH → HOME → Funktionen**. Der Landing-Screen / bleibt bei jedem frischen App-Start die markentypische Begrüßung und zeigt bei vorhandener Sitzung keine Loginpflicht. „STARTEN“ führt zur echten Startseite /home, **niemals direkt zur Karte**.

**Ziel-Navigationsdock (fünf Spalten, exakt in dieser Reihenfolge):**
1. Haus: HOME → /home.
2. Pin: KARTE → /map.
3. Balken: STATS → künftig /stats (derzeit nicht als eigene Route vorhanden).
4. Pokal: RANGLISTE → /leaderboard.
5. Person: PROFIL → /profile.

**Dock-Position:** x=0–100% der verfügbaren Displaybreite, y=Viewport-Unterkante minus Dockhöhe, inkl. Safe-Area. Icon mittig über 10–12 px Text. Aktiver Tab erhält Lime/Cyan-Glow und deutlich erkennbaren aktiven Hintergrund, andere Tabs bleiben Navy/Weiß. Der Dock wird nur auf öffentlichen/normalen App-Seiten gezeigt; **nicht** auf Splash, Login/Registrierung, Countdown, laufendem Rennen oder Rennabschluss, sofern diese Konzentration erfordern.

**Technische Bestandsaufnahme 12.11.2026:** Die vorhandenen entwickelten Routen im develop-Zweig sind /, /home, /map, /leaderboard, /profile, /gps-lab, /calibration, /fusion-lab und /sprint-lab sowie /login und /register. /stats und eigenständige reale Rennen-/Ergebnisseiten sind Zukunfts-Soll. Die aktuelle BottomNav hat vier Tabs; Umstellung auf fünf muss erst implementiert werden.

### 3. Screen 00 — öffentlicher Splash (/)
**Referenz:** genehmigtes vollständiges 9:16-Bild, nicht das Dashboard-Mockup.

**Bild:** originaler Runner im Vordergrund, RUNNIT-Chromelogo ganz oben, Stadt-/Neonatmosphäre, drei dekorative Feature-Leisten (1v1 DUELL, GHOST-RUN, RENNEN IN DEINER NÄHE) im rechten mittleren Bereich, großer gerahmter STARTEN-CTA unten.

**Zonen im Verhältnis zur genehmigten Originalillustration** (Bild bleibt immer unverzerrt, Bedienflächen liegen darüber):
- Oberes Viertel: Logo und Claim, keine Buttons darüber.
- Mittlerer Bereich: Runner, Stadtkulisse, drei **nicht anklickbare** Leisten.
- Untere ~20%: STARTEN am selben Ort, mit demselben in die Grafik eingebauten Neonrahmen.
- Unterste ~7–8%: **nicht angemeldet** ANMELDEN / REGISTRIEREN / ALS GAST als kleine, rahmenlose, einzeln bedienbare Textaktionen. **Angemeldet:** PROFIL / RANGLISTE / ANGEMELDET als bewusst ausgewechselte unterste Ebene, ohne STARTEN zu verdecken.

**Interaktion:** STARTEN öffnet /home; Anmelden öffnet /login; Registrieren öffnet /register; Gast öffnet /home im Gastmodus. Kein künstliches langes Intro und keine Standortabfrage hier.

### 4. Screen 01 — HOME / Dashboard (/home)
**Priorität:** visuelles Master-Mockup. Scrollbarer Screen; festes Dock unten. Keine Fake-Zahlen als echte Daten.

**Vertikale Abfolge bei 390 px Breite (y = Abstand unter oberer Safe Area; Höhen sind Design-Zielwerte):**

| Zone | y im Scroll-Dokument | Geometrie / Inhalt | Aktion |
|---|---|---|---|
| A — Marke | 8–106 px | RUNNIT Chrome-Logo links 65–70% Breite; Claim darunter; rechts Benachrichtigung (Glocke) + Settings-Icon | Glocke zu Nachrichten, Zahnrad zu Einstellungen, falls implementiert |
| B — Drei Mini-Rangabzeichen | 116–164 px | 3 gleiche Badges in einer Reihe, je (358−16)/3 ≈114 px breit, 44–48 px hoch | Nur Anzeige; optional Tipp öffnet passende Rangliste |
| C — Runner-ID-Karte | 176–292 px | Links Avatar 70–82 px; mittig Username, Level, XP-Leiste; rechts neonfarbenes R-Emblem | Zum Profil |
| D — Arcade-Kurznavigation | 306–382 px | Vier gleich breite Kacheln: AKTIVITÄT, RENNEN, RANGLISTE, PROFIL | Aktivität springt im Home zu Stats; Rennen zu Rennmodi; Rangliste und Profil zu eigenen Seiten |
| E — Wochenaktivität | 396–548 px | Überschrift links, Zeitraum rechts; 3 Metriken nebeneinander (Schritte, Distanz, Kalorien nur falls seriös ermittelbar) | Aufklappen zu /stats |
| F — 1v1-Spotlight | 562–680 px | Breites cineastisches Banner mit zwei rennenden Figuren, diagonaler 1v1-Schrift | Startet direkt die 1v1-Konfiguration |
| G — Zuletzt / Ranking | 694–970+ px | Bei >=375 px: zwei schmale Panels nebeneinander (je ~175 px). Links die 3 jüngsten **echten** Rennen, rechts Top 3 einer echten Rangliste. Bei <375 px untereinander | Detail ansehen / vollständige Rangliste |
| H — Hauptaktion | nach G + 24 px | Großflächiger, zentraler, cyanfarbener Bevel-CTA „RENNEN STARTEN“ mit Pfeilen | Öffnet Auswahl 1v1 / Ghost, nicht unmittelbar die Karte |
| I — Dock | fix unten | HOME / KARTE / STATS / RANGLISTE / PROFIL | Navigation |

**Drei Rangabzeichen aus dem bestätigten letzten Bild:** Kein sichtbarer Text „Stadt“, „Land“ oder „Welt“. Stattdessen [🏙 Skyline + #Rang], [Landesflagge des gewählten Rankinglandes + #Rang], [🌐 Globus + #Rang]. Für Deutschland zeigt das zweite Abzeichen die Deutschlandflagge. Screenreader erhalten die zugänglichen Namen „Platzierung in meiner Stadt / meinem Land / weltweit“. Ohne genehmigte, überprüfte Werte: **— statt fiktiver Platzierung**; ggf. kleine Kennzeichnung „Noch ungewertet“. Keine stillschweigende Ortsermittlung allein auf Home.

**Werte und Datenschutz:** Wöchentliche Schritte und Distanz zählen nur tatsächlich aufgezeichnete Sitzungen. Keine Behauptung, die PWA könne im Hintergrund wie eine native Health-App alle Schritte fortlaufend sammeln. XP, Level, Siege und Rang sind erst nach definiertem, manipulationsresistentem Wertungssystem produktiv. Demo-Zahlen nur in ausdrücklich markiertem Showroom.

### 5. Screen 02 — KARTE / Rennen in deiner Nähe (/map)
**Vollbild-Karte als funktionales Zentrum; Gestaltung als Overlay, nicht als Lesbarkeit störender Fotohintergrund.**

- **Top 8–62 px:** kompakte Headerleiste: Pfeil zurück links, „RENNEN IN DEINER NÄHE“ mittig, rechts Filter/Standort-Button.
- **62–114 px:** segmentierte Auswahl KARTE | LISTE, Lime markiert aktiv; optional Such-/Radiusfilter als kleine rechtsseitige Pill.
- **Kartengebiet:** vom Header bis ca. 92 px über dem unteren Dock vollflächig, klare Kartenlabels, cyanfarbener Radius-Kreis, aktueller Standort als blauer Punkt nur nach Erlaubnis. Marker: Cyan = offene 1v1-Duelle; Magenta = Ghost (nur wenn echte Funktion verfügbar); Lime = selbst veranstaltet; Gold = besondere Challenges.
- **Floating Bottom Card (oberhalb Dock):** bei Auswahl eines Markers: 1v1-Typ, Distanz, Entfernung, Teilnehmer 1/2, Veranstalter, Zustand; primärer Button „BEITRETEN“, sekundär „DETAILS“.
- **Hauptaktion:** fest oberhalb des Docks oder sichtbar als markanter FAB „RENNEN VERANSTALTEN“; nicht unter Karten-Steuerelementen verstecken.
- **Leerzustände:** „Hier ist derzeit kein Rennen verfügbar“ + „Eigenes Rennen erstellen“; keine als echt getarnten Demo-Marker.
- **GPS verweigert:** Ortsauswahl/Suche statt Blockade; niemals Standortberechtigung ungefragt beim Öffnen des Home-Screens.
- **Tippfolge:** Marker → Karteikarte → Details/Beitreten; Veranstalten → Race-Setup-Bottom-Sheet.

### 6. Screen 03 — Rennen erstellen / beitreten (Overlay über Karte)
**Bottom Sheet** mit 85–90% max. Viewporthöhe, eigener Scrollbereich, sichtbarer Schließen-/Abbrechen-Aktion.
- Oberste 56 px: „RENNEN VERANSTALTEN“ / Schließen.
- Darunter zwei große Modi: 1v1 DUELL (Cyan) und GHOST-RUN (Magenta). Nicht verfügbaren Ghost-Modus als „IN ENTWICKLUNG“ eindeutig deaktivieren.
- Nächste Zeile Distanz: 50 / 75 / 100 m oder validierte, unterstützte Distanzen; Auswahl als großes Segment.
- Danach Start-/Zielkonzept, Sichtbarkeit/Radius, ungefähre Ortsangabe, GPS-Qualität, Teilnehmerlimit, Geräteberechtigungen und kurze Fair-Play-Hinweise.
- Am Fuß fixiert: große Aktion „RENNEN ERSTELLEN“. Abbrechen ist immer möglich; vor Löschung offener Events Bestätigung anzeigen.
- Gästen bei echtem Erstellen/Beitreten klaren Account-Gate mit Rückkehr in denselben Vorgang anbieten. Kein Eingabeverlust bei Login.

**Warteraum:** Nach Erstellung eine eigene deutliche Karte: Host-Name, Rennart, Distanz, 1/2 Teilnehmer, Ort, „Warte auf Gegner“, Einladung/Teilen, „RENNEN ABSAGEN“. Kein fiktiver Countdown ohne zweite Person. Fehler und Stornozustände sichtbar.

### 7. Screen 04 — Startaufstellung / Countdown
**Nutzung:** vor echtem 1v1; Fullscreen ohne unteres Dock.
- Oben: Du vs Gegner, validierte Distanz, beide Bereitschaftsindikatoren.
- Mitte: große zweispurige Startaufstellung mit den Rennfiguren nach rechts, Start- und Ziellinie erkennbar.
- Im Zentrum darüber: synchronisierter Countdown 3–2–1–GO mit kurzer einmaliger Bewegung und optional Sound (Ton abschaltbar).
- Unten: deutliche Verbindung/GPS/IMU-Zustände, „ABBRECHEN“ vor Start; keine fingierten exakten Startbedingungen.
- Bei fehlendem Standort, blockiertem Bewegungssensor oder Browser-Unterbrechung: Start blockieren oder Rennen als nicht wertbar kennzeichnen; nicht stillschweigend fortsetzen.

### 8. Screen 05 — LIVE-Rennen / Zweispurige Race Engine
**Vorrang:** Information vor Dekoration, im Gegensatz zu Showroom-Screens niemals irreführende Präzision.
- **Top 10–22%:** links „HEAD TO HEAD“ + 100 M, rechts große zentrale Zeit „DEINE UHR“, Statusband „LIVE“ oder „DEMO“.
- **Mittlere 22–70%:** zwei klar voneinander getrennte Bahnen (YOU, RIVAL), identische Skalierung 0–Zieldistanz; zwei animierte Sprinter bewegen sich tatsächlich nach rechts, blicken zum Ziel, bleiben an der Ziellinie sichtbar; Zielwort außerhalb des Schachbrettstreifens. Auf der rechten Seite der jeweiligen Bahn Distanz „x / 100 m“.
- **Direkt darunter:** Abstand nur mit definierter Bedeutung („geschätzter Vorsprung“ / „Abstand beim ersten Zieleinlauf“) und korrekter Vorzeichenlogik; keine fiktiven 0,1-m-Gewissheiten.
- **Bottom 70–100%:** Sport-Status „GO! GO! GO!“, Verbindungs- und Qualitätspills für GPS / IMU / Synchronisation, sichere Aktion „Rennen beenden“; ohne Dock.
- **Unterbrechung:** Bildschirm gesperrt, Sensor-Lücken oder GPS-Sprünge erzeugen einen deutlich sichtbaren Status; kein automatischer „verifizierter“ Sieg.

**Animationsstandard:** Der ursprüngliche menschliche Runner dient als Stilreferenz. Animierte Runner sollen in realistischer Sprintmechanik laufen (nicht hüpfen oder slide-gliden), konstant nach rechts ausgerichtet. Sprites oder Web-Animation mit 8–12 klar gezeichneten Bewegungsphasen und reduzierter Bewegungsoption; Rendering darf den Sensor-Live-Loop nicht blockieren.

### 9. Screen 06 — Rennabschluss / Ergebnis
**Vollbild, ohne Dock während der ersten Ergebnisansicht.**
- Oben 10–35%: je nach Zustand **SIEG / NIEDERLAGE / UNENTSCHIEDEN / NICHT GEWERTET**. Großer goldener Kranz nur bei tatsächlichem gewerteten Erfolg.
- Mitte 35–65%: beide Endzeiten, Distanz, relevante Qualitätsangaben, Zeitdifferenz und nachvollziehbar definierter Zielabstand.
- Unten 65–100%: XP und neue Platzierung nur falls reale Wertungslogik vorhanden; Buttons „ERGEBNIS ANSEHEN“, „NOCH EIN RENNEN“ und „ZURÜCK ZUR KARTE“.
- Demo/Sandbox immer klar als **DEMO / KÜNSTLICHE ZEITEN**; Demo-Siege niemals ins öffentliche Ranking.

### 10. Screen 07 — Ghost-Run
**Geplante eigenständige Rennart, nicht automatisch als produktiv zu behaupten.**
- Auswahlliste: eigene verifizierte Bestzeit, verfügbares Ghost-Ziel, Distanz, Aufzeichnungsqualität. Keine Phantomgegner als echte Läufer.
- Vor Start: „Du gegen deine Bestzeit“ mit zwei Avatar-Plätzen; eigene Position Cyan, Ghost Magenta als halbdurchsichtige Figur.
- Während des Rennens: dieselbe Race Engine und derselbe Maßstab wie 1v1, zusätzlich Zeitdelta zum Ghost und deutlicher Ghost-/Replay-Status.
- Nach Finish: eigene vorherige Zeit vs neue Zeit, persönliche Verbesserung; öffentliche Wertung nur bei erfüllten Prüfregeln.

### 11. Screen 08 — STATS / Aktivität (künftig /stats)
**Zugriff:** Dock „STATS“, Home-Kurznavigation „AKTIVITÄT“ und Klick auf Wochenmetriken.
- Oben: RUNNIT-Header, Titel „DEINE STATS“, Zeitraumfilter HEUTE / WOCHE / MONAT / GESAMT.
- First Fold: drei große echte Kennzahlen in einer Reihe (Schritte, aufgezeichnete Distanz, aktive Zeit). Kalorien optional und ausdrücklich **geschätzt** – ansonsten nicht als konkrete Zahl ausgeben.
- Darunter: Wochenbalken oder Tagesaktivitätskurve, Monatsfortschritt, Anzahl absolvierter/wertbarer Rennen, persönliche Bestzeit nach Distanz, faire Leistungsentwicklung.
- Untere Abschnitte: „RENNHISTORIE“, Filter 1v1/Ghost, Tippen öffnet Renndetail; „FAIR-PLAY-STATUS“ mit verständlicher Sensorqualität.
- Keine permanente Schrittzählung im Hintergrund behaupten, wenn Browser/API sie nicht liefert. Fehlende Daten: „Noch keine aufgezeichneten Aktivitäten“ und CTAs zum echten Test oder Rennen.

### 12. Screen 09 — RANGLISTE (/leaderboard)
- Oben: großer Gold-Pokal auf Navy-Skyline-Band; Titel „RANGLISTE“.
- Darunter: drei große Segmente, **🏙 / Landesflagge / 🌐** mit Screenreader-Namen Stadt / Land / Welt; ohne lange sichtbare Tab-Texte. Aktives Segment Lime.
- Zweite Filterzeile: Distanz 50/75/100 m (sofern verifizierte Disziplinen) und Zeitraum Saison / Gesamt.
- Oberer Mittelteil: 1.–3.-Platz-Podium mit kleinen Avataren; echte Punkte/Zeiten und bekannte Stadt nur nach datenschutzkonformer Freigabe.
- Rest: scrollende nummerierte Platzierungsliste, eigene Zeile highlighted in Cyan/Lime, klare Sortierregeln (z. B. schnellste verifizierte Zeit je Distanz und Saison); keine gemischten Distanzen oder ungeprüften Ergebnisse.
- Bei fehlender Datenbasis: exklusiv markierter DEMO-MODUS oder seriöser Leerzustand. Derzeit zeigt die vorhandene Seite fiktive Demo-Daten; **noch keine offiziellen Platzierungen**.
- Auf Ranking-Badge im Home tippen → diese Seite mit vorgewählter Ebene.

### 13. Screen 10 — PROFIL (/profile)
- Oben 10–33%: breiter City-Sunset-Hintergrund, großes Portrait des Runner-Avatars links, eigener Nickname/Level rechts, XP-Fortschrittsleiste unmittelbar darunter.
- Darunter: drei gleich große Leistungs-Karten „RENNEN“, „SIEGE“, „BESTZEIT (100 m)“; nur echte, nachprüfbare Werte.
- Darunter drei Segmente „PROFIL“ / „ZIELE“ / „ERFOLGE“; „ZIELE“ zeigt selbst gewählte Wochenziele, „ERFOLGE“ freigeschaltete Awards, gesperrte Awards unterscheiden sich sichtbar von verdienten.
- Danach Badge-Galerie (zwei Reihen, horizontales Scrollen zulässig), Persönliche Bestzeiten, letzte Rennen.
- Unterer Inhaltsbereich „EINSTELLUNGEN & LABORE“: Anzeigename ändern, Passwort ändern, Abmelden, persönliche Gehschrittlänge, Kalibrierung wiederholen, GPS-Labor, Fusion-Labor, Sprint-Demo. Debug-Werkzeuge nicht über die Sportdaten legen.
- Gäste sehen einen ansprechend gestalteten Gaststatus mit Login/Registrierung, keine erfundenen persönlichen Statistiken.
- Profilavatar ist eine optionale Designfigur; keine echte Person behaupten, wenn Foto/Avatar nicht hinterlegt.

### 14. Screen 11 — Persönliche Schrittkalibrierung (/calibration)
**Wichtig für das spätere GPS×IMU-System; Geh- und Sprintkalibrierung sind methodisch getrennt.**
- Header RUNNIT SETUP, Fortschrittsstufen 1/4 bis 4/4.
- Schritt 1: Körpergröße und Hinweise zu gerader Außenstrecke; Größe dient als Plausibilitätsprüfung, nicht als Ersatz der Messung.
- Schritt 2: GPS-Startpunkt sammeln, Messgüte sichtbar, „GEHEN STARTEN“ erst bei akzeptabler GPS-Situation.
- Schritt 3: große Live-Schrittzahl mittig, Fortschrittsbalken, „SCHRITTE STOPPEN“ unten fixiert; bestehende Testlogik zielt auf etwa 40–50 Schritte und nicht auf 10 GPS-Schritte, weil die 10-Schritte-Distanz im Smartphone-GPS oft zu kurz für eine verlässliche Endpunktmessung ist.
- Schritt 4: Distanz, Schritte, geschätzte Gehschrittlänge, Qualitäts-/Plausibilitätsbericht, „SPEICHERN“ oder „NEU MESSEN“.
- Keine Pflicht für öffentliche App-Erkundung; Pflichtstatus erst definieren, wenn eine **valide gewertete Rennmessung** Kalibrierung tatsächlich voraussetzt. Gehschrittlänge nicht ungeprüft als Sprintschrittlänge verwenden.

### 15. Screen 12 — GPS-Labor (/gps-lab)
**Experimenteller Developer-View, nicht prominenter Main-Dock-Tab.**
- Oben: RUNNIT ENGINEERING / GPS-TESTLABOR, SIMULATION vs ECHTMESSUNG deutlich markiert.
- Oberstes Panel: Sensorgüte (GPS-Fixes, IMU-Frequenz/Unterbrechungen, Display-Wake-Status) und „TEST STARTEN“.
- Mittleres Panel: Live-Schritte (IMU), GPS-Distanz, Schritt-basierte Schätzung und Differenz; keine exakte Gleichheit behaupten.
- Darunter: Zeitachse mit IMU-Peaks/Gaps und auswählbarem Messfenster.
- Unten: Referenzschritteingabe, Diagnosedaten-Export als JSON, Messlauf stoppen/abbrechen, Links zu Fusion und Kalibrierung.
- Mess-Logik/Schwellwerte ausdrücklich nicht durch Designarbeit verändern; der bestehende Schrittzähler dient als Regression-Baseline.

### 16. Screen 13 — Fusion-Labor (/fusion-lab)
- Header „GPS × IMU“; oben zwei Metrik-Karten „GPS“ und „IMU“.
- Mitte: vereinfachte überlagerte Distanzkurven und klarer „FUSIONS-SCHÄTZWERT“-Balken.
- Darunter: auswählbare Fehlerszenarien (sauber, GPS-Drift, Signalverlust, Stillstand etc.), Start/Schritt-für-Schritt und Reset.
- Footer: Erklärung der Qualitätsentscheidung, Navigation zum realen GPS-Labor.
- **SIMULATION** über jeder unechten Ausgabe. Keine behauptete garantierte Zentimeter-Genauigkeit.

### 17. Screen 14 — Sprint-Arena-Demo (/sprint-lab)
- Übernimmt Live-Rennen-Layout exakt als **animierte Designvorschau** (zwei Bahnen, Richtung Ziel, Start/Ziel-Legende außerhalb der Figur, Timer/Finish).
- Moduswahl 50/75/100 m, Tempo-Szenarien, START DEMO / RESET, künstlicher Gegner klar als „RIVAL · SIM“.
- Niedrigerer Bereich: Sprintkadenz-Entwicklung / Technikstatus als getrenntes Laborpanel; nicht mit der Rennanzeige vermengen.
- Demo-Resultate niemals speichern wie echte Siegerzeiten.

### 18. Screen 15 — Anmeldung, Registrierung, Konto-Einstellungen
**Auth ist eigenständig und visuell konsistent, aber deutlich ruhiger als das Splash-Poster.**
- Beide haben RUNNIT-Minilogo oben links und „ZURÜCK“.
- /login: Heading „ANMELDEN“, direkt darunter E-Mail und Passwort, klare Hauptaktion „ANMELDEN“; alternative Anbieter/Link/Code unter sekundärem Disclosure.
- /register: Heading „REGISTRIEREN“, direkt darunter Anzeigename, E-Mail, Passwort, „KONTO ERSTELLEN“; danach nachvollziehbarer Bestätigungshinweis, kein Wechsel unter derselben URL zum falschen Formular.
- Unten der linkartige Wechsel „Noch kein Konto? Registrieren“ / „Schon registriert? Anmelden“, „Als Gast fortfahren“.
- Konto-Einstellungen im Profil: Accountdaten, Passwortwechsel, Logout (immer bestätigt/erkennbar), Datenschutz, Sound/Bewegung, Berechtigungsstatus; keine unnötige neue Registrierung bei vorhandener Sitzung.

### 19. Wiederverwendbare Komponenten / Art Direction
**Verbindliche UI-Bausteine:**
- RunnitHeader: Chrome-Logo + Street-Akzent + maximal zwei Utility-Aktionen.
- RankMiniBadge: SVG-Icon (Skyline/Flagge/Globus), tabellarischer #Wert, 3-Spalten-Raster, Tooltip/Screenreader-Beschriftung.
- RunnerIdentityCard: Avatar, Displayname, Level, echter Fortschritt.
- ArcadeNavTile: schräges Neon-Chrome-Panel (Cyan/Lime für aktiv, Cyan/Violet für sekundär), ikonografisch.
- StatCard: sehr große Zahl, kleine Einheit, Zeitbezug und Provenienz.
- DuelSpotlight: Runner/Rival, kontrastreiches 1v1, genau **eine** eindeutige Aktion.
- RaceLane: Start/Ziel-Track, Sprite, Progress, Distanz, eigener Status, skaliert auf echte Rennmetrik.
- FloatingRaceCard + RaceSetupSheet: Karten-Kontextaktionen ohne Überlagerung der Kartendaten.
- ArcadeButtonPrimary: 56–64 px, cyanfarbener Bevel, dunkle Beschriftung, Chevron rechts.
- ArcadeButtonSecondary: Navy-Glas, Cyan-Outline, keine bedeutungslosen Duplikat-CTAs.
- StreetPanel: dezenter Chrome-Rand, Navy-Untergrund, gezielter Glow oben rechts.
- DemoRibbon + DataQualityPill: immer gleich positionierte Zustandslabels (DEMO, UNGEPRÜFT, GEPRÜFT, OFFLINE).
- NavigationDock: die fünf festen Hauptrouten. Labore nur über Profil/Einstellungen.

**Illustrationen:** Der genehmigte RUNNIT-Runner bleibt in Aussehen und Proportionen konsistent. Kein Sonic-artiges Tiermaskottchen und keine zufällig wechselnden Personendesigns. Neue Artwork-Ausschnitte müssen denselben Runner, dieselbe Brille, denselben Hoodie, ähnliche Schuhe und denselben Stadt-Neon-Look verwenden. Verschiedene Sportarten/Zeiten dürfen nur mit klarer Szenenkontinuität dargestellt werden.

### 20. Informations- und Bewegungsprinzipien
- Jede Hauptaktion hat ein einzelnes klares Ziel; keine drei Buttons nebeneinander, die alle nur /map öffnen.
- Auf Home wirken große Banner wie Sport-Werbemotive; echte Daten befinden sich in semantischen DOM-Elementen darüber/daneben, damit Sprache/Größe/Zustand reagieren können.
- In Live-Rennen sind große Kontraste, Geschwindigkeit, Timer und Rivalenabstand wichtiger als dekorative Hintergrundfiguren.
- Vor dem Drücken von „STARTEN“ in einem Rennen müssen Zielstrecke, GPS-Berechtigung und Sensor-/Verbindungsstatus klar sein.
- Ein Übergang dauert vorzugsweise 150–250 ms; keine andauernden, energiefressenden Blur-/Glow-Animationen. Bei reduzierter Bewegung keine transformierenden Hintergründe. Animation nur, wenn sie Informationen vermittelt (Countdown, Runner, Fortschritt, Erfolg).
- Alle Overlays schließen mit eindeutiger Cancel-Aktion und ohne versteckte Scroll-Probleme; Zustand bleibt erhalten, wo sinnvoll.
- Standardmäßig keine Standort-/Sensorabfrage beim allgemeinen Starten oder beim Home-Laden.

### 21. Definition of Done (für jede einzelne Seite)
1. Bildvergleich mit genehmigtem Mockup: Silhouette, Farben, Größen, Hierarchie, Abstände und Glows nachvollziehbar konsistent.
2. Nutzbare DOM-Bedienelemente, 44 px Touchgrößen, klare Zustände, Fokus-/Screenreader-Namen.
3. Screenshots auf 320, 375, 390, 428 px Breite; Tablet und Desktop; keine gestreckten Bilder, kein horizontaler Overflow, kein Inhalt unter Dock/Notch.
4. Guest, Signed-in, Signed-out, Loading, Empty, Error, Offline und Permission-Denied geprüft, wo relevant.
5. Live-Daten aus echten Quellen oder offen als Demo/ungeprüft gekennzeichnet; keine erfundenen Ranglisten, XP, Siege oder Nutzerzahlen.
6. Kein Regressionsrisiko für bestehende GPS-/IMU-Erkennung, Race State Machine, Supabase Auth, Event-Storno und Berechtigungsgrenzen. Tests + TypeScript + Build + Sicherheitsprüfung.
7. Keine Änderungen auf main ohne separate Nutzerfreigabe. PRs zunächst auf develop; tatsächliche Geräteprüfung vor Design-Abnahme.

### 22. Umsetzungsetappen / Abnahmereihenfolge
**A — Designsystem/Komponenten:** Tokens, NavigationDock, Header, Panels, CTA, Layout, CSS und Accessibility-Tests. Dies schafft die Basis und verändert keine Messalgorithmen.

**B — HOME 1:1:** Rangabzeichen 🏙/Flagge/🌐, Runnerkarte, Arcade-Kacheln, Aktivität, DuelSpotlight, letzte Rennen, Rangliste, CTA. Zunächst ehrliche Empty-States statt erfundener Daten.

**C — KARTE + RaceSheet:** Fullscreen-Kartenoberfläche, Marker, Filter, Rennkarten, Host/Join/Warteraum und nutzbare Stornoaktionen.

**D — RACE Engine + Finish:** Runner-Animation, Zweispur-Progress, Zustände, Datenqualität, Ergebnisbildschirm; erst Design dann Integration/Abnahme mit echter Race State Machine.

**E — PROFILE / RANGLISTE / STATS:** reale Kontodaten, verifizierte Ergebnisquellen, Badge-Regeln, Statistikroute und Rankingtabellen.

**F — KALIBRIERUNG / LABORE / AUTH:** optische Angleichung bei unveränderten Sensoralgorithmen, klares Engineering-Label und saubere Formulare.

**Regel für sämtliche Etappen:** Das Mockup ist die visuelle Nordrichtung, aber niemals eine Entschuldigung, nicht existierende Wettkampfdaten als real darzustellen oder die Bedienbarkeit auf dem iPhone zu verschlechtern.
