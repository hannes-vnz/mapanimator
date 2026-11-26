# Kartenanimator

Browser-based map animation tool for travel videos: draw routes on a map, animate them with a keyframe timeline and export the result as video for editing in DaVinci Resolve. Think of it as a free, self-built alternative to tools like GeoLayers.

**[Live demo][https://hannes-vnz.github.io/mapanimator/]** · Single HTML file, no build step, no framework

<!-- ![Screenshot](screenshots/preview.png) -->

## Features

- Multiple routes with photo badges
- After-Effects-style keyframe timeline
- Routing via OSRM, POIs from OpenStreetMap (Overpass API), place search via Nominatim
- 3D terrain, several map themes
- Frame-exact MP4 export (WebCodecs) up to 4K, 9:16 for Shorts, optional motion blur; realtime WebM as fallback
- Relief theme (multidirectional hillshade, 3D terrain) and Atlas theme (flat world map, country shades)
- Country highlight (Natural Earth), km/day counter overlay, snap-zoom camera preset
- German / English UI

## Run locally

Open `index.html` in a modern browser, or serve the folder:

```bash
python3 -m http.server 8000
```

## Development

Source lives in `src/` (`index.html`, `style.css`, `app.js`, `vendor/`). Open http://localhost:8000/src/ while editing, then build the single-file `index.html`:

```bash
npm install      # once, for the Playwright smoke test
npm test         # build + smoke test (all themes, 1 s MP4, no JS errors)
```

An optional [MapTiler](https://www.maptiler.com/) key can be entered in the app to enable satellite imagery and vector tiles. Without a key the app falls back to free sources. The key stays in your browser. It is not written into saved project files (`.json`), so projects can be shared safely.

## Built with

[MapLibre GL JS](https://maplibre.org/) 5.24.1 (BSD-3-Clause, inlined in `index.html`), mp4-muxer 5.2.1 (MIT, inlined), Natural Earth (public domain), OpenStreetMap, OpenFreeMap, MapTiler, Esri World Imagery, OSRM, Overpass API.

## Script API (automatic rendering)

`window.MA` (alias `window.RK`, compatible with plans from `reliefkarte.html`):

```js
await MA.load(plan);            // apply a plan (replaces the project)
await MA.render({ bundle: true }); // download <name>_bundle.json (MP4 base64 + screen positions)
await MA.still(2.5);            // JPEG data URL of one frame
```

Plan fields: `name, w, h, fps, dur, look, style, settings, route{stops[{name, c:[lon,lat], mode}]}, routes, camera (preset id), shots, keys (keyframes {t,c,z,b,p,e}), tempo{len,feel}, highlight, hlIn, marks, layers, labels, signs, points, scenes, whip`.
Open `index.html?plan=<url>` to load a plan directly.

Render without clicking (uses installed Chrome via Playwright):

```bash
node tools/render.mjs plans.json --out renders            # one plan, an array, or {P:{id:plan}, PTS:{...}}
node tools/render.mjs ~/Kartenvideos/reliefkarte/ab_plans.json --only m1,m3
```

Writes `<name>.mp4` and `<name>_pos.json` (screen position of every `points` entry and every stop, per frame).

## Data & attribution

Map data © OpenStreetMap contributors. The app shows the required attribution in the map corner. Exported videos contain only the map canvas, so please credit the map sources (© OpenStreetMap contributors, © OpenFreeMap, and MapTiler or Esri if you use their layers) in your video description. Please also respect the usage policies of the services listed above (e.g. Nominatim, Overpass).
