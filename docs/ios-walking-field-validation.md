# GPS-Lab: reproduzierbarer iPhone-Gehfeldtest (experimentell)

Stand: 16.11.2026. **Kein Sprint, keine 50-m-Wertung, kein FairPlay-Freigabenachweis.** Nur mit Einwilligung des Testers auf einer sicheren Fußgängerstrecke; niemals während der Bedienung laufen und auf Verkehr achten.

## Vorbedingungen
- iPhone-Modell, iOS-Version, Browser/PWA-Modus, Build-URL und **exakten develop-Commit** notieren. Ohne nachgewiesenen READY-Preview dieses Commits keinen erfolgreichen App-Test behaupten.
- `/gps-lab` öffnen; Standortfreigabe und DeviceMotion erst nach eigener Nutzeraktion erteilen. Keine Mikrofonberechtigung. Testmodus und Einschränkungen sichtbar prüfen.
- Referenzschritte manuell zählen (optional zweite Person). Rohkoordinaten weder im Issue noch in Screenshots, PRs oder Cloud-Diensten teilen. Lokalen Export vor dem Teilen auf Standortdaten und absolute Zeitstempel prüfen.

## Vier getrennte Testläufe
1. **Normales Gehen, Display an:** etwa 100 manuell gezählte Schritte, auf gerader freier Strecke. Einzellauf starten, gleichmäßig gehen, stoppen. Live-Schritte, Kadenz, GPS-Genauigkeit, IMU-Abdeckung und Unsicherheitsstatus notieren.
2. **Langsames Gehen:** etwa 100 Schritte in deutlich langsamerem Tempo. Niedrige Geschwindigkeit allein darf nicht als Betrug gelten; fehlende oder ungenaue Messungen als unsicher markieren.
3. **Bildschirm sperren:** Einzellauf bei eingeschaltetem Display starten, nach ungefähr 20 Schritten sperren, weitergehen, entsperren und stoppen. Fehlende Sensorwerte nicht nachträglich erfinden; Unterbrechung ausdrücklich protokollieren. Safari/PWA darf bei Sperre pausieren.
4. **Hintergrund/Unterbrechung:** Nach Teststart Browser kurz in den Hintergrund versetzen, zurückkehren und stoppen. Keine unplausiblen Distanzsprünge oder erfundenen Schritte akzeptieren. Offline-Verhalten nur prüfen, wenn der Test dies tatsächlich unterstützt; niemals Netzwerkfreiheit voraussetzen.

## Protokoll pro Lauf
| Feld | Eintrag |
| --- | --- |
| Build-SHA / iOS / Safari oder PWA | |
| Testart / Displaystatus / Start-Stop | |
| Referenzschritte ± Zählunsicherheit | |
| App-Schritte / Differenz / Kadenz | |
| GPS-Distanz / gemeldete Genauigkeit | |
| IMU-Abdeckung / Sensorlücken | |
| Qualitätswarnungen / FairPlay-Beurteilung | |
| Export lokal erstellt? / Datenschutz geprüft? | |
| Sichtbare Fehler / reproduzierbare Schritte | |

## Auswertung und Grenzen
- Schrittfehler: `App-Schritte − Referenzschritte`; relative Abweichung nur bei Referenz > 0. Referenzzählung ist selbst fehlerbehaftet.
- **Keine** pauschale Prozentgrenze als bestanden deklarieren, bevor mehrere echte Feldläufe ausgewertet wurden. GPS-Distanz ist ohne unabhängige Streckenreferenz nicht validiert.
- Unbekannte, fehlende, blockierte oder pausierte Sensorwerte als **unsicher/nicht messbar** dokumentieren, nicht als erwiesenen Betrug oder als erfolgreiche Messung.
- Export enthält möglichst nur aggregierte Kennzahlen; keinerlei Roh-GPS-Daten, persönliche Wege oder identifizierende Standortdetails in GitHub posten.
- Diese Anleitung ersetzt weder Unit-/Build-/CodeQL-Checks noch den Test auf dem tatsächlichen iPhone. Nach jedem Lauf Abweichungen und Bildschirmstatus im Nachtbericht zusammenfassen; erst dann gezielte Algorithmusänderung planen.
