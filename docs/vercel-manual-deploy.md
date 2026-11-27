# Runnit – kontrollierte Vercel-Previews und Release-Freigabe

## Aktuelle Arbeitsweise

- Autonome Fehleroptimierung läuft getrennt von der manuellen Release-Arbeit. Sie erstellt kleine, überprüfbare PRs gegen `develop`, ohne automatische Merges.
- Der Nutzer integriert PRs erst nach Prüfung der relevanten GitHub-Checks auf dem aktuellen PR-Head.
- Ein Merge nach `develop` erzeugt eine automatische Vercel-Vorschau. Einzelne PR-Branches werden nicht automatisch deployed.
- `main` ist ausschließlich für ausdrücklich vom Nutzer freigegebene Veröffentlichungen reserviert. Eine grüne CI oder ein READY-Preview ist keine Veröffentlichungsfreigabe.

## Branch- und Deployment-Konfiguration

Die gewünschte Konfiguration in `vercel.json` auf `develop` lautet:

```json
"git": {
  "deploymentEnabled": {
    "main": true,
    "develop": true,
    "**": false
  }
}
```

Der bisherige Produktionsbranch kann noch eine ältere Konfiguration enthalten. Vor dem ersten Release den tatsächlichen Vercel-Produktionsbranch, Projekt, Konfiguration, Zugriffsschutz und Zielumgebung separat prüfen. Keine Einstellung automatisch ändern.

## PR gezielt auf dem iPhone testen

1. [Vercel-Deployments](https://vercel.com/tokioaces-projects/runnit/deployments) öffnen.
2. Unter Deployments bei Bedarf ein ausdrücklich genehmigtes Preview des exakten geprüften PR-Head-SHA erstellen (nicht Production).
3. READY-Status und Git-SHA vergleichen; Zugriffsschutz beibehalten.
4. Den konkreten Preview-Link für die Testabnahme verwenden. Ein Redeploy eines älteren Builds ist kein Test des aktuellen PR.
5. Vor dem Merge die aktuelle Branch-Version und die relevanten Prüfungen erneut kontrollieren.

## Freigabe nach main (R12, Release-Tracker #399)

1. Alle Freigabekriterien im Release-Tracker abarbeiten; insbesondere echte Geräte-, Backend-, Datenschutz- und Sicherheitsabnahmen. Keine unaufgeklärten P0/P1-Fehler.
2. Exakten Kandidaten-Commit auf `develop` festhalten, getesteten Preview-SHA abgleichen und vollständige Evidenz dokumentieren.
3. Einen PR nach `main` erst nach ausdrücklicher Freigabe vorbereiten. Auch dort TypeScript/Build/Tests, CodeQL, den strikten Dependency-Audit und isolierte SQL-Integration auf dem tatsächlichen Release-PR prüfen. Native Vorschau und erforderliche macOS-/Geräteprüfungen separat auf dem passenden Kandidaten belegen; Die Linux-iOS-Preview-Prüfung wird bei Änderungen an gemeinsamen Web-Build-Eingaben oder nativen Build-Eingaben auch für PRs nach main ausgelöst. Bei fehlendem oder übersprungenem Lauf (etwa bei sehr großen Diffs) den exakten Kandidaten separat prüfen. Die macOS-Kompilierung und der verbundene Testbackend bleiben ausschließlich manuelle Opt-ins; häufigere Linux-Prüfungen können vorhandene CI-Minuten verbrauchen.
4. Den Release-Diff und das exakte Merge-Ergebnis prüfen. Wenn Branch, Head, Inhalt oder Konfiguration abweichen, erneut prüfen. Fehlende oder übersprungene notwendige Checks gelten nicht als bestanden.
5. Vor einer produktiven Änderung die bisherige Produktions-Deployment-ID, Git-SHA und den Datenbank-Migrationsstand dokumentieren; Wiederherstellungsfähigkeit und Schema-Kompatibilität des alten Builds mit dem vorgesehenen Backend überprüfen.
6. Merge nach `main` kann eine automatische Produktionsbereitstellung auslösen. Erst nach abschließender ausdrücklicher Nutzerfreigabe mergen. Nachher READY-Status, tatsächlichen Produktions-SHA, Domain und zentrale Funktionen kontrollieren. Die vier Kernworkflows (fünf Pflichtjobs) laufen zusätzlich auf dem tatsächlichen integrierten main-Commit. Diese nachgelagerte Kontrolle ist kein Schutz vor einer bereits ausgelösten Vercel-Bereitstellung und ersetzt keine vorherige Freigabe. Bei rotem oder fehlendem Nachweis weitere Releases stoppen, Auswirkung prüfen und gegebenenfalls den genehmigten Rollback-Prozess verwenden.

Die CI-Trigger allein erzwingen keinen geschützten Branch und keine Vercel-Freigabe. Erforderliche GitHub-Regeln und Vercel-Einstellungen müssen vor Veröffentlichung separat geprüft und gegebenenfalls ausdrücklich genehmigt konfiguriert werden. Kein automatischer Merge, Rollback oder Datenbankeingriff durch diese Anleitung.

## Störung nach Release / Rollback

- Bei schwerwiegendem Fehler weitere Releases stoppen und den betroffenen Produktions-SHA, Deployment-ID, Zeitpunkt sowie Fehlerbild dokumentieren (keine Zugangsdaten oder Standortdaten).
- Die zuvor dokumentierte, funktionsfähige Production-Deployment-ID und Kompatibilität mit dem aktuellen Backend überprüfen. In Vercel nur nach ausdrücklicher Freigabe die Rückkehr zu diesem Deployment auslösen; kein ungeprüftes Preview promoten.
- Anschließend Produktionsdomain, Deployment-ID/SHA und wesentliche Funktionen erneut kontrollieren. Bei abweichendem Zustand oder Fehlern kein Erfolg melden.
- Ein Frontend-Rollback setzt keine Supabase-Migration und keine gelöschten Kontodaten zurück. Datenbank-Rollback bzw. Forward-Fix benötigt eine eigene, vorab erprobte und genehmigte Strategie.
- Fehler reproduzieren und auf `develop` korrigieren. Erneute Veröffentlichung erst nach aktualisierter Abnahme. Bei Vercel Instant Rollback den Zustand der automatischen Produktionszuordnung überprüfen, bevor der nächste Release erfolgt.

Keine Produktionsänderung und kein echter Rollback wurden durch diese Dokumentation ausgeführt.
