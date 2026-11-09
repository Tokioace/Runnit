# Runnit: E-Mail-Code kommt nicht an – sichere Diagnose

Stand: 9. November 2026. Dieses Dokument ist eine **Anleitung**, keine Änderung an der produktiven Supabase-Konfiguration.

## Symptom unterscheiden

1. **Kein Code und keine E-Mail:** Zuerst Spam/Junk, Tippfehler in der Adresse und Posteingangsfilter prüfen. Nicht wiederholt auf „Code anfordern“ tippen: Supabase kann Anfragen drosseln.
2. **E-Mail kommt an, aber Link führt zu localhost oder in einen anderen Browser:** Das ist ein Redirect-/Browser-Sitzungsproblem, **kein** E-Mail-Zustellproblem. Siehe [Callback-Einrichtung](email-login-callback-setup.md).
3. **Code kommt an, aber wird abgelehnt:** Nur den zuletzt angeforderten Code verwenden, auf Ablaufzeit und richtige E-Mail-Adresse achten. Den Code niemals in Issues, Screenshots oder Supportnachrichten teilen.

## Prüfung für Projektverantwortliche

- Im Supabase-Dashboard **Authentication → Logs** die Zeit der fehlgeschlagenen Anfrage prüfen. Zeit und Fehlerkategorie notieren, keine E-Mail-Adressen, Tokens oder kompletten Logpayloads in GitHub kopieren.
- In **Authentication → Providers → Email** prüfen, ob der E-Mail-Provider aktiviert ist und ob der verwendete Login-Flow zu den App-Einstellungen passt.
- In **Authentication → Email Templates** prüfen, ob die für den konkreten Flow genutzte Vorlage (Magic Link bzw. Confirm signup) einen gültigen `{{ .Token }}`-Platzhalter enthält, wenn die App einen sechsstelligen Code erwartet. Die HTML-Vorlage allein schaltet keinen OTP-Flow in der App frei.
- Bei SMTP-/Versandfehlern die dokumentierten Supabase-Versandlimits und gegebenenfalls den eigenen SMTP-Anbieter prüfen. Ohne eigenes SMTP können Einschränkungen des Standard-Maildiensts greifen; Zustellung an beliebige Empfänger ist nicht garantiert.
- Falls im Browser **„Code anfordern“** gedrückt wird, aber keine Anfrage beim Backend ankommt, Browser-Netzwerkfehler und App-Konsole prüfen; keine Zugangsschlüssel oder vollständigen Request-Header veröffentlichen.
- Falls die Anfrage erfolgreich quittiert wird, aber keine E-Mail ankommt, Versand-/Auth-Logs und SMTP-Status prüfen. Eine Erfolgsmeldung in der App allein beweist keine Zustellung; Auth-Systeme können aus Sicherheitsgründen gleichförmige Antworten liefern.

## Sichere Testabfolge

1. Mit einer eigenen, kontrollierten Testadresse **einmal** einen Code anfordern und Uhrzeit festhalten.
2. Posteingang und Spam prüfen; parallel nur redigierte Auth-Logs betrachten.
3. Falls E-Mail eintrifft, Code im **selben Browser/Tab** eingeben, in dem Runnit geöffnet wurde.
4. Ergebnis als „Anfrage fehlgeschlagen“, „Versand nicht bestätigt“, „E-Mail zugestellt“, „Code akzeptiert“ oder „Code abgelehnt“ dokumentieren. Keine realen Codes oder Standortdaten speichern.

## Grenzen und nächste Schritte

Diese Checkliste testet weder Live-SMTP noch das Supabase-Dashboard automatisch. Änderungen an Auth-Provider, Redirect-Allowlist, Mail-Templates, SMTP und RLS sind produktionsrelevant und bedürfen gesonderter Freigabe. Für die Nachtprüfung: Auth-Logs nach **redigierten Fehlerkategorien** auswerten und erst danach einen eng begrenzten Code-Fix planen, falls der Fehler nachweislich im Client liegt. GPS-Feldtest PR #21 bleibt unberührt.
