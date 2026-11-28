# GPS-Labor – datensparsamer Geh-Feldtest (nur develop)

Stand: 22.11.2026. **Testprotokoll, keine Implementierungs- oder Freigabebestätigung.** Ausschließlich die zu Testbeginn in GitHub gemergte `develop`-Version und die dort tatsächlich vorhandenen `/gps-lab`-Funktionen verwenden. Keine offenen PRs als verfügbare Funktionen annehmen.

## Ziel und Abgrenzung

Normaler Fußweg (Walking), **kein Sprint**. Untersucht werden Schrittzahl, Schritt-Kadenz, Zeitstempel-Konsistenz, GPS-Qualität, Distanzplausibilität und Unterbrechungen. Langsames Gehen ist **kein Betrugsbeweis**. Fehlende IMU-Schritte bei ruhiger Hand oder gesperrtem Bildschirm sind ein Qualitäts-/Verfügbarkeitsproblem, kein automatischer FairPlay-Verstoß. Keine 50-m-Wertung, kein Einfluss auf Live-Rennen oder Ranglisten.

## Datenschutz und Sicherheit

- Nur auf einem sicheren, öffentlichen Fußweg ohne Verkehrsgefährdung testen; Bedienung im Stand. Sensorfreigaben ausschließlich nach bewusster Nutzeraktion.
- Keine Rohkoordinaten, Streckenverläufe, Tokens, personenbezogenen Screenshots oder vollständigen Sensorlogs in GitHub-Issues hochladen. Lokale Auswertung bevorzugen; Export nur nach bewusster Aktion und vor dem Teilen anonymisieren.
- Vor Beginn prüfen, ob `/gps-lab` tatsächlich keine Roh-GPS-Daten dauerhaft speichert oder hochlädt. **Falls unklar: Test nicht starten und Datenschutzprüfung dokumentieren.**
- Mikrofon wird nicht benötigt. Fehlende Berechtigungen oder Sensoren als „nicht messbar“ anzeigen, nicht als Nullmessung ausgeben.

## Vorbereitung

1. Exakten GitHub-`develop`-SHA, iPhone-/iOS-/Safari- bzw. PWA-Version und verfügbare Laborfunktionen notieren; identische Version während aller Durchgänge.
2. Standortgenauigkeit im iOS-Dialog bewusst wählen; DeviceMotion nur durch Nutzeraktion erlauben. Bei Ablehnung erwartete, verständliche Fehlermeldung prüfen.
3. Eine kurze, sichere Strecke und Referenzschrittzahl durch manuelles Zählen vorbereiten. Referenzdistanz nur verwenden, wenn unabhängig gemessen und ihre Unsicherheit bekannt ist.
4. Prüfen, ob ein echter Start/Stop-Einzellauf und ein lokaler Bericht vorhanden sind. Fehlende Funktionen als **Blocker**, nicht als bestanden, notieren.

## Szenarien (jeweils separat, kein paralleles Live-Duell)

| ID | Ablauf | Zu protokollieren | Akzeptanzkriterium |
| --- | --- | --- | --- |
| W01 | 100–200 normale Schritte, iPhone in Hosentasche, Bildschirm an | Referenzschritte, erkannte Schritte, Dauer, Kadenz, GPS-Fix/Genauigkeit | Zähler reagiert nachvollziehbar; Abweichung explizit statt erfundener Genauigkeit |
| W02 | Gleiche Gehweise, iPhone ruhig in der Hand | Referenzschritte, IMU-Verfügbarkeit, erkannte Schritte | Fehlende Ausschläge werden als Messunsicherheit gewertet |
| W03 | Einzellauf im Stand starten, einige Schritte gehen, im Stand stoppen | Start-/Stop-Zeit, Dauer, Berichtstyp | Bericht klar „Geh-Test“, keine Sprintwertung |
| W04 | DeviceMotion-Berechtigung ablehnen | Fehlermeldung, GPS-Verfügbarkeit | Keine stillschweigende IMU-Messung und kein falscher FairPlay-Vorwurf |
| W05 | GPS schwach/unterbrochen, nur wenn gefahrlos reproduzierbar | Fix-Status, Genauigkeit, Distanzqualität | Unsichere Distanz klar markiert, keine erfundene Präzision |
| W06 | Safari/PWA in Hintergrund oder Bildschirm sperren, danach zurückkehren | Zeitlücke, Schritt-/GPS-Lücke, Wiederaufnahme | Keine Behauptung lückenloser Messung; Unterbrechung sichtbar |
| W07 | Netz offline, sofern lokale Laborfunktion das unterstützt | Sensorstatus, Bericht, Netzwerkaktivität | Kein stiller Upload; Offline-Einschränkung verständlich |
| W08 | Nach Stop Bericht ansehen und optional lokal exportieren | Summen, Unsicherheiten, Felder im Export | Keine Rohkoordinaten oder Identifikatoren ohne ausdrückliche Einwilligung |

## Ergebnisformat

`Datum | develop-SHA | iOS/Safari/PWA | Test-ID | Referenzschritte | erkannte Schritte | Dauer | Kadenz | GPS-Qualität/Unsicherheit | Sensor-/Bildschirmlücken | bestanden/fehlgeschlagen/blockiert | redigierte Beobachtung`

Schrittfehler, sofern Referenz > 0: `(erkannte - Referenz) / Referenz * 100 %`. Nicht aus einer einzigen Messung allgemeine Genauigkeit ableiten. GPS-Distanz gegen unabhängige Referenz nur mit deren Unsicherheit vergleichen. Weder Unit-Tests noch grüner Build belegen reale iPhone-GPS-Genauigkeit.

## Rückkopplung an Entwicklung

Bei reproduzierbarem Fehler nur die betroffene, bereits gemergte `develop`-Implementierung auf frischem Fix-Branch bearbeiten; Test und CodeQL/Build für den exakten neuen SHA nachweisen. Sensorlücken nicht als Cheat klassifizieren. **Nächste freie Aufgabe:** Nach tatsächlicher W01–W08-Abnahme einen eng begrenzten, reproduzierbaren Fehler in der Geh-Messung isolieren; parallel bleibt die Zwei-iPhone-1v1-Matrix D01–D12 P0.
