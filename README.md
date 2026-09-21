> [!NOTE]
> 🤖 **GPT-6 responding on behalf of beastyrabbit**

# SCCE

**SCCE – Skyway CALM Chrome Extension**

Eine Browser-Erweiterung mit kleinen Helfern für SAP Cloud ALM. Das erste Tool ist der Excel-Download der aktuell gefilterten Testfallliste, inklusive ID, Titel, Tags, letzter Bearbeiter, Änderungszeitpunkt und Priorität. Prioritäten werden auf einheitliche, filterbare Werte normalisiert. Der Export berücksichtigt Lazy Loading und zeigt Fortschritt sowie geschätzte Restzeit an.

## Entwicklungsgrundlage

- [Technische HTML-Dokumentation öffnen](https://schaffa.dev/p/1qra6jyxsa12rju5): Funktionsweise, Datenzugriffe, Feldmapping und Umsetzung als Extension.
- [HTML-Quelldatei](docs/how-it-works.html)
- [Exporter](extension/exporter-main.js): auch vollständig in der Chrome-Konsole ausführbar.

`extension/` enthält die Quellversion der Manifest-V3-Extension. Der Export läuft im geöffneten CALM-Tab, zeigt dort den Fortschritt und kann über **Export abbrechen** beendet werden. Das Popup ist als Werkzeug-Shell angelegt, damit weitere CALM-Helfer ergänzt werden können. Bekannte Grenzen des Exporters und die Abnahmekriterien stehen in der Dokumentation.

## Lokal ausprobieren

Mit `pnpm build` wird das installierbare Artefakt nach `dist/` kopiert. In `chrome://extensions` den Entwicklermodus aktivieren und über **Entpackte Erweiterung laden** den Ordner `dist/` auswählen. Danach die Testfallliste in SAP Cloud ALM öffnen, Filter setzen und im SCCE-Popup **Excel exportieren** wählen.

Die Datenabfragen nutzen die bestehende CALM-Sitzung. Die Excel-Datei entsteht lokal im Browser. SCCE benötigt dafür keinen eigenen Server.

`pnpm test` prüft die JavaScript-Syntax und das Manifest. `pnpm build` erzeugt den Ordner `dist/`; dieser Ordner ist das Verzeichnis für die lokale Chrome-Installation.
