# Runnit – Herkunft und Vertrauensstatus von Ranglisteneinträgen

## Aktuelle Regeln
Die Oberfläche unterscheidet drei Herkunftsarten:

| Quelle | Anzeige | Bedeutung |
| --- | --- | --- |
| `demo` | Demo · erfunden | Synthetisch erzeugte Namen und Zeiten, keine realen Nutzerleistungen |
| `server-unverified` | Gespeichert · ungeprüft | Daten aus der aktuellen Supabase-RPC, deren sportliche Echtheit **nicht** nachgewiesen ist |
| `local-unverified` | Lokal · ungeprüft | Nur im offenen Browser angezeigte Laufzeiten, **nicht** offiziell geprüft |

**Keine** der drei Kategorien verleiht einen offiziellen Ranglistenstatus. Die Darstellung trennt die Quellen in
verschiedenen Abschnitten und vergibt keine Medaillen für unbestätigte Resultate.

## Transparenz in der UI
- `/leaderboard`: vorherige Beispielzeiten sind als fiktiv gekennzeichnet. National und Welt zeigen keinen
  falschen Ranglistenausschnitt mehr; bis zu echten verifizierten Daten wird dort der leere Zustand gezeigt.
- Karten-Leaderboard: Die RPC-Daten, lokalen Ergebnisse und Ersatz-Demos haben einen eigenen Bereich.
- Auf der Karte macht ein Hinweis darauf aufmerksam, wenn Beispielspieler oder Demo-Herausforderungen angezeigt werden.
- `/profile`: Das Profil ist derzeit eine Demoansicht, einschließlich aller Zahlen, Ränge und Medaillen.
- Abschlussdialog nach einem Rennen verspricht **nicht** länger, dass eine Zeit in Deutschland- oder Weltlisten
  übernommen wurde.

## Was diese Änderung ausdrücklich NICHT absichert
- Der bestehende RPC `submit_duel_result` und die Supabase-RLS/Validierung bleiben unverändert.
- Ein im Backend gespeicherter Datensatz ist NICHT automatisch echt, GPS-verifiziert oder Anti-Cheat-geprüft.
- Eine reine Client-Kennzeichnung verhindert **keine** gefälschten API-Requests oder unechte Ranglistenwerte.
- Auch die aktuelle GPS-Messung der regulären Rennansicht ist noch nicht unabhängig gegen Referenzzeitmessungen validiert.

## Voraussetzungen für offizielle Ranglisten
Bevor die App echte Ranglisten, Siege oder Medaillen ausgibt, sind mindestens eine belastbare serverseitige
Ergebnisfreigabe, RLS-/RPC-Prüfungen, Missbrauchs- und Replay-Schutz sowie ein praktisches GPS-Testprotokoll
erforderlich. Die Einführung von `verified` darf **erst** nach einem gesonderten Backend-Review mit
nachvollziehbaren Tests und ausdrücklicher Nutzerfreigabe erfolgen.
