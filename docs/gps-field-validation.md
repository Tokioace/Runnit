# GPS-Feldvalidierung – experimentell, nicht produktiv

## Geltungsbereich
- `/gps-lab`: ausschließlich synthetische Testdaten, keine Gerätestandortberechtigung.
- `/gps-field-test`: manuell aktivierte Browser-Geolocation, Testwerte nur im Arbeitsspeicher der geöffneten Seite.
- Beide Arten erhalten explizit die Klassifizierung `eligibility: "not-eligible"`.
- Es gibt **keinen** Codepfad, der Labor- oder Feldtestberichte in Supabase, ein Duell oder eine Rangliste einträgt.
- Der optionale Export enthält nur zusammengefasste Kennzahlen und eine ggf. eingegebene Referenzzeit; keine rohen Breiten-/Längengrade, keine Laufspur, keine Benutzerkennung.

## Testablauf auf einem iPhone
1. Eine freie, möglichst gerade Strecke mit unabhängiger Messmethode über 50, 75 oder 100 Meter festlegen und Start/Ziel eindeutig markieren. Nicht auf Straßen oder in gefährlichen Bereichen testen.
2. Im Browser die sichere Preview öffnen, `/gps-field-test` wählen und das Telefon im Vordergrund mit eingeschaltetem Bildschirm lassen.
3. Am Startpunkt warten und **GPS vorbereiten** drücken. Der Browser fragt dabei erstmals nach der Ortsfreigabe. Start ist nur bei einem maximal 3 Sekunden alten Fix mit angegebener Genauigkeit von höchstens 15 m möglich.
4. **Jetzt Testlauf starten** drücken; der Referenzzeitnehmer soll einen unabhängig erfassten, eindeutig definierten Startzeitpunkt messen. Die Differenz zwischen Klick und tatsächlichem Bewegungsbeginn muss bei der Interpretation berücksichtigt werden.
5. Bis deutlich hinter die Ziellinie laufen. Zwei aufeinanderfolgende akzeptierte Fixes jenseits der Ziellinie sind erforderlich. Wenn ein Lauf keine gültige Zielbestätigung hat, ist das Ergebnis **unvollständig**.
6. Unabhängige Referenzzeit optional manuell eingeben. Die Seite zeigt `GPS-Zeit minus Referenzzeit` an. Bei Bedarf den anonymisierten JSON-Testbericht herunterladen.
7. Mehrere Läufe unter verschiedenen freien Himmel-/Empfangsbedingungen wiederholen; Abweichung, Ausfallquote, Stichprobengröße und Gerätekonfiguration dokumentieren. Keine Ranglistenzeiten daraus ableiten.

## Methodische Grenzen
- GPS-Genauigkeit in Metern bezeichnet typischerweise horizontale **Positions**unsicherheit, nicht eine nachgewiesene Sprint-Distanz oder Zeitunsicherheit.
- Das System misst Luftlinie ab erstem Start-Fix. Es garantiert weder, dass der Button-Klick mit der echten Bewegung übereinstimmt, noch eine geradlinige Laufbewegung.
- Auf iOS kann der Browser Standort-Fixes verzögern oder drosseln. Wenn die Seite in den Hintergrund tritt, wird die Ortung bewusst gestoppt; die Messung ist dann nicht vollständig.
- Zeitinterpolation zwischen Fixes kann einen systematischen oder zufälligen Messfehler enthalten. Sie ist kein Lichtschrankenersatz.
- Die akzeptierten 15 m / 12 m/s und die zwei Ziel-Fixes sind **experimentelle Filterparameter**, keine nachgewiesenen Qualitätsgrenzen.
- Ein grüner TypeScript-/Test-/Build-/CodeQL-Status beweist nicht, dass die Messung auf einem realen iPhone zuverlässig funktioniert.

## Kritische Integrationsgrenze (Folgearbeit)
Die bestehende produktive `RaceOverlay`-Logik in `src/screens/MapScreen.tsx` und der RPC `submit_duel_result` in `src/db/submitDuelResult.ts` verwenden einen separaten, **noch nicht unabhängig validierten** Datenpfad. Dieser PR verändert ihn absichtlich nicht.

**Vor einer Veröffentlichung als echte Rangliste** muss ein überprüfbares, serverseitig durchgesetztes Ergebnis-/Berechtigungsmodell implementiert werden. Reine Client-Typen, GPS-Filter und die Aufschrift `not-eligible` verhindern keine manipulierten Supabase-Requests. Die Rechte/RLS, Replay-Schutz, Plausibilität und der Umgang mit sensiblen Standortdaten erfordern eine getrennte Sicherheitsprüfung und explizite Freigabe.
