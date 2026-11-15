# Vercel-Deployments – manuell und sparsam

## Zweck

Runnit bleibt auf Vercel. Es gibt weiterhin GitHub-Commits, Pull Requests,
TypeScript-Checks, Tests und CodeQL. Aber **Git-Pushes auf develop und
Feature-/PR-Branches lösen kein automatisches Vercel-Deployment mehr aus**.

Das steuert `vercel.json` via `git.deploymentEnabled` mit `main: true`
und `**: false`. Die zukünftige Produktionsbranche `main` darf weiterhin
nach einer bewussten Freigabe automatisch veröffentlicht werden.

## Eine bestimmte Testversion auf dem iPhone veröffentlichen

1. Vercel öffnen: https://vercel.com/tokioaces-projects/runnit/deployments
2. Bei **Deployments** über das `...`-Menü **Create Deployment** auswählen.
3. Die **vollständige Branch-Bezeichnung des zu testenden PRs** oder den
   **exakten Head-Commit-SHA** eingeben. Beispiel: `develop` für die
   aktuelle Entwicklungsfassung.
4. **Preview** als Ziel verwenden (nicht Production/`main`).
5. **Create Deployment** drücken und nach erfolgreichem Build die neue
   Preview-URL auf dem iPhone öffnen.
6. Freigabe nur für denselben Commit erteilen, für den alle GitHub-Checks
   erfolgreich waren.

**Wichtig:** `Redeploy` eines älteren Deployments ist nicht automatisch
die aktuelle Branch-Version. Verwende für neue Änderungen
**Create Deployment** und wähle explizit die neue Git-Referenz.

Die Einstellung reduziert **automatische** Deployments; sie erhöht die
Hobby-Kontingente nicht. Auch manuell ausgelöste Deployments können das
Tageslimit erreichen. Wenn kein aktueller Preview-Link existiert, bitte
keinen veralteten Deployment-Link als geprüfte neue Version behandeln.

Dokumentation:
https://vercel.com/docs/project-configuration/git-configuration
https://vercel.com/docs/git#creating-a-deployment-from-a-git-reference
