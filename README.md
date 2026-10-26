# Kartenanimator

Browser-based map animation tool for travel videos: draw routes on a map, animate them with a keyframe timeline and export the result as video for editing in DaVinci Resolve. Think of it as a free, self-built alternative to tools like GeoLayers.

**[Live demo](https://USERNAME.github.io/kartenanimator/)** · Single HTML file, no build step, no framework

<!-- ![Screenshot](screenshots/preview.png) -->

## Features

- Multiple routes with photo badges
- After-Effects-style keyframe timeline
- Routing via OSRM, POIs from OpenStreetMap (Overpass API), place search via Nominatim
- 3D terrain, several map themes
- WebM export up to 4K
- German / English UI

## Run locally

Open `index.html` in a modern browser, or serve the folder:

```bash
python -m http.server 8000
```

An optional [MapTiler](https://www.maptiler.com/) key can be entered in the app to enable satellite imagery and vector tiles. Without a key the app falls back to free sources. The key stays in your browser. It is not written into saved project files (`.json`), so projects can be shared safely.

## Built with

[MapLibre GL JS](https://maplibre.org/) 4.7.1 (BSD-3-Clause, inlined in `index.html`), OpenStreetMap, OpenFreeMap, MapTiler, Esri World Imagery, OSRM, Overpass API.

## Data & attribution

Map data © OpenStreetMap contributors. The app shows the required attribution in the map corner. Exported videos contain only the map canvas, so please credit the map sources (© OpenStreetMap contributors, © OpenFreeMap, and MapTiler or Esri if you use their layers) in your video description. Please also respect the usage policies of the services listed above (e.g. Nominatim, Overpass).
