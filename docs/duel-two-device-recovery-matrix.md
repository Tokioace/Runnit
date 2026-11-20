# Runnit 1v1 – reproduzierbare Zwei-Geräte-Abnahme (develop)

Stand: 2026-11-19. Diese Checkliste beschreibt **manuelle Feldtests**, keine bereits bestandenen Tests. Ausschließlich die zu Testbeginn tatsächlich gemergte `develop`-Version verwenden. Keine offenen PR-Previews mischen.

## Voraussetzungen

- Zwei unterschiedliche Testkonten auf zwei iPhones, je Safari/PWA; Berechtigungen für Standort nach bewusster Nutzeraktion erteilen
- Sicherer, freier und legal zugänglicher Ort ohne Verkehr; nicht während des Gehens auf den Bildschirm schauen
- Beide Geräte mit sichtbarer Uhrzeit, Build-/Commitkennung soweit verfügbar und gleicher `develop`-Version
- Nur Testdaten verwenden; **keine** GPS-Rohkoordinaten, Auth-Tokens, privaten Standorte oder personenbezogenen Screenshots in GitHub-Issues veröffentlichen
- Vor jedem Szenario beide Geräte zurück zur Karte, keine aktive Lobby oder Rennsession; Status im Testprotokoll notieren

## Testmatrix

| ID | Aktion | Erwartetes Ergebnis auf Gerät A (Host) | Erwartetes Ergebnis auf Gerät B (Gast) |
| --- | --- | --- | --- |
| D01 | A erstellt im zulässigen Radius ein Event | Genau eine eigene Event-Fahne, Event eindeutig öffnbar | Event nur an tatsächlicher Kartenposition sichtbar, nach Aktualisierung beitretbar |
| D02 | B tritt einmal bei, tippt anschließend erneut / wiederholt die Aktion | Genau ein zugeordneter Gast, keine zweite Lobby | Genau eine Teilnahme; keine Doppelanmeldung |
| D03 | Nur A markiert Ready | Lobby bleibt, kein verfrühter Countdown | Sieht A als bereit; eigener Ready-Status unverändert |
| D04 | B markiert Ready | Synchroner Countdown, kein doppelter Start | Derselbe Countdown und derselbe Matchbezug |
| D05 | Beide beenden regulär | Eigener Ergebnisbildschirm mit eigener Zeit und korrektem Ausgang | Eigener Ergebnisbildschirm, komplementärer Ausgang; Gleichstand bei gleichen Zeiten |
| D06 | Ergebnis auf beiden Geräten schließen | Karte ohne aktive alte Rennsession; neues Event möglich | Karte ohne aktive alte Rennsession; erneuter Beitritt möglich |
| D07 | A bricht vor Beitritt ab | Event und Fahne verschwinden | Kein Beitritt in storniertes Event möglich |
| D08 | A bricht in der Lobby ab | Keine festhängende Lobby; Karte wieder nutzbar | Abbruch sichtbar; Karte wieder nutzbar |
| D09 | Abbruch während des Rennens (soweit UI erlaubt) | Eindeutige Abbruchanzeige, kein Sieg und keine Bestenzeit | Eindeutige Abbruchanzeige, kein Sieg und keine Bestenzeit |
| D10 | B verliert kurz die Verbindung und verbindet sich wieder | Keine doppelte Rennsession oder Event-Fahne | Nach Wiederverbindung korrekter Status oder eindeutige Wiederherstellungs-/Fehlermeldung |
| D11 | Safari/PWA wird kurz in den Hintergrund gesetzt | Kein stillschweigender Anspruch auf weiterlaufende IMU-Messung | Unterbrechung erkennbar; keine erfundene Zeit, Schritte oder GPS-Genauigkeit |
| D12 | Ergebnisansicht schließen, App neu öffnen | Keine verwaiste aktive Session; Verlauf zeigt nur tatsächlich abgeschlossene Duelle | Gleiche Konsistenz; kein falscher Sieg aus nur einseitig gespeicherten Daten |

## Messprotokoll pro Szenario

`Datum/Uhrzeit (lokal) | develop-SHA | iOS/Safari-Version A/B | ID | bestanden/fehlgeschlagen/nicht testbar | Schritte zur Reproduktion | erwarteter/erhaltener Zustand A/B | redigierter Screenshot/Log (optional)`

Ein Szenario gilt nur als **bestanden**, wenn beide Geräte beobachtet wurden. Netzwerk- und Sensorprobleme separat notieren; GPS-Genauigkeit kann durch TypeScript-, Build- oder Unit-Tests nicht bestätigt werden. Normales Gehen im `/gps-lab` ist ein separater Walking-Sensortest, **kein** Sprint-/1v1-Ergebnis.

## Fehlerpriorisierung

- **P0:** Falsche Sieger, doppelte Ergebnisse, nicht verlassbare Lobby, alte aktive Session verhindert neue Rennen, Standort-/Auth-Datenleck
- **P1:** Verzögerte Synchronisierung, falsch platzierte oder doppelte Event-Fahnen, unklare Sensorunterbrechung
- **P2:** Visuelle Abweichungen ohne Einfluss auf Ablauf oder Daten

## Nächste technische Aufgabe nach der Feldabnahme

Nur anhand reproduzierbarer Fehler aus der Matrix einen eng begrenzten Fix vom dann aktuellen `origin/develop` ableiten. TypeScript, komplette Testsuite, Build, unabhängiges CodeQL und Security-Audit für den **exakten PR-Head** prüfen; bei fehlenden oder roten Checks kein automatischer Merge. `main` unverändert lassen, keine Feature-Branch-Deployments auslösen.
