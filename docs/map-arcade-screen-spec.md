# RUNNIT Arcade-Karte – verbindlicher Plan v1

Die vom Nutzer gelieferte Acht-Screen-Collage definiert den Look der Karte (drittes Telefon in der oberen Reihe: RENNEN IN DEINER NÄHE) und des Renn-Hostings (viertes Telefon oben). Dies ist ein echter dynamischer Map-Screen mit Leaflet/OpenStreetMap und kein anklickbares Ganzbild.

## Visuelle Zielstruktur
1. Header nach iPhone-Safe-Area: Zurück-Pfeil, RUNNIT/STREET CHALLENGE, Schriftzug RENNEN IN DEINER NÄHE, aktives Stadtlabel nur bei echtem GPS.
2. KARTE / LISTE: Lime aktiver Tab, dunkelblau inaktiver Tab, echte Umschaltung.
3. Echte Leaflet-Karte mit stärkerem nächtlichem Navy-Kontrast, ohne OSM-Attribution zu übermalen. Keine Veränderung des Kartenproviders.
4. Cyanfarbener georeferenzierter Radar-Kreis mit Radius **500 Meter** um einen echten GPS-Fix, nicht um IP- oder Demo-Positionen. Der Backend-Abfrageradius von 5 km bleibt unverändert. Radar ist eine visuelle Orientierung, kein Filter.
5. Realer Positionspunkt blau/cyan, Rennmarker in Cyan/Magenta/Lime mit Runner-Symbol. Niemals frei erfundene Live-Rennen als echt anzeigen.
6. Rechts die vorhandene Standortfunktion als Arcade-Rundknopf; eigener Rennkarten-Preview unten mit Rennart, echter Distanz, Host und Teilnehmerzahl 1/2 (offene Lobby). DEMO und eigene Rennen deutlich kennzeichnen.
7. Vor dem fünfteiligen Bottom-Dock echte Aktionen: Rennen veranstalten und Leaderboards. Renn-Preview mit **BEITRETEN**, bei eigenen Rennen mit **ABSAGEN** (vorhandener Confirm-Dialog).
8. LISTE listet dieselben OpenRun-Objekte wie die Map-Marker; kein zweiter Datenbestand. Auswahl kehrt zur Karte zurück.

## Datenvertrag
MapScreen behält getNearbyDuels aus Supabase mit Radius 5 km, createDuel, joinDuel, cancelHostedOpenDuel, AuthGate, Realtime, Countdown und Ergebnis-Overlays. Präsentationskomponente ArcadeMapChrome akzeptiert nur sichere Einträge mit ID, Host, Renndistanz, optionaler exakt aus GPS ermittelter Entfernung, isOwn und isDemo. Kein Backend- oder GPS-Aufruf innerhalb der Präsentationskomponente.

## Ausschließlich dekorativ
Hintergrundtönung, Radar-Glow, Neonrahmen, Speedlines, Race-Karten-Thumbnail und Pins. Nicht als Bitmap einfrieren: echte Eingabefelder, Zahlen, Button-Beschriftungen, Liste, Status und Karte.

## iPhone-Tests / Abnahme
1. Bei 320/375/390/430 CSS-Pixeln passen Header, Tab-Umschalter, Action-Button und Footer ohne horizontale Überläufe.
2. KARTE/LISTE schaltet um; dieselben Rennen erscheinen an beiden Stellen.
3. Bei echtem GPS erscheint der 500m-Kreis, ohne GPS kein falscher Kreis und kein fingierter Entfernungstext.
4. Event-Pin öffnen: Kartenpopup, ausgewählte Preview und Daten stimmen überein.
5. Gast-Demos werden als DEMO gekennzeichnet; Beitreten fordert Login.
6. Angemeldete Nutzer: Beitreten, Veranstalten, Countdown und Absagen funktionieren unverändert. Keine frei erfundenen Server-Ergebnisse.
7. Recenter, Zoom, Pan und OSM-Lizenztext bleiben erreichbar.
8. Kartenkachel-Ausfälle, GPS-Verweigerung, Laden und leere Angebote bleiben lesbar.
9. Demo-Renn-Grafik ist gesondert gekennzeichnet und kein echtes Rennen.
10. Screen direkt auf dem iPhone mit der verbindlichen Collage vergleichen. Erst danach behaupten, das Design sei pixelgenau.

## Weitere Umsetzung
Der Host-Dialog sowie die Live-Race- und Victory-Screens werden nach der Karte in eigenen Schritten angepasst. Ghost-Run im Hosting wird erst als aktiv wählbarer Modus gezeigt, wenn der echte technische Ablauf vorhanden ist.


## iPhone-Abnahme nach drei Nutzer-Screenshots (15.11.2026)
Im vorherigen Preview überdeckten große Demo-Notiz, separate Renn-Grafik-Test-Kachel, Location-Button, Leaflet-Popup und die neue Duellkarte einander. Der Map-Screen verwendet ab jetzt nur noch **eine** Duell-Vorschau: Markertaps setzen die ausgewählte ID; es gibt kein zusätzliches Leaflet-Popup. Der Demo-Status erscheint als schmale gelbe Plakette links im Kartenbereich; die eigenständige Grafik-Simulation liegt nur hinter der LISTE-Umschaltung. Die untere Aktionsleiste ist kompakter und behält mindestens 44px Touch-Flächen. GPS-, Karten-, Rennlogik und Auth-Schranken bleiben unverändert. Reale iPhone-Sichtprüfung nach diesem Commit erforderlich.


## Nutzerentscheidung: drei Karten-Fenster entfernen (15.11.2026)

Auf ausdrücklichen Wunsch wurden die permanenten **1v1-DUELL-Vorschau**, **RENNEN VERANSTALTEN** und **RANGLISTE**-Karten aus der Karte entfernt. KARTE zeigt die echte Map, Standort, Radar, Pins und BottomDock ohne die drei überdeckenden Panels. Das Antippen eines Rennmarkers öffnet jetzt **LISTE** und sortiert das gewählte Rennen nach oben; dort sind BEITRETEN und bei eigenen Rennen ABSAGEN erreichbar. **RENNEN VERANSTALTEN** steht als durchgehend verfügbarer Button oben in LISTE, auch wenn bereits Rennen existieren. RANGLISTE bleibt über die untere Navigation erreichbar. Die OSM-Attribution wurde knapp oberhalb der Navigation positioniert. Die eigentlichen Auth-, Join-, Host- und Cancel-Handler sowie die Rennengine bleiben unverändert. Dieser neue Zustand benötigt iPhone-Sichtabnahme vor Merge.


## Nutzerkorrektur: spezifisches Renn-Popup ≠ Rennliste (15.11.2026)

Auf Wunsch gibt es jetzt zwei **getrennte Interaktionswege**:

- **KARTE:** Antippen eines Eventmarkers öffnet ein **kleines an genau diesem geografischen Punkt verankertes Leaflet-Popup** für das getippte Rennen. Das Popup zeigt nur dieses Rennen mit Host, Streckenlänge, aus echtem GPS berechnetem Abstand (falls vorhanden), Teilnehmerstatus, Demo-Kennzeichnung und sicherem **BEITRETEN** bzw. **ABSAGEN**. Automatisches Verschieben der Karte erhält Platz unter der Kopfzeile und über dem unteren Dock. Tippen auf eine andere Markierung tauscht das Popup; Schließen erfolgt durch Leaflet-X oder Karten-Tap. Kein Wechsel in LISTE.
- **LISTE:** zeigt unabhängig alle offenen Rennen in der bekannten 5-km-Suche, mit Erstellung, Beitreten und Absagen. Die Liste bleibt ein separater, bewusst vom Popup unterschiedener Screen-Zustand.

Beide Oberflächen verwenden dieselben aus `openRuns` abgeleiteten sicheren Daten und dieselben Auth-/Join-/Cancel-Handler, damit keine doppelte Logik entsteht. Die drei vorher ausdrücklich entfernten großen Dauerfenster bleiben entfernt. Die Popups sind **nur auf Marker-Tap** sichtbar und keine permanente Karte-in-der-Karte.
