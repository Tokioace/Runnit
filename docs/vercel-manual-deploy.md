# Runnit – adaptiver Vercel-Hobby-Workflow

## Ziel

Der Nutzer hat wechselnde Zeitfenster. Die **fünf autonomen Entwicklungszyklen
und die Nachtprüfung laufen immer weiter**, unabhängig davon, ob der Nutzer
aktiv Runnit testet. Der Unterschied betrifft **wer ein Preview auslöst und
ob während einer aktiven Testsitzung automatisch nach develop gemergt wird**.

### Normalbetrieb (Nutzer nicht in einer längeren Testsitzung)

- Automatische Entwicklungszyklen implementieren und prüfen eigene PRs.
- Sichere, vollständig geprüfte kleine PRs dürfen nach den bisherigen
  strengen Merge-Regeln automatisch nach **develop** integriert werden.
- Ein neuer Commit auf **develop** löst eine automatische Vercel-Vorschau
  aus. Dadurch kann der Nutzer am Ende des Tages eine aktualisierte
  Testversion ansehen, ohne jedes Deployment selbst anzustoßen.
- Es werden **keine** zusätzlichen automatischen Preview-Builds für
  einzelne `feature/`, `fix/`, `chore/` oder sonstige PR-Branches
  erzeugt. Ein solcher PR wird ausschließlich auf ausdrückliche Anforderung
  des Nutzers manuell deployed.

### Aktive Testsitzung (z. B. mehrere Stunden am Wochenende)

- Entwicklung und **alle Tests laufen unverändert**.
- Der Nutzer bestimmt, welcher PR bzw. Commit als Nächstes als Preview
  gebaut wird. Keine eigenmächtigen Vercel-Deployments für Einzel-PRs.
- Während der Nutzer dieselbe Funktion intensiv testet, PRs in dieser
  Funktion ohne seine explizite Freigabe **nicht automatisch nach develop
  mergen**. Andere unabhängige sichere Patches können weiterentwickelt
  werden; nach Testschluss werden sie kontrolliert integriert.
- Ein Merge nach `develop` erzeugt weiterhin automatisch EINEN
  Preview-Build (durch die konfigurierte Git-Integration). Vor einem
  solchen Merge während einer aktiven Sitzung möglichst Nutzerfreigabe
  einholen, um ungewollte Deployments zu vermeiden.

### Wie wird aktive Beteiligung erkannt?

Vercel selbst kennt keine ChatGPT-Nutzung, und aus einer stillen Zeit
darf nicht auf ein zuverlässiges Anwesenheitssignal geschlossen werden.
Das ist **kein automatisch getestetes Idle-Erkennungssystem**.

Die sichere Regel ist:

- Sagt der Nutzer `Ich teste gerade`, `Aktivmodus` oder arbeitet
  unmittelbar sichtbar mit uns an manuellen Tests, behandeln wir diese
  laufende Sitzung als **aktiv**.
- Sagt er `Bin fertig`, `Automatikmodus`, `Mache morgen weiter` oder
  es steht bei einer neuen, unabhängigen Entwicklungsrunde keine
  nachweisbar aktive Nutzersitzung an, gilt **Normalbetrieb**.
- Bei unklarer Lage nicht zeitkritische Test-PRs offenlassen, anstatt
  Preview-Deployments durch Vermutungen auszulösen.
- Automatische Entwicklung wird **niemals** allein wegen Aktivmodus
  pausiert. Nur Preview-/Merge-Freigaben werden angepasst.

## Technischer Vercel-Schalter

In `vercel.json`:

```json
"git": {
  "deploymentEnabled": {
    "main": true,
    "develop": true,
    "**": false
  }
}
```

Wird diese Änderung nach `develop` gemergt, gelten für dessen künftige
Commits die Regeln. Der `main`-Branch bleibt unangetastet; bevor eine
künftige Änderung nach `main` kommt, ist die aktive Konfiguration dort
gesondert zu prüfen.

Vercel zählt Deployments auch bei manueller Erstellung; die Regeln
reduzieren nur die Zahl unnötiger automatischer Git-Builds.

## PR gezielt auf dem iPhone testen

1. Vercel öffnen: https://vercel.com/tokioaces-projects/runnit/deployments
2. Unter **Deployments** das `...`-Menü und **Create Deployment** wählen.
3. Den **Feature-Branch** oder besser den **exakten PR-Head-SHA** eingeben,
   den TypeScript, Tests und CodeQL erfolgreich geprüft haben.
4. **Preview**, niemals Production/`main`, auswählen.
5. Nach READY die konkrete Preview-URL auf dem iPhone öffnen.
6. Die Versionsgleichheit von Link und geprüften Head-SHA nachweisen.
   **Redeploy** eines älteren Builds ist nicht der aktuelle PR.

## Sicherheitsgrenzen

Keine automatische Veröffentlichung nach `main`; kein Merge risikoreicher
Auth-, Standort-, Supabase-, CI-/Deployment-Sicherheitsänderungen ohne
Freigabe. Bei ungelösten Prüfungen: PR offenlassen. Keine alten Previews
als aktuelle Version ausgeben.

Dokumentation: https://vercel.com/docs/project-configuration/git-configuration
