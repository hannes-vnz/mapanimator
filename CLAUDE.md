# Mapanimator – Übergabe für Claude Code

Ziel: ein richtig gutes Kartentool für Reise-Vlogs und Erklär-Shorts (Hochformat 9:16 und 16:9).
Maßstab sind drei Referenzen:
- Baldinger Map Animator (mapanimator.baldinger.se)
- Karten-Recap im Vlog „Tag 787 – Kamelfamilie“
- 3D-Reliefkarten von 70 Sekunden Wiki

Sprache im Tool und in der Kommunikation: Deutsch.

## Aufbau (Stand 26.11.2026)
- Quellcode in `src/`:
  - `src/index.html` (Markup), `src/style.css`, `src/app.js` (die App, `/* ---------- `-Abschnitte).
  - `src/vendor/`: MapLibre GL JS 5.24.1 (+CSS), mp4-muxer 5.2.1.
- Entwickeln: `python3 -m http.server 8000` → http://localhost:8000/src/ (lädt die Einzeldateien).
- Bauen: `python3 tools/build.py` (oder `npm run build`) erzeugt die Einzeldatei `index.html` mit allem inline. **`index.html` nie direkt editieren.**
- Testen: `npm test` = Build + Playwright-Smoke-Test (`tools/smoke.mjs`: alle Themes, 1 s MP4, keine JS-Fehler). Nutzt das installierte Chrome.
- Braucht WebGL + WebCodecs, also Chrome/Edge mit Hardwarebeschleunigung.
- Zentrale Funktionen:
  - Grundkarte: `buildBaseStyle(name)` + `THEMES`
  - Laufzeit-Layer: `addRuntimeLayers()` (Highlight, Features, Routen, Pins)
  - Animation: `prepareAnim()` / `renderAt(t, live)` / `tipIndexFor()`
  - Timeline: `tracks` (pos/zoom/bearing/pitch/line, Keyframes {t, v, ease}), `sampleNum`, `applyEase`
  - Kamera-Presets: `#camPreset`
  - Export: `#mp4Btn` (framegenau), `#recordBtn` (Echtzeit-WebM)
  - Overlay: `drawOverlay()` zeichnet in `#ovl` und wird beim Export aufs Video gelegt.
- Projekt-Speichern: `SETTING_IDS`. Neue Einstellungen dort eintragen.

## Neu in dieser Runde (Claude, Chat)
1. MapLibre 4.7.1 → 5.24.1. Die Map nutzt `canvasContextAttributes.preserveDrawingBuffer`.
2. Stil „Relief (70-SW-Look)“:
   - `color-relief`-Tönung, multidirektionales Hillshade und ein Meer aus dem DEM (< −12 m).
   - Schaltet 3D-Terrain mit Überhöhung 12 an. Der Regler geht jetzt bis 20.
3. Stil „Atlas (Vlog-Weltkarte)“:
   - Länder aus Natural Earth 50m, eingefärbt nach `MAPCOLOR7` in 7 Pfirsich-/Brauntönen.
   - Meer blau, weiße gesperrte Länderlabels.
4. Länder hervorheben: ISO3-Liste, Füllung, weiße Kontur mit Schlagschatten, Einblendzeit.
5. Zähler-Overlay „37050 KM / TAG #787“:
   - Zählt mit der Linienspitze.
   - Tag wird linear über die Strecke verteilt.
6. Kamera:
   - Easing „Snap (Ruck)“.
   - Preset „70-SW: Snap-Zooms + Drift“: Snap ~13 % über 3 Frames, dann Drift mit 1,6 °/s Drehung und −2 %/s Zoom.
   - Mit Keyframes auf pos/zoom wird nicht mehr geglättet, sonst würden Snaps weich.
7. MP4-Export framegenau:
   - Jedes Frame wartet auf alle Kacheln. pixelRatio ist dabei 1, also exakt W×H.
   - 25/30/60 fps.
   - Optional Bewegungsunschärfe (6 Unterbilder).
   - Optional Stopp-Positionen pro Frame als JSON, für Compositing in Python.

Getestet ist das nur in headless Chrome (SwiftShader, ohne OpenFreeMap-Kacheln):
- Atlas-Stil, Highlight, Zähler, Snap-Preset und MP4 mit Unschärfe laufen ohne JS-Fehler.
- Auf dem Mac geprüft (26.11.): alle Themes mit echten Kacheln, MP4 (auch mit Unschärfe), WebM, Speichern/Laden. Behoben: Pin-Bild-Race („image already exists“), 3D-Terrain blieb nach Relief an.

## Roadmap (Priorität von oben)
1. **Entwicklungs-Setup:**
   - `src/` (app.js, style.css, index.html) plus Build-Skript, das wieder eine einzelne `mapanimator.html` erzeugt (Bibliotheken inline).
   - Grund: Die 1-MB-Datei ist zum Editieren unhandlich.
   - Playwright-Smoke-Test: lädt die Seite, wählt alle Themes, rendert 1 s MP4 und prüft auf JS-Fehler.
2. **Verkehrsmittel pro Etappe** (Kamelfamilie):
   - Auto/Rad/Zu Fuß geroutet; Fähre und Flug als Bogen.
   - Linienstil je Etappe: durchgezogen rot mit weißer Kontur, Fähre weiß gestrichelt, Bus orange gestrichelt.
3. **Kamera wie Baldinger:**
   - Modi „Folgen“ (mit Vorausschau und automatischem Rauszoomen bei langen Etappen), „Still“, „Stativ“, „Orbit“.
   - „Norden oben“ / „Fahrtrichtung oben“.
   - Kamera-Segmente als Blöcke in der Timeline.
4. **Whip-Pan-Übergänge** am Anfang/Ende: schneller Schwenk mit starker Richtungsunschärfe, wie der Ein- und Ausstieg in Kamelfamilie.
5. **Schilder (Signs):**
   - Freie Labels oder Fotokarten auf der Karte.
   - Anzeige: immer, wenn passiert, oder Zeitfenster; optional mit Pause.
   - Größenregler.
6. **Avatar an der Spitze:** rundes Foto mit weißem Ring und Pin. Foto-Spitze gibt es schon, Look angleichen.
7. **Gesperrte Regionslabels** („A L P E N“, „I R A N“) aus Natural Earth geography_regions (Gebirge, Wüsten, Meere).
8. **Szenen:** mehrere Szenen pro Projekt, die nacheinander exportiert werden; Projekt als JSON-Datei.
9. **Formate:**
   - 9:16, 4:5, 1:1, 16:9 als Buttons.
   - Safe-Zone-Overlay für Shorts/TikTok-UI (nur Vorschau).
10. **Skript-API** für automatisches Rendern, wie im Tool `~/Kartenvideos/reliefkarte/reliefkarte.html`:
    - `window.MA.load(plan)` / `render()`.
    - Plan-JSON mit Keyframes, Layern und Punkten.
    - Export als ein Bundle (MP4 + Positionen).
11. Später: 3D-Modelle an der Spitze (Schiff, Auto, Fahrrad) als glTF über einen Custom Layer.

## Regeln
- Single-File-Auslieferung behalten (läuft offline per Doppelklick bzw. GitHub Pages).
- Keine API-Keys im Code; MapTiler-Key bleibt optional im Browser.
- Attribution (OSM, OpenFreeMap, Natural Earth, Mapzen/AWS) im Kartenrand lassen.
- Nach jeder Änderung: Seite laden, Konsole fehlerfrei, kurz rendern.
