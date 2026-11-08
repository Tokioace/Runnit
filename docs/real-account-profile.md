# Runnit – echtes Konto und Profil (Auth-Beta)

## Ausgangspunkt
Die Profilseite war zuvor eine vollständig fiktive Spielerkarte mit erfundenen Zeiten,
Siegen, Platzierungen, Levels und Medaillen. Ein Anmeldungspunkt existierte bisher
nur im Kartendialog, während das Profil selbst nicht mit Supabase Auth verbunden war.

## Umsetzung
- Unter `/profile` wird der echte Auth-Status aus dem bestehenden
  `useSupabaseUser`-Hook geladen.
- Gäste können sich anmelden oder ein Konto mit E-Mail, Passwort und
  Anzeigenamen erstellen; der Gastmodus mit Karte und GPS-Simulation
  bleibt ausdrücklich nutzbar.
- Bei bestehendem Konto werden **nur** echte, aus der angemeldeten
  Supabase-Session abgeleitete Kontodaten gezeigt. Kein fremdes Profil
  wird aus einer vom Client vorgegebenen Nutzer-ID geladen.
- Nach Anmeldung wird ein Anzeigename aus `user.user_metadata.display_name`
  angezeigt. Fehlt er oder ist er ungültig, erscheint der neutrale
  Platzhalter „Runnit-Läufer“ – niemals der private E-Mail-Präfix.
- Anzeigename kann im Konto geändert werden. Er wird über
  `supabase.auth.updateUser` in der Auth-Metadatenstruktur **des
  angemeldeten Kontos** gespeichert. Keine neuen Datenbanktabellen,
  zusätzlichen RLS-Regeln oder Admin-Rechte erforderlich.
- Authentifizierte Nutzer können sich abmelden.
- Sportwerte sind **nicht** an verifizierte Datenquellen angeschlossen.
  Deshalb erscheinen Striche und klare Hinweise, keine fiktiven Rekorde.
- Die Karte verwendet bei angemeldeten Nutzern den Anzeigenamen
  anstelle eines aus der E-Mail abgeleiteten Pseudonyms.

## Datenschutz und Grenzen
- Die Anmeldung erfolgt über Supabase Auth. E-Mail und Passwort werden
  von den vorhandenen Supabase-Funktionen verarbeitet; der neue
  Profilbildschirm speichert Passwörter nicht eigenständig.
- Der Benutzername ist **frei editierbare, nicht verifizierte
  Auth-Metadaten**. Es gibt keine globale Eindeutigkeit, keine
  Identitätsprüfung und keinen serverseitigen Schutz vor Namensgleichheit.
  Er darf NICHT als Berechtigungsmerkmal oder Siegernachweis dienen.
- Eine gespeicherte Session beweist keine echte Sprintleistung.
  Auth-Login/Signup auf einer Vercel-Vorschau nutzt dieselbe
  konfigurierte Supabase-Umgebung wie diese Vorschau. Echte Testkonten
  erzeugen echte Benutzer in dieser Umgebung.
- E-Mail-Bestätigung, Account-Limits und Passwortanforderungen
  hängen von der bestehenden Supabase-Projektkonfiguration ab.
  Die UI zeigt eine vorsichtige Bestätigungsmeldung statt einen
  garantierten E-Mail-Versand zu behaupten.
- Die vorhandene Karte nutzt bislang eigene Demo-/Duellpfade und
  ist nicht durch dieses Paket als sichere offizielle Rangliste freigegeben.

## Prüfen auf dem iPhone
1. `/profile` als Gast öffnen: Login/Registrierung und Links zum
   Gastmodus sichtbar, keine fiktiven 100-m-Bestzeiten.
2. Einen bewusst für die Beta vorgesehenen Testaccount verwenden;
   bei Neuregistrierung E-Mail-Bestätigung entsprechend Supabase prüfen.
3. Nach Anmeldung sollten die eigenen Kontoangaben erscheinen.
4. Anzeigenamen ändern, Seite neu laden und auf Wunsch auf einem
   zweiten Gerät überprüfen, ob der Wert erhalten blieb.
5. Karte öffnen: nur der Anzeigename, nicht die E-Mail-Adresse,
   darf als Teilnehmername erscheinen.
6. Ausloggen und bestätigen, dass die Profilansicht wieder
   die Gastanmeldung zeigt.
7. Browser-Fehlermeldungen und gescheiterte Anmeldung prüfen;
   die Seite darf kein Passwort oder Access-Token ausgeben.

## Separate Folgearbeit
Die echten Sportdaten benötigen eine gesonderte Abfrage-/Speicherschicht,
serverseitige Auth- und RLS-Regeln sowie ein unabhängiges GPS-Validierungskonzept.
Der offene GPS-Feldtest-PR #21 bleibt von dieser Profiländerung unberührt.
