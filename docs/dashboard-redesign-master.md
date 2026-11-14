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
