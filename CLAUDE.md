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
  - `src/labels.js`: Labels (`LABELS`, aufs Overlay `#ovl` gezeichnet → automatisch im MP4; Stile pill/callout/marker/spaced/plain, Animationen pop/fade/type, Balken in der Timeline; Namen aus Markierungen, Distanz-Labels je Etappe).
  - `src/signs.js`: Schilder & Fotokarten (`SIGNS`; Polaroid an Schnur, Typen pin/tent/hotel/flag/star/view, Anzeige pass/passHide/always/window, EXIF-GPS-Parser, „Hier anhalten“ → `pausesFor()` teilt Etappen in `prepareAnim`).
  - Stopp-Pins ohne Foto werden automatisch als Marker gezeichnet (`buildPinImage`, Stil `marker`).
  - `src/regions.js`: Regionslabels (`REGIONS`, Natural Earth 50m regions + marine, NAME_DE, Ebenen `rg-0…4` nach MIN_LABEL-Rang; wichtigste zuletzt = Vorrang).
  - Kameramodus `earth` (Erdzoom, `evalEarth` in camera.js): All ↔ Straße in einem Zug, Globus dreht ein (`swing`), Drehung (`spin`), Neigung erst am Ende; Start-Globus skaliert mit dem Format. Shots `s_earthin`/`s_earthout`, Look `earthsat`. `introHold`/`outroHold` verlängern erste/letzte Pause, damit die Linie wartet.
  - `src/overlays.js`: Info-Overlays (`OVL`) aufs `#ovl`: Höhenprofil der Route 1 (Terrarium-DEM direkt abgetastet, Flug/Fähre ohne Gelände, Höhenmeter mit Hysterese, Gipfel, Stopps) und Mini-Karte (Globus orthografisch oder Weltkarte, Ausschnitt-Rahmen, Position pulsiert, blendet bei weitem Zoom aus). `waitIdle` wartet auf die Daten. Shot „Rad-Etappe“ (`s_bike`) nutzt beides.
  - `src/intro.js`: Intro-Titelkarten (`INTRO`, Stile stamp/boarding/coords/spaced/chapter) aufs Overlay; „Linie bis Intro-Ende warten“ setzt `introHold`.
  - Ortsmarkierungs-Stile `PIN_ART` in app.js (stamp, callout, flag, sticker, neon, rank – Anker Mitte unten). Länderzähler (`cnt*`) in overlays.js. Shots `s_countries` (Ländersammlung) und `s_countdown` (Rang-Pins, Tempo je Ortsanzahl). Achtung: `cc*`-IDs sind die Kartenfarben.
  - `src/assets.js`: Asset-Studio (`ASSETS`, Tab 6 „Assets“, eigene Bühne `#assetStage` ohne Karte, `body.assets-mode`, Event `ma:tab`): animierte Einblendungen im THE-RACE-Look (hexflag mit Lametta, rchallenge, rules mit VERBOTEN/ERLAUBT, money, clock, info, medal, stamp, flag, challenge-Banner, flags). Export als PNG-Sequenz mit Transparenz (ZIP) oder Greenscreen-MP4 (`exportAsset`); mehrere Länder per Komma → je Land ein Asset. Im Projekt unter `assets`. Reisepass-Sequenz nach THE RACE Folge 09 (5:18: „Neues Land erreicht“, Konfetti in Teamfarbe, Länder-Abzeichen mit Motiv aus `COUNTRY_ART`, Pass mit Teamname + alten Tintenstempeln, Abzeichen wird Tinte), `teamcard` (Teamfoto, Budget, 2 Werte, Flaggen-Plätze), `chapter` („Was bisher geschah“). In der Vorschau ziehen = verschieben (`dx`/`dy`), Mausrad = Größe; `drawAsset` wendet das in Vorschau und Export an. Flaggen von flagcdn.com, Emoji → weiße Piktogramme (`picto`). Standard-Pin = `tag` (Kara & Nate).
  - Asset-Studio-Typen zusätzlich: `kmintro` (Zählwerk auf eigener Ebene, Ziffern springen ein, passt sich der Bildbreite an), aus dem Niko-Video `daystamp` (Briefmarke + getöntes Wahrzeichen), `countdown`, `flapboard` (Split-Flap), `itempop`, `nametag`. Pass-Intro (Cutout) wurde wieder entfernt.
  - Rad-/Reise-Assets: `elevation` (eigene Höhen oder Route über `OVL.profile()`), `miniglobe` (Land oder „Breite, Länge“, Bogen A→B, Land aus ne_110m_land), `daystats`, `weather`, `speedo`, `gradesign`, `progress`, `signpost`, `lodging`.
  - `src/davinci.js`: DaVinci-Export. 6 bearbeitbare Fusion-Titel (MacroOperator aus Background+Maske, Text+, Merge, Transform mit Keyframes; Regler per InstanceInput) und Grafik-Assets als Titel mit Loader (PNG-Sequenz, Pfad `Templates:Edit/Titles/Mapanimator/<name>/`). Schreibt per File System Access direkt in den Fusion-Ordner „Templates“, sonst ZIP/.drfx. Prüfen: `fuscript -l lua` mit `bmd.readfile(pfad)` (geht offline).
  - Einreisestempel nach echten Vorbildern (`REAL`, `SCHENGEN`, `realStamp` in assets.js): Form, Tinte, Landessprache, Grenzübergang, Datum, Verkehrsmittel-Piktogramm.
  - `src/scenes.js`: Szenen (`SCENES`; Leiste über der Karte; Zustand je Szene = `serializeProject()`, Laden über `loadProject()` → Event `ma:loaded`; Projekt-JSON v6 `{scenes:[{name,data}], active}`, alte Dateien = 1 Szene). MP4 „Alle Szenen in einem Video“.
  - `src/api.js`: Skript-API `window.MA` (= `window.RK`-kompatibel): `load(plan)`, `render({bundle|base64})`, `still(t)`; Plan-Format siehe Kopfkommentar/README. `exportMP4(opts)` in app.js ist die gemeinsame Render-Funktion. `tools/render.mjs` rendert Pläne headless.
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
- Projekt-Speichern: `SETTING_IDS`. Neue Einstellungen dort eintragen. Module, die nach dem Laden etwas synchronisieren müssen, hören auf `ma:loaded`.
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

## Videoanalyse (26.11.2026)
- `docs/analyse-reisevideos.md`: Kara & Nate „Overlanding Iceland“ + „THE RACE S3E01“ – Kartentypen, Schnitt, Format, Ideen, Formate ohne vor der Kamera zu sprechen.
- Daraus: Themes `pastell`, `nacht` (mit `streets`), Globus (`projGlobe`, `style.projection`), Pin-Stil `tag`, Übergang Crash-Zoom (`whipDir: "zoom"`), Looks `pastellvlog`/`racegps`/`raceglobe`/`raceborder`, Presets `vloginsert`/`tracker`/`globeflight`.
- Komplette Shots (`CAM.shots`, `applyShot`): Island-Etappe, Globus-Flug, Routen-Reveal, Split-Kachel, Team-Tracker, Positions-Recap – nach gemessenem Ablauf. Bausteine: `legFocus: last` (nur letzte Etappe), `fxClouds` (Wolken-Einflug), Shot-Parameter `drift`/`zoomDrift`/`zoomAbs`/`fitSoFar`/`zoomFromOv`.
- Race-Shots belebt: Wolkenschicht (`cloudLayer`, NASA-Textur über jsDelivr als Image-Source), Sternenhimmel (`fxStars`, `CAM.drawBackdrop` – auch im MP4/`MA.still`), Vignette (`fxVignette`), Neon-Kern `route-core`, Drift/Zoom-/Neigungs-Drift (`drift`/`zoomDrift`/`pitchDrift`) jetzt in allen Kameramodi, Start-/Zielpuls größer.
- Werkzeug: `tools/video-analyse.sh <video>` (Schnitte, Kontaktbögen, Whisper-Transkript, PANNs-Tonklassen + Beats via uv).

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
6. **Labels im Spezifischen:** – erledigt (`labels.js`, Tab Ebenen). Offen: Icon-/Bild-Marker, Labels per Drag auf der Karte verschieben.
   - Eigene Labels an Punkt, Fläche oder Etappe: Stile Pille, Callout mit Linie zum Punkt (Leader-Line), Kreis-Marker + Name, gesperrter Großtext, Icon-/Bild-Marker.
   - Automatische Labels für markierte Länder/Städte, Distanz-Label an Etappen („412 km“).
   - Schrift, Größe, Farbe, Hintergrund, Kontur; Animationen Pop, Fade, Schreibmaschine; Zeitfenster in der Timeline.
7. **Schilder (Signs):** – erledigt (`signs.js`, Tab Ebenen). Offen: Schilder auf der Karte ziehen, HEIC direkt.
   - Freie Labels oder Fotokarten auf der Karte.
   - Anzeige: immer, wenn passiert, oder Zeitfenster; optional mit Pause.
   - Größenregler.
8. **Avatar an der Spitze:** – erledigt (Spitzen-Stil `avatar`, `makeAvatarIcon()`; Foto wählen schaltet automatisch auf Avatar; ohne Foto → Marker). rundes Foto mit weißem Ring und Pin. Foto-Spitze gibt es schon, Look angleichen.
9. **Gesperrte Regionslabels** – erledigt (`regions.js`, Look-Tab; in den Looks Relief/Abenteuer/Vlog-Atlas/Erklär-Atlas an): („A L P E N“, „I R A N“) aus Natural Earth geography_regions (Gebirge, Wüsten, Meere).
10. **Szenen:** – erledigt (`scenes.js`): mehrere Szenen pro Projekt, die nacheinander exportiert werden; Projekt als JSON-Datei.
11. **Formate:** (erledigt: Buttons 9:16/4:5/1:1/16:9 und Safe-Zone in der Topbar)
   - 9:16, 4:5, 1:1, 16:9 als Buttons.
   - Safe-Zone-Overlay für Shorts/TikTok-UI (nur Vorschau).
12. **Skript-API** – erledigt (`api.js`, `tools/render.mjs`; Reliefkarte-Pläne laufen unverändert, Animation auch ohne Route bei fester Dauer) für automatisches Rendern, wie im Tool `~/Kartenvideos/reliefkarte/reliefkarte.html`:
    - `window.MA.load(plan)` / `render()`.
    - Plan-JSON mit Keyframes, Layern und Punkten.
    - Export als ein Bundle (MP4 + Positionen).
13. 3D-Modelle an der Spitze – erledigt als prozedurale Modelle (`models3d.js`); glTF-Import wäre die Ausbaustufe.

## Regeln
- Single-File-Auslieferung behalten (läuft offline per Doppelklick bzw. GitHub Pages).
- Keine API-Keys im Code; MapTiler-Key bleibt optional im Browser.
- Attribution (OSM, OpenFreeMap, Natural Earth, Mapzen/AWS) im Kartenrand lassen.
- Nach jeder Änderung: Seite laden, Konsole fehlerfrei, kurz rendern.
