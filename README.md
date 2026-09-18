> [!NOTE]
> 🤖 **GPT-6 responding on behalf of beastyrabbit**

# SCCE

**SCCE – Skyway CALM Chrome Extension**

Eine Browser-Erweiterung mit kleinen Helfern für SAP Cloud ALM. Das erste Tool ist der Excel-Download der aktuell gefilterten Testfallliste, inklusive ID, Titel, Tags, letzter Bearbeiter und Änderungszeitpunkt. Der Export berücksichtigt Lazy Loading und zeigt Fortschritt sowie geschätzte Restzeit an.

## Entwicklungsgrundlage

- [Technische HTML-Dokumentation öffnen](https://schaffa.dev/p/1qra6jyxsa12rju5): Funktionsweise, Datenzugriffe, Feldmapping und Umsetzung als Extension.
- [HTML-Quelldatei](docs/how-it-works.html)
- [Exporter](extension/exporter-main.js): auch vollständig in der Chrome-Konsole ausführbar.

`extension/` enthält ein Manifest-V3-Grundgerüst mit Export-Button. Es ist ein Entwicklungsstand; der vollständige Extension-Ablauf wurde noch nicht in Chrome getestet. Bekannte Grenzen des Exporters und die Abnahmekriterien stehen in der Dokumentation.

## Lokal ausprobieren

In `chrome://extensions` den Entwicklermodus aktivieren und über **Entpackte Erweiterung laden** den Ordner `extension/` auswählen. Danach die Testfallliste in SAP Cloud ALM öffnen, Filter setzen und im SCCE-Popup **Excel exportieren** wählen.

Die Datenabfragen nutzen die bestehende CALM-Sitzung. Die Excel-Datei entsteht lokal im Browser. SCCE benötigt dafür keinen eigenen Server.

`npm test` prüft die JavaScript-Syntax.
