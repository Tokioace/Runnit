# iPhone-Gehfeldtest: reproduzierbares Prüfprotokoll

**Geltungsbereich:** ausschließlich die experimentelle `/gps-lab`-Ansicht. Kein Sprint, kein Duell, keine Ranglistenwertung. Dieses Protokoll ist eine manuelle Feldvalidierung und **kein Nachweis** der GPS- oder Schrittzählergenauigkeit durch CI.

## Vorbereitungen

1. Auf dem iPhone die aktuelle `develop`-Vorschau in Safari öffnen und die angezeigte Versions-/Deployment-Zuordnung notieren. Ohne nachweislich aktuelle Vorschau keinen Test als Verifikation eines neuen Commits melden.
2. Einen sicheren, bekannten Gehweg ohne Straßenquerung während der Bedienung wählen. Das Gerät vor dem Losgehen bedienen; im Gehen nicht auf den Bildschirm schauen.
3. `/gps-lab` öffnen, **Geh-/Walking-Einzellauf** auswählen, Sensorfreigaben nur nach eigener Nutzeraktion erteilen und prüfen, ob GPS- und IMU-Status sichtbar sind.
4. Energiesparmodus, iOS-Version, Safari/PWA-Modus, Display-Sperre und Trageposition (z. B. Hosentasche) als Testbedingungen notieren. Keine Mikrofonberechtigung erforderlich.

## Einzelmessung

1. Einen festen Referenzpunkt wählen; vor Start **0 Schritte** als Ausgangswert dokumentieren. Den Geh-Test bewusst starten.
2. Normal gehen und die Schritte unabhängig mitzählen (z. B. 100 Schritte). Keine Sprint-Zeiten oder 50-m-Wertung erwarten.
3. An einem sicheren Punkt stehen bleiben und den Test stoppen. Unabhängig gezählte Schritte, angezeigte Schritte, Dauer, Kadenz, IMU-Sample-Anzahl, erkannte Sensorlücken, GPS-Qualitätsstatus und etwaige Warnungen notieren.
4. Nur wenn ausdrücklich gewünscht, den lokalen Diagnosebericht manuell exportieren. Vor Weitergabe prüfen, ob er Koordinaten, Zeit-/Ortsbezüge oder andere personenbezogene Angaben enthält; bei Unsicherheit nicht teilen.
5. Den Ablauf mit gleichem Gerät und gleicher Trageposition mindestens dreimal wiederholen; Abweichungen und Aussetzer je Lauf getrennt erfassen. Keine Messwerte zwischen Läufen zusammenführen.

## Bildschirm-/Hintergrundgrenze separat prüfen

- Ein Kontrolllauf mit eingeschaltetem Display und ein gesonderter Lauf mit gesperrtem Bildschirm sind **nicht gleichwertig**. iOS kann Browser-DeviceMotion und GPS bei Hintergrundwechsel oder Displaysperre unterbrechen.
- Bei gesperrtem Bildschirm die Dauer des Ausfalls und die Anzeige der Datenqualität protokollieren. Fehlende Daten **nicht** als null Schritte oder Betrug interpretieren.
- Wake Lock ist keine Garantie für Hintergrundaufzeichnung. Ergebnisse bei gesperrtem Bildschirm dürfen nicht zur Kalibrierung einer kontinuierlichen Schrittzählung verwendet werden.

## Auswertung und Akzeptanz

| Kriterium | Was dokumentiert werden muss |
| --- | --- |
| Referenz | Manuell gezählte Schritte, geschätzte Zählunsicherheit und Start-/Stop-Bedingungen |
| Schrittzählung | Angezeigte Zahl und absolute Abweichung pro Lauf; kein pauschaler Genauigkeitsanspruch |
| IMU-Verfügbarkeit | Sample-Anzahl, Zeitlücken, sichtbare Unterbrechungswarnungen |
| GPS | Qualitäts-/Unsicherheitsanzeige; GPS-Distanz nicht als exakte Referenz behandeln |
| FairPlay | Normales Gehen darf nicht allein wegen geringer Geschwindigkeit als Betrug gelten |
| Datenschutz | Keine automatische Speicherung oder Übertragung roher GPS-Spuren; Export nur nach Nutzeraktion |
| Ergebnis | **bestanden / nicht bestanden / nicht beurteilbar**, jeweils mit konkreter Beobachtung |

**Nicht beurteilbar** ist ausdrücklich das korrekte Ergebnis, wenn Sensorfreigaben fehlen, die Vorschau nicht dem geprüften Commit entspricht, die Messung unterbrochen wurde oder keine unabhängige Schritt-Referenz vorliegt. Ein erfolgreiches `npm run test:gps`, TypeScript-Check, Build oder CodeQL ersetzt diese Feldmessung nicht.

## Übergabe an die Nachtprüfung

- CI und unabhängige CodeQL für den exakten PR-Head-SHA nachprüfen.
- Prüfen, ob offene PRs #21, #47, #72 und #73 in Konflikt mit dem aktuellen `develop` stehen; nicht blind integrieren.
- **Nächste freie technische Aufgabe:** einen echten, freiwillig bereitgestellten, datenschutzgeprüften iPhone-Gehbericht gegen die manuell gezählten Schritte auswerten; nur bei reproduzierbarem Fehler einen isolierten Algorithmus-Fix mit Regressionstest vorbereiten.
