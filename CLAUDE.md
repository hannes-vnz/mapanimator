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
  - `src/models3d.js`: 3D-Modelle an der Spitze (`M3D`, eigene WebGL-Custom-Layer `tip-3d`, prozedurale Low-Poly-Meshes je Verkehrsmittel, Schatten, Flugzeug steigt/landet).
  - `src/camera.js`: Kamera-Abschnitte (`CAM`, Modi follow/still/overview/tripod/orbit, Norden/Fahrtrichtung oben, Vorausschau, Auto-Rauszoomen, Überblendung) + Kamera-Presets. Kamera ist reine Funktion der Zeit (`CAM.at(t)`); Keyframes auf pos/zoom/bearing/pitch haben Vorrang.
  - `src/marks.js`: Markierungen (`MARKS`, je Markierung eigene Quellen/Ebenen `mk<id>-*`: Füllung, Kontur mit `line-gradient` zum Nachzeichnen, Glühen, Schatten, Puls, Fokus-Maske, `fill-extrusion`), Suche/Land-Klick/„Länder der Route“ (Natural Earth 50m), Balken in der Timeline. Alte `hlIso`/Features werden beim Laden umgewandelt.
  - `src/templates.js`: Looks (`TEMPLATES`, nur Aussehen) und Tempo (`FEELS`, Ziel-Länge `tplLen` → passt `speedMult` an). Serialisiert `drawStatic`.
  - `src/ui.js`: Oberfläche (Einfach/Profi-Modus über `body.pro`, `.adv` = nur Profi), (Schritte 1–5, Bottom-Sheet mobil, Format-Buttons, Safe-Zone, Theme-Kacheln, Tastenkürzel).
  - Vorschau = Export-Ausschnitt: `sizeStage(null)` skaliert die Karte in Export-Größe in die Bühne (pixelRatio angepasst), `sizeStage(W,H)` = Exportmodus (pixelRatio 1).
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
- Stilwechsel immer über `swapStyle()` (Terrain vorher aus, `diff:false`, `styleBusy`-Promise).

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
1. **Entwicklungs-Setup:** – erledigt (`src/`, `tools/build.py` → `index.html`, `npm test`).
   - `src/` (app.js, style.css, index.html) plus Build-Skript, das wieder eine einzelne `mapanimator.html` erzeugt (Bibliotheken inline).
   - Grund: Die 1-MB-Datei ist zum Editieren unhandlich.
   - Playwright-Smoke-Test: lädt die Seite, wählt alle Themes, rendert 1 s MP4 und prüft auf JS-Fehler.
2. **Verkehrsmittel pro Etappe** (Kamelfamilie) – erledigt (22 Verkehrsmittel inkl. Seilbahn/Sessellift, gruppierte Auswahl, Tempo nach Bildschirm-Strecke `legScreenDur()`, Chips + ½×/2× am Stopp): `MODES`, `wp.mode` („Anreise per“), `legFeatures()`, Layer route-casing/route-line/route-dash:
   - Auto/Rad/Zu Fuß geroutet; Fähre und Flug als Bogen.
   - Linienstil je Etappe: durchgezogen rot mit weißer Kontur, Fähre weiß gestrichelt, Bus orange gestrichelt.
3. **Kamera wie Baldinger:** – erledigt (`camera.js`, Tab 3 „Kamera“ mit Presets + Tempo, Blöcke in der Timeline). Offen: „alle Routen folgen“.
   - Modi „Folgen“ (mit Vorausschau und automatischem Rauszoomen bei langen Etappen), „Still“, „Stativ“, „Orbit“.
   - „Norden oben“ / „Fahrtrichtung oben“.
   - Kamera-Segmente als Blöcke in der Timeline.
4. **Whip-Pan-Übergänge** – erledigt (`whipState()` in camera.js, Vorschau per SVG-Filter, MP4 echt verschmiert; nicht im WebM): schneller Schwenk mit starker Richtungsunschärfe, wie der Ein- und Ausstieg in Kamelfamilie.
5. **Landmarkierungen (GeoLayers-Stil, geolayers.app):** – erledigt (`marks.js`, Tab Ebenen). Offen: Innenglühen (nur Außen-Glow), Seen/Gebirge nur über Nominatim-Suche.
   - Länder, Regionen, Städte, Seen, Gebirge per Suche markieren (Natural Earth / Nominatim-Polygone).
   - Fläche einfärben, Kontur zeichnet sich animiert (Strich „draw-on“), Innenglühen/Schatten, optional 3D-Extrusion.
   - Effekte: einblenden, pulsieren/blinken, Kontur nachzeichnen, Fokus (Rest der Karte abdunkeln).
   - Als Objekte mit Balken in der Timeline (Item-Timeline wie GeoLayers, keine Keyframes nötig).
6. **Labels im Spezifischen:**
   - Eigene Labels an Punkt, Fläche oder Etappe: Stile Pille, Callout mit Linie zum Punkt (Leader-Line), Kreis-Marker + Name, gesperrter Großtext, Icon-/Bild-Marker.
   - Automatische Labels für markierte Länder/Städte, Distanz-Label an Etappen („412 km“).
   - Schrift, Größe, Farbe, Hintergrund, Kontur; Animationen Pop, Fade, Schreibmaschine; Zeitfenster in der Timeline.
7. **Schilder (Signs):**
   - Freie Labels oder Fotokarten auf der Karte.
   - Anzeige: immer, wenn passiert, oder Zeitfenster; optional mit Pause.
   - Größenregler.
8. **Avatar an der Spitze:** rundes Foto mit weißem Ring und Pin. Foto-Spitze gibt es schon, Look angleichen.
9. **Gesperrte Regionslabels** („A L P E N“, „I R A N“) aus Natural Earth geography_regions (Gebirge, Wüsten, Meere).
10. **Szenen:** mehrere Szenen pro Projekt, die nacheinander exportiert werden; Projekt als JSON-Datei.
11. **Formate:** (erledigt: Buttons 9:16/4:5/1:1/16:9 und Safe-Zone in der Topbar)
   - 9:16, 4:5, 1:1, 16:9 als Buttons.
   - Safe-Zone-Overlay für Shorts/TikTok-UI (nur Vorschau).
12. **Skript-API** für automatisches Rendern, wie im Tool `~/Kartenvideos/reliefkarte/reliefkarte.html`:
    - `window.MA.load(plan)` / `render()`.
    - Plan-JSON mit Keyframes, Layern und Punkten.
    - Export als ein Bundle (MP4 + Positionen).
13. 3D-Modelle an der Spitze – erledigt als prozedurale Modelle (`models3d.js`); glTF-Import wäre die Ausbaustufe.

## Regeln
- Single-File-Auslieferung behalten (läuft offline per Doppelklick bzw. GitHub Pages).
- Keine API-Keys im Code; MapTiler-Key bleibt optional im Browser.
- Attribution (OSM, OpenFreeMap, Natural Earth, Mapzen/AWS) im Kartenrand lassen.
- Nach jeder Änderung: Seite laden, Konsole fehlerfrei, kurz rendern.
