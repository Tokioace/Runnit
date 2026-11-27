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
5. Bis deutlich hinter die Ziellinie laufen. Zwei aufeinanderfolgende akzeptierte Fixes jenseits der Ziellinie sind erforderlich. Liegen mehr als drei Sekunden zwischen akzeptierten Fixes, beginnt die Zielbestätigung neu; über diese Lücke wird nicht interpoliert. Wenn ein Lauf keine gültige Zielbestätigung hat, ist das Ergebnis **unvollständig**. Nach fünf Minuten wird ein noch laufender Test automatisch ohne Zielzeit beendet; der Teilbericht bleibt exportierbar.
6. Unabhängige Referenzzeit optional manuell eingeben. Die Seite zeigt `GPS-Zeit minus Referenzzeit` an. Bei Bedarf den anonymisierten JSON-Testbericht herunterladen.
7. Mehrere Läufe unter verschiedenen freien Himmel-/Empfangsbedingungen wiederholen; Abweichung, Ausfallquote, Stichprobengröße und Gerätekonfiguration dokumentieren. Keine Ranglistenzeiten daraus ableiten.

## Methodische Grenzen
- GPS-Genauigkeit in Metern bezeichnet typischerweise horizontale **Positions**unsicherheit, nicht eine nachgewiesene Sprint-Distanz oder Zeitunsicherheit.
- Das System misst Luftlinie ab erstem Start-Fix. Es garantiert weder, dass der Button-Klick mit der echten Bewegung übereinstimmt, noch eine geradlinige Laufbewegung.
- Auf iOS kann der Browser Standort-Fixes verzögern oder drosseln. Wenn die Seite während eines Laufs in den Hintergrund tritt oder ein GPS-Fehler auftritt, wird die Ortung bewusst gestoppt; die Messung ist dann nicht vollständig. Der bisherige Bericht bleibt bis zum bewussten Zurücksetzen exportierbar, solange die Seite im Speicher bleibt. Ein unvollständiger Lauf hat keine Zielzeit und ist nicht für den Referenzzeitvergleich auswertbar.
- Zeitinterpolation zwischen Fixes kann einen systematischen oder zufälligen Messfehler enthalten. Sie ist kein Lichtschrankenersatz. Der lokale JSON-Export enthält bei bestätigtem Zieleinlauf `crossingIntervalMs`: die Zeitspanne zwischen den beiden akzeptierten GPS-Fixes, zwischen denen die Ziellinie interpoliert wurde. Bei fehlendem bestätigtem Ziel oder einem nach einer Messlücke ohne Interpolation bestätigten Ziel ist der Wert `null`. Im zweiten Fall gilt der erste neue Fix jenseits des Ziels als konservative Zeitschätzung; die Laufzeit kann zu lang ausfallen. Ein vorhandenes Intervall ist weder eine kalibrierte Fehlergrenze noch ein Beleg für die tatsächliche Genauigkeit.
- `gpsObservationGapCount` und `gpsLongestObservationGapMs` erfassen Lücken von mehr als drei Sekunden zwischen akzeptierten GPS-Fixes einschließlich der Bestätigungsphase. Bei keiner solchen Lücke ist die maximale Dauer `null`. Abgelehnte Fixes schließen keine Lücke. `finishTimingMethod` unterscheidet `interpolated`, `observed-after-gap` und `null` (kein Ziel). Diese lokalen Diagnosefelder sind keine verifizierte Qualitätswertung.
- Der lokale JSON-Export enthält zusätzlich `stopReason` (bestätigter Zieleinlauf, manueller Stopp, Hintergrundwechsel, Seitenwechsel, GPS-Fehlerkategorie oder `duration-limit` nach fünf Minuten) und `observationMs` (relative Zeit vom Start bis zum letzten akzeptierten Fix, mindestens null Millisekunden; ohne Fix `null`). Die Beobachtungsdauer kann bei bestätigten Läufen über der interpolierten Zielzeit liegen und ersetzt bei unvollständigen Läufen keine Zielzeit. Es werden keine absoluten Zeitstempel oder Koordinaten ergänzt.
- Die akzeptierten 15 m / 12 m/s und die zwei Ziel-Fixes sind **experimentelle Filterparameter**, keine nachgewiesenen Qualitätsgrenzen.
- Ein grüner TypeScript-/Test-/Build-/CodeQL-Status beweist nicht, dass die Messung auf einem realen iPhone zuverlässig funktioniert.

## Kritische Integrationsgrenze (Folgearbeit)
Die bestehende produktive `RaceOverlay`-Logik in `src/screens/MapScreen.tsx` und der RPC `submit_duel_result` in `src/db/submitDuelResult.ts` verwenden einen separaten, **noch nicht unabhängig validierten** Datenpfad. Dieser PR verändert ihn absichtlich nicht.

**Vor einer Veröffentlichung als echte Rangliste** muss ein überprüfbares, serverseitig durchgesetztes Ergebnis-/Berechtigungsmodell implementiert werden. Reine Client-Typen, GPS-Filter und die Aufschrift `not-eligible` verhindern keine manipulierten Supabase-Requests. Die Rechte/RLS, Replay-Schutz, Plausibilität und der Umgang mit sensiblen Standortdaten erfordern eine getrennte Sicherheitsprüfung und explizite Freigabe.


## Auswertung der geplanten Feldtestserie (R06)
Vor dem ersten Test 30–50 Versuchsslots festlegen, mindestens zehn je Distanz (50/75/100 m). Die Aufteilung ist ein vorgeschlagenes Testdesign, kein statistischer Genauigkeitsnachweis. Gerät/OS, Empfangsbedingungen, unabhängige Referenzmethode, vergleichbare Start-/Zielereignisse und zulässige Fehler- sowie Ausfallgrenzen vor Beginn dokumentieren und freigeben. Keine Grenzwerte nach Sichtung der Ergebnisse anpassen. Browser-GPS und native GPS/IMU getrennt auswerten.
 
Für die Browser-GPS-Serie eine lokale JSON-Datei mit einem Array aller geplanten Slots führen. Jeder Slot hat genau `id` (T01 bis T50, eindeutig), `distanceMeters`, `outcome` und `report`. Initial steht jeder Slot auf `not-run` und `report: null`. Nach einem begonnenen Versuch den Original-JSON-Export als Objekt unter `report` übernehmen und `outcome: "report"` setzen. Wenn kein Export möglich war, den Slot als `failed-no-export` mit `report: null` erfassen. Keine abgebrochenen oder ungünstigen Versuche entfernen. Keine Namen, Koordinaten oder sonstigen Identifikatoren in diese Datei übernehmen.

Auswertung ohne Netzwerk: `node scripts/summarize-gps-field-trials.mjs pfad-zur-lokalen-datei.json`. Die Ausgabe zeigt pro Distanz geplante, durchgeführte, nicht gestartete, nicht exportierte und unvollständige Versuche, bestätigte Ziele, fehlende Referenzen, auswertbare Vergleiche, Anteil ohne bestätigtes Ziel sowie Anteil ohne Referenzvergleich (Nenner: alle begonnenen Versuche). Zeitfehler werden ausschließlich aus bestätigten Zielzeiten mit unabhängiger Referenz berechnet, nicht aus Abbrüchen. Der Anteil ohne bestätigtes Ziel ist kein Beweis dafür, dass bei allen fehlenden Exporten die Messung selbst gescheitert ist.

Das Skript prüft strukturelle Konsistenz, nicht Echtheit der Messwerte oder Vollständigkeit der tatsächlich durchgeführten Serie. Es gibt bewusst keine automatische Freigabe aus. Die unabhängig vereinbarten Grenzen, Originalprotokolle, Gerätekonfiguration, native IMU-Tests und Beurteilung der Ergebnisse bleiben erforderlich. Nur synthetische Unit-Tests, keine realen Feldläufe ausgeführt.

Die Auswertung unterscheidet zusätzlich Berichte mit und ohne GPS-Beobachtungslücke, interpolierte Ziele und Ziele nach einer Lücke sowie die dokumentierten Stoppgründe. `withObservationGapErrors` und `withoutObservationGapErrors` enthalten die getrennten Referenzfehler; die Gesamtkennzahlen und der Nenner aller begonnenen Versuche bleiben unverändert. Fehlende Exporte besitzen keine bekannte Lücken- oder Stoppklassifikation. Keine Teilgruppe gilt allein als Freigabenachweis.
