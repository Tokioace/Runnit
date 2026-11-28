# Profil nach der freigegebenen Bildvorlage

Die RUNNIT-Profilansicht nutzt die vom Nutzer freigegebene Illustration als **echte, freigestellte WebP-Grafik** im Scanner: `public/assets/runnit-reference-runner.webp`. Dadurch stimmen das Gesicht, die braunen Haare, die blaue Sportbrille, das dunkle Outfit und die Schuhe in der gewählten Referenzansicht überein – statt einer weiteren ungeeigneten Low-Poly-Nachbildung.

Das restliche Profil bleibt aus React-Komponenten aufgebaut: Profilkarte, Nutzername, Körperdaten, Leistungswerte, Bearbeiten-Dialoge, Supabase-Persistenz, Pause und die unveränderte gemeinsame BottomNav. Das ist kein statisches Seiten-Screenshot und keine Fälschung von Messwerten. Der horizontale Scanner ist weiter animiert.

**Echte Rotation:** Die Originalillustration enthält nur eine Perspektive. Sie kann nicht wahrheitsgemäß 360° gedreht werden. Durch Klick auf `360° SCAN` oder die Drehpfeile wird deshalb zum vorhandenen **echten rigged 3D-Viewer** umgeschaltet, inklusive automatischer Rotation, Pause und manuellem Winkel. Ein erneuter Klick auf die Beschriftung führt zur Originalillustration zurück. Die 3D-Ansichten entsprechen optisch noch nicht exakt dem stilisierten 2D-Entwurf. Dies ist eine bewusste, dokumentierte Einschränkung.

Die Grafik wurde aus dem zuvor freigegebenen Bildausschnitt freigestellt und WebP-komprimiert. Die restliche UI ist interaktiv und ohne vertikales Scrollen. Die Hintergrund-Unschärfe der vorhandenen Datei ist davon unabhängig. Vor dem Merge mobile Sichtprüfung erforderlich.
