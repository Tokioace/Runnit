# RUNNIT — rechtliche Dokumente, Arbeitsentwurf (nicht veröffentlichen)

Die folgenden Texte sind eine redaktionelle Grundlage, keine bestätigte Datenschutzerklärung und keine Rechtsberatung. Die Betreiberidentität, Verträge, tatsächlichen Produktionsprozesse und Speicherfristen fehlen. Änderungen aus db/release-candidates sind ausdrücklich nicht als bereits aktiv beschrieben.

## Datenschutzerklärung (Entwurf)

### Verantwortlicher und Kontakt
[OFFEN: vollständiger Name/Firma, ladungsfähige Anschrift, E-Mail, gegebenenfalls Datenschutzbeauftragter und Vertreter]. Diese Angaben müssen vor Veröffentlichung ergänzt werden.

### Konto und Anmeldung
RUNNIT bietet einen Gastzugang und kontogebundene Funktionen an. Bei Registrierung/Anmeldung werden E-Mail-Adresse, Auth-Kennung, Anmeldedaten, Sitzungsinformationen und Anzeigename verarbeitet. Supabase Auth übernimmt die technische Anmeldung. Bei aktivierten externen Login-Diensten werden zusätzlich die für die Anmeldung benötigten Informationen des jeweiligen Anbieters verarbeitet. [OFFEN: tatsächlich freigegebene Anbieter, Empfänger, Rechtsgrundlagen, Aufbewahrung und Übermittlungsbedingungen].

### Profil, Training und Laufmessung
Optionale Profilinformationen (z. B. Körpermaße, Bio, Ausrüstung, Ziele), Trainingspräferenzen und Kalibrierungsinformationen können kontogebunden gespeichert werden. Bei Rennen werden GPS- und Bewegungssensordaten zur Messung von Zeit, Distanz, Schritten, Geschwindigkeit und weiteren Messwerten verwendet, abhängig von Berechtigungen und Gerät. Private Ghost-Run-Zusammenfassungen können im Konto gespeichert werden; Diagnoseexporte können lokal vom Nutzer erstellt werden. Die Messung ist experimentell. [OFFEN: Rechtsgrundlage je Verarbeitung, Bewertung möglicher Gesundheitsdaten nach Art. 9 DSGVO, Datenminimierung, Aufbewahrung, Löschkonzept und tatsächliche Sensoren der nativen Version].

### Karte, Standort und Veranstaltungen
Kartenanfragen gehen nach aktuellem Code an OpenFreeMap (tiles.openfreemap.org). Für die Standortzuordnung gibt es externe Anfragen an ipapi.co und Nominatim; bei Nominatim können Koordinaten übertragen werden. Zur Suche nach Duellen werden Koordinaten an Supabase gesendet; beim Erstellen eines Events wird dessen Standort gespeichert. Offene Herausforderungen können anderen angemeldeten Nutzern angezeigt werden. [OFFEN: genaue Auslöser bei Gast/Account, Anbieteridentitäten, Rechtsgrundlagen, IP- und Standortverarbeitung, Verträge, Länder, Speicherfristen und Vermeidung unnötiger Standortübermittlungen].

### Ranglisten und Gegner
Freiwillig freigegebene Beta-Ranglisten zeigen Anzeigenamen und sportliche Ergebnisse. Duellteilnehmer können die hierfür vorgesehenen Ergebnisdaten des Gegners sehen. Die Freigabe kann im Profil geändert werden. Der öffentliche Ghost-Ranking-Code muss separat auf seine tatsächliche Datenfreigabe geprüft werden; nicht pauschal behaupten, alle Ergebnisse seien nur opt-in. Die Beta-Messung ist keine unabhängige Leistungszertifizierung.

### Hosting, technische Daten und lokale Speicherung
Vercel hostet die Webanwendung, Supabase verarbeitet Auth- und App-Daten. Technische Verbindungsinformationen können bei Nutzung der Dienste anfallen. Die App speichert Anmeldesitzungen, Gastmodus und gegebenenfalls ein ausstehendes Rennergebnis im Browser. Die Wiederherstellung ausstehender Ergebnisse ist auf vier Stunden ab Start begrenzt; dieser Wert ist keine garantierte automatische Speicherlöschfrist. [OFFEN: tatsächliche technische Logs, SMTP-Dienst, Cookies/Endgerätezugriff, Fristen, Empfänger, Drittlandübermittlungen, Verträge und weitere eingebundene Dienste].

### Rechtsgrundlagen, Aufbewahrung, Datenübermittlungen
[OFFEN: zweckbezogene Rechtsgrundlagen nach Art. 6 DSGVO, ggf. Art. 9, berechtigte Interessen, Pflicht/Freiwilligkeit der Bereitstellung und Folgen, konkrete Fristen oder Kriterien, Empfänger, Drittlandübermittlungen und Garantien]. Keine pauschale Einwilligungsbehauptung aus der Browser-Berechtigung ableiten.

### Rechte und Löschung
Betroffene können nach Maßgabe der DSGVO Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch verlangen; eine auf Einwilligung gestützte Verarbeitung kann für die Zukunft widerrufen werden. Ein Beschwerderecht besteht bei einer Datenschutzaufsichtsbehörde. [OFFEN: erreichbarer Kontakt, zuständige Behörde, tatsächliche Lösch- und Auskunftsprozesse, Umgang mit Backups und gemeinsamem Rennverlauf]. Die in der Entwicklung befindliche Kontolöschung ist noch nicht freigeschaltet. [OFFEN: automatisierte Entscheidungen, Altersgruppe und tatsächlich geltende Regeln].

## Nutzungsbedingungen (Entwurf)

### Angebot
RUNNIT ist eine digitale Lauf- und Sprint-Challenge-Anwendung. Beta-Messungen können ungenau sein und ersetzen keine amtliche oder medizinische Messung. Es wird keine bestimmte Messgenauigkeit oder Wettkampfzulassung zugesichert.

### Sichere Nutzung
Nur an geeigneten, sicheren Orten laufen und Verkehrsregeln sowie Rechte anderer beachten. Nicht während des Laufens auf das Display schauen oder Rennen in gefährlichen Bereichen veranstalten. Keine Manipulation von Messungen, kein Missbrauch fremder Konten und keine Belästigung anderer Nutzer.

### Konto und Ranglisten
Zugangsdaten schützen. Ergebnisse können nach den tatsächlich freigegebenen Regeln öffentlich erscheinen; Manipulationsverdacht darf nicht als sicherer Betrugsnachweis behandelt werden. [OFFEN: faire Sanktionen, Einspruch, Moderationsverfahren, altersbezogene Regeln und Löschprozess].

### Vertrag und Verfügbarkeit
[OFFEN: Vertragspartner, Vertragsabschluss, Laufzeit/Kündigung, kostenlose oder kostenpflichtige Funktionen, Verbraucherinformationen, Haftung unter Beachtung zwingender gesetzlicher Rechte, ggf. Widerruf, anwendbares Recht, Support und Änderungen]. Keine pauschalen Haftungsausschlüsse oder Verzichtserklärungen.

## Impressum (Entwurf)
[OFFEN: Name/Firma, Anschrift, elektronische Kontaktmöglichkeit und weitere tatsächlich einschlägige Pflichtangaben nach § 5 DDG; prüfen, ob weitere Vorschriften anwendbar sind].

## Quellen zur Prüfung (25.11.2026)
- DSGVO insbesondere Art. 5, 6, 9, 12–22: https://eur-lex.europa.eu/eli/reg/2016/679/oj
- DDG § 5: https://www.gesetze-im-internet.de/ddg/__5.html
- Apple Review Guidelines 5.1.1: https://developer.apple.com/app-store/review/guidelines/
- Apple Privacy Details: https://developer.apple.com/app-store/app-privacy-details/

## Freigabe und App-Store-Einreichung
1. Verantwortlichen und Supportkontakt bestätigen, reale Produktionsdatenflüsse einschließlich Kartenanbieter/SMTP/Logs prüfen, Rechtsgrundlagen und Fristen festlegen und rechtlich prüfen lassen.
2. Drei freigegebene Texte in VITE_APPROVED_LEGAL_PAGES_JSON als JSON mit version, privacy, terms, imprint hinterlegen; jede Seite hat title und sections mit heading/body. Keine Zugangsdaten oder nicht öffentliche Informationen in VITE_ Variablen. VITE_LEGAL_PAGES_ENABLED=true erst nach expliziter Inhaltsfreigabe setzen. Der Parser prüft nur Struktur und typische Platzhalter, nicht Rechtmäßigkeit.
3. /privacy, /terms und /imprint in einem öffentlichen Build ohne Login und auf iPhone testen; öffentliche Privacy- und Support-URL in App Store Connect hinterlegen. Die Links erscheinen in Anmeldung/Registrierung und Profil-Datenschutz, nicht im bestehenden Startbild. Ggf. später Nutzungsbedingungen-Zustimmung vor Vertragsabschluss gesondert umsetzen.
4. Apple Privacy Labels gegen tatsächliche native Binärdatei, SDKs und Backend abgleichen. Insbesondere Kontaktinfos, Nutzer-ID, präziser/ungefährer Standort, Fitness-/Bewegungsdaten, Nutzerinhalte und Diagnostik prüfen; nicht ungeprüft Tracking- oder Nicht-Tracking-Angaben behaupten.
5. Löschung und E-Mail-Bestätigung separat fertigstellen; die Veröffentlichung der Rechtsseiten allein erfüllt keine Löschpflicht.
