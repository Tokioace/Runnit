# RUNNIT Dashboard — verbindliche visuelle Master-Referenz

Die zuletzt übermittelte 864 × 1536 JPEG-Illustration ist der Soll-Zustand für die Home-/Dashboard-Seite. Die Referenz zeigt einen gesondert gestalteten Hero Runner, Metallic-Logo, Neon-Rangabzeichen, Spieler-HUD, limefarbene Aktivität, drei KPI-Instrumente, einen bildstarken 1v1-Banner, zwei Listenpanels, Rennen-Start-CTA und eine fünfteilige Bottom-Navigation.

## Verbindliche Abschnittsfolge und Referenz-Positionen (Y-Pixel)
- 0–205: Logo, Skyline, Hero Runner, Tagline, Action-Icons
- 205–285: Stadt-, Land- und Welt-Pills
- 286–419: Spieler-HUD mit Avatar, Name, Level, XP und R-Emblem
- 425–540: Aktivität / Rennen / Rangliste / Profil
- 542–735: Aktivitäts-Box, Wochenfilter, Schritte, Distanz, Kalorien
- 739–887: 1v1 DUELL mit Runner-Action-Hintergrund
- 889–1160: Letzte Rennen links, Rangliste rechts
- 1180–1335: großer cyanfarbener CTA Rennen starten
- 1373–1490: Home / Karte / Stats / Rangliste / Profil im Gaming-Dock

## Technische Treue
- Die Originalgrafik des Start-Splashs bleibt unberührt.
- Der Dashboard-Aufbau bildet dieselben Blöcke und die Neon-/Glanz-Ästhetik nach. Keine sterile Standard-SaaS-Oberfläche.
- Die auf dem JPEG sichtbaren Level-/XP-/Kalorien-/Ranglistenwerte sind Artwork-Beispielwerte. Sie dürfen NICHT als echte Nutzer- oder Supabase-Daten erscheinen.
- Nur Benutzername (vom App-Session-Gate als reine Prop übergeben) und vorhandene Navigationsziele sind jetzt echt. Schritte, Rennen, Ränge, Kalorien, XP und Level bleiben gekennzeichnete Leerzustände bis zu verlässlicher Datenanbindung.
- Bei 375px / 390px / 430px muss Text lesbar bleiben und kein horizontales Scrollen entstehen. Lange Dashboard-Seiten dürfen vertikal scrollen; die Dock-Navigation bleibt sichtbar.
- Für endgültige pixelgenaue Übereinstimmung müssen die grafischen Einzel-Layer (Hero, Skyline, Logo, Buttons, Panels, Badge-Sprites, Rennszene) aus der Referenz separat aufgebaut bzw. exportiert werden. Ein einzelnes JPEG als anklickbarer Gesamtscreen wäre weder zugänglich noch datenwahr.
- Diese erste CSS/React-Iteration ist ausdrücklich noch KEINE bestätigte 1:1-Fertigstellung. Die Abnahme erfolgt über Screenshots der laufenden iPhone-App und Vergleich gegen das 864×1536-Masterbild.

## Abnahme
1. Alle genannten Abschnitte in der Soll-Reihenfolge.
2. Hauptaktionen öffnen /map, /leaderboard, /profile bzw. /gps-lab; kein gefälschtes Rennen.
3. Keine erfundenen Statistiken oder Platzierungen.
4. TypeScript, Tests, Build, Audit, CodeQL und Vercel auf exaktem Head grün.
5. iOS-Geräte-Vergleich mit Referenz und gezielte visuelle Iteration, bevor die fertige 1:1-Optik behauptet wird.

## Navigation-Ergänzung: separater Stats-Screen

Die erste Dashboard-Version nutzte `/home#aktivitaet` als Stats-Anker. Das war lediglich ein anderer Scrollpunkt derselben Home-Seite. Der Nutzer hat das als nicht eigenständig erkannt. Die Korrektur führt `/stats` als echte Route ein, mit separatem Arcade-Statistikschirm, Wochenringen, Bestwert-Kacheln und Testlabor-Verknüpfungen. Die Datenanzeige bleibt ausdrücklich ehrlich: keine erfundenen Messwerte oder Rankings. `/home` behält seine Aktivitätsvorschau und ist weiterhin der eigenständige Hauptscreen.

## Visuelle Iteration 02 – Master-Artwork

Dieser PR führt vier **lokale, separate SVG-Artwork-Layer** ein: Metallic-RUNNIT-Logo mit Krone/Zielflagge, Stadt-/Brücken-/Sonnenuntergang-Hintergrund, 1v1-Rennszene und den weißen Sprint-Button-Runner. Die bereits freigegebene Portraitgrafik bleibt als dekorativer Hero-Runner erhalten. Die KPI-Zellen sind in ihrer Referenzanordnung nun horizontal gestaltet, und das mobile Dashboard wurde verdichtet.

Die Assets sind visuelle Erstinterpretationen und noch nicht identisch mit den exakten Anime-Illustrationen. Vor einer 1:1-Freigabe ist eine echte iPhone-Screenshot-Gegenprüfung erforderlich. Keine fingierten Leistungsdaten und keine Änderungen an Supabase oder Messlogik.

## iPhone-Bildschirmabgleich 14.11.2026 – konkrete Nachbesserungen

Die vom Nutzer zugesandten sechs echten iPhone-Vorschaubilder zeigten einen mehrfach überlagerten Hero-Bereich, ungünstigen Zuschnitt des Runner-Fotos und des Avatars, in der Navigation abgeschnittenes `RANGLISTE`, zweizeilige Platzhalter im dreispaltigen Aktivitäts-HUD sowie den alten Launch-Hintergrund auf Stats. Die Stats-Überschrift war durch enge Laufweite optisch verschmolzen; die neutralen Daten-Kreise enthielten fälschlich kleine farbige Fortschrittssegmente.

Nachbesserung: Quellbild-Ausschnitt unterhalb des eingebrannten Splash-Schriftzugs, Avatar-Ausschnitt zur Gesichtspartie, fünf vollständig lesbare Dock-Labels, kürzerer eindeutiger Leerwert `KEINE DATEN`, Stats mit separatem Stadthintergrund und kompakter Header-Typografie, nicht-farbige Fortschrittsringe bis echte Messdaten existieren. Kein Eingriff in Auth, GPS, Supabase oder Rennen. Die schwarzen runden Overlays und Vercel-/Browser-Chrome in den Screenshots gehören nicht zum App-Quellcode.

## Master-Spacing-Pass 03 – kompakte 864:390-Übersetzung

Nutzerwunsch: Referenz mit deutlich höherer grafischer Dichte, jedoch **keine statische 864×1536-Bildschirmaufnahme mit unsichtbaren Hotspots**. Das Bild ist eine Vorlage; vorhandene lokale Bild-Layer bleiben dekorativ, die Interaktion ist HTML mit Routen und späteren Daten-Props. Im neuen `src/styles/runnitMaster.css` (nach bestehendem Index-CSS importiert) wird die 864px-Referenz für 390 CSS-Pixel in konkrete Größen übersetzt: Hero etwa 126px, Player-HUD 64px, Mode-Tiles 54px, drei KPI-Instrumente 69px, Duel-Banner 72px, Listen-Kacheln und 60px Start-CTA. Fünfteiliges Dock 55px plus iOS Safe-Area. Schrift wird responsiv skaliert, nicht ellipsiert. Der zweite und dritte Rank-Pill erhalten die individuelle Magenta-/Blau-Kontur der Vorlage. Die originalen Layer aus PR94 und der bessere iPhone-Zuschnitt aus PR95 werden weiterverwendet. Keine fingierten Daten, keine Änderungen an Auth, Supabase, GPS oder Rennlogik.

Die Vorlage ist dichter als moderne Accessibility-Mindestziele; reale Links bleiben daher mindestens 44px hoch, selbst wenn im Mock kleinere Segmente erscheinen. Finale 1:1-Abnahme erst nach visuellem Vergleich auf iPhone; SVG-Zeichnungen des Hero bleiben eine künstlerische Abweichung zum Original-Screenshot.

## Fidelity-Pass 04 – Arcade-Zeilen und echte Daten-Schnittstelle

Die zwei unteren Module erhalten jetzt wie im 864×1536-Master jeweils drei eng gesetzte visuelle Ergebniszeilen. Diese Zeilen sind **neutrale, als leer markierte Platzhalter** und keine simulierten Namen, Ergebnisse oder Zeiten. Die React-Komponente akzeptiert künftig ausschließlich ausdrücklich als `source: 'verified'` markierte Datensätze über optionale Props `recentRaces` und `rankings`, derzeit ohne automatische Verbindung. So lassen sich später verifizierte Werte einsetzen, ohne das Artwork neu zu schneiden. Untere Renn-CTA mit zusätzlichem innerem Lichtkante und Magenta/Cyan-Glows, Skyline/1v1-Vektorarts mit Graffiti-R und dynamischen Speedlines; Duellbanner erhält mehr freien Bereich für die Figur.

**Weiterhin offen:** Der Anime-Charakter und die 1v1-Figuren des Original-Masterbildes bleiben qualitativ abweichend. Die vorhandenen SVG-Zeichnungen sind keine exakte Rekonstruktion der Nutzerreferenz. 1:1-Pixeltreue ist weiter nicht erreicht. Echte iPhone-Bildschirmabnahme erforderlich.
