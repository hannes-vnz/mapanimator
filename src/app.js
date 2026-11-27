"use strict";
/* =========================================================
   Kartenanimator v4
   AE-Timeline · Linien-Speed-Keyframes · Scrubbing · 3D-Terrain
   ========================================================= */

window.addEventListener("error", e => {
  const s = document.getElementById("status");
  if (s) s.textContent = "Fehler: " + (e.message || "unbekannt") + (e.lineno ? " (Zeile " + e.lineno + ")" : "");
});
window.addEventListener("unhandledrejection", e => {
  const s = document.getElementById("status");
  if (s) s.textContent = "Fehler: " + (e.reason && e.reason.message ? e.reason.message : e.reason);
});
if (typeof maplibregl === "undefined") {
  document.getElementById("status").textContent = "Interner Fehler: eingebettete Kartenbibliothek nicht gefunden.";
  throw new Error("maplibre-gl nicht geladen");
}

const FONTS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
const PALETTE = ["#e2504c", "#2f6fde", "#e7772d", "#7c4fb5", "#2ea86c", "#d8a316"];
/* Früh deklarieren – buildBaseStyle läuft schon bei der Map-Erzeugung */
let customColors = null;      // {land, water, boundary, label}
let features = [];            // {id, name, geometry, color, appearT, op}
let featCounter = 0;
let pois = [];                // {name, cat, lng, lat}

/* ---------- Sprache (DE/EN) ---------- */
let lang = "de";
const EN = {
  // Sektionen
  "Routen & Orte":"Routes & Places","Features (Regionen & GeoJSON)":"Features (regions & GeoJSON)",
  "Kartendetails":"Map details","POIs entlang der Route":"POIs along the route",
  "Route & Kamera":"Route & camera","Stil":"Style","Farben (Style-Editor)":"Colors (style editor)",
  "Kamera-Presets":"Camera presets","Wolkenschicht (NASA)":"Cloud layer (NASA)","Sternenhimmel":"Starfield","Vignette":"Vignette","Nur letzte Etappe animieren":"Animate last leg only","Wolken-Einflug":"Fly in through clouds","Komplette Shots":"Complete shots","Etikett (Ortsname)":"Tag (place name)","Globus-Ansicht":"Globe view","Pastell-Topo":"Pastel topo","Nacht-GPS":"Night GPS","Lade Karte vor …":"Preloading map …","Ortsnamen":"Place names",
  "Fotos werden an ihren Aufnahmeort gesetzt (GPS aus dem Foto) und poppen als Polaroid auf, wenn die Linie vorbeikommt. Ohne GPS: zwischen zeitlich benachbarten Fotos oder per Klick. iPhone-Fotos (HEIC) vorher als JPEG exportieren, mit Ortsangabe.":"Photos are placed where they were taken (GPS from the photo) and pop up as instant prints when the line passes. Without GPS: between photos taken before/after, or by click. Export iPhone photos (HEIC) as JPEG with location first.",
  "Eigene Beschriftungen auf der Karte: Pille, Callout mit Linie zum Punkt, Marker mit Name, gesperrter Großtext („I T A L I E N“). Mit Pop-, Fade- oder Schreibmaschinen-Animation und eigenem Zeitfenster in der Timeline.":"Your own labels on the map: pill, callout with a line to the point, marker with name, spaced title (“I T A L Y”). With pop, fade or typewriter animation and their own time window in the timeline.","👆 Land anklicken":"👆 Click country","🧭 Länder der Route":"🧭 Route countries",
  "Hebt Länder, Regionen, Städte oder Seen hervor – die Kontur zeichnet sich, die Fläche leuchtet auf. „Länder der Route“ markiert alle durchquerten Länder, jedes erscheint, wenn die Route es erreicht. Jede Markierung ist ein Balken in der Timeline.":"Highlights countries, regions, cities or lakes – the outline draws itself, the area lights up. “Route countries” highlights every country the route crosses, each appearing when the route reaches it. Each highlight is a bar in the timeline.","Looks":"Looks","Kamera-Abschnitte":"Camera shots","Keyframe-Kamera (Profi)":"Keyframe camera (pro)","Abenteuer (Vintage)":"Adventure (vintage)",
  "Ein Look setzt nur das Aussehen: Kartenstil, Linie, Spitze, Pins. Kamera und Tempo stellst du im Tab Kamera ein.":"A look only sets the appearance: map style, line, tip, pins. Set camera and pace in the Camera tab.",
  "Jeder Abschnitt gilt bis zum nächsten; Übergänge werden weich überblendet. Blöcke in der Timeline anklicken oder an der Kante ziehen.":"Each shot lasts until the next; transitions blend smoothly. Click blocks in the timeline or drag their edge.","Größe Spitze / 3D-Modell":"Tip / 3D model size","Look":"Look","Gefühl":"Feel","Profi":"Pro",
  "Eine Vorlage setzt Kartenstil, Linie, Spitze, Kamera, Tempo und Format. Deine Orte bleiben. Danach alles frei anpassbar.":"A template sets map style, line, tip, camera, pace and format. Your places stay. Adjust anything afterwards.",
  "Länge passt das Tempo automatisch an, auch wenn du Orte ergänzt. Pro Etappe: Verkehrsmittel und ½×/2× direkt am Stopp.":"Length adjusts the pace automatically, even when you add places. Per leg: transport and ½×/2× right at the stop.","Projekt":"Project","Export":"Export",
  "Reise-Animationen im Vlog-Stil · rendert lokal im Browser":"Vlog-style travel animations · renders locally in your browser",
  // Buttons
  "Suchen":"Search","+ Stopp manuell (Koordinaten)":"+ Add stop manually (coordinates)",
  "GPX-Track importieren":"Import GPX track","GeoJSON importieren":"Import GeoJSON",
  "POIs laden":"Load POIs","Leeren":"Clear","＋ Route hinzufügen":"＋ Add route",
  "Speichern":"Save","Laden":"Load","● Aufnehmen & Abspielen":"● Record & play",
  "▶ Vorschau":"▶ Preview","Zurücksetzen":"Reset","Auf Theme zurücksetzen":"Reset to theme",
  "＋ Kamera-KF am Playhead":"＋ Camera KF at playhead","Linie → Keyframes":"Line → keyframes",
  "Wählen":"Choose","Foto ✓":"Photo ✓","Foto hinzufügen":"Add photo","Foto ✓ (ändern)":"Photo ✓ (change)",
  "Fit":"Fit","✕ löschen":"✕ delete",
  // Labels
  "Linienfarbe":"Line color","Weiße Kontur":"White outline","Anreise per":"Arrive by","Standard":"Default",
  "Auto":"Car","Laufen":"Running","Reiten":"Horse riding","Ski":"Skiing","Wohnwagen":"Caravan","LKW":"Truck","Seilbahn":"Cable car","Sessellift":"Chairlift","Kreuzfahrt":"Cruise ship","Kajak":"Kayak","Ballon":"Hot-air balloon","Gleitschirm":"Paraglider","Zu Fuß":"On foot","Land":"Land","Schiene & Seil":"Rail & cable","Wasser":"Water","Luft":"Air","Alle Verkehrsmittel":"All transports","Camper":"Camper van","Motorrad":"Motorbike","Segelboot":"Sailboat","Heli":"Helicopter","Tempo dieser Etappe":"Speed of this leg",
  "3D-Modell (Verkehrsmittel)":"3D model (transport)","Avatar (rundes Foto)":"Avatar (round photo)","Foto/Avatar Spitze":"Tip photo / avatar","Name unter Avatar":"Name below avatar","Symbol (Verkehrsmittel)":"Icon (transport)","Fahrrad":"Bicycle","Zu Fuß":"On foot","Bus":"Bus","Zug":"Train","Fähre":"Ferry","Flug":"Flight",
  "Standard-Fortbewegung":"Default travel mode","Linienbreite":"Line width","Linienstil":"Line style","Fortbewegung":"Travel mode",
  "Sekunden pro Etappe":"Seconds per leg","Pause am Stopp (s)":"Pause at stop (s)",
  "Konstante Geschwindigkeit":"Constant speed","Tempo nach Bildschirm-Strecke":"Pace by on-screen distance","Kamera":"Camera","Kamera-Zoom":"Camera zoom",
  "Zoom-In an Stopps":"Zoom in at stops","Neigung (Pitch)":"Tilt (pitch)","Kamera-Glättung":"Camera smoothing",
  "Rotation (°/s)":"Rotation (°/s)","Linien-Beschleunigung":"Line acceleration","Tempo ×":"Speed ×",
  "Übersicht am Ende":"Overview at end","Karten-Stil":"Map style","Pin-Stil":"Pin style","Linien-Glow":"Line glow",
  "Linienspitze":"Line tip","Foto/Logo Spitze":"Tip photo/logo","Name Spitze":"Tip name",
  "Pin-Einblendung":"Pin reveal","Pin-Größe":"Pin size","Spitzen-Pin-Größe":"Tip pin size",
  "Label-Größe (px)":"Label size (px)","Schrift (Pins)":"Font (pins)","MapTiler-Key (optional)":"MapTiler key (optional)",
  "Land":"Land","Wasser":"Water","Grenzen":"Borders","Labels":"Labels","Vorschlag":"Preset",
  "3D-Terrain":"3D terrain","Terrain-Überhöhung":"Terrain exaggeration","Auflösung":"Resolution",
  "Bundesländer-Grenzen":"State borders","Hauptstraßen":"Major roads","Bahnlinien":"Railways",
  "Wälder":"Forests","Siedlungsflächen":"Urban areas","Parks":"Parks","Dörfer anzeigen":"Show villages",
  "Gipfel":"Peaks","Burgen & Schlösser":"Castles & palaces","Bahnhöfe":"Train stations",
  "Sehenswürdigkeiten":"Sights","Korridor (km)":"Corridor (km)","Dauer (s)":"Duration (s)",
  // Optionen
  "Flug (Bogen)":"Flight (arc)","Auto (Straße)":"Car (roads)","Fahrrad (Straße)":"Bicycle (roads)","Zu Fuß (Wege)":"On foot (paths)",
  "Gestrichelt":"Dashed","Durchgezogen":"Solid","Gepunktet":"Dotted",
  "Linear (konstant)":"Linear (constant)","Quadratisch (weich)":"Quadratic (soft)","Kubisch (sehr weich)":"Cubic (very soft)",
  "Schnell starten → ausrollen":"Fast start → ease out","Langsam anlaufen → schnell":"Slow start → fast",
  "Folgt der Linie":"Follows the line","Feste Übersicht":"Fixed overview",
  "Vlog Hell (Creme)":"Vlog light (cream)","Race Dunkel":"Race dark","Satellit":"Satellite","Minimal Flach":"Minimal flat",
  "Foto-Pin (weiß)":"Photo pin (white)","Foto-Badge + Name":"Photo badge + name","Farbpunkt":"Color dot",
  "Wie Stopp-Pins (Foto/Badge)":"Like stop pins (photo/badge)","Pin + Punkt (wie Google Maps)":"Pin + dot (Google Maps style)",
  "Nur Punkt":"Dot only","Aus":"Off",
  "Pop (Overshoot)":"Pop (overshoot)","Sanft":"Soft","Sofort":"Instant",
  "System Sans":"System sans","Display (fett)":"Display (bold)",
  "– wählen –":"– choose –","Vlog Standard (folgend)":"Vlog standard (following)","Cinematic Schwenk":"Cinematic pan",
  "Drohnenflug":"Drone flight","Übersicht + Orbit":"Overview + orbit",
  // Timeline
  "Linie %":"Line %","Position":"Position","Zoom":"Zoom","Rotation":"Rotation","Neigung":"Tilt",
  "Glow":"Glow","Spitzen-Größe":"Tip size",
  "Ziehen in Spur/Lineal = Scrubben · ＋ oder Doppelklick in Spur = Keyframe · Raute ziehen = Zeit · Doppelklick auf Raute / Entf = löschen · Pfeiltasten = feinjustieren":
    "Drag in track/ruler = scrub · ＋ or double-click track = keyframe · drag diamond = retime · double-click diamond / Del = delete · arrow keys = nudge",
  "Kein Keyframe ausgewählt.":"No keyframe selected.","Zeit":"Time","Wert":"Value","Breite":"Lat","Länge":"Lng",
  "an Linie":"on line","Easing":"Easing","linear":"linear","quadratisch":"quadratic","kubisch (sanft)":"cubic (soft)",
  "ausklingend":"ease out","anlaufend":"ease in","folgt":"follows","Übersicht":"overview","KF":"KF",
  // Platzhalter
  "Ort suchen (z.B. Reykjavík) …":"Search a place (e.g. Reykjavík) …",
  "Land/Region suchen (z.B. Bayern) …":"Search country/region (e.g. Bavaria) …",
  "z.B. HANNES":"e.g. HANNES","für HQ-Tiles":"for HQ tiles","auto":"auto","immer":"always",
  "Name":"Name","Ab (s)":"From (s)","Stoppfarbe":"Stop color","Entfernen":"Remove","Route entfernen":"Remove route",
  "Name der Route:":"Route name:",
  // Hinweise (lang)
  "Presets erzeugen Keyframes in der Timeline unten – dort frei anpassbar. Ohne Keyframes gelten die Regler oben.":
    "Presets create keyframes in the timeline below – edit them freely there. Without keyframes the sliders above apply.",
  "Speichert Orte, Fotos, Stil, Keyframes als JSON-Datei.":"Saves places, photos, style and keyframes as a JSON file.",
  "Paletten anklicken oder Farben einzeln setzen – wirkt auf jeden Karten-Stil.":
    "Click a palette or set colors individually – applies to every map style.",
  "Features erscheinen als Flächen/Linien unter der Route. „Ab (s)“ leer = immer sichtbar, sonst blendet das Feature zu diesem Zeitpunkt animiert ein (Race-Stil: Land leuchtet auf).":
    "Features appear as areas/lines below the route. Leave “From (s)” empty for always visible, or set a time to fade the feature in (Race style: country lights up).",
  "Lädt benannte Orte aus OpenStreetMap im Umkreis der Route und markiert sie mit Icons.":
    "Loads named places from OpenStreetMap around the route and marks them with icons.",
  // Status
  "Karte lädt …":"Loading map …","Bereit. Orte suchen oder GPX laden.":"Ready. Search places or load a GPX.",
  "Aktualisiert.":"Updated.","Fertig.":"Done.","Vorschau läuft …":"Preview running …",
  "● Aufnahme läuft …":"● Recording …","Zurückgesetzt.":"Reset.","Projekt gespeichert.":"Project saved.",
  "Projekt geladen.":"Project loaded.","Nichts gefunden.":"Nothing found.",
  "Mindestens zwei Orte (oder ein GPX-Track) nötig.":"At least two places (or a GPX track) required.",
  "Erst eine Route anlegen.":"Create a route first.","Mindestens eine POI-Kategorie wählen.":"Select at least one POI category.",
  "Export gespeichert (map-animation.webm).":"Export saved (map-animation.webm)."
};
function tr(s){ return lang === "de" ? s : (EN[s] || s); }
function applyLang(){
  lang = document.getElementById("uiLang").value || "de";
  document.querySelectorAll("#langSel .lbtn").forEach(b => b.classList.toggle("active", b.dataset.lang === lang));
  const sel = ".i18n, #sidebar .colorrow span, #sidebar h2, #sidebar .setting > label, " +
    "#sidebar button:not(.lbtn):not(.del):not(.kfadd), #sidebar option, #sidebar .hint, " +
    "#sidebar label.photo-label, #tlHead label, #tlHead .hint, #tlHead button.ghost";
  document.querySelectorAll(sel).forEach(el => {
    const tn = [...el.childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
    if (!tn) return;
    if (!el.dataset.de) el.dataset.de = tn.textContent.trim().replace(/\s+/g, " ");
    tn.textContent = lang === "de" ? el.dataset.de : (EN[el.dataset.de] || el.dataset.de);
  });
  ["searchInput", "featInput", "tipLabel", "totalDur", "mtKey"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (!el.dataset.de) el.dataset.de = el.placeholder || "";
    el.placeholder = lang === "de" ? el.dataset.de : (EN[el.dataset.de] || el.dataset.de);
  });
  renderTimeline(); renderInspector(); renderWpList(); renderFeatList(); renderRoutes(); syncRouteInputs();
}
document.querySelectorAll("#langSel .lbtn").forEach(b => b.addEventListener("click", () => {
  document.getElementById("uiLang").value = b.dataset.lang;
  applyLang();
}));

const FONT_STACKS = {
  system: "system-ui, sans-serif",
  rounded: "'Trebuchet MS', 'Arial Rounded MT Bold', sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  display: "Impact, 'Arial Black', sans-serif",
  mono: "'Courier New', monospace"
};

/* ---------- Themes ---------- */
const THEMES = {
  atlas: {
    atlas: true, bg: "#5b78c2", water: "#5b78c2",
    shades: ["#f3d2bf", "#e7b9a3", "#d9a390", "#c8907f", "#f6dfd0", "#b98676", "#e2c1ae"],
    boundary: { color: "#fbe9de", width: 0.8, dash: null, opacity: 0.55 },
    country: { color: "#ffffff", halo: "rgba(60,40,40,0.25)", upper: true, spacing: 0.35 },
    city: { color: "#ffffff", halo: "rgba(60,40,40,0.3)" },
    detail: { states: "#f1d6c7", road: "#c7a08d", rail: "#b48c7c", wood: "#d9b6a2", urban: "#d6ac98", park: "#dcb9a5" },
    defaultLine: "#e3262b", glowDefault: false, casing: true
  },
  relief: {
    relief: true, bg: "#97a3b9", water: "#e6ebf3",
    hills: { shadow: "#121d38", highlight: "#ffffff", accent: "#46557a", ex: 1 },
    boundary: { color: "#ffffff", width: 1.1, dash: null, opacity: 0.55 },
    country: { color: "#1f2a44", halo: "#e6ebf3", upper: true, spacing: 0.2 },
    city: { color: "#1f2a44", halo: "#e6ebf3" },
    detail: { states: "#c9d1e0", road: "#46557a", rail: "#5b6788", wood: "#8e9bb3", urban: "#aab4c8", park: "#8fa0b8" },
    defaultLine: "#dc2828", glowDefault: false
  },
  hell: {
    bg: "#f3eee5", water: "#c6dbe8", ice: "#fcfcfa", iceOp: 0.85,
    hills: { shadow: "#b3a494", highlight: "#ffffff", accent: "#d9cdbd", ex: 0.35 },
    boundary: { color: "#d3c4b6", width: 1, dash: [3, 2] },
    country: { color: "#6d2e38", halo: "#f3eee5", upper: false, spacing: 0.06 },
    city: { color: "#6d2e38", halo: "#f3eee5" },
    detail: { states: "#c4b4a2", road: "#dfd3c0", rail: "#b9aa97", wood: "#e3e6d1", urban: "#eae1d0", park: "#dde5cc" },
    defaultLine: "#6d2e38", glowDefault: false
  },
  dunkel: {
    bg: "#1d1e22", water: "#303a46", ice: "#2e3036", iceOp: 0.6,
    hills: { shadow: "#0a0a0c", highlight: "#4a505a", accent: "#2a2c33", ex: 0.5 },
    boundary: { color: "#a03844", width: 1.6, dash: null },
    country: { color: "#e8e9ee", halo: "#1d1e22", upper: true, spacing: 0.25 },
    city: { color: "#c6c9d1", halo: "#1d1e22" },
    detail: { states: "#6b3a45", road: "#34383f", rail: "#4a4e57", wood: "#22262a", urban: "#272a30", park: "#243029" },
    defaultLine: "#f2506e", glowDefault: true
  },
  satellit: {
    raster: true,
    boundary: { color: "#ffffff", width: 0.8, dash: null, opacity: 0.5 },
    country: { color: "#ffffff", halo: "#000000", upper: true, spacing: 0.2 },
    city: { color: "#ffffff", halo: "#000000" },
    detail: { states: "#ffffff", road: "#ffffff", rail: "#dddddd", wood: "#ffffff", urban: "#ffffff", park: "#ffffff" },
    defaultLine: "#ffd23f", glowDefault: true
  },
  papier: {       // Papier-Cutout: Land/Wasser als Papier mit Textur, Küsten als Schnittkanten mit Schatten, Wälder als aufgeklebte Stücke
    paper: true, bg: "#f1e4c8", water: "#8fc3df", ice: "#fbf6ec", iceOp: 1,
    hills: null,
    boundary: { color: "#a0826d", width: 1.6, dash: [2, 2], opacity: 0.9 },
    country: { color: "#5b4636", halo: "#f6ecd6", upper: true, spacing: 0.15 },
    city: { color: "#5b4636", halo: "#f6ecd6" },
    detail: { states: "#c9b391", road: "#e8d6b4", rail: "#b49d7c", wood: "#9cc48a", urban: "#ead9b8", park: "#b6d39a" },
    defaultLine: "#e0533c", glowDefault: false
  },
  pastell: {      // Reise-Vlog-Look (Kara & Nate): helle Topo-Karte, Relief, dünne dunkle Linie
    bg: "#ece9e3", water: "#bcd5e6", ice: "#f8f8f6", iceOp: 0.9,
    hills: { shadow: "#a9a196", highlight: "#ffffff", accent: "#d9d2c7", ex: 0.55 },
    boundary: { color: "#c4bcb1", width: 0.8, dash: null, opacity: 0.7 },
    country: { color: "#5b5f66", halo: "#ece9e3", upper: false, spacing: 0.05 },
    city: { color: "#6b6f76", halo: "#ece9e3" },
    detail: { states: "#cfc7bc", road: "#ffffff", rail: "#bdb5aa", wood: "#dfe3d3", urban: "#e3ded6", park: "#dbe3cf" },
    defaultLine: "#2b2d31", glowDefault: false
  },
  nacht: {        // The-Race-Look: dunkler Stadtplan mit allen Straßen, Neon-Linien
    bg: "#131519", water: "#1c2531", ice: null, hills: null, streets: true,
    boundary: { color: "#3a3f48", width: 1, dash: null },
    country: { color: "#8b919c", halo: "#131519", upper: true, spacing: 0.3 },
    city: { color: "#7d838e", halo: "#131519" },
    detail: { states: "#2c3038", road: "#2e333b", rail: "#262a31", wood: "#171b1f", urban: "#181b20", park: "#16201a" },
    defaultLine: "#3fa9ff", glowDefault: true
  },
  vintage: {
    bg: "#e9dcbc", water: "#a9c3c1", ice: "#f3ecd8", iceOp: 0.8,
    hills: { shadow: "#9c8a6a", highlight: "#fff8e6", accent: "#d8c8a2", ex: 0.45 },
    boundary: { color: "#8a6a4a", width: 1.2, dash: [3, 2] },
    country: { color: "#4a3524", halo: "#e9dcbc", upper: true, spacing: 0.3 },
    city: { color: "#5b4330", halo: "#e9dcbc" },
    detail: { states: "#b39d78", road: "#d6c49c", rail: "#a8936f", wood: "#d9cfa6", urban: "#dccca6", park: "#d6d0a4" },
    defaultLine: "#c1272d", glowDefault: false
  },
  minimal: {
    bg: "#f7f4ee", water: "#d6e4ee", ice: null,
    hills: null,
    boundary: { color: "#cfc6b8", width: 1, dash: [3, 2] },
    country: { color: "#55565c", halo: "#f7f4ee", upper: false, spacing: 0.08 },
    city: { color: "#7c7d84", halo: "#f7f4ee" },
    detail: { states: "#c8bfae", road: "#e0dacb", rail: "#c2bcae", wood: "#e5e8da", urban: "#ebe6d9", park: "#e0e7d4" },
    defaultLine: "#3a6fb0", glowDefault: false
  }
};

function dt(id){ const el = document.getElementById(id); return el ? el.checked : false; }
function buildBaseStyle(name){
  const t = THEMES[name];
  const cc = customColors || {};
  const C = (k, fb) => cc[k] || fb;
  const keyEl = document.getElementById("mtKey");
  const key = keyEl ? keyEl.value.trim() : "";
  const glyphs = key ? "https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=" + key : FONTS;
  const style = { version: 8, glyphs, sources: {}, layers: [] };
  // DEM-Quelle immer bereitstellen (Hillshade + echtes 3D-Terrain)
  style.sources.dem = key ? {
    type: "raster-dem",
    tiles: ["https://api.maptiler.com/tiles/terrain-rgb-v2/{z}/{x}/{y}.webp?key=" + key],
    encoding: "mapbox", tileSize: 256, maxzoom: 12, attribution: "© MapTiler"
  } : {
    type: "raster-dem",
    tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
    encoding: "terrarium", tileSize: 256, maxzoom: 13, attribution: "Terrain: Mapzen/AWS"
  };
  style.sources.omt = key
    ? { type: "vector", url: "https://api.maptiler.com/tiles/v3/tiles.json?key=" + key }
    : { type: "vector", url: "https://tiles.openfreemap.org/planet" };

  if (t.raster){
    style.sources.sat = key ? {
      type: "raster",
      tiles: ["https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=" + key],
      tileSize: 256, maxzoom: 20, attribution: "© MapTiler, © Maxar"
    } : {
      type: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256, maxzoom: 18, attribution: "Bilder: Esri, Maxar, Earthstar Geographics"
    };
    style.layers.push({ id: "sat", type: "raster", source: "sat" });
  } else {
    style.layers.push({ id: "bg", type: "background", paint: t.paper ? { "background-pattern": "paper-land" } : { "background-color": C("land", t.bg) } });
    if (t.atlas){
      style.sources.atlas = { type: "geojson", data: "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson" };
      const sh = t.shades;
      style.layers.push({ id: "atlas-fill", type: "fill", source: "atlas", paint: {
        "fill-color": ["match", ["get", "MAPCOLOR7"], 1, sh[0], 2, sh[1], 3, sh[2], 4, sh[3], 5, sh[4], 6, sh[5], sh[6]], "fill-antialias": true } });
    }
    if (t.relief){
      const demT = (ts) => ({ type: "raster-dem", encoding: "terrarium", tileSize: ts, maxzoom: 13,
        tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"] });
      style.sources.dem2 = demT(256); style.sources.demhs = demT(128);
      const H = t.hills;
      style.layers.push({ id: "relief-tint", type: "color-relief", source: "dem2", paint: { "color-relief-opacity": 0.55,
        "color-relief-color": ["interpolate", ["linear"], ["elevation"], 0, "#93a2bc", 300, "#9aa5bb", 900, "#a19cb0", 1800, "#a597a6", 3000, "#d9dbe6"] } });
      style.layers.push({ id: "hills", type: "hillshade", source: "demhs", paint: {
        "hillshade-method": "multidirectional",
        "hillshade-illumination-direction": [270, 315, 0, 340], "hillshade-illumination-altitude": [22, 22, 25, 45],
        "hillshade-highlight-color": [H.highlight, H.highlight, "#e6ecf6", H.highlight],
        "hillshade-shadow-color": [H.shadow, H.accent, H.shadow, H.shadow], "hillshade-exaggeration": 1 } });
      style.layers.push({ id: "relief-sea", type: "color-relief", source: "dem2", paint: { "color-relief-opacity": 1,
        "color-relief-color": ["interpolate", ["linear"], ["elevation"], -11000, C("water", t.water), -12, C("water", t.water), -4, "rgba(0,0,0,0)", 10000, "rgba(0,0,0,0)"] } });
    } else if (t.hills){
      style.layers.push({ id: "hills", type: "hillshade", source: "dem",
        paint: {
          "hillshade-shadow-color": t.hills.shadow,
          "hillshade-highlight-color": t.hills.highlight,
          "hillshade-accent-color": t.hills.accent,
          "hillshade-exaggeration": t.hills.ex
        } });
    }
    if (t.ice) style.layers.push({ id: "ice", type: "fill", source: "omt", "source-layer": "landcover",
      filter: ["==", ["get", "class"], "ice"],
      paint: { "fill-color": t.ice, "fill-opacity": t.iceOp } });
    style.layers.push({ id: "water", type: "fill", source: "omt", "source-layer": "water",
      paint: t.paper ? { "fill-pattern": "paper-water" } : { "fill-color": C("water", t.water) } });
    if (t.paper){                                                          // Schnittkante: Schatten der Landschicht fällt ins Wasser, helle Papierkante
      style.layers.push({ id: "paper-coast-shadow", type: "line", source: "omt", "source-layer": "water", filter: ["in", ["get", "class"], ["literal", ["ocean", "sea", "lake"]]],
        paint: { "line-color": "rgba(55,40,25,0.3)", "line-width": ["interpolate", ["linear"], ["zoom"], 2, 3, 8, 6, 14, 9], "line-offset": ["interpolate", ["linear"], ["zoom"], 2, 1.5, 8, 3, 14, 4.5], "line-blur": ["interpolate", ["linear"], ["zoom"], 2, 2, 8, 4] } });
      style.layers.push({ id: "paper-coast-edge", type: "line", source: "omt", "source-layer": "water",
        paint: { "line-color": "#fffaf0", "line-width": ["interpolate", ["linear"], ["zoom"], 2, 1, 10, 2.2], "line-opacity": 0.9 } });
      for (const [id, src, f, pat] of [["paper-wood", "landcover", ["==", ["get", "class"], "wood"], "paper-green"], ["paper-park", "park", null, "paper-green2"]]){
        const base = { source: "omt", "source-layer": src, minzoom: id === "paper-wood" ? 7 : 6 }; if (f) base.filter = f;
        style.layers.push(Object.assign({ id: id + "-shadow", type: "line", paint: { "line-color": "rgba(55,40,25,0.28)", "line-width": 4, "line-offset": -2, "line-blur": 3, "line-translate": [1.5, 2] } }, base));
        style.layers.push(Object.assign({ id, type: "fill", paint: { "fill-pattern": pat, "fill-opacity": 0.95 } }, base));
        style.layers.push(Object.assign({ id: id + "-edge", type: "line", paint: { "line-color": "#fbf6e8", "line-width": 1, "line-opacity": 0.8 } }, base));
      }
    }
    style.layers.push({ id: "waterway", type: "line", source: "omt", "source-layer": "waterway",
      minzoom: 6,
      paint: { "line-color": C("water", t.water), "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.6, 12, 2] } });
    if (dt("dtWood")) style.layers.push({ id: "dt-wood", type: "fill", source: "omt", "source-layer": "landcover",
      filter: ["==", ["get", "class"], "wood"],
      paint: { "fill-color": t.detail.wood, "fill-opacity": 0.7 } });
    if (dt("dtUrban")) style.layers.push({ id: "dt-urban", type: "fill", source: "omt", "source-layer": "landuse",
      filter: ["in", ["get", "class"], ["literal", ["residential", "suburb", "neighbourhood"]]],
      paint: { "fill-color": t.detail.urban, "fill-opacity": 0.8 } });
    if (dt("dtParks")) style.layers.push({ id: "dt-park", type: "fill", source: "omt", "source-layer": "park",
      paint: { "fill-color": t.detail.park, "fill-opacity": 0.6 } });
  }
  if (dt("dtRoads")) style.layers.push({ id: "dt-roads", type: "line", source: "omt", "source-layer": "transportation",
    filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk", "primary", "secondary"]]],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": t.detail.road, "line-opacity": t.raster ? 0.5 : 1,
             "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.4, 9, 1.6, 13, 4] } });
  if (t.streets) style.layers.push({ id: "streets", type: "line", source: "omt", "source-layer": "transportation",
    minzoom: 9, filter: ["!", ["in", ["get", "class"], ["literal", ["rail", "transit", "ferry", "path"]]]],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": t.detail.road, "line-width": ["interpolate", ["exponential", 1.4], ["zoom"], 9, 0.3, 12, 1, 16, 5] } });
  if (dt("dtRail")) style.layers.push({ id: "dt-rail", type: "line", source: "omt", "source-layer": "transportation",
    filter: ["==", ["get", "class"], "rail"],
    paint: { "line-color": t.detail.rail, "line-opacity": t.raster ? 0.6 : 1,
             "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.4, 12, 1.6], "line-dasharray": [4, 3] } });

  if (dt("dtStates")) style.layers.push({ id: "dt-states", type: "line", source: "omt", "source-layer": "boundary",
    filter: ["all", ["has", "admin_level"], ["==", ["get", "admin_level"], 4], ["!=", ["get", "maritime"], 1]],
    paint: { "line-color": t.detail.states, "line-width": 1,
             "line-opacity": t.raster ? 0.7 : 1, "line-dasharray": [2, 2] } });
  const bPaint = { "line-color": C("boundary", t.boundary.color), "line-width": t.boundary.width };
  if (t.boundary.dash) bPaint["line-dasharray"] = t.boundary.dash;
  if (t.boundary.opacity != null) bPaint["line-opacity"] = t.boundary.opacity;
  style.layers.push({ id: "boundary", type: "line", source: "omt", "source-layer": "boundary",
    filter: ["all", ["has", "admin_level"], ["<=", ["get", "admin_level"], 2], ["!=", ["get", "maritime"], 1]],
    paint: bPaint });

  if (dt("projGlobe")){
    style.projection = { type: "globe" };
    style.sky = { "sky-color": "#0a1630", "horizon-color": "#7fb6ff", "fog-color": "#a9ccff", "horizon-fog-blend": 0.6, "sky-horizon-blend": 0.6,
                  "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 7, 0] };
  }
  if (dt("cloudLayer")){
    // NASA Blue Marble Wolken (gemeinfrei), transparente PNG
    style.sources.clouds = { type: "image", url: "https://cdn.jsdelivr.net/gh/turban/webgl-earth@master/images/fair_clouds_4k.png",
      coordinates: [[-180, 85.05], [180, 85.05], [180, -85.05], [-180, -85.05]] };
    style.layers.push({ id: "clouds", type: "raster", source: "clouds", maxzoom: 7,
      paint: { "raster-opacity": ["interpolate", ["linear"], ["zoom"], 2, 0.85, 5, 0.55, 7, 0], "raster-fade-duration": 0 } });
  }
  const noLabels = document.getElementById("dtLabels") && !document.getElementById("dtLabels").checked;
  if (noLabels) style.layers = style.layers.filter(l => l.type !== "symbol");
  if (!noLabels) style.layers.push({ id: "place-city", type: "symbol", source: "omt", "source-layer": "place",
    minzoom: 4.5,
    filter: ["in", ["get", "class"], ["literal", dt("dtTowns") ? ["city", "town", "village"] : ["city", "town"]]],
    layout: {
      "text-field": ["coalesce", ["get", "name:de"], ["get", "name"]],
      "text-font": ["Noto Sans Regular"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 5, 11, 10, 15],
      "text-letter-spacing": 0.03
    },
    paint: { "text-color": C("label", t.city.color), "text-halo-color": C("land", t.city.halo), "text-halo-width": 1.2 } });

  if (!noLabels) style.layers.push({ id: "place-country", type: "symbol", source: "omt", "source-layer": "place",
    filter: ["==", ["get", "class"], "country"],
    layout: {
      "text-field": ["coalesce", ["get", "name:de"], ["get", "name"]],
      "text-font": ["Noto Sans Bold"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 2, 12, 5, 20, 8, 26],
      "text-letter-spacing": t.country.spacing,
      "text-transform": t.country.upper ? "uppercase" : "none"
    },
    paint: { "text-color": C("label", t.country.color), "text-halo-color": C("land", t.country.halo), "text-halo-width": 1.5 } });

  return style;
}

/* ---------- Map ---------- */
const map = new maplibregl.Map({
  container: "map",
  style: buildBaseStyle("hell"),
  center: [10.5, 51.2], zoom: 5, maxPitch: 85,
  maxTileCacheSize: 1500,                 // genug Kacheln behalten, damit Vorschau-Wiederholungen nicht neu laden
  attributionControl: false,
  canvasContextAttributes: { preserveDrawingBuffer: true, antialias: true },
  fadeDuration: 0
});
map.addControl(new maplibregl.AttributionControl({
  compact: true,
  customAttribution: "© OpenStreetMap-Mitwirkende · © OpenFreeMap"
}));
let bootOK = false;
map.on("load", () => { bootOK = true; });
// Papier-Texturen (Papier-Cutout-Stil): werden erzeugt, sobald der Stil sie anfordert
function paperTexture(base, fibers){
  const S = 256, c = document.createElement("canvas"); c.width = c.height = S; const g = c.getContext("2d");
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  let sd = 1234567; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 40; i++){ const x = rnd() * S, y = rnd() * S, r = 10 + rnd() * 40, gr = g.createRadialGradient(x, y, 0, x, y, r);   // Flecken
    const d = rnd() < 0.5; gr.addColorStop(0, d ? "rgba(90,60,30,0.025)" : "rgba(255,255,255,0.045)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) g.fillRect(x - r + ox, y - r + oy, r * 2, r * 2); }
  g.lineWidth = 0.7; for (let i = 0; i < fibers; i++){ const x = rnd() * S, y = rnd() * S, a = rnd() * Math.PI, l = 4 + rnd() * 10;   // Fasern
    g.strokeStyle = rnd() < 0.5 ? "rgba(255,255,255,0.35)" : "rgba(80,55,30,0.12)"; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  const d = g.getImageData(0, 0, S, S), px = d.data; for (let i = 0; i < px.length; i += 4){ const n = (rnd() - 0.5) * 14; px[i] += n; px[i + 1] += n; px[i + 2] += n; }   // Körnung
  g.putImageData(d, 0, 0);
  return g.getImageData(0, 0, S, S);
}
const PAPER_TEX = { "paper-land": ["#f1e4c8", 900], "paper-water": ["#8fc3df", 500], "paper-green": ["#9cc48a", 600], "paper-green2": ["#b6d39a", 600] };
const paperCache = {};
function ensurePaperImages(){
  for (const [id, t] of Object.entries(PAPER_TEX)){ if (map.hasImage(id)) continue; const im = paperCache[id] || (paperCache[id] = paperTexture(t[0], t[1]));
    try { map.addImage(id, { width: 256, height: 256, data: new Uint8Array(im.data.buffer.slice(0)) }, { pixelRatio: 2 }); } catch (e) {} }
}
map.on("styleimagemissing", e => { if (PAPER_TEX[e.id]) ensurePaperImages(); });
map.on("style.load", () => { if ((THEMES[val("mapStyle")] || {}).paper){ ensurePaperImages(); map.triggerRepaint(); } });
setTimeout(() => {
  if (!bootOK) setStatus("Karte konnte nicht starten. Läuft die Datei in einer Vorschau/Sandbox? Bitte herunterladen und lokal im Browser öffnen (Internet nötig).");
}, 8000);
let tileErrShown = false;
map.on("error", e => {
  const m = e && e.error && e.error.message ? e.error.message : "";
  if (m && !tileErrShown && /tile|source|fetch|network|failed/i.test(m)){
    tileErrShown = true;
    setStatus("Karten-Daten-Fehler: " + m + " – Internetverbindung prüfen.");
  }
});

/* ---------- State ---------- */
let routeCounter = 0;
function newRoute(name, color){
  return { id: ++routeCounter, name, color, waypoints: [], gpx: null,
           tipPhoto: null, tipLabel: "", _tipIcon: null };
}
let routes = [];
let activeRoute = 0;
function R(){ return routes[activeRoute]; }
let wpCounter = 0;
let mapReady = false;
let playing = false;
let recorder = null, recChunks = [];
/* Spitzen-Foto liegt jetzt pro Route */
let anim = null;               // vorbereiteter Animations-Kontext
let playheadT = 0;
let selKf = null;              // {track, kf}
let popT = {};                 // Stopp-Nr -> Zeitpunkt des Aufpoppens (Live-Playback)

/* Keyframe-Tracks (Zeiten in Sekunden) – jedes animierbare Attribut */
let tracks = { line: [], pos: [], zoom: [], bearing: [], pitch: [],
               lineWidth: [], glowOp: [], pinScale: [], tipScale: [] };
const TRACK_DEFS = [
  { key: "line",      label: "Linie %",      cur: t => tipFracFallback(t) },
  { key: "pos",       label: "Position" },
  { key: "zoom",      label: "Zoom",         cur: () => map.getZoom() },
  { key: "bearing",   label: "Rotation",     cur: () => map.getBearing() },
  { key: "pitch",     label: "Neigung",      cur: () => map.getPitch() },
  { key: "lineWidth", label: "Linienbreite", cur: () => num("lineWidth") || 3.5 },
  { key: "glowOp",    label: "Glow",         cur: () => checked("glow") ? 0.55 : 0 },
  { key: "pinScale",  label: "Pin-Größe",    cur: () => num("pinScale") },
  { key: "tipScale",  label: "Spitzen-Größe", cur: () => num("tipScale") }
];
function ensureTrackKeys(){
  for (const d of TRACK_DEFS) if (!tracks[d.key]) tracks[d.key] = [];
}

function emptyFC(){ return { type: "FeatureCollection", features: [] }; }
function setStatus(msg, rec){ const s = document.getElementById("status"); s.textContent = msg; s.className = rec ? "rec" : ""; }
function val(id){ return document.getElementById(id).value; }
function num(id){ return parseFloat(document.getElementById(id).value); }
function checked(id){ return document.getElementById(id).checked; }
function invalidateAnim(){ anim = null; }

/* ---------- Runtime-Layer ---------- */
let HL_ALL = null, HL_LOADING = null;
async function hlData(){
  const iso = (val("hlIso") || "").toUpperCase().split(/[\s,;]+/).filter(Boolean);
  if (!iso.length) return emptyFC();
  if (!HL_ALL){
    HL_LOADING = HL_LOADING || fetch("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson").then(r => r.json());
    HL_ALL = await HL_LOADING;
  }
  return { type: "FeatureCollection", features: HL_ALL.features.filter(f => iso.includes(f.properties.ADM0_A3) || iso.includes(f.properties.ISO_A3)) };
}
async function refreshHighlight(){
  if (!map.getSource("hl")) return;
  try { map.getSource("hl").setData(await hlData()); } catch(e){ setStatus("Länderdaten konnten nicht geladen werden."); }
  applyHighlightStyle(); hlAnim(playheadT);
}
function applyHighlightStyle(){
  if (!map.getLayer("hl-fill")) return;
  map.setPaintProperty("hl-fill", "fill-color", val("hlColor") || "#86ccff");
  const on = checked("hlLine");
  map.setLayoutProperty("hl-line", "visibility", on ? "visible" : "none");
  map.setLayoutProperty("hl-shadow", "visibility", on ? "visible" : "none");
}
function hlAnim(t){
  if (!map.getLayer("hl-fill")) return;
  const t0 = parseFloat(val("hlT0"));
  const k = isNaN(t0) ? 1 : Math.min(Math.max((t - t0) / 0.45, 0), 1);
  const e = easeOutC(k), op = num("hlOp");
  map.setPaintProperty("hl-fill", "fill-opacity", (op === undefined || isNaN(op) ? 0.66 : op) * e);
  map.setPaintProperty("hl-line", "line-opacity", e);
  map.setPaintProperty("hl-shadow", "line-opacity", 0.5 * e);
}
function addHighlightLayers(){
  if (!map.getSource("hl")) map.addSource("hl", { type: "geojson", data: emptyFC() });
  const zw = (a, b) => ["interpolate", ["exponential", 1.5], ["zoom"], 3, a, 10, b];
  if (!map.getLayer("hl-fill")) map.addLayer({ id: "hl-fill", type: "fill", source: "hl", paint: { "fill-color": "#86ccff", "fill-opacity": 0.66 } });
  if (!map.getLayer("hl-shadow")) map.addLayer({ id: "hl-shadow", type: "line", source: "hl", layout: { "line-join": "round" },
    paint: { "line-color": "#0b1630", "line-opacity": 0.5, "line-width": zw(5, 34), "line-blur": zw(4, 22), "line-translate": [4, 10] } });
  if (!map.getLayer("hl-line")) map.addLayer({ id: "hl-line", type: "line", source: "hl", layout: { "line-join": "round" },
    paint: { "line-color": "#ffffff", "line-width": zw(2.4, 18) } });
  refreshHighlight();
}
["hlIso", "hlColor", "hlOp", "hlLine", "hlT0"].forEach(id => setTimeout(() => {
  const el = document.getElementById(id); if (el) el.addEventListener("change", refreshHighlight);
}, 0));

function addRuntimeLayers(){
  if ((THEMES[val("mapStyle")] || {}).paper) ensurePaperImages();
  addHighlightLayers();
  setTimeout(() => { try { applyTerrain(); } catch(e){} }, 0);
  if (!map.getSource("features")) map.addSource("features", { type: "geojson", data: emptyFC() });
  if (!map.getLayer("feat-fill")) map.addLayer({
    id: "feat-fill", type: "fill", source: "features",
    filter: ["in", ["geometry-type"], ["literal", ["Polygon", "MultiPolygon"]]],
    paint: { "fill-color": ["get", "color"], "fill-opacity": ["*", ["get", "op"], 0.4] }
  });
  if (!map.getLayer("feat-line")) map.addLayer({
    id: "feat-line", type: "line", source: "features",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": ["get", "color"], "line-width": 2.5, "line-opacity": ["get", "op"] }
  });
  if (!map.getLayer("feat-point")) map.addLayer({
    id: "feat-point", type: "circle", source: "features",
    filter: ["==", ["geometry-type"], "Point"],
    paint: { "circle-color": ["get", "color"], "circle-radius": 6,
             "circle-stroke-color": "#ffffff", "circle-stroke-width": 2,
             "circle-opacity": ["get", "op"], "circle-stroke-opacity": ["get", "op"] }
  });
  if (!map.getSource("route")) map.addSource("route", { type: "geojson", data: emptyFC() });
  if (!map.getSource("stops")) map.addSource("stops", { type: "geojson", data: emptyFC() });
  if (!map.getSource("tip"))   map.addSource("tip",   { type: "geojson", data: emptyFC() });

  if (!map.getLayer("route-glow")) map.addLayer({
    id: "route-glow", type: "line", source: "route",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": ["get", "color"], "line-width": 12, "line-blur": 8, "line-opacity": 0 }
  });
  if (!map.getLayer("route-shadow") && (THEMES[val("mapStyle")] || {}).paper) map.addLayer({
    id: "route-shadow", type: "line", source: "route", filter: ["==", ["get", "dash"], 0],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "rgba(40,25,10,0.35)", "line-width": 12, "line-blur": 4, "line-translate": [3, 4] } });
  if (!map.getLayer("route-casing")) map.addLayer({
    id: "route-casing", type: "line", source: "route",
    filter: ["==", ["get", "dash"], 0],
    layout: { "line-cap": "round", "line-join": "round", visibility: checked("lineCasing") ? "visible" : "none" },
    paint: { "line-color": "#ffffff", "line-width": 6.5 }
  });
  if (!map.getLayer("route-line")) map.addLayer({
    id: "route-line", type: "line", source: "route",
    filter: ["==", ["get", "dash"], 0],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": ["get", "color"], "line-width": 3.5 }
  });
  if (!map.getLayer("route-core")) map.addLayer({
    id: "route-core", type: "line", source: "route",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#ffffff", "line-width": 1.2, "line-opacity": 0, "line-blur": 0.5 }
  });
  if (!map.getLayer("route-dash")) map.addLayer({
    id: "route-dash", type: "line", source: "route",
    filter: ["==", ["get", "dash"], 1],
    layout: { "line-cap": "butt", "line-join": "round" },
    paint: { "line-color": ["get", "color"], "line-width": 3.5, "line-dasharray": [2, 1.5] }
  });
  if (!map.getLayer("tip-dot")) map.addLayer({
    id: "tip-dot", type: "circle", source: "tip",
    paint: {
      "circle-radius": 7, "circle-color": ["get", "color"],
      "circle-stroke-color": "#ffffff", "circle-stroke-width": 2.5,
      "circle-opacity": 0, "circle-stroke-opacity": 0
    }
  });
  if (!map.getLayer("tip-pin")) map.addLayer({
    id: "tip-pin", type: "symbol", source: "tip",
    layout: {
      "icon-image": ["get", "icon"], "icon-size": 1, "icon-anchor": "bottom",
      "icon-offset": [0, -6],
      "icon-allow-overlap": true, "icon-ignore-placement": true
    },
    paint: { "icon-opacity": 0 }
  });
  if (!map.getLayer("stops-icons")) map.addLayer({
    id: "stops-icons", type: "symbol", source: "stops",
    layout: {
      "icon-image": ["get", "img"],
      "icon-size": ["get", "size"],
      "icon-anchor": "bottom",
      "icon-allow-overlap": true, "icon-ignore-placement": true,
      "text-field": ["get", "label"],
      "text-font": ["Noto Sans Bold"],
      "text-size": 14,
      "text-anchor": "right",
      "text-offset": [-2.2, -2.6],
      "text-allow-overlap": true, "text-ignore-placement": true,
      "text-optional": true
    },
    paint: {
      "text-color": "#6d2e38",
      "text-halo-color": "#ffffff", "text-halo-width": 1.6,
      "text-opacity": ["get", "size"]
    }
  });
  if (!map.getSource("pois")) map.addSource("pois", { type: "geojson", data: emptyFC() });
  if (!map.getLayer("pois-icons")) map.addLayer({
    id: "pois-icons", type: "symbol", source: "pois",
    layout: {
      "icon-image": ["get", "icon"], "icon-size": 0.8,
      "icon-allow-overlap": false,
      "text-field": ["get", "name"],
      "text-font": ["Noto Sans Regular"],
      "text-size": 10.5,
      "text-anchor": "top", "text-offset": [0, 1.4],
      "text-optional": true
    },
    paint: { "text-color": "#6d2e38", "text-halo-color": "#ffffff", "text-halo-width": 1.3 }
  }, "stops-icons");
  M3D.addLayer(map);
  buildPoiIcons();
  refreshPois();
  applyStyleSettings();
  applyTerrain();
}

map.on("load", () => {
  addRuntimeLayers();
  mapReady = true;
  renderTimeline();
  setStatus(tr("Bereit. Orte suchen oder GPX laden."));
});

let prevStyle = "hell";
document.getElementById("mapStyle").addEventListener("change", () => {
  if (playing) return;
  const name = val("mapStyle");
  const t = THEMES[name];
  document.getElementById("lineColor").value = t.defaultLine;
  document.getElementById("glow").checked = t.glowDefault;
  document.getElementById("lineCasing").checked = !!t.casing;
  if (t.relief){ document.getElementById("terrain3d").checked = true; document.getElementById("terrainEx").value = 12; }
  else if (THEMES[prevStyle] && THEMES[prevStyle].relief){ document.getElementById("terrain3d").checked = false; document.getElementById("terrainEx").value = 1.5; }
  prevStyle = name;
  swapStyle(() => setStatus("Stil „" + document.getElementById("mapStyle").selectedOptions[0].text + "“ aktiv."));
});

/* 3D-Terrain */
function applyTerrain(){
  if (!map.getSource("dem")) return;
  if (checked("terrain3d")) map.setTerrain({ source: "dem", exaggeration: num("terrainEx") || 1.5 });
  else map.setTerrain(null);
}
["terrain3d", "terrainEx"].forEach(id =>
  document.getElementById(id).addEventListener("change", applyTerrain));

/* ---------- Pin-Bilder ---------- */
async function buildPinImage(wp, styleOverride){
  let pinStyle = styleOverride || val("pinStyle");
  if (!wp.photo && (pinStyle === "badge" || pinStyle === "photo")) pinStyle = "marker";   // ohne Foto: nur Marker
  const fontStack = FONT_STACKS[val("pinFont")] || FONT_STACKS.system;
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d");
  const name = "pin-" + wp.id + "-" + pinStyle + "-" + val("pinFont") + "-" + (wp.color || "").replace("#", "");

  if (pinStyle === "tag"){
    // Orts-Etikett: kleiner Chip mit Namen + Punkt am Ort (hell auf hellen, dunkel auf dunklen Karten)
    const th = THEMES[val("mapStyle")] || {};
    const dark = th.raster || /^#(0|1|2)/.test(th.bg || "");
    const label = wp.name || "";
    ctx.font = "700 30px " + fontStack;
    const tw = Math.min(ctx.measureText(label).width, 420), W = Math.max(60, tw + 40), H = 92;
    c.width = W; c.height = H;
    const g = c.getContext("2d");
    g.font = "700 30px " + fontStack;
    g.save(); g.shadowColor = "rgba(0,0,0,.3)"; g.shadowBlur = 8; g.shadowOffsetY = 2;
    g.fillStyle = dark ? "#0d0e10" : "#ffffff";
    roundRect(g, 0, 4, W, 48, 10); g.fill();
    g.beginPath(); g.moveTo(W / 2 - 9, 50); g.lineTo(W / 2 + 9, 50); g.lineTo(W / 2, 62); g.closePath(); g.fill();
    g.restore();
    g.fillStyle = dark ? "#ffffff" : "#1b1d21"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(label, W / 2, 29, 420);
    g.fillStyle = wp.color; g.strokeStyle = "#ffffff"; g.lineWidth = 4;
    g.beginPath(); g.arc(W / 2, 78, 10, 0, Math.PI * 2); g.fill(); g.stroke();
    // Anker unten: Punkt-Mitte liegt 14 px über der Unterkante → per Polsterung ausgleichen
  }
  else if (PIN_ART[pinStyle]){
    PIN_ART[pinStyle](c, wp, fontStack);
  }
  else if (pinStyle === "marker"){
    // klassischer Karten-Marker (Tropfen) in Stoppfarbe mit weißem Punkt
    c.width = 100; c.height = 132; ctx.scale(100 / 72, 132 / 96);
    const cx = 36, cy = 34, r = 26;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.35)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
    ctx.fillStyle = wp.color;
    ctx.beginPath();
    ctx.moveTo(cx, 92);
    ctx.bezierCurveTo(cx - 8, 70, cx - r, 58, cx - r, cy);
    ctx.arc(cx, cy, r, Math.PI, 0);
    ctx.bezierCurveTo(cx + r, 58, cx + 8, 70, cx, 92);
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = 3; ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.stroke();
    ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fill();
  }
  else if (pinStyle === "dot"){
    c.width = 64; c.height = 64;
    ctx.shadowColor = "rgba(0,0,0,.35)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(32, 32, 18, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = wp.color;
    ctx.beginPath(); ctx.arc(32, 32, 12, 0, Math.PI * 2); ctx.fill();
  }
  else if (pinStyle === "badge"){
    const label = (wp.name || "STOPP").toUpperCase();
    ctx.font = "700 30px " + fontStack;
    const tw = Math.min(ctx.measureText(label).width, 300);
    const W = Math.max(240, tw + 60), H = 258;
    c.width = W; c.height = H;
    const x2 = c.getContext("2d");
    const cx = W / 2, cy = 108, R = 86, PR = 72;
    x2.save();
    x2.shadowColor = "rgba(0,0,0,.45)"; x2.shadowBlur = 16; x2.shadowOffsetY = 6;
    x2.fillStyle = wp.color;
    x2.beginPath(); x2.arc(cx, cy, R, 0, Math.PI * 2); x2.fill();
    x2.restore();
    x2.save();
    x2.beginPath(); x2.arc(cx, cy, PR, 0, Math.PI * 2); x2.clip();
    if (wp.photo){
      const img = wp.photo;
      const s = Math.max(PR * 2 / img.width, PR * 2 / img.height);
      x2.drawImage(img, cx - img.width * s / 2, cy - img.height * s / 2, img.width * s, img.height * s);
    } else {
      x2.fillStyle = "#f2ede4";
      x2.fillRect(cx - PR, cy - PR, PR * 2, PR * 2);
    }
    x2.restore();
    x2.font = "700 30px " + fontStack;
    const bw = tw + 44, bh = 48, by = cy + R - 14;
    x2.save();
    x2.shadowColor = "rgba(0,0,0,.35)"; x2.shadowBlur = 10; x2.shadowOffsetY = 4;
    x2.fillStyle = wp.color;
    roundRect(x2, cx - bw / 2, by, bw, bh, 14); x2.fill();
    x2.restore();
    x2.fillStyle = "#ffffff";
    x2.textAlign = "center"; x2.textBaseline = "middle";
    x2.fillText(label, cx, by + bh / 2 + 2, 300);
    x2.fillStyle = wp.color;
    x2.beginPath();
    x2.moveTo(cx - 14, by + bh - 2);
    x2.lineTo(cx + 14, by + bh - 2);
    x2.lineTo(cx, by + bh + 26);
    x2.closePath(); x2.fill();
  }
  else {
    const S = 176, R = 62, PR = 56;
    c.width = S; c.height = 168;
    const cx = S / 2, cy = 74;
    ctx.save();
    ctx.shadowColor = "rgba(61,43,46,.35)"; ctx.shadowBlur = 14; ctx.shadowOffsetY = 5;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(cx - 16, cy + R - 14);
    ctx.lineTo(cx + 16, cy + R - 14);
    ctx.lineTo(cx, cy + R + 30);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (wp.photo){
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, PR, 0, Math.PI * 2); ctx.clip();
      const img = wp.photo;
      const s = Math.max(PR * 2 / img.width, PR * 2 / img.height);
      ctx.drawImage(img, cx - img.width * s / 2, cy - img.height * s / 2, img.width * s, img.height * s);
      ctx.restore();
    } else {
      ctx.fillStyle = wp.color;
      ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2); ctx.fill();
    }
  }

  const bmp = await createImageBitmap(c);
  if (map.hasImage(name)) map.removeImage(name);
  map.addImage(name, bmp, { pixelRatio: 2 });
  return name;
}
/* ---------- Ortsmarkierungs-Stile (Anker = Mitte unten = Ort) ----------
   Jeder Stil zeichnet in doppelter Auflösung (pixelRatio 2). */
function pinRank(wp){
  const rt = routes.find(r => r.waypoints.includes(wp)); if (!rt) return 1;
  return rt.waypoints.length - rt.waypoints.indexOf(wp);           // Countdown: letzter Ort = #1
}
function pinDark(){ const th = THEMES[val("mapStyle")] || {}; return !!(th.raster || /^#(0|1|2)/.test(th.bg || "")); }
function fmtCoord(wp){ const la = wp.lat, lo = wp.lng; return Math.abs(la).toFixed(4) + "° " + (la >= 0 ? "N" : "S") + "  " + Math.abs(lo).toFixed(4) + "° " + (lo >= 0 ? "E" : "W"); }
function pinFit(c, W, H){ c.width = Math.ceil(W); c.height = Math.ceil(H); return c.getContext("2d"); }
const PIN_ART = {
  // Reisepass-Stempel: doppelter Rahmen, leicht gedreht, Druckfarbe mit Fehlstellen
  stamp(c, wp, fs){
    const name = (wp.name || "").toUpperCase(), col = wp.color || "#c0262d";
    let g = c.getContext("2d"); g.font = "900 34px " + fs;
    const tw = Math.min(g.measureText(name).width, 380), w = tw + 64, h = 104, S = Math.hypot(w, h) + 10;
    g = pinFit(c, S, S + 30);
    const rot = ((wp.id * 37) % 13 - 6) * Math.PI / 180;
    g.save(); g.translate(S / 2, S / 2); g.rotate(rot);
    g.strokeStyle = col; g.fillStyle = col;
    g.lineWidth = 5; roundRect(g, -w / 2, -h / 2, w, h, 14); g.stroke();
    g.lineWidth = 2; roundRect(g, -w / 2 + 8, -h / 2 + 8, w - 16, h - 16, 9); g.stroke();
    g.textAlign = "center"; g.textBaseline = "middle"; g.font = "900 34px " + fs; g.fillText(name, 0, -8, 380);
    g.font = "700 15px " + FONT_STACKS.mono; g.fillText("✦ " + (wp.sub || fmtCoord(wp)) + " ✦", 0, 26, w - 30);
    g.restore();
    g.globalCompositeOperation = "destination-out";                    // Stempel-Fehlstellen
    let sd = wp.id * 9301 + 49297; const rnd = () => (sd = (sd * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < 260; i++){ g.globalAlpha = 0.25 + rnd() * 0.6; g.beginPath(); g.arc(rnd() * S, rnd() * S, 0.6 + rnd() * 1.8, 0, Math.PI * 2); g.fill(); }
    g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
    g.fillStyle = col; g.strokeStyle = "#fff"; g.lineWidth = 4;
    g.beginPath(); g.arc(S / 2, S + 14, 10, 0, Math.PI * 2); g.fill(); g.stroke();
  },
  // Fähnchen an der Stange, Name auf dem Wimpel
  flag(c, wp, fs){
    const name = wp.name || "", col = wp.color || "#e3262b";
    let g = c.getContext("2d"); g.font = "800 30px " + fs;
    const tw = Math.min(g.measureText(name).width, 360), fw = tw + 46, H = 150;
    g = pinFit(c, fw * 2 + 20, H);
    const x = fw + 10;
    g.save(); g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = 8; g.shadowOffsetY = 3;
    g.fillStyle = "#2a2a2a"; g.fillRect(x - 3, 10, 6, H - 18);
    g.fillStyle = col; g.beginPath(); g.moveTo(x + 3, 12);
    g.bezierCurveTo(x + fw * 0.35, 4, x + fw * 0.65, 22, x + fw, 12); g.lineTo(x + fw - 14, 37); g.lineTo(x + fw, 62);
    g.bezierCurveTo(x + fw * 0.65, 72, x + fw * 0.35, 54, x + 3, 62); g.closePath(); g.fill(); g.restore();
    g.fillStyle = "#fff"; g.font = "800 30px " + fs; g.textBaseline = "middle"; g.fillText(name, x + 16, 38, 360);
    g.fillStyle = "#2a2a2a"; g.beginPath(); g.ellipse(x, H - 8, 12, 5, 0, 0, Math.PI * 2); g.fill();
  },
  // Leader-Linie: Punkt am Ort, dünne Linie nach oben, Karte mit gesperrtem Namen (Doku-/Erklär-Look)
  callout(c, wp, fs){
    const name = (wp.name || "").toUpperCase().split("").join("\u2009"), dark = pinDark();
    let g = c.getContext("2d"); g.font = "800 26px " + fs;
    const tw = Math.min(g.measureText(name).width, 420), W = tw + 40, H = 170;
    g = pinFit(c, W, H);
    g.save(); g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = 10; g.shadowOffsetY = 3;
    g.fillStyle = dark ? "#ffffff" : "#111317"; g.fillRect(0, 0, W, 52); g.restore();
    g.fillStyle = wp.color || "#e3262b"; g.fillRect(0, 48, W, 4);
    g.fillStyle = dark ? "#111317" : "#ffffff"; g.font = "800 26px " + fs; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(name, W / 2, 26, 420);
    g.strokeStyle = dark ? "#ffffff" : "#111317"; g.lineWidth = 3; g.beginPath(); g.moveTo(W / 2, 52); g.lineTo(W / 2, H - 16); g.stroke();
    g.fillStyle = wp.color || "#e3262b"; g.strokeStyle = "#fff"; g.lineWidth = 4; g.beginPath(); g.arc(W / 2, H - 12, 9, 0, Math.PI * 2); g.fill(); g.stroke();
  },
  // Neon: leuchtende Kontur, für dunkle Karten
  neon(c, wp, fs){
    const name = wp.name || "", col = wp.color || "#3fa9ff";
    let g = c.getContext("2d"); g.font = "700 30px " + fs;
    const tw = Math.min(g.measureText(name).width, 380), W = tw + 80, H = 128;
    g = pinFit(c, W, H);
    const glow = (blur, a) => { g.shadowColor = col; g.shadowBlur = blur; g.globalAlpha = a; };
    g.lineWidth = 4; g.strokeStyle = col;
    for (const [b, a] of [[28, 0.6], [12, 0.9], [0, 1]]){ glow(b, a); roundRect(g, 20, 14, W - 40, 54, 27); g.stroke(); }
    g.globalAlpha = 1; g.fillStyle = "rgba(5,8,14,0.55)"; g.shadowBlur = 0; roundRect(g, 22, 16, W - 44, 50, 25); g.fill();
    g.font = "700 30px " + fs; g.textAlign = "center"; g.textBaseline = "middle";
    glow(16, 1); g.fillStyle = "#ffffff"; g.fillText(name, W / 2, 42, 380);
    g.strokeStyle = col; g.lineWidth = 3; glow(10, 1); g.beginPath(); g.moveTo(W / 2, 68); g.lineTo(W / 2, H - 22); g.stroke();
    glow(24, 1); g.fillStyle = col; g.beginPath(); g.arc(W / 2, H - 14, 9, 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0; g.fillStyle = "#fff"; g.beginPath(); g.arc(W / 2, H - 14, 4, 0, Math.PI * 2); g.fill();
  },
  // Sticker: dicker weißer Rand, leicht gedreht, kräftige Füllung (Stickerbuch-Look)
  sticker(c, wp, fs){
    const name = (wp.name || "").toUpperCase(), col = wp.color || "#ff5a5f";
    let g = c.getContext("2d"); g.font = "900 36px " + fs;
    const tw = Math.min(g.measureText(name).width, 380), w = tw + 50, h = 66, S = Math.hypot(w, h) + 30;
    g = pinFit(c, S, S / 2 + h + 40);
    const rot = ((wp.id * 53) % 11 - 5) * Math.PI / 180, cy = S / 4 + h / 2 + 6;
    g.save(); g.translate(S / 2, cy); g.rotate(rot);
    g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = 12; g.shadowOffsetY = 5;
    g.fillStyle = "#ffffff"; roundRect(g, -w / 2 - 10, -h / 2 - 10, w + 20, h + 20, (h + 20) / 2); g.fill();
    g.shadowColor = "transparent"; g.fillStyle = col; roundRect(g, -w / 2, -h / 2, w, h, h / 2); g.fill();
    g.fillStyle = "rgba(255,255,255,0.25)"; roundRect(g, -w / 2 + 8, -h / 2 + 6, w - 16, h * 0.32, h * 0.16); g.fill();
    g.fillStyle = "#ffffff"; g.font = "900 36px " + fs; g.textAlign = "center"; g.textBaseline = "middle";
    g.lineWidth = 6; g.strokeStyle = "rgba(0,0,0,0.18)"; g.strokeText(name, 0, 3, 380); g.fillText(name, 0, 2, 380);
    g.restore();
    g.fillStyle = "#ffffff"; g.beginPath(); g.moveTo(S / 2 - 14, cy + h / 2 + 4); g.lineTo(S / 2 + 14, cy + h / 2 + 4); g.lineTo(S / 2, g.canvas.height - 2); g.closePath(); g.fill();
  },
  // Rang-Nummer: großer Kreis „#3“ + Name (Countdown / Top-Listen)
  rank(c, wp, fs){
    const name = wp.name || "", n = pinRank(wp), col = wp.color || "#e3262b";
    let g = c.getContext("2d"); g.font = "800 28px " + fs;
    const tw = Math.min(g.measureText(name).width, 360), W = Math.max(150, tw + 150), H = 150;
    g = pinFit(c, W, H);
    const cx = 62, cy = 58;
    g.save(); g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = 10; g.shadowOffsetY = 4;
    g.fillStyle = "#ffffff"; roundRect(g, cx, cy - 26, tw + 76, 52, 26); g.fill();
    g.fillStyle = col; g.beginPath(); g.arc(cx, cy, 46, 0, Math.PI * 2); g.fill(); g.restore();
    g.strokeStyle = "#fff"; g.lineWidth = 5; g.beginPath(); g.arc(cx, cy, 46, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = "900 46px " + FONT_STACKS.display; g.fillText("#" + n, cx, cy + 2, 80);
    g.fillStyle = "#15171c"; g.textAlign = "left"; g.font = "800 28px " + fs; g.fillText(name, cx + 58, cy + 1, 360);
    g.fillStyle = col; g.beginPath(); g.moveTo(cx - 14, cy + 40); g.lineTo(cx + 14, cy + 40); g.lineTo(cx, H - 4); g.closePath(); g.fill();
    // Anker: Spitze liegt unter dem Kreis, nicht mittig → Leinwand symmetrisch erweitern
    const img = g.getImageData(0, 0, W, H), off = Math.max(0, W - 2 * cx);
    pinFit(c, W + off, H).putImageData(img, off, 0);
  }
};
function roundRect(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
async function makeTipPinFor(rt){
  const c = document.createElement("canvas");
  c.width = 72; c.height = 78;
  const ctx = c.getContext("2d");
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.4)"; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
  ctx.fillStyle = rt.color;
  ctx.beginPath();
  ctx.arc(36, 28, 22, Math.PI * 0.85, Math.PI * 0.15);
  ctx.lineTo(36, 74);
  ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(36, 28, 22, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath(); ctx.arc(36, 28, 9, 0, Math.PI * 2); ctx.fill();
  const name = "tipdrop-" + rt.id + "-" + rt.color.replace("#", "");
  const bmp = await createImageBitmap(c);
  if (map.hasImage(name)) map.removeImage(name);
  map.addImage(name, bmp, { pixelRatio: 2 });
  return name;
}
async function makeModeIcon(rt, mode){
  const name = "tipmode-" + mode + "-" + rt.id;
  const c = document.createElement("canvas"); c.width = c.height = 84;
  const g = c.getContext("2d");
  g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = 6; g.shadowOffsetY = 2;
  g.fillStyle = "#ffffff"; g.beginPath(); g.arc(42, 42, 34, 0, Math.PI * 2); g.fill();
  g.shadowColor = "transparent";
  g.lineWidth = 6; g.strokeStyle = rt.color; g.beginPath(); g.arc(42, 42, 31, 0, Math.PI * 2); g.stroke();
  g.font = "38px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.save(); if (mode !== "fly") { g.translate(84, 0); g.scale(-1, 1); }   // Emojis schauen nach links → spiegeln
  g.fillText(MODES[mode].icon, 42, 45); g.restore();
  const bmp = await createImageBitmap(c);
  if (map.hasImage(name)) map.removeImage(name);
  map.addImage(name, bmp, { pixelRatio: 2 });
}
/* Avatar an der Spitze (Kamelfamilie-Look): rundes Foto, dicker weißer Ring,
   kleine Spitze nach unten, Schatten; optional Name-Tag darunter. Ohne Foto → Marker. */
async function makeAvatarIcon(rt){
  if (!rt.tipPhoto) return buildPinImage({ id: "tipav" + rt.id, name: "", color: rt.color, photo: null }, "marker");
  const S = 220, R = 82, ring = 13, cx = S / 2, cy = 96;
  const label = (rt.tipLabel || "").toUpperCase();
  const c = document.createElement("canvas"); c.width = S; c.height = 214;   // Unterkante = Pin-Spitze = Position
  const g = c.getContext("2d");
  g.save();
  g.shadowColor = "rgba(0,0,0,.42)"; g.shadowBlur = 18; g.shadowOffsetY = 7;
  g.fillStyle = "#ffffff";
  g.beginPath(); g.arc(cx, cy, R + ring, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(cx - 20, cy + R + ring - 8); g.lineTo(cx + 20, cy + R + ring - 8); g.lineTo(cx, cy + R + ring + 22); g.closePath(); g.fill();
  g.restore();
  g.save(); g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
  const img = rt.tipPhoto, k = Math.max(R * 2 / img.width, R * 2 / img.height);
  g.drawImage(img, cx - img.width * k / 2, cy - img.height * k / 2, img.width * k, img.height * k);
  g.restore();
  g.lineWidth = 4; g.strokeStyle = rt.color; g.beginPath(); g.arc(cx, cy, R + ring - 2, 0, Math.PI * 2); g.stroke();
  if (label){
    g.font = "800 26px " + (FONT_STACKS[val("pinFont")] || FONT_STACKS.system);
    const tw = Math.min(g.measureText(label).width, 190), bw = tw + 30, bh = 38, by = cy + R - 22;   // Name über dem unteren Fotorand
    g.fillStyle = rt.color; roundRect(g, cx - bw / 2, by, bw, bh, 12); g.fill();
    g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(label, cx, by + bh / 2 + 1, 190);
  }
  const name = "tipavatar-" + rt.id;
  const bmp = await createImageBitmap(c);
  if (map.hasImage(name)) map.removeImage(name);
  map.addImage(name, bmp, { pixelRatio: 1.25 });          // ≈ 16 % der kurzen Bildseite bei 1080 px
  return name;
}
async function updateTipPin(){
  if (!map.getLayer("tip-pin")) return;
  const ts = val("tipStyle");
  for (const rt of routes){
    if (ts === "avatar"){
      rt._tipIcon = await makeAvatarIcon(rt);
    } else if (ts === "stop"){
      const style = val("pinStyle") === "dot" ? "photo" : val("pinStyle");
      rt._tipIcon = await buildPinImage(
        { id: "tip" + rt.id, name: rt.tipLabel || rt.name || "ON TOUR", color: rt.color, photo: rt.tipPhoto }, style);
      // Offset für Stopp-Stil neutral
    } else {
      rt._tipIcon = await makeTipPinFor(rt);
    }
  }
  if (ts === "mode" || (ts === "model3d" && dt("projGlobe"))) for (const rt of routes) for (const k of Object.keys(MODES)) await makeModeIcon(rt, k);
  try {
    map.setLayoutProperty("tip-pin", "icon-anchor", ts === "mode" ? "center" : "bottom");
    map.setLayoutProperty("tip-pin", "icon-offset", ts === "stop" || ts === "mode" || ts === "avatar" ? [0, 0] : [0, -6]);
    map.setLayoutProperty("tip-pin", "icon-size", num("tipScale"));
  } catch { /* Stil wird gerade getauscht – nächstes drawStatic setzt es */ }
}
document.getElementById("tipPhoto").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  const img = new Image();
  img.onload = () => {
    R().tipPhoto = img;
    if (!["avatar", "stop"].includes(val("tipStyle"))) document.getElementById("tipStyle").value = "avatar";   // Foto gewählt → Avatar zeigen
    const lbl = document.getElementById("tipPhotoLbl");
    lbl.classList.add("has-photo");
    lbl.childNodes[0].textContent = "Foto ✓";
    updateTipPin();
  };
  img.src = URL.createObjectURL(file);
});
document.getElementById("tipLabel").addEventListener("change", () => { R().tipLabel = val("tipLabel"); updateTipPin(); });

function labelFor(wp){ const ps = val("pinStyle"); return (ps === "badge" && wp.photo) || ps === "tag" || PIN_ART[ps] ? "" : wp.name; }

/* ---------- Routen-UI ---------- */
function renderRoutes(){
  const el = document.getElementById("routeChips");
  el.innerHTML = "";
  routes.forEach((rt, i) => {
    const chip = document.createElement("div");
    chip.className = "rchip" + (i === activeRoute ? " active" : "");
    chip.innerHTML = `<span class="dot" style="background:${escapeHtml(rt.color)}"></span><span class="nm">${escapeHtml(rt.name)}</span>` +
      (routes.length > 1 ? '<span class="x" title="' + tr("Route entfernen") + '">✕</span>' : "");
    chip.addEventListener("click", e => {
      if (e.target.classList.contains("x")) return;
      activeRoute = i;
      syncRouteInputs();
      renderRoutes(); renderWpList();
      drawStatic();
    });
    chip.addEventListener("dblclick", () => {
      const n = prompt(tr("Name der Route:"), rt.name);
      if (n){ rt.name = n; renderRoutes(); updateTipPin(); }
    });
    const x = chip.querySelector(".x");
    if (x) x.addEventListener("click", () => {
      routes.splice(i, 1);
      if (activeRoute >= routes.length) activeRoute = routes.length - 1;
      syncRouteInputs(); renderRoutes(); renderWpList(); drawStatic();
    });
    el.appendChild(chip);
  });
}
function syncRouteInputs(){
  const rt = R();
  document.getElementById("lineColor").value = rt.color;
  document.getElementById("tipLabel").value = rt.tipLabel || "";
  const lbl = document.getElementById("tipPhotoLbl");
  lbl.classList.toggle("has-photo", !!rt.tipPhoto);
  lbl.childNodes[0].textContent = rt.tipPhoto ? tr("Foto ✓") : tr("Wählen");
  document.getElementById("gpxInfo").textContent = rt.gpx ? "GPX aktiv (" + rt.gpx.length + " Punkte)" : "";
}
document.getElementById("routeAdd").addEventListener("click", () => {
  routes.push(newRoute("Route " + (routes.length + 1), PALETTE[routes.length % PALETTE.length]));
  activeRoute = routes.length - 1;
  syncRouteInputs(); renderRoutes(); renderWpList(); drawStatic();
});
document.getElementById("lineColor").addEventListener("input", () => { R().color = val("lineColor"); renderRoutes(); });

/* ---------- Waypoint-UI (aktive Route) ---------- */
function addWaypoint(name, lat, lng){
  R().waypoints.push({ id: ++wpCounter, name: name || "", lat, lng, photo: null,
                       color: R().color });
  renderWpList();
  drawStatic();
}

function renderWpList(){
  const list = document.getElementById("wpList");
  list.innerHTML = "";
  R().waypoints.forEach((wp, i) => {
    const div = document.createElement("div");
    div.className = "wp";
    const cur = wp.mode || "";
    const recent = recentModes().filter(k => MODES[k]);
    const show = [...new Set([cur || val("travelMode"), ...recent, "car", "foot", "train", "ferry", "fly"])].filter(Boolean).slice(0, 6);
    const chip = k => `<button type="button" class="mchip${cur === k ? " on" : ""}${!cur && val("travelMode") === k ? " def" : ""}" data-mode="${k}" title="${tr(MODES[k].label)}">${MODES[k].icon}</button>`;
    const groups = {};
    Object.entries(MODES).forEach(([k, m]) => (groups[m.group] = groups[m.group] || []).push(k));
    const picker = `<div class="mpick" hidden>${Object.entries(groups).map(([g, ks]) =>
      `<div class="mgrp"><span>${tr(g)}</span><div>${ks.map(k => `<button type="button" class="mopt${cur === k ? " on" : ""}" data-mode="${k}"><em>${MODES[k].icon}</em>${tr(MODES[k].label)}</button>`).join("")}</div></div>`).join("")}</div>`;
    div.innerHTML = (i > 0 ? `<div class="legsel"><div class="mchips">${show.map(chip).join("")}<button type="button" class="mmore" title="${tr("Alle Verkehrsmittel")}">⋯</button></div>` +
      `<button type="button" class="lspeed" title="${tr("Tempo dieser Etappe")}">${(wp.speed || 1) < 1 ? (wp.speed === 0.5 ? "½" : "¼") : (wp.speed || 1)}×</button></div>${picker}` : "") + `
      <div class="idx">${i + 1}</div>
      <div class="row">
        <input type="text" data-f="name" placeholder="${tr("Name")}" value="${escapeHtml(wp.name)}">
        <input type="color" data-f="color" value="${escapeHtml(wp.color)}" title="${tr("Stoppfarbe")}" style="width:34px;flex:none;padding:1px;border:1px solid var(--line);border-radius:6px;background:#fff;">
      </div>
      <div class="row coords">
        <input type="number" data-f="lat" step="0.0001" placeholder="${tr("Breite")}" value="${wp.lat.toFixed(4)}">
        <input type="number" data-f="lng" step="0.0001" placeholder="${tr("Länge")}" value="${wp.lng.toFixed(4)}">
      </div>
      <div class="tools">
        <label class="photo-label ${wp.photo ? "has-photo" : ""}">${wp.photo ? tr("Foto ✓ (ändern)") : tr("Foto hinzufügen")}<input type="file" accept="image/*"></label>
        <button class="del" title="${tr("Entfernen")}">✕</button>
      </div>`;
    div.querySelectorAll("input[data-f], select[data-f]").forEach(inp => {
      inp.addEventListener("change", () => {
        const f = inp.dataset.f;
        wp[f] = (f === "name" || f === "color" || f === "mode") ? inp.value : parseFloat(inp.value);
        drawStatic();
      });
    });
    div.querySelectorAll(".mchip, .mopt").forEach(b => b.addEventListener("click", () => {
      wp.mode = wp.mode === b.dataset.mode && b.classList.contains("mchip") ? "" : b.dataset.mode;
      if (wp.mode) pushRecentMode(wp.mode);
      renderWpList(); drawStatic();
    }));
    const more = div.querySelector(".mmore");
    if (more) more.addEventListener("click", () => { const pk = div.querySelector(".mpick"); pk.hidden = !pk.hidden; more.classList.toggle("on", !pk.hidden); });
    const sp = div.querySelector(".lspeed");
    if (sp) sp.addEventListener("click", () => {
      wp.speed = LEG_SPEEDS[(LEG_SPEEDS.indexOf(wp.speed || 1) + 1) % LEG_SPEEDS.length];
      renderWpList(); drawStatic();
    });
    div.querySelector(".del").addEventListener("click", () => {
      R().waypoints = R().waypoints.filter(w => w !== wp);
      renderWpList(); drawStatic();
    });
    div.querySelector('input[type=file]').addEventListener("change", e => {
      const file = e.target.files[0];
      if (!file) return;
      const img = new Image();
      img.onload = () => { wp.photo = img; renderWpList(); drawStatic(); };
      img.src = URL.createObjectURL(file);
    });
    list.appendChild(div);
  });
}
function escapeHtml(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

/* Suche über Nominatim */
document.getElementById("searchBtn").addEventListener("click", doSearch);
document.getElementById("searchInput").addEventListener("keydown", e => { if (e.key === "Enter") doSearch(); });
async function doSearch(){
  const q = document.getElementById("searchInput").value.trim();
  if (!q) return;
  setStatus("Suche „" + q + "“ …");
  try {
    const r = await fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=de&q=" + encodeURIComponent(q));
    const res = await r.json();
    if (!res.length){ setStatus(tr("Nichts gefunden.")); return; }
    const hit = res[0];
    const short = hit.display_name.split(",")[0];
    addWaypoint(short, parseFloat(hit.lat), parseFloat(hit.lon));
    document.getElementById("searchInput").value = "";
    map.easeTo({ center: [parseFloat(hit.lon), parseFloat(hit.lat)], zoom: Math.max(map.getZoom(), 5) });
    setStatus("„" + short + "“ hinzugefügt.");
  } catch (e){ setStatus("Suche fehlgeschlagen (offline?). Koordinaten manuell eingeben."); }
}

document.getElementById("addManual").addEventListener("click", () => {
  const c = map.getCenter();
  addWaypoint("", c.lat, c.lng);
});

/* GPX-Import */
document.getElementById("gpxInput").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const doc = new DOMParser().parseFromString(reader.result, "application/xml");
    let pts = [...doc.querySelectorAll("trkpt")];
    if (!pts.length) pts = [...doc.querySelectorAll("rtept")];
    if (!pts.length){ setStatus("Keine Trackpunkte in der GPX-Datei gefunden."); return; }
    let coords = pts.map(p => [parseFloat(p.getAttribute("lon")), parseFloat(p.getAttribute("lat"))]);
    const step = Math.max(1, Math.floor(coords.length / 3000));
    coords = coords.filter((_, i) => i % step === 0);
    R().gpx = coords;
    document.getElementById("gpxInfo").textContent = file.name + " · " + coords.length + " Punkte (Route „" + R().name + "“).";
    drawStatic();
    map.fitBounds(boundsOf(coords), { padding: 60, duration: 800 });
  };
  reader.readAsText(file);
});

/* ---------- Feature-Browser ---------- */
function featuresFC(){
  return { type: "FeatureCollection", features: features.map(f => ({
    type: "Feature",
    properties: { fid: f.id, color: f.color, op: f.op },
    geometry: f.geometry
  })) };
}
function refreshFeatures(){
  if (map.getSource("features")) map.getSource("features").setData(featuresFC());
}
function renderFeatList(){
  const list = document.getElementById("featList");
  list.innerHTML = "";
  features.forEach(f => {
    const div = document.createElement("div");
    div.className = "wp";
    div.innerHTML = `
      <div class="row">
        <input type="text" data-f="name" value="${escapeHtml(f.name)}" title="Name">
        <input type="color" data-f="color" value="${escapeHtml(f.color)}" style="width:34px;flex:none;padding:1px;border:1px solid var(--line);border-radius:6px;background:#fff;">
      </div>
      <div class="tools">
        <label style="font-size:11px;color:#8c7d72;display:flex;align-items:center;gap:4px;">${tr("Ab (s)")}
          <input type="number" data-f="appearT" min="0" step="0.1" value="${escapeHtml(f.appearT)}" placeholder="${tr("immer")}" style="width:56px;border:1px solid var(--line);border-radius:6px;padding:3px 5px;font-size:12px;background:var(--cream);color:var(--ink);">
        </label>
        <button class="btn ghost" data-a="fit" style="padding:3px 8px;font-size:11px;">${tr("Fit")}</button>
        <button class="del" title="Entfernen">✕</button>
      </div>`;
    div.querySelectorAll("[data-f]").forEach(inp => {
      inp.addEventListener("change", () => {
        const k = inp.dataset.f;
        if (k === "appearT") f.appearT = inp.value === "" ? null : parseFloat(inp.value);
        else f[k] = inp.value;
        f.op = f.appearT == null ? 1 : 0;
        refreshFeatures();
      });
    });
    div.querySelector('[data-a="fit"]').addEventListener("click", () => {
      const b = geomBounds(f.geometry);
      if (b) map.fitBounds(b, { padding: 60, duration: 700 });
    });
    div.querySelector(".del").addEventListener("click", () => {
      features = features.filter(x => x !== f);
      renderFeatList(); refreshFeatures();
    });
    list.appendChild(div);
  });
}
function geomBounds(g){
  let minX = 180, minY = 90, maxX = -180, maxY = -90, any = false;
  const walk = c => {
    if (typeof c[0] === "number"){
      any = true;
      minX = Math.min(minX, c[0]); minY = Math.min(minY, c[1]);
      maxX = Math.max(maxX, c[0]); maxY = Math.max(maxY, c[1]);
    } else c.forEach(walk);
  };
  walk(g.coordinates);
  return any ? [[minX, minY], [maxX, maxY]] : null;
}
function addFeature(name, geometry){
  features.push({ id: ++featCounter, name, geometry,
                  color: PALETTE[(featCounter - 1) % PALETTE.length], appearT: null, op: 1 });
  renderFeatList(); refreshFeatures();
}
document.getElementById("featBtn").addEventListener("click", doFeatSearch);
document.getElementById("featInput").addEventListener("keydown", e => { if (e.key === "Enter") doFeatSearch(); });
async function doFeatSearch(){
  const q = document.getElementById("featInput").value.trim();
  if (!q) return;
  setStatus("Suche Feature „" + q + "“ …");
  try {
    const r = await fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&polygon_geojson=1&accept-language=de&q=" + encodeURIComponent(q));
    const res = await r.json();
    if (!res.length || !res[0].geojson){ setStatus("Kein Geometrie-Treffer."); return; }
    const short = res[0].display_name.split(",")[0];
    addFeature(short, res[0].geojson);
    document.getElementById("featInput").value = "";
    const b = geomBounds(res[0].geojson);
    if (b) map.fitBounds(b, { padding: 60, duration: 800 });
    setStatus("Feature „" + short + "“ hinzugefügt.");
  } catch (e){ setStatus("Feature-Suche fehlgeschlagen."); }
}
document.getElementById("geojsonInput").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const j = JSON.parse(reader.result);
      const list = j.type === "FeatureCollection" ? j.features
        : j.type === "Feature" ? [j]
        : [{ type: "Feature", properties: {}, geometry: j }];
      let n = 0;
      for (const ft of list.slice(0, 50)){
        if (!ft.geometry) continue;
        addFeature((ft.properties && (ft.properties.name || ft.properties.NAME)) || "Feature " + (featCounter + 1), ft.geometry);
        n++;
      }
      setStatus(n + " Feature(s) importiert.");
    } catch (err){ setStatus("GeoJSON ungültig: " + err.message); }
  };
  reader.readAsText(file);
});

/* ---------- POIs entlang der Route (Overpass) ---------- */
const POI_CATS = {
  peak:    { color: "#3f7d4e", label: "Gipfel" },
  castle:  { color: "#7a4a2b", label: "Burg" },
  station: { color: "#2f6fde", label: "Bahnhof" },
  sight:   { color: "#c2733d", label: "Sehenswert" }
};
async function buildPoiIcons(){
  for (const [cat, def] of Object.entries(POI_CATS)){
    const c = document.createElement("canvas");
    c.width = 52; c.height = 52;
    const x = c.getContext("2d");
    x.shadowColor = "rgba(0,0,0,.4)"; x.shadowBlur = 5; x.shadowOffsetY = 2;
    x.fillStyle = "#ffffff";
    x.beginPath(); x.arc(26, 26, 21, 0, Math.PI * 2); x.fill();
    x.shadowColor = "transparent";
    x.fillStyle = def.color;
    x.beginPath(); x.arc(26, 26, 18, 0, Math.PI * 2); x.fill();
    x.fillStyle = "#ffffff";
    x.strokeStyle = "#ffffff"; x.lineWidth = 2.4; x.lineCap = "round";
    if (cat === "peak"){
      x.beginPath(); x.moveTo(15, 33); x.lineTo(24, 18); x.lineTo(29, 26); x.lineTo(33, 20); x.lineTo(38, 33); x.closePath(); x.fill();
    } else if (cat === "castle"){
      x.fillRect(16, 22, 20, 12);
      x.fillRect(16, 17, 4, 5); x.fillRect(24, 17, 4, 5); x.fillRect(32, 17, 4, 5);
    } else if (cat === "station"){
      x.beginPath(); x.moveTo(18, 17); x.lineTo(34, 17); x.quadraticCurveTo(37, 17, 37, 21); x.lineTo(37, 29);
      x.quadraticCurveTo(37, 32, 34, 32); x.lineTo(18, 32); x.quadraticCurveTo(15, 32, 15, 29); x.lineTo(15, 21);
      x.quadraticCurveTo(15, 17, 18, 17); x.fill();
      x.fillStyle = def.color; x.fillRect(19, 20, 14, 6);
      x.fillStyle = "#ffffff";
      x.beginPath(); x.arc(20, 35, 2.4, 0, Math.PI * 2); x.arc(32, 35, 2.4, 0, Math.PI * 2); x.fill();
    } else {
      x.beginPath();
      for (let i = 0; i < 5; i++){
        const a = -Math.PI / 2 + i * 2 * Math.PI / 5;
        const b = a + Math.PI / 5;
        x.lineTo(26 + Math.cos(a) * 10, 26 + Math.sin(a) * 10);
        x.lineTo(26 + Math.cos(b) * 4.5, 26 + Math.sin(b) * 4.5);
      }
      x.closePath(); x.fill();
    }
    const name = "poi-" + cat;
    if (map.hasImage(name)) map.removeImage(name);
    map.addImage(name, await createImageBitmap(c), { pixelRatio: 2 });
  }
}
function refreshPois(){
  if (!map.getSource("pois")) return;
  map.getSource("pois").setData({ type: "FeatureCollection", features: pois.map(p => ({
    type: "Feature", properties: { icon: "poi-" + p.cat, name: p.name },
    geometry: { type: "Point", coordinates: [p.lng, p.lat] }
  })) });
  document.getElementById("poiInfo").textContent = pois.length
    ? pois.length + " POIs auf der Karte."
    : "Lädt benannte Orte aus OpenStreetMap im Umkreis der Route und markiert sie mit Icons.";
}
document.getElementById("poiClear").addEventListener("click", () => { pois = []; refreshPois(); });
document.getElementById("poiLoad").addEventListener("click", async () => {
  const a = await ensureAnim();
  if (!a){ setStatus(tr("Erst eine Route anlegen.")); return; }
  // Korridor-Abfrage: Overpass filtert selbst entlang der Route (statt riesiger Bounding-Box)
  const corridorM = Math.max((num("poiDist") || 8) * 1000, 1000);
  const step = Math.max(1, Math.ceil(a.allCoords.length / 80));
  const line = a.allCoords.filter((_, i) => i % step === 0 || i === a.allCoords.length - 1)
    .map(c => c[1].toFixed(5) + "," + c[0].toFixed(5)).join(",");
  const around = "(around:" + Math.round(corridorM) + "," + line + ")";
  const parts = [];
  if (checked("poiPeak"))    parts.push('node["natural"="peak"]["name"]' + around + ';');
  if (checked("poiCastle"))  parts.push('node["historic"~"^(castle|fort|fortress)$"]["name"]' + around + ';');
  if (checked("poiStation")) parts.push('node["railway"="station"]["name"]' + around + ';');
  if (checked("poiSight"))   parts.push('node["tourism"~"^(attraction|viewpoint)$"]["name"]' + around + ';');
  if (!parts.length){ setStatus(tr("Mindestens eine POI-Kategorie wählen.")); return; }
  const q = "[out:json][timeout:40];(" + parts.join("") + ");out body 600;";
  const SERVERS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter"
  ];
  let j = null, lastErr = null;
  for (let i = 0; i < SERVERS.length && !j; i++){
    setStatus("Lade POIs von OpenStreetMap (Server " + (i + 1) + "/" + SERVERS.length + ", kann 10–30 s dauern) …");
    try {
      const r = await fetch(SERVERS[i], {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(q)
      });
      if (!r.ok) throw new Error("Server " + (i + 1) + " antwortet mit " + r.status);
      j = await r.json();
    } catch (err){ lastErr = err; setStatus("Server " + (i + 1) + " fehlgeschlagen (" + err.message + ") – versuche nächsten …"); }
  }
  try {
    if (!j) throw lastErr || new Error("kein Server erreichbar");
    // Abstand zur Route nur noch fürs Sortieren (Korridor filtert der Server)
    const sStep = Math.max(1, Math.floor(a.allCoords.length / 200));
    const samples = a.allCoords.filter((_, i) => i % sStep === 0);
    const catOf = el => {
      const tg = el.tags || {};
      if (tg.natural === "peak") return "peak";
      if (tg.historic) return "castle";
      if (tg.railway === "station") return "station";
      return "sight";
    };
    const cand = [];
    for (const el of (j.elements || [])){
      if (el.lat == null) continue;
      let dmin = Infinity;
      for (const s of samples){
        const d = haversine(s, [el.lon, el.lat]);
        if (d < dmin) dmin = d;
      }
      cand.push({ name: el.tags.name, cat: catOf(el), lng: el.lon, lat: el.lat,
                  ele: parseFloat((el.tags.ele || "0").replace(",", ".")) || 0, d: dmin });
    }
    // Pro Kategorie begrenzen (Gipfel nach Höhe, Rest nach Nähe zur Route)
    pois = [];
    for (const cat of Object.keys(POI_CATS)){
      const list = cand.filter(c => c.cat === cat);
      list.sort((x, y) => cat === "peak" ? y.ele - x.ele : x.d - y.d);
      pois.push(...list.slice(0, 25));
    }
    refreshPois();
    setStatus(pois.length + " POIs geladen (" + cand.length + " im Korridor gefunden, pro Kategorie max. 25 angezeigt).");
  } catch (err){ setStatus("POI-Laden fehlgeschlagen: " + err.message); }
});

/* ---------- Farb-Editor (5-Grundfarben-Prinzip) ---------- */
const PALETTES = [
  { land: "#f3eee5", water: "#c6dbe8", boundary: "#d3c4b6", label: "#6d2e38" },
  { land: "#1d1e22", water: "#303a46", boundary: "#a03844", label: "#e8e9ee" },
  { land: "#10131a", water: "#1c2740", boundary: "#2e4a7a", label: "#9fc2ff" },
  { land: "#f7f1e1", water: "#a8c6b8", boundary: "#b8a888", label: "#3f4a3c" },
  { land: "#efe6da", water: "#88b3c8", boundary: "#c58f6d", label: "#334455" },
  { land: "#22262a", water: "#15393b", boundary: "#3e7a6c", label: "#c8f0dd" },
  { land: "#fdf6ec", water: "#f0c9a8", boundary: "#d88c51", label: "#7a3b1e" },
  { land: "#e8e8e8", water: "#ffffff", boundary: "#bbbbbb", label: "#333333" }
];
function renderPalettes(){
  const el = document.getElementById("palList");
  el.innerHTML = "";
  PALETTES.forEach(p => {
    const b = document.createElement("button");
    b.style.cssText = "display:flex;border:1px solid var(--line);border-radius:6px;overflow:hidden;cursor:pointer;padding:0;background:none;";
    b.title = "Palette anwenden";
    [p.land, p.water, p.boundary, p.label].forEach(c => {
      const s = document.createElement("span");
      s.style.cssText = "width:16px;height:20px;background:" + c;
      b.appendChild(s);
    });
    b.addEventListener("click", () => {
      document.getElementById("ccLand").value = p.land;
      document.getElementById("ccWater").value = p.water;
      document.getElementById("ccBoundary").value = p.boundary;
      document.getElementById("ccLabel").value = p.label;
      customColors = { ...p };
      rebuildStyle();
    });
    el.appendChild(b);
  });
}
function readCustomColors(){
  customColors = {
    land: val("ccLand"), water: val("ccWater"),
    boundary: val("ccBoundary"), label: val("ccLabel")
  };
}
["ccLand", "ccWater", "ccBoundary", "ccLabel"].forEach(id =>
  document.getElementById(id).addEventListener("change", () => { readCustomColors(); rebuildStyle(); }));
document.getElementById("ccReset").addEventListener("click", () => { customColors = null; rebuildStyle(); });
document.getElementById("mtKey").addEventListener("change", rebuildStyle);
["dtStates", "dtRoads", "dtRail", "dtWood", "dtUrban", "dtParks", "dtTowns", "dtLabels", "projGlobe", "cloudLayer"].forEach(id =>
  document.getElementById(id).addEventListener("change", rebuildStyle));
/* Stil wechseln: Terrain vorher aus (sonst rendert MapLibre Terrain ohne DEM-Quelle),
   Laufzeit-Ebenen neu anlegen, neu zeichnen. styleBusy = Promise bis alles fertig ist. */
let styleBusy = Promise.resolve();
function swapStyle(after){
  try { map.setTerrain(null); } catch {}
  map.setStyle(buildBaseStyle(val("mapStyle")), { diff: false });
  styleBusy = new Promise(res => map.once("style.load", async () => {
    try {
      addRuntimeLayers();
      refreshFeatures();
      if (after) await after();
      await drawStatic();
    } finally { res(); }
  }));
  return styleBusy;
}
function rebuildStyle(){
  if (playing) return;
  swapStyle();
}

/* ---------- Geometrie ---------- */
function toRad(d){ return d * Math.PI / 180; }
function toDeg(r){ return r * 180 / Math.PI; }
function haversine(a, b){
  const R = 6371, dLat = toRad(b[1] - a[1]), dLng = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function greatCircleLeg(a, b, n){
  const lat1 = toRad(a[1]), lng1 = toRad(a[0]), lat2 = toRad(b[1]), lng2 = toRad(b[0]);
  const d = 2 * Math.asin(Math.sqrt(Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lng2 - lng1) / 2) ** 2));
  if (d < 1e-9) return [a, b];
  const out = [];
  for (let i = 0; i <= n; i++){
    const f = i / n;
    const A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lng1) + B * Math.cos(lat2) * Math.cos(lng2);
    const y = A * Math.cos(lat1) * Math.sin(lng1) + B * Math.cos(lat2) * Math.sin(lng2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    out.push([toDeg(Math.atan2(y, x)), toDeg(Math.atan2(z, Math.hypot(x, y)))]);
  }
  return out;
}
/* Bogen-Etappe (Flug/Fähre): Großkreis, seitlich ausgebeult (bend = Anteil der Strecke) */
function arcLeg(a, b, n, bend){
  const gc = greatCircleLeg(a, b, n);
  if (gc.length < 3 || !bend) return gc;
  let dx = b[0] - a[0];
  if (dx > 180) dx -= 360; else if (dx < -180) dx += 360;
  const dy = b[1] - a[1];
  const nx = -dy, ny = dx;                       // Normale (links der Fahrtrichtung)
  return gc.map((p, i) => {
    const f = i / (gc.length - 1), k = Math.sin(Math.PI * f) * bend;
    return [p[0] + nx * k, p[1] + ny * k];
  });
}

/* Verkehrsmittel pro Etappe
   route: Routing-Profil (sonst Luftlinie/Bogen mit arc), pace: Dauer-Faktor (Gehen ≈ 2× Auto),
   zoom: Zoom-Versatz der Folgekamera (Flug weiter draußen), color/dash: fester Linienstil */
const MODES = {
  foot:      { group: "Zu Fuß",          icon: "🚶", label: "Zu Fuß",      route: "foot", pace: 2,    zoom: 1.2 },
  run:       { group: "Zu Fuß",          icon: "🏃", label: "Laufen",      route: "foot", pace: 1.5,  zoom: 1.1 },
  horse:     { group: "Zu Fuß",          icon: "🐎", label: "Reiten",      route: "foot", pace: 1.5,  zoom: 1 },
  ski:       { group: "Zu Fuß",          icon: "⛷️", label: "Ski",         arc: 0,        pace: 1.2,  zoom: 1.2 },
  bike:      { group: "Land",            icon: "🚲", label: "Fahrrad",     route: "bike", pace: 1.4,  zoom: 0.6 },
  car:       { group: "Land",            icon: "🚗", label: "Auto",        route: "car",  pace: 1,    zoom: 0 },
  caravan:   { group: "Land",            icon: "🏕️", label: "Wohnwagen",   route: "car",  pace: 1.2,  zoom: 0 },
  camper:    { group: "Land",            icon: "🚐", label: "Camper",      route: "car",  pace: 1.15, zoom: 0 },
  moto:      { group: "Land",            icon: "🏍️", label: "Motorrad",    route: "car",  pace: 0.9,  zoom: 0.2 },
  bus:       { group: "Land",            icon: "🚌", label: "Bus",         route: "car",  pace: 1.1,  zoom: 0, color: "#ff9a1f", dash: 1 },
  truck:     { group: "Land",            icon: "🚚", label: "LKW",         route: "car",  pace: 1.15, zoom: 0 },
  train:     { group: "Schiene & Seil",  icon: "🚆", label: "Zug",         arc: 0,        pace: 0.7,  zoom: -0.6, dash: 1 },
  cablecar:  { group: "Schiene & Seil",  icon: "🚡", label: "Seilbahn",    arc: 0,        pace: 2.2,  zoom: 1.2, color: "#2b2d31" },
  chairlift: { group: "Schiene & Seil",  icon: "🚠", label: "Sessellift",  arc: 0,        pace: 2.4,  zoom: 1.4, color: "#2b2d31" },
  ferry:     { group: "Wasser",          icon: "⛴️", label: "Fähre",       arc: 0.12,     pace: 0.9,  zoom: -1,   color: "#ffffff", dash: 1 },
  cruise:    { group: "Wasser",          icon: "🛳️", label: "Kreuzfahrt",  arc: 0.1,      pace: 0.8,  zoom: -1.2, color: "#ffffff", dash: 1 },
  boat:      { group: "Wasser",          icon: "⛵", label: "Segelboot",   arc: 0.07,     pace: 1.3,  zoom: -0.6, color: "#ffffff", dash: 1 },
  kayak:     { group: "Wasser",          icon: "🛶", label: "Kajak",       arc: 0.03,     pace: 2.2,  zoom: 1,    color: "#ffffff", dash: 1 },
  fly:       { group: "Luft",            icon: "✈️", label: "Flug",        arc: 0.18,     pace: 0.45, zoom: -2.2 },
  heli:      { group: "Luft",            icon: "🚁", label: "Heli",        arc: 0.04,     pace: 0.8,  zoom: -0.8 },
  balloon:   { group: "Luft",            icon: "🎈", label: "Ballon",      arc: 0.03,     pace: 2,    zoom: 0.3 },
  paraglider:{ group: "Luft",            icon: "🪂", label: "Gleitschirm", arc: 0.05,     pace: 1.6,  zoom: 0.5 }
};
const LEG_SPEEDS = [1, 0.5, 0.25, 2, 4];
function recentModes(){ try { return JSON.parse(localStorage.getItem("ma.recentModes") || "[]"); } catch { return []; } }
function pushRecentMode(k){ try { localStorage.setItem("ma.recentModes", JSON.stringify([k, ...recentModes().filter(x => x !== k)].slice(0, 6))); } catch {} }
function legMode(wp){ return (wp && wp.mode) || val("travelMode"); }

function boundsOf(coords){
  let minX = 180, minY = 90, maxX = -180, maxY = -90;
  coords.forEach(c => { minX = Math.min(minX, c[0]); minY = Math.min(minY, c[1]); maxX = Math.max(maxX, c[0]); maxY = Math.max(maxY, c[1]); });
  return [[minX, minY], [maxX, maxY]];
}
function nearestIndex(coords, pt){
  let best = 0, bd = Infinity;
  coords.forEach((c, i) => {
    const d = (c[0] - pt[0]) ** 2 + (c[1] - pt[1]) ** 2;
    if (d < bd){ bd = d; best = i; }
  });
  return best;
}

/* Straßenrouting (FOSSGIS-OSRM) */
const legCache = new Map();
async function fetchRoadLeg(a, b, mode){
  const prof = { car: "routed-car", bike: "routed-bike", foot: "routed-foot" }[mode];
  const key = mode + "|" + a.join(",") + "|" + b.join(",");
  if (legCache.has(key)) return legCache.get(key);
  const url = "https://routing.openstreetmap.de/" + prof + "/route/v1/driving/" +
    a[0] + "," + a[1] + ";" + b[0] + "," + b[1] + "?overview=full&geometries=geojson";
  const r = await fetch(url);
  if (!r.ok) throw new Error("Routing-Server antwortet mit " + r.status);
  const j = await r.json();
  if (!j.routes || !j.routes.length) throw new Error("keine Route gefunden");
  let coords = j.routes[0].geometry.coordinates;
  const step = Math.max(1, Math.floor(coords.length / 1500));
  coords = coords.filter((_, i) => i % step === 0 || i === coords.length - 1);
  legCache.set(key, coords);
  return coords;
}

async function buildRouteFor(rt){
  if (rt.gpx){
    const stops = rt.waypoints.map(wp => ({ wp, idx: nearestIndex(rt.gpx, [wp.lng, wp.lat]) }))
                              .sort((a, b) => a.idx - b.idx);
    return { coords: rt.gpx, stops, legs: [{ from: 0, to: rt.gpx.length - 1, mode: legMode(null) }] };
  }
  if (rt.waypoints.length < 1) return null;
  const coords = [], stops = [], legs = [];
  for (let i = 0; i < rt.waypoints.length; i++){
    const a = [rt.waypoints[i].lng, rt.waypoints[i].lat];
    if (i === 0){ coords.push(a); stops.push({ wp: rt.waypoints[0], idx: 0 }); continue; }
    const prev = [rt.waypoints[i - 1].lng, rt.waypoints[i - 1].lat];
    const mode = legMode(rt.waypoints[i]), M = MODES[mode] || MODES.car;
    let leg;
    if (!M.route){
      leg = arcLeg(prev, a, 160, M.arc);
    } else {
      try {
        setStatus("Route „" + rt.name + "“: Etappe " + i + " von " + (rt.waypoints.length - 1) + " …");
        leg = await fetchRoadLeg(prev, a, M.route);
      } catch (err){
        setStatus("„" + rt.name + "“ Etappe " + i + ": Straßenroute fehlgeschlagen – Luftlinie verwendet.");
        leg = greatCircleLeg(prev, a, 160);
      }
    }
    const from = coords.length - 1;
    coords.push(...leg.slice(1));
    legs.push({ from, to: coords.length - 1, mode, speed: rt.waypoints[i].speed || 1 });
    stops.push({ wp: rt.waypoints[i], idx: coords.length - 1 });
  }
  return { coords, stops, legs };
}

/* Linien-Features je Etappe bis zur Spitze (tipIdx = gebrochener Index) */
function legFeatures(p, tipIdx){
  const out = [];
  const i0 = Math.floor(tipIdx), f = tipIdx - i0;
  for (const lg of p.legs){
    if (lg.from >= tipIdx) break;
    const end = Math.min(lg.to, i0);
    const line = p.coords.slice(lg.from, end + 1);
    if (end < lg.to && f > 0 && i0 + 1 < p.coords.length){
      const a = p.coords[i0], b = p.coords[i0 + 1];
      line.push([lerp(a[0], b[0], f), lerp(a[1], b[1], f)]);
    }
    if (line.length < 2) continue;
    const M = MODES[lg.mode] || {};
    out.push({ type: "Feature", properties: { color: M.color || p.rt.color, dash: M.dash || 0, mode: lg.mode },
               geometry: { type: "LineString", coordinates: line } });
  }
  return out;
}
function legAt(p, tipIdx){
  for (const lg of p.legs) if (tipIdx <= lg.to + 1e-6) return lg;
  return p.legs[p.legs.length - 1];
}
function headingAt(p, tipIdx){
  const n = p.coords.length, k = Math.max(2, Math.round(n / 400));
  const ia = Math.max(0, Math.floor(tipIdx) - k), ib = Math.min(n - 1, Math.ceil(tipIdx) + k);
  const A = maplibregl.MercatorCoordinate.fromLngLat(p.coords[ia]), B = maplibregl.MercatorCoordinate.fromLngLat(p.coords[ib]);
  if (A.x === B.x && A.y === B.y) return p._head || 0;
  return (p._head = Math.atan2(B.y - A.y, B.x - A.x));
}
function setLineWidths(w){
  map.setPaintProperty("route-line", "line-width", w);
  if (map.getLayer("route-core")) map.setPaintProperty("route-core", "line-width", Math.max(1, w * 0.32));
  if (map.getLayer("route-dash")) map.setPaintProperty("route-dash", "line-width", w);
  if (map.getLayer("route-casing")) map.setPaintProperty("route-casing", "line-width", w + Math.max(2.5, w * 0.8));
  if (map.getLayer("route-shadow")) map.setPaintProperty("route-shadow", "line-width", w * 2 + 4);
}

/* ---------- Animations-Kontext (alle Routen) ---------- */
/* Etappen-Dauer nach Bildschirm-Strecke: Wie weit wandert die Spitze im Bild,
   wenn die Kamera (inkl. Auto-Rauszoomen) ihr folgt? Daraus + Tempo-Gefühl die Dauer.
   Lange Etappen bekommen einen kleinen Distanz-Bonus, kurze eine Mindestdauer. */
const SCREEN_SPEED = { gemuetlich: 0.3, normal: 0.45, rasant: 0.72 };   // Bildbreiten (kurze Seite) pro Sekunde
function legScreenDur(coords, from, to, km, mode, followZoom, frameMin){
  const bb = boundsOf(coords.slice(from, to + 1));
  const fit = map.cameraForBounds(bb, { padding: 80 });
  let z = followZoom == null ? (anim0Zoom ?? 5) : followZoom + ((MODES[mode] || {}).zoom || 0);
  if (fit && followZoom != null) z = Math.min(z, fit.zoom + 0.35);
  const lat = (bb[0][1] + bb[1][1]) / 2;
  const mpp = 40075016.686 * Math.cos(lat * Math.PI / 180) / (512 * Math.pow(2, z));
  const frac = (km * 1000 / mpp) / frameMin;
  const v = SCREEN_SPEED[val("tplFeel")] || SCREEN_SPEED.normal;
  let dur = frac / v * (1 + 0.22 * Math.log10(1 + km / 100));
  dur *= Math.sqrt((MODES[mode] || {}).pace || 1);
  const minDur = 1.2 + 0.55 * Math.log10(1 + km / 10);     // kurze Etappen nie hektisch, lange etwas länger
  return Math.min(Math.max(dur, minDur), 10);
}
let anim0Zoom = null;
async function prepareAnim(){
  const speed = Math.max(num("speedMult") || 1, 0.1);
  const legDurBase = (num("legDur") || 4) / speed;
  const pauseDur = (num("pauseDur") || 0) / speed;
  const constSpeed = checked("constSpeed");
  const per = [];
  const allStopsFeats = [];
  // 1. alle Routen bauen (für Übersichts-Zoom)
  const built = [], rts = routes.slice();          // Schnappschuss: Szenenwechsel während await nicht stören lassen
  for (let ri = 0; ri < rts.length; ri++){
    const r = await buildRouteFor(rts[ri]);
    if (r && r.coords.length >= 2){ built.push({ ri, r }); rts[ri]._coords = r.coords; }
  }
  if (rts[0] !== routes[0]) return null;
  if (built.length){
    const oc = map.cameraForBounds(boundsOf(built.flatMap(b => b.r.coords)), { padding: 90 });
    anim0Zoom = oc ? oc.zoom : null;
  }
  const followZoom = typeof CAM !== "undefined" ? CAM.followZoom() : num("zoom");
  const [EW, EH] = val("resolution").split("x").map(Number);
  const frameMin = Math.min(EW, EH) || 1080;
  for (const { ri, r } of built){
    const rt = rts[ri];
    const coords = r.coords;
    const cum = [0];
    for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + haversine(coords[i - 1], coords[i]));
    const totalKm = cum[cum.length - 1] || 1;
    const stopIdxs = r.stops.map(s => s.idx);
    if (!stopIdxs.length || stopIdxs[0] !== 0) stopIdxs.unshift(0);
    if (stopIdxs[stopIdxs.length - 1] !== coords.length - 1) stopIdxs.push(coords.length - 1);
    const legKm = [];
    for (let i = 0; i < stopIdxs.length - 1; i++) legKm.push(cum[stopIdxs[i + 1]] - cum[stopIdxs[i]]);
    const segs = [];
    for (let i = 0; i < stopIdxs.length; i++){
      segs.push({ type: "pause", at: stopIdxs[i], dur: Math.max(pauseDur, 0.6 / speed), stopNo: i });
      if (i < stopIdxs.length - 1){
        const lg = r.legs && r.legs.length === stopIdxs.length - 1 ? r.legs[i] : null;
        const mode = lg ? lg.mode : legMode(null);
        let dur;
        if (constSpeed) dur = legScreenDur(coords, stopIdxs[i], stopIdxs[i + 1], legKm[i], mode, followZoom, frameMin) / speed;
        else dur = legDurBase * (((MODES[mode] || {}).pace) || 1);
        if (lg) dur /= lg.speed || 1;
        segs.push({ type: "leg", from: stopIdxs[i], to: stopIdxs[i + 1], dur, km: legKm[i] });
      }
    }
    // „Hier anhalten“ an Schildern: Etappe am Schild teilen und Pause einfügen
    if (typeof SIGNS !== "undefined") for (const pz of SIGNS.pausesFor(rt, coords)){
      const k = segs.findIndex(s => s.type === "leg" && pz.idx > s.from && pz.idx < s.to);
      if (k < 0) continue;
      const s = segs[k], whole = s.whole || s, span = (cum[s.to] - cum[s.from]) || 1, f = (cum[pz.idx] - cum[s.from]) / span;
      segs.splice(k, 1, { type: "leg", from: s.from, to: pz.idx, dur: Math.max(s.dur * f, 0.3), km: (s.km || 0) * f, whole },
        { type: "pause", at: pz.idx, dur: pz.dur / speed, sign: true },
        { type: "leg", from: pz.idx, to: s.to, dur: Math.max(s.dur * (1 - f), 0.3), km: (s.km || 0) * (1 - f), whole });
    }
    if (val("legFocus") === "last"){
      const legIx = segs.map((s, k) => s.type === "leg" && !s.whole ? k : -1).filter(k => k >= 0);
      const wholes = segs.filter(s => s.type === "leg" && s.whole).map(s => s.whole).filter((w, i, a) => a.indexOf(w) === i);
      const lastLeg = legIx.length + wholes.length > 1 ? Math.max(...segs.map((s, k) => s.type === "leg" ? k : -1)) : -1;
      if (lastLeg > 0){
        const lastWhole = segs[lastLeg].whole;
        const firstOfLast = lastWhole ? segs.findIndex(s => s.whole === lastWhole) : lastLeg;
        for (let k = 0; k < firstOfLast - 1; k++) segs[k].dur = 0;   // vorherige Etappen + Pausen sofort fertig
      }
    }
    // Start/Ende halten (z. B. für den Erdzoom): erste/letzte Pause verlängern
    const hIn = num("introHold") || 0, hOut = num("outroHold") || 0;
    if (hIn > 0 && segs[0] && segs[0].type === "pause") segs[0].dur += hIn;
    if (hOut > 0 && segs.length && segs[segs.length - 1].type === "pause") segs[segs.length - 1].dur += hOut;
    let tt = 0;
    segs.forEach(s => { s.t0 = tt; tt += s.dur; s.t1 = tt; });
    const stopMeta = [];
    for (const s of r.stops){
      const img = await buildPinImage(s.wp);
      allStopsFeats.push({ type: "Feature",
        geometry: { type: "Point", coordinates: coords[s.idx] || [s.wp.lng, s.wp.lat] },
        properties: { img, size: 0, label: labelFor(s.wp) } });
      stopMeta.push({ idx: s.idx, frac: cum[s.idx] / totalKm, feat: allStopsFeats.length - 1 });
    }
    const legs = r.legs && r.legs.length ? r.legs : [{ from: 0, to: coords.length - 1, mode: "car" }];
    per.push({ ri, rt, coords, cum, totalKm, segs, legs, natural: tt, stops: stopMeta, _tipIdx: 0 });
  }
  if (!per.length){
    // ohne Route: reine Kamera-/Ebenen-Animation, wenn eine feste Dauer gesetzt ist
    const td = num("totalDur");
    if (td > 0){
      const c = map.getCenter();
      anim = { per: [], natural: td, ovCam: { center: [c.lng, c.lat], zoom: map.getZoom() }, allCoords: [[c.lng, c.lat]],
               stopsData: { type: "FeatureCollection", features: [] } };
      return anim;
    }
    anim = null; return null;
  }
  const allCoords = per.flatMap(p => p.coords);
  const natural = Math.max(...per.map(p => p.natural));
  const ovCam = map.cameraForBounds(boundsOf(allCoords), { padding: 90 });
  await updateTipPin();
  anim = { per, natural, ovCam, allCoords,
           stopsData: { type: "FeatureCollection", features: allStopsFeats } };
  return anim;
}
async function ensureAnim(){
  if (anim) return anim;
  return await prepareAnim();
}
function timelineTotal(){
  const td = num("totalDur");
  if (td && td > 0) return td;
  if (tracks.line.length) return Math.max(...tracks.line.map(k => k.t), 1);
  return anim ? anim.natural : 10;
}

/* ---------- Sampling ---------- */
function easeInOut(t){ return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
function easeOutC(t){ return 1 - Math.pow(1 - t, 3); }
function easeInC(t){ return t * t * t; }
function quadInOut(t){ return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
function backOut(t){ const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
function lerp(a, b, f){ return a + (b - a) * f; }
function applyEase(name, f){
  switch (name){
    case "linear":    return f;
    case "quadInOut": return quadInOut(f);
    case "easeOut":   return easeOutC(f);
    case "easeIn":    return easeInC(f);
    case "snap":      return 1 - Math.pow(1 - f, 5);
    default:          return easeInOut(f);
  }
}

function sortedTrack(arr){ return [...arr].sort((a, b) => a.t - b.t); }
function sampleNum(arr, t, fb){
  if (!arr.length) return fb;
  const s = sortedTrack(arr);
  if (t <= s[0].t) return s[0].v;
  if (t >= s[s.length - 1].t) return s[s.length - 1].v;
  for (let i = 0; i < s.length - 1; i++){
    if (t >= s[i].t && t <= s[i + 1].t){
      const f = applyEase(s[i + 1].ease, (t - s[i].t) / (s[i + 1].t - s[i].t || 1e-9));
      return lerp(s[i].v, s[i + 1].v, f);
    }
  }
  return fb;
}
function samplePos(arr, t, tip){
  if (!arr.length) return null;
  const s = sortedTrack(arr);
  let a = s[0], b = s[s.length - 1], f = 0;
  if (t <= s[0].t){ a = b = s[0]; }
  else if (t >= s[s.length - 1].t){ a = b = s[s.length - 1]; }
  else {
    for (let i = 0; i < s.length - 1; i++){
      if (t >= s[i].t && t <= s[i + 1].t){
        a = s[i]; b = s[i + 1];
        f = applyEase(b.ease, (t - a.t) / (b.t - a.t || 1e-9));
        break;
      }
    }
  }
  const ca = a.follow ? tip : [a.lng, a.lat];
  const cb = b.follow ? tip : [b.lng, b.lat];
  return [lerp(ca[0], cb[0], f), lerp(ca[1], cb[1], f)];
}

/* Position der Linienspitze für Route p zum Zeitpunkt t */
function tipIndexFor(p, t){
  const total = timelineTotal();
  if (tracks.line.length){
    const frac = Math.min(Math.max(sampleNum(tracks.line, t, 0) / 100, 0), 1);
    const target = frac * p.totalKm;
    const cum = p.cum;
    let lo = 0, hi = cum.length - 1;
    while (lo < hi){ const mid = (lo + hi) >> 1; if (cum[mid] < target) lo = mid + 1; else hi = mid; }
    const i = Math.max(lo, 1);
    const span = cum[i] - cum[i - 1] || 1e-9;
    return (i - 1) + Math.min(Math.max((target - cum[i - 1]) / span, 0), 1);
  }
  const ts = t * (anim.natural / total);
  const easeFn = f => applyEase(val("legEase"), f);
  let tipIdx = 0;
  for (const seg of p.segs){
    if (ts >= seg.t1){ if (seg.type === "leg") tipIdx = seg.to; continue; }
    if (ts >= seg.t0){
      if (seg.type === "leg"){
        const pr = easeFn((ts - seg.t0) / seg.dur);
        tipIdx = seg.from + (seg.to - seg.from) * pr;
      } else tipIdx = seg.at;
      break;
    }
  }
  return tipIdx;
}
function tipFracFallback(t){
  if (!anim || !anim.per.length) return 0;
  const p = anim.per.find(x => x.ri === activeRoute) || anim.per[0];
  const idx = tipIndexFor(p, t);
  const i = Math.min(Math.floor(idx), p.cum.length - 1);
  return p.cum[i] / p.totalKm * 100;
}

/* ---------- Zentrale Render-Funktion (Playback + Scrubbing) ---------- */
let camPos = null;
// Stop-Motion: Zeit auf einen gleichmäßigen Takt runden, der glatt in die Export-Bildrate passt (jedes Bild 3× bzw. 2×/5× gleich lang)
function stopmoT(t){
  if (!checked("fxStopmotion")) return t;
  const fps = parseInt(val("expFps")) || 30, hold = Math.max(1, Math.round(fps / 12)), step = hold / fps;
  return Math.floor(t / step + 1e-6) * step;
}
function renderAt(t, live){
  if (!anim) return;
  t = stopmoT(t);
  hlAnim(t);
  const total = timelineTotal();
  t = Math.min(Math.max(t, 0), total);
  const tipStyle = val("tipStyle");
  const popStyle = val("popStyle");
  const popDur = popStyle === "instant" ? 0.01 : 0.6;

  // Linien + Spitzen aller Routen
  const lineFeats = [], tipFeats = [];
  const activeP = anim.per.find(p => p.ri === activeRoute) || anim.per[0];
  let activeTip = null, activeLeg = null;
  const models = [];
  for (const p of anim.per){
    const tipIdx = tipIndexFor(p, t);
    p._tipIdx = tipIdx;
    const i0 = Math.floor(tipIdx), f = tipIdx - i0;
    const tip = (f > 0 && i0 + 1 < p.coords.length)
      ? [lerp(p.coords[i0][0], p.coords[i0 + 1][0], f), lerp(p.coords[i0][1], p.coords[i0 + 1][1], f)]
      : p.coords[Math.min(i0, p.coords.length - 1)];
    if (p === activeP) activeTip = tip;
    lineFeats.push(...legFeatures(p, tipIdx));
    const done = tipIdx >= p.coords.length - 1 - 1e-6;
    const lg = legAt(p, tipIdx);
    if (p === activeP) activeLeg = lg;
    if (tipStyle !== "none" && t < total - 0.01 && !done){
      if (tipStyle === "model3d" && !dt("projGlobe")){
        const span = Math.max(lg.to - lg.from, 1e-6);
        // Luftfahrzeuge mit 3D-Terrain: ruhige Flughöhe über dem höchsten Punkt der Umgebung
        let groundM = null;
        if (M3D.isAir(lg.mode) && map.getTerrain()){
          groundM = 0;
          const n = 8, span2 = Math.max((lg.to - lg.from) * 0.12, 2);
          for (let k = -n; k <= n; k++){
            const ii = Math.min(Math.max(Math.round(tipIdx + k / n * span2), lg.from), lg.to);
            groundM = Math.max(groundM, map.queryTerrainElevation(p.coords[ii]) || 0);
          }
        }
        models.push({ groundM, lngLat: tip, heading: headingAt(p, tipIdx), mode: lg.mode, color: p.rt.color,
                      prog: (tipIdx - lg.from) / span, px: 64 * sampleNum(tracks.tipScale, t, num("tipScale")) });
      } else
        tipFeats.push({ type: "Feature",
          properties: { color: p.rt.color, icon: tipStyle === "mode" || tipStyle === "model3d" ? "tipmode-" + lg.mode + "-" + p.rt.id : (p.rt._tipIcon || "") },
          geometry: { type: "Point", coordinates: tip } });
    }
  }
  map.getSource("route").setData({ type: "FeatureCollection", features: lineFeats });
  map.getSource("tip").setData({ type: "FeatureCollection", features: tipFeats });
  const anyTip = tipFeats.length > 0;
  const dotOn = anyTip && (tipStyle === "pin" || tipStyle === "dot" || tipStyle === "stop");
  map.setPaintProperty("tip-dot", "circle-opacity", dotOn ? 1 : 0);
  map.setPaintProperty("tip-dot", "circle-stroke-opacity", dotOn ? 1 : 0);
  if (map.getLayer("tip-pin"))
    map.setPaintProperty("tip-pin", "icon-opacity", (tipStyle === "pin" || tipStyle === "stop" || tipStyle === "mode" || tipStyle === "avatar" || tipStyle === "model3d") && anyTip ? 1 : 0);
  M3D.update(models, t);

  // Stopps (pro Route, beim Überfahren)
  let dirty = false;
  for (const p of anim.per){
    for (const st of p.stops){
      const crossed = p._tipIdx >= st.idx - 1e-6;
      const n = st.feat;
      let size;
      if (live){
        if (crossed && popT[n] === undefined) popT[n] = t;
        if (popT[n] === undefined) size = 0;
        else {
          const lp = Math.min((t - popT[n]) / popDur, 1);
          size = popStyle === "pop" ? backOut(lp) : lp >= 1 ? 1 : easeInOut(lp);
        }
      } else size = crossed ? 1 : 0;
      const v = Math.round(size * 100) / 100;
      if (anim.stopsData.features[n].properties.size !== v){
        anim.stopsData.features[n].properties.size = v; dirty = true;
      }
    }
  }
  if (dirty) map.getSource("stops").setData(anim.stopsData);

  // Animierbare Stil-Attribute
  const lwS = sampleNum(tracks.lineWidth, t, num("lineWidth") || 3.5);
  setLineWidths(lwS);
  const glowS = sampleNum(tracks.glowOp, t, checked("glow") ? 0.55 : 0);
  map.setPaintProperty("route-glow", "line-opacity", glowS > 0 ? Math.min(1, glowS * 1.6) : 0);
  map.setPaintProperty("route-glow", "line-width", lwS * 4.2);
  map.setPaintProperty("route-glow", "line-blur", lwS * 3);
  if (map.getLayer("route-core")) map.setPaintProperty("route-core", "line-opacity", glowS > 0 ? 0.9 : 0);
  if (map.getLayer("stops-icons"))
    map.setLayoutProperty("stops-icons", "icon-size", ["*", ["get", "size"], sampleNum(tracks.pinScale, t, num("pinScale"))]);
  if (map.getLayer("tip-pin"))
    map.setLayoutProperty("tip-pin", "icon-size", sampleNum(tracks.tipScale, t, num("tipScale")));

  // Feature-Einblendungen
  let fDirty = false;
  features.forEach(f => {
    let op;
    if (f.appearT == null) op = 1;
    else if (t < f.appearT) op = 0;
    else op = easeOutC(Math.min((t - f.appearT) / 0.8, 1));
    op = Math.round(op * 100) / 100;
    if (f.op !== op){ f.op = op; fDirty = true; }
  });
  if (fDirty) refreshFeatures();

  // Kamera: ohne Keyframes → Kamera-Abschnitte (camera.js), sonst Keyframe-Kamera
  if (!tracks.pos.length && !tracks.zoom.length && !tracks.bearing.length && !tracks.pitch.length && typeof CAM !== "undefined"){
    const c = CAM.at(t);
    camPos = { lng: c.c[0], lat: c.c[1], zoom: c.z };
    map.jumpTo({ center: c.c, zoom: c.z, bearing: c.b, pitch: Math.min(Math.max(c.p, 0), 85) });
    return;
  }
  const hasPos = tracks.pos.length > 0;
  let zoomV = sampleNum(tracks.zoom, t, num("zoom") + (activeLeg && !tracks.zoom.length ? ((MODES[activeLeg.mode] || {}).zoom || 0) : 0));
  let bearV = tracks.bearing.length ? sampleNum(tracks.bearing, t, 0) : (num("rotSpeed") || 0) * t;
  const pitchV = sampleNum(tracks.pitch, t, num("pitch"));
  let center;
  if (hasPos) center = samplePos(tracks.pos, t, activeTip || anim.allCoords[0]);
  else if (val("camMode") === "overview"){
    center = anim.ovCam.center;
    if (!tracks.zoom.length) zoomV = anim.ovCam.zoom;
  } else center = activeTip || anim.allCoords[0];

  if (live && camPos){
    const sm = Math.max(1 - num("smooth"), 0.15);
    const cx = center.lng !== undefined ? center.lng : center[0];
    const cy = center.lat !== undefined ? center.lat : center[1];
    camPos.lng = hasPos ? cx : lerp(camPos.lng, cx, sm);
    camPos.lat = hasPos ? cy : lerp(camPos.lat, cy, sm);
    camPos.zoom = tracks.zoom.length ? zoomV : lerp(camPos.zoom, zoomV, sm * 0.7);
    map.jumpTo({ center: [camPos.lng, camPos.lat], zoom: camPos.zoom, bearing: bearV, pitch: pitchV });
  } else {
    const c = center.lng !== undefined ? [center.lng, center.lat] : center;
    camPos = { lng: c[0], lat: c[1], zoom: zoomV };
    map.jumpTo({ center: c, zoom: zoomV, bearing: bearV, pitch: pitchV });
  }
}

/* ---------- Statische Vorschau + Stil ---------- */
async function drawStatic(){
  if (!mapReady || !map.getSource("tip") || !map.getSource("route")) return;
  invalidateAnim();
  applyStyleSettings();
  const a = await prepareAnim();
  if (!map.getSource("tip") || !map.getSource("route") || !map.getSource("stops")) return;   // Stil wurde inzwischen getauscht
  if (/^Route „/.test(document.getElementById("status").textContent)) setStatus("");
  M3D.update([]);
  map.getSource("tip").setData(emptyFC());
  if (map.getLayer("tip-pin")) map.setPaintProperty("tip-pin", "icon-opacity", 0);
  map.setPaintProperty("tip-dot", "circle-opacity", 0);
  map.setPaintProperty("tip-dot", "circle-stroke-opacity", 0);
  if (!a){ map.getSource("route").setData(emptyFC()); map.getSource("stops").setData(emptyFC()); renderTimeline(); return; }
  map.getSource("route").setData({ type: "FeatureCollection",
    features: a.per.flatMap(p => legFeatures(p, p.coords.length - 1)) });
  features.forEach(f => f.op = 1);
  refreshFeatures();
  a.stopsData.features.forEach(ft => ft.properties.size = 0.75);
  map.getSource("stops").setData(a.stopsData);
  renderTimeline();
}

function applyStyleSettings(){
  if (!map.getLayer("route-line")) return;
  const width = num("lineWidth") || 3.5;
  const style = val("lineStyle");
  setLineWidths(width);
  if (map.getLayer("route-casing")) map.setLayoutProperty("route-casing", "visibility", checked("lineCasing") ? "visible" : "none");
  map.setPaintProperty("route-line", "line-dasharray",
    style === "dashed" ? [2.2, 1.8] : style === "dotted" ? [0.1, 2] : [1, 0]);
  const glowOn = checked("glow");
  map.setPaintProperty("route-glow", "line-width", width * 4.2);
  map.setPaintProperty("route-glow", "line-blur", width * 3);
  map.setPaintProperty("route-glow", "line-opacity", glowOn ? 0.88 : 0);
  if (map.getLayer("route-core")) map.setPaintProperty("route-core", "line-opacity", glowOn ? 0.9 : 0);
  map.setPaintProperty("tip-dot", "circle-radius", Math.max(6, width * 1.6));
  updateTipPin();
  if (map.getLayer("stops-icons")){
    map.setLayoutProperty("stops-icons", "icon-anchor", val("pinStyle") === "dot" ? "center" : "bottom");
    map.setLayoutProperty("stops-icons", "icon-size", ["*", ["get", "size"], num("pinScale")]);
    map.setLayoutProperty("stops-icons", "text-size", num("labelSize") || 14);
    const t = THEMES[val("mapStyle")];
    const cc = customColors || {};
    map.setPaintProperty("stops-icons", "text-color", cc.label || t.country.color);
    map.setPaintProperty("stops-icons", "text-halo-color", cc.land || t.country.halo);
    if (map.getLayer("pois-icons")){
      map.setPaintProperty("pois-icons", "text-color", cc.label || t.country.color);
      map.setPaintProperty("pois-icons", "text-halo-color", cc.land || t.country.halo);
    }
  }
}
["lineColor", "lineWidth", "lineStyle", "lineCasing", "glow", "tipStyle", "travelMode", "pinStyle",
 "pinScale", "tipScale", "labelSize", "pinFont", "legDur", "pauseDur", "constSpeed",
 "speedMult", "legEase"].forEach(id =>
  document.getElementById(id).addEventListener("change", async () => { await drawStatic(); setStatus(tr("Aktualisiert.")); }));
document.getElementById("totalDur").addEventListener("change", renderTimeline);

/* ---------- Timeline-UI ---------- */
const tlRuler = document.getElementById("tlRuler");
const tlTracksEl = document.getElementById("tlTracks");
const tlPlayhead = document.getElementById("tlPlayhead");
const tlTime = document.getElementById("tlTime");

function laneWidth(){ return tlRuler.clientWidth || 1; }
function t2x(t){ return t / timelineTotal() * laneWidth(); }
function x2t(x){ return Math.min(Math.max(x / laneWidth(), 0), 1) * timelineTotal(); }

function renderTimeline(){
  const total = timelineTotal();
  // Ruler
  tlRuler.innerHTML = "";
  const steps = [0.5, 1, 2, 5, 10, 15, 30, 60];
  let step = steps.find(s => total / s <= 16) || 60;
  for (let s = 0; s <= total + 1e-6; s += step){
    const tick = document.createElement("div");
    tick.className = "tick";
    tick.style.left = t2x(s) + "px";
    tick.textContent = (Math.round(s * 10) / 10) + "s";
    tlRuler.appendChild(tick);
  }
  // Tracks
  tlTracksEl.innerHTML = "";
  TRACK_DEFS.forEach(def => {
    const row = document.createElement("div");
    row.className = "tlRow";
    const lbl = document.createElement("div");
    lbl.className = "tlabel";
    lbl.textContent = tr(def.label);
    const addBtn = document.createElement("button");
    addBtn.className = "kfadd";
    addBtn.textContent = "＋";
    addBtn.title = "Keyframe am Playhead (aktueller Wert)";
    addBtn.addEventListener("click", async e => {
      e.stopPropagation();
      await ensureAnim();
      addKeyframe(def.key, Math.round(playheadT * 10) / 10);
    });
    const rv = document.createElement("span");
    rv.className = "tlval";
    rv.dataset.key = def.key;
    lbl.appendChild(rv);
    lbl.appendChild(addBtn);
    const lane = document.createElement("div");
    lane.className = "lane";
    lane.dataset.track = def.key;
    sortedTrack(tracks[def.key]).forEach(kf => {
      const dia = document.createElement("div");
      dia.className = "kfdia" + (selKf && selKf.kf === kf ? " sel" : "");
      dia.style.left = t2x(kf.t) + "px";
      dia.title = kf.t.toFixed(1) + " s" + (kf.v !== undefined ? " · " + kf.v : kf.follow ? " · an Linie" : "");
      dia.addEventListener("dblclick", e => {
        e.stopPropagation();
        tracks[def.key] = tracks[def.key].filter(k => k !== kf);
        if (selKf && selKf.kf === kf) selKf = null;
        renderTimeline(); renderInspector();
      });
      dia.addEventListener("pointerdown", e => {
        e.stopPropagation();
        e.preventDefault();
        const laneRect = lane.getBoundingClientRect();   // messen, solange die Spur noch im DOM ist
        selKf = { track: def.key, kf };
        document.querySelectorAll(".kfdia.sel").forEach(d => d.classList.remove("sel"));
        dia.classList.add("sel");
        renderInspector();
        const move = ev => {
          let nt = Math.round(x2t(ev.clientX - laneRect.left) * 10) / 10;
          if (Math.abs(nt - playheadT) < 0.15) nt = Math.round(playheadT * 10) / 10;   // Snap an Playhead
          nt = Math.max(0, Math.min(nt, timelineTotal()));
          kf.t = nt;
          dia.style.left = t2x(kf.t) + "px";
          dia.title = kf.t.toFixed(1) + " s";
          renderInspector();
        };
        const up = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
          renderTimeline();   // erst NACH dem Loslassen neu zeichnen
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      });
      lane.appendChild(dia);
    });
    lane.addEventListener("pointerdown", async e => {
      if (e.target !== lane) return;
      await ensureAnim();
      popT = {};
      const laneRect = lane.getBoundingClientRect();
      const move = ev => setPlayhead(x2t(ev.clientX - laneRect.left));
      move(e);
      const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    });
    lane.addEventListener("dblclick", async e => {
      if (e.target !== lane) return;
      await ensureAnim();
      const laneRect = lane.getBoundingClientRect();
      addKeyframe(def.key, Math.round(x2t(e.clientX - laneRect.left) * 10) / 10);
    });
    row.appendChild(lbl); row.appendChild(lane);
    tlTracksEl.appendChild(row);
  });
  setPlayhead(playheadT, false);
}

function addKeyframe(trackKey, t){
  let kf;
  const def = TRACK_DEFS.find(d => d.key === trackKey);
  if (trackKey === "pos"){
    const c = map.getCenter();
    kf = { t, lat: c.lat, lng: c.lng, follow: false, ease: "easeInOut" };
  } else if (trackKey === "line"){
    const v = anim ? Math.round(sampleNum(tracks.line, t, tipFracFallback(t)) * 10) / 10 : 0;
    kf = { t, v, ease: "easeInOut" };
  } else {
    kf = { t, v: Math.round((def.cur ? def.cur(t) : 0) * 100) / 100, ease: "easeInOut" };
  }
  tracks[trackKey].push(kf);
  selKf = { track: trackKey, kf };
  renderTimeline(); renderInspector();
  setStatus("Keyframe „" + trackKey + "“ bei " + t.toFixed(1) + " s.");
}
/* tipFracFallback: siehe Definition bei tipIndexFor (Multi-Routen-Version) */

function renderInspector(){
  const el = document.getElementById("tlInspector");
  if (!selKf){ el.innerHTML = '<span class="hint">' + tr("Kein Keyframe ausgewählt.") + '</span>'; return; }
  const { track, kf } = selKf;
  let html = `<b>${tr(TRACK_DEFS.find(d => d.key === track).label)}</b>
    <label>${tr("Zeit")} <input type="number" data-f="t" step="0.1" min="0" value="${kf.t.toFixed(1)}"></label>`;
  if (track === "pos"){
    html += `<label>${tr("Breite")} <input type="number" data-f="lat" step="0.001" value="${kf.lat.toFixed(3)}" ${kf.follow ? "disabled" : ""}></label>
      <label>${tr("Länge")} <input type="number" data-f="lng" step="0.001" value="${kf.lng.toFixed(3)}" ${kf.follow ? "disabled" : ""}></label>
      <label><input type="checkbox" data-f="follow" ${kf.follow ? "checked" : ""} style="width:auto;accent-color:var(--wine)"> ${tr("an Linie")}</label>`;
  } else {
    html += `<label>${tr("Wert")} <input type="number" data-f="v" step="0.1" value="${kf.v}"></label>`;
  }
  html += `<label>${tr("Easing")} <select data-f="ease">
      <option value="linear" ${kf.ease === "linear" ? "selected" : ""}>${tr("linear")}</option>
      <option value="quadInOut" ${kf.ease === "quadInOut" ? "selected" : ""}>${tr("quadratisch")}</option>
      <option value="easeInOut" ${kf.ease === "easeInOut" ? "selected" : ""}>${tr("kubisch (sanft)")}</option>
      <option value="easeOut" ${kf.ease === "easeOut" ? "selected" : ""}>${tr("ausklingend")}</option>
      <option value="easeIn" ${kf.ease === "easeIn" ? "selected" : ""}>${tr("anlaufend")}</option>
      <option value="snap" ${kf.ease === "snap" ? "selected" : ""}>${tr("Snap (Ruck)")}</option>
    </select></label>
    <button class="del">${tr("✕ löschen")}</button>`;
  el.innerHTML = html;
  el.querySelectorAll("[data-f]").forEach(inp => {
    inp.addEventListener("change", () => {
      const f = inp.dataset.f;
      if (f === "follow") kf.follow = inp.checked;
      else if (f === "ease") kf.ease = inp.value;
      else kf[f] = parseFloat(inp.value);
      renderTimeline(); renderInspector();
    });
  });
  el.querySelector(".del").addEventListener("click", () => {
    tracks[track] = tracks[track].filter(k => k !== kf);
    selKf = null;
    renderTimeline(); renderInspector();
  });
}

function trackReadout(key, t){
  if (key === "pos"){
    if (!tracks.pos.length) return val("camMode") === "overview" ? tr("Übersicht") : tr("folgt");
    return tr("KF");
  }
  const fb = key === "line" ? (anim ? tipFracFallback(t) : 0)
    : key === "zoom" ? num("zoom") : key === "bearing" ? 0 : key === "pitch" ? num("pitch")
    : key === "lineWidth" ? (num("lineWidth") || 3.5)
    : key === "glowOp" ? (checked("glow") ? 0.55 : 0)
    : key === "pinScale" ? num("pinScale") : num("tipScale");
  const v = sampleNum(tracks[key], t, fb);
  return (Math.round(v * 10) / 10) + (key === "line" ? " %" : "");
}
function updateReadouts(){
  document.querySelectorAll(".tlval").forEach(el =>
    el.textContent = trackReadout(el.dataset.key, playheadT));
}
function setPlayhead(t, render){
  playheadT = Math.min(Math.max(t, 0), timelineTotal());
  tlPlayhead.style.left = t2x(playheadT) + "px";
  tlTime.textContent = playheadT.toFixed(1) + " s";
  updateReadouts();
  if (render !== false && anim) renderAt(playheadT, false);
}
tlRuler.addEventListener("pointerdown", async e => {
  await ensureAnim();
  const rect = tlRuler.getBoundingClientRect();
  popT = {};
  const move = ev => setPlayhead(x2t(ev.clientX - rect.left));
  move(e);
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
});

/* Kamera-KF am Playhead aus aktueller Ansicht */
document.getElementById("tlAddCam").addEventListener("click", async () => {
  await ensureAnim();
  const t = Math.round(playheadT * 10) / 10;
  const c = map.getCenter();
  tracks.pos.push({ t, lat: c.lat, lng: c.lng, follow: false, ease: "easeInOut" });
  tracks.zoom.push({ t, v: Math.round(map.getZoom() * 10) / 10, ease: "easeInOut" });
  tracks.bearing.push({ t, v: Math.round(map.getBearing()), ease: "easeInOut" });
  tracks.pitch.push({ t, v: Math.round(map.getPitch()), ease: "easeInOut" });
  renderTimeline();
  setStatus("Kamera-Keyframes bei " + t.toFixed(1) + " s aus aktueller Ansicht angelegt.");
});

/* Linien-Verlauf in editierbare Keyframes umwandeln */
document.getElementById("tlLineKF").addEventListener("click", async () => {
  const a = await ensureAnim();
  if (!a){ setStatus("Erst Route anlegen."); return; }
  const total = timelineTotal();
  const scale = total / a.natural;
  tracks.line = [];
  for (const seg of a.segs){
    if (seg.type !== "leg") continue;
    const f0 = a.cum[seg.from] / a.totalKm * 100;
    const f1 = a.cum[seg.to] / a.totalKm * 100;
    if (!tracks.line.length || Math.abs(tracks.line[tracks.line.length - 1].t - seg.t0 * scale) > 0.01)
      tracks.line.push({ t: Math.round(seg.t0 * scale * 10) / 10, v: Math.round(f0 * 10) / 10, ease: "easeInOut" });
    tracks.line.push({ t: Math.round(seg.t1 * scale * 10) / 10, v: Math.round(f1 * 10) / 10, ease: "easeInOut" });
  }
  renderTimeline();
  setStatus("Linien-Keyframes erzeugt – Abstände = Geschwindigkeit, gleiche Werte = Pause.");
});

/* Presets */
document.getElementById("camPreset").addEventListener("change", async () => {
  const p = val("camPreset");
  document.getElementById("camPreset").value = "";
  if (!p) return;
  await ensureAnim();
  const T = timelineTotal();
  const z = num("zoom");
  const set = (id, v) => { const el = document.getElementById(id); el.type === "checkbox" ? el.checked = v : el.value = v; };
  tracks.pos = []; tracks.zoom = []; tracks.bearing = []; tracks.pitch = [];
  if (p === "vlog"){
    set("camMode", "follow"); set("smooth", 0.6); set("rotSpeed", 0); set("pitch", 0); set("stopZoom", false);
  } else if (p === "cine"){
    tracks.pos = [{ t: 0, lat: 0, lng: 0, follow: true, ease: "easeInOut" },
                  { t: T, lat: 0, lng: 0, follow: true, ease: "easeInOut" }];
    tracks.zoom = [{ t: 0, v: z - 0.4, ease: "easeInOut" }, { t: T, v: z + 0.4, ease: "easeInOut" }];
    tracks.bearing = [{ t: 0, v: -14, ease: "easeInOut" }, { t: T, v: 14, ease: "easeInOut" }];
    tracks.pitch = [{ t: 0, v: 32, ease: "easeInOut" }, { t: T, v: 46, ease: "easeInOut" }];
  } else if (p === "drone"){
    tracks.pos = [{ t: 0, lat: 0, lng: 0, follow: true, ease: "easeInOut" },
                  { t: T, lat: 0, lng: 0, follow: true, ease: "easeInOut" }];
    tracks.zoom = [{ t: 0, v: z + 1.4, ease: "easeInOut" }, { t: T / 2, v: z - 0.8, ease: "easeInOut" }, { t: T, v: z + 1.0, ease: "easeInOut" }];
    tracks.bearing = [{ t: 0, v: 0, ease: "easeInOut" }, { t: T / 2, v: 25, ease: "easeInOut" }, { t: T, v: -15, ease: "easeInOut" }];
    tracks.pitch = [{ t: 0, v: 52, ease: "easeInOut" }, { t: T / 2, v: 30, ease: "easeInOut" }, { t: T, v: 55, ease: "easeInOut" }];
  } else if (p === "snap70"){
    // Referenz 70 Sekunden Wiki: Snap-Zoom (3 Frames, ~13 %) direkt am Anfang, dann ruhiger Drift
    // (Drehung ~1,6 °/s, Zoom-out ~2 %/s), alle ~2,5 s ein neuer Snap.
    set("camMode", "overview");
    const z0 = anim.ovCam.zoom, c0 = anim.ovCam.center;
    const lng = c0.lng !== undefined ? c0.lng : c0[0], lat = c0.lat !== undefined ? c0.lat : c0[1];
    tracks.pos = [{ t: 0, lat, lng, follow: false, ease: "linear" }];
    tracks.pitch = [{ t: 0, v: 50, ease: "linear" }];
    tracks.bearing = [{ t: 0, v: -12, ease: "linear" }, { t: T, v: -12 + 1.6 * T, ease: "linear" }];
    const zk = [{ t: 0, v: z0, ease: "linear" }];
    let z = z0 + 0.18; zk.push({ t: 0.1, v: z, ease: "snap" });
    for (let t = 0.1; t < T - 0.3; ){
      const nt = Math.min(t + 2.5, T);
      z -= 0.03 * (nt - t); zk.push({ t: nt - (nt < T ? 0.1 : 0), v: z, ease: "linear" });
      if (nt >= T) break;
      z += 0.17; zk.push({ t: nt, v: z, ease: "snap" }); t = nt;
    }
    tracks.zoom = zk;
  } else if (p === "orbit"){
    set("camMode", "overview"); set("rotSpeed", 3); set("pitch", 40);
  }
  renderTimeline();
  setStatus("Preset angewendet – Keyframes in der Timeline anpassbar.");
});

/* ---------- Playback ---------- */
let animFrame = null;
/* Vorschau: Kacheln entlang des Kamerapfads vorladen (einmal je Projektzustand) */
let prefetchSig = "", prefetching = false;
// Nur echte Kartenkacheln prüfen (Vektor/Raster/Höhen) – GeoJSON-Ebenen werden jedes Frame neu gesetzt und „laden“ ständig
function baseTilesLoaded(){
  const st = map.style, tm = st && (st.tileManagers || st.sourceCaches);
  if (!tm) return true;
  for (const id in tm){
    const c = tm[id], src = c._source || (c.getSource && c.getSource());
    if (src && src.type === "geojson") continue;
    if (c.loaded && !c.loaded()) return false;
  }
  return true;
}
async function waitTiles(ms){
  const t0 = performance.now();
  while (performance.now() - t0 < ms){ if (baseTilesLoaded()) return true; await new Promise(r => setTimeout(r, 30)); }
  return false;
}
async function prefetchPath(fromT){
  const total = timelineTotal();
  const sig = JSON.stringify([total, val("resolution"), val("mapStyle"), checked("terrain3d"), tracks.pos, tracks.zoom, tracks.bearing, tracks.pitch,
    typeof CAM !== "undefined" ? CAM.get() : 0, anim.per.map(p => p.coords.length + ":" + p.natural.toFixed(2))]);
  if (sig === prefetchSig) return;
  prefetching = true;
  document.getElementById("tlPlay").textContent = "⏳";
  const N = Math.min(48, Math.max(6, Math.ceil(total / 0.35)));
  for (let k = 0; k <= N; k++){
    renderAt(total * k / N, false);
    await waitTiles(1500);
    if (k % 3 === 0) setStatus(tr("Lade Karte vor …") + " " + Math.round(k / N * 100) + " %");
  }
  prefetchSig = sig; prefetching = false;
  renderAt(fromT, false);
  await waitTiles(1500);
}
async function play(fromT, onDone){
  if (prefetching) return;
  const a = await ensureAnim();
  if (!a){ setStatus(tr("Mindestens zwei Orte (oder ein GPX-Track) nötig.")); onDone && onDone(false); return; }
  applyStyleSettings();
  const total = timelineTotal();
  if (fromT >= total - 0.05) fromT = 0;
  await prefetchPath(fromT);
  playing = true;
  document.getElementById("tlPlay").textContent = "⏸";
  popT = {};
  camPos = null;
  let start = performance.now() - fromT * 1000, last = performance.now(), held = 0;

  function frame(now){
    if (!playing) return;
    // fehlen Kacheln, Zeit kurz anhalten (max. 0,6 s am Stück) statt leere Karte zu zeigen
    const dt = now - last; last = now;
    if (!baseTilesLoaded() && held < 0.6){ start += dt; held += dt / 1000; }
    else held = Math.max(0, held - dt / 4000);
    const t = (now - start) / 1000;
    setPlayheadOnly(t);
    renderAt(t, true);
    if (t >= total){
      playing = false;
      document.getElementById("tlPlay").textContent = "▶";
      setStatus(tr("Fertig."));
      onDone && onDone(true);
      return;
    }
    animFrame = requestAnimationFrame(frame);
  }
  animFrame = requestAnimationFrame(frame);
}
function setPlayheadOnly(t){
  playheadT = Math.min(Math.max(t, 0), timelineTotal());
  tlPlayhead.style.left = t2x(playheadT) + "px";
  tlTime.textContent = playheadT.toFixed(1) + " s";
  updateReadouts();
}
function pause(){
  playing = false;
  if (animFrame) cancelAnimationFrame(animFrame);
  document.getElementById("tlPlay").textContent = "▶";
}
document.getElementById("tlPlay").addEventListener("click", () => {
  if (playing) pause();
  else play(playheadT);
});
document.getElementById("previewBtn").addEventListener("click", () => {
  if (playing) return;
  setStatus(tr("Vorschau läuft …"));
  play(0);
});
document.getElementById("resetBtn").addEventListener("click", () => {
  pause();
  playheadT = 0;
  drawStatic();
  setStatus(tr("Zurückgesetzt."));
});

/* ---------- Zähler-Overlay ---------- */
function kmAt(){
  if (!anim) return 0;
  let km = 0;
  for (const p of anim.per){
    const idx = p._tipIdx || 0, i = Math.min(Math.floor(idx), p.cum.length - 1);
    const f = idx - i, a = p.cum[i], b = p.cum[Math.min(i + 1, p.cum.length - 1)];
    km += a + (b - a) * f;
  }
  return km;
}
function drawOverlay(){
  const c = document.getElementById("ovl"), wrap = document.getElementById("mapwrap");
  const W = wrap.clientWidth, H = wrap.clientHeight;
  if (c.width !== W || c.height !== H){ c.width = W; c.height = H; }
  const g = c.getContext("2d"); g.clearRect(0, 0, W, H);
  if (!checked("ovOn") || !anim) return;
  const total = anim.per.reduce((a, p) => a + p.totalKm, 0) || 1;
  const km0 = num("ovKm0") || 0, rnd = Math.max(1, num("ovRound") || 10);
  const km = kmAt(), kmTxt = String(Math.round((km0 + km) / rnd) * rnd);
  const d0 = parseFloat(val("ovDay0")), d1 = parseFloat(val("ovDay1"));
  const day = isNaN(d0) ? null : Math.round(isNaN(d1) ? d0 : d0 + (d1 - d0) * (km / total));
  const u = Math.min(W, H * 0.5625);                 // Basis-Einheit (9:16 und 16:9 gleich groß)
  const f1 = Math.round(u * 0.105), f2 = Math.round(u * 0.052), pad = Math.round(u * 0.02);
  const font = (px) => "900 " + px + "px 'Archivo Black','Arial Black','Helvetica Neue',sans-serif";
  const x = Math.round(W * 0.12);
  let y = val("ovPos") === "bottom" ? Math.round(H * 0.78) : Math.round(H * 0.075);
  const box = (parts) => {
    let w = pad * 2; parts.forEach(([txt, px]) => { g.font = font(px); w += g.measureText(txt).width; });
    w += pad * 0.6 * (parts.length - 1);
    const h = Math.round(Math.max(...parts.map(p => p[1])) * 1.08);
    g.fillStyle = "#ffffff"; g.fillRect(x, y, w, h);
    let cx = x + pad; g.fillStyle = "#111111"; g.textBaseline = "alphabetic";
    parts.forEach(([txt, px]) => { g.font = font(px); g.fillText(txt, cx, y + h * 0.86 - (h - px * 1.08) * 0.1); cx += g.measureText(txt).width + pad * 0.6; });
    y += h + Math.round(u * 0.012);
  };
  box([[kmTxt, f1], ["KM", Math.round(f1 * 0.55)]]);
  if (day !== null) box([[(val("ovPrefix") || "") + day, Math.round(f1 * 0.78)]]);
}
const __renderAt0 = renderAt;
renderAt = function(t, live){ __renderAt0(t, live); drawOverlay(); };
["ovOn", "ovKm0", "ovRound", "ovDay0", "ovDay1", "ovPrefix", "ovPos"].forEach(id =>
  document.getElementById(id).addEventListener("input", () => { if (anim) renderAt(playheadT, false); else drawOverlay(); }));

/* ---------- Export ---------- */
async function waitIdle(ms = 25000){
  const t0 = performance.now();
  for (;;){
    map.redraw();
    if (map.loaded() && map.areTilesLoaded()){ map.redraw(); break; }
    if (performance.now() - t0 > ms) break;
    await new Promise(r => setTimeout(r, 25));
  }
}
function dl(blob, name){ const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
let mp4Busy = false;
document.getElementById("mp4Btn").addEventListener("click", () => exportMP4({ download: true }));
/* Framegenauer MP4-Export. opts: download (Datei speichern), points ({Name:[lng,lat]} → Positionen je Frame),
   wantPos (Positionen sammeln), allScenes (überschreibt Häkchen). Rückgabe: { blob, pos, frames, fps, w, h, err } */
async function exportMP4(opts = {}){
  if (playing || mp4Busy) return null;
  if (!window.VideoEncoder || !window.Mp4Muxer){ setStatus("Dieser Browser kann kein MP4 kodieren (WebCodecs fehlt) – bitte aktuelles Chrome/Edge nutzen."); return; }
  const allScenes = typeof SCENES !== "undefined" && (opts.allScenes ?? checked("expAllScenes")) && SCENES.count() > 1;
  const startScene = allScenes ? SCENES.active() : 0;
  const sceneList = allScenes ? [...Array(SCENES.count()).keys()] : [null];
  if (!(await ensureAnim()) && !allScenes){ setStatus(tr("Mindestens zwei Orte (oder ein GPX-Track) nötig.")); return null; }
  mp4Busy = true;
  const [W, H] = val("resolution").split("x").map(Number);
  const fps = parseInt(val("expFps")) || 30;
  const pr = map.getPixelRatio();
  let codec = "avc1.640034";
  if (!(await VideoEncoder.isConfigSupported({ codec, width: W, height: H })).supported) codec = "avc1.4d0034";
  const muxer = new Mp4Muxer.Muxer({ target: new Mp4Muxer.ArrayBufferTarget(), video: { codec: "avc", width: W, height: H, frameRate: fps }, fastStart: "in-memory" });
  let err = null;
  const enc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: e => err = e });
  enc.configure({ codec, width: W, height: H, bitrate: W * H > 4e6 ? 60e6 : 24e6, framerate: fps, latencyMode: "quality" });
  const out = document.createElement("canvas"); out.width = W; out.height = H; const g = out.getContext("2d");
  const pos = [], wantPos = opts.wantPos ?? (checked("expPos") || !!opts.points), t0 = performance.now();
  let fi = 0, skipped = 0;
  for (const sc of sceneList){
    if (err) break;
    if (sc !== null){ await SCENES.switchTo(sc); }
    const a = await ensureAnim();
    if (!a){ skipped++; continue; }
    applyStyleSettings();
    sizeStage(W, H); map.setPixelRatio(1); map.resize();
    await new Promise(r => setTimeout(r, 300));
    const total = timelineTotal(), n = Math.round(total * fps);
    popT = {}; camPos = null;
    for (let i = 0; i < n && !err; i++, fi++){
      const t = i / fps;
      setPlayheadOnly(t);
      if (checked("expBlur") && !checked("fxStopmotion")){   // Stop-Motion hält Bilder an → Unschärfe würde Schritte verschmieren
        // 6 Unterbilder über einen halben Frame (180°-Shutter) mitteln
        if (typeof CAM !== "undefined") CAM.drawBackdrop(g, W, H);
        const S = 6;
        for (let k = 0; k < S; k++){
          const tt = Math.max(0, t + (k / S - 0.25) / fps);
          renderAt(tt, true); await waitIdle();
          g.globalAlpha = 1 / (k + 1); g.drawImage(map.getCanvas(), 0, 0, W, H);
        }
        g.globalAlpha = 1; renderAt(t, false);
      } else {
        renderAt(t, true); await waitIdle();
        if (typeof CAM !== "undefined") CAM.drawBackdrop(g, W, H); else g.clearRect(0, 0, W, H);
        g.drawImage(map.getCanvas(), 0, 0, W, H);
      }
      if (typeof CAM !== "undefined") CAM.blurCanvas(g, W, H, t, fps);
      g.drawImage(document.getElementById("ovl"), 0, 0, W, H);   // Zähler + Labels + Schilder
      if (wantPos){
        const o = {};
        a.stopsData.features.forEach((f, k) => { const p = map.project(f.geometry.coordinates);
          o[(f.properties.label || f.properties.name || "stopp") + "#" + k] = [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]; });
        for (const [k, ll] of Object.entries(opts.points || {})){ const p = map.project(ll); o[k] = [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]; }
        pos.push(o);
      }
      const vf = new VideoFrame(out, { timestamp: Math.round(fi * 1e6 / fps), duration: Math.round(1e6 / fps) });
      enc.encode(vf, { keyFrame: fi % (fps * 2) === 0 || i === 0 }); vf.close();
      while (enc.encodeQueueSize > 6) await new Promise(r => setTimeout(r, 5));
      if (i % 10 === 0) setStatus("■ " + (sc !== null ? tr("Szene") + " " + (sc + 1) + "/" + sceneList.length + " · " : "") + "Frame " + (i + 1) + " / " + n + " …", true);
    }
  }
  await enc.flush(); muxer.finalize();
  const blob = new Blob([muxer.target.buffer], { type: "video/mp4" });
  const base = opts.name || "map-animation";
  if (fi && opts.download !== false) dl(blob, base + ".mp4");
  if (wantPos && fi && opts.download !== false) setTimeout(() => dl(new Blob([JSON.stringify({ fps, w: W, h: H, pos })], { type: "application/json" }), base + "_punkte.json"), 800);
  if (allScenes) await SCENES.switchTo(startScene);
  map.setPixelRatio(pr); sizeStage(null);
  mp4Busy = false;
  setStatus(err ? "Fehler beim Kodieren: " + err.message
    : !fi ? tr("Mindestens zwei Orte (oder ein GPX-Track) nötig.")
    : "MP4 gespeichert: " + fi + " Frames" + (allScenes ? ", " + (sceneList.length - skipped) + " " + tr("Szenen") : "") + ", " + ((performance.now() - t0) / 1000).toFixed(0) + " s Renderzeit, " + (blob.size / 1e6).toFixed(1) + " MB.");
  return { blob, pos, frames: fi, fps, w: W, h: H, err: err ? err.message : null };
}
document.getElementById("recordBtn").addEventListener("click", async () => {
  if (playing) return;
  await ensureAnim();
  const [w, h] = val("resolution").split("x").map(Number);
  sizeStage(w, h); drawOverlay();
  await new Promise(r => setTimeout(r, 600));
  if (anim) await prefetchPath(0);        // Vorladen nicht mit aufnehmen

  const canvas = map.getCanvas();
  const stream = canvas.captureStream(60);
  const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
  recChunks = [];
  recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 24_000_000 });
  recorder.ondataavailable = e => { if (e.data.size) recChunks.push(e.data); };
  recorder.onstop = () => {
    const blob = new Blob(recChunks, { type: "video/webm" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "map-animation.webm";
    a.click();
    sizeStage(null);
    setStatus(tr("Export gespeichert (map-animation.webm)."));
  };
  setStatus(tr("● Aufnahme läuft …"), true);
  recorder.start();
  play(0, () => { recorder.stop(); });
});

/* Vorschau zeigt immer exakt den Export-Ausschnitt: Die Karte hat die
   Export-Größe in CSS-Pixeln und wird per transform in die Bühne skaliert.
   Vorschau: pixelRatio = Bildschirm-Pixel pro Karten-Pixel (scharf + schnell).
   Export (w,h gesetzt): pixelRatio 1 → Canvas exakt W×H. */
let stageLock = false;
function sizeStage(w, h){
  const wrap = document.getElementById("mapwrap");
  const stage = document.getElementById("stage");
  const exportMode = w != null;
  stageLock = exportMode;
  if (!exportMode) [w, h] = val("resolution").split("x").map(Number);
  const pad = exportMode ? 0 : (stage.clientWidth < 600 ? 10 : 24);
  const sw = Math.max(1, stage.clientWidth - pad * 2), sh = Math.max(1, stage.clientHeight - pad * 2);
  const s = Math.min(sw / w, sh / h);
  const x = (stage.clientWidth - w * s) / 2, y = (stage.clientHeight - h * s) / 2;
  wrap.style.width = w + "px"; wrap.style.height = h + "px";
  wrap.style.transform = "translate(" + x + "px," + y + "px) scale(" + s + ")";
  const pr = exportMode ? 1 : Math.min(2, Math.max(0.35, s * (window.devicePixelRatio || 1)));
  if (Math.abs(map.getPixelRatio() - pr) > 0.01) map.setPixelRatio(pr);
  map.resize();
}
window.addEventListener("resize", () => { if (!stageLock) sizeStage(null); renderTimeline(); });
sizeStage(null);

/* Tastatur: Entf = Keyframe löschen, Pfeiltasten = verschieben (Shift = 1 s) */
document.addEventListener("keydown", e => {
  const tag = (e.target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "select" || tag === "textarea") return;
  if (!selKf) return;
  const { track, kf } = selKf;
  if (e.key === "Delete" || e.key === "Backspace"){
    tracks[track] = tracks[track].filter(k => k !== kf);
    selKf = null;
    renderTimeline(); renderInspector();
    e.preventDefault();
  } else if (e.key === "ArrowLeft" || e.key === "ArrowRight"){
    const d = (e.shiftKey ? 1 : 0.1) * (e.key === "ArrowLeft" ? -1 : 1);
    kf.t = Math.max(0, Math.round((kf.t + d) * 10) / 10);
    renderTimeline(); renderInspector();
    e.preventDefault();
  }
});

/* ---------- Projekt speichern/laden ---------- */
function imgToDataURL(img){
  if (!img) return null;
  const c = document.createElement("canvas");
  const max = 512, s = Math.min(1, max / Math.max(img.width, img.height));
  c.width = img.width * s; c.height = img.height * s;
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85);
}
const SETTING_IDS = ["mapStyle","pinStyle","glow","tipStyle","tipLabel","popStyle","pinScale","tipScale",
  "labelSize","pinFont","lineColor","lineWidth","lineStyle","lineCasing","travelMode","legDur","pauseDur","constSpeed",
  "camMode","zoom","stopZoom","pitch","smooth","rotSpeed","legEase","speedMult","endOverview","resolution",
  "totalDur","terrain3d","terrainEx","ccLand","ccWater","ccBoundary","ccLabel",
  "dtStates","dtRoads","dtRail","dtWood","dtUrban","dtParks","dtTowns","dtLabels","projGlobe","cloudLayer","fxVignette","fxStars","poiDist","uiLang","hlIso","hlColor","hlOp","hlLine","hlT0","expFps","ovOn","ovKm0","ovRound","ovDay0","ovDay1","ovPrefix","ovPos","expBlur","spriteSticker","fxStopmotion","asBrand","asRes","asKey","introOn","introStyle","introTitle","introSub","introDur","cntOn","cntLabel","cntStart","cntPos","profOn","profPos","profStyle","profSize","mmOn","mmPos","mmStyle","mmSize","mmAuto","mmTheme","tplLen","tplFeel","tplId","camPresetId","whipIn","whipOut","whipDir","legFocus","fxClouds","introHold","outroHold","signScale","rgMtn","rgLand","rgSea","rgSize"];

function serializeProject(){
  return {
    version: 5,
    settings: Object.fromEntries(SETTING_IDS.map(id => {
      const el = document.getElementById(id);
      return [id, el.type === "checkbox" ? el.checked : el.value];
    })),
    routes: routes.map(rt => ({
      name: rt.name, color: rt.color, tipLabel: rt.tipLabel, gpx: rt.gpx,
      tipPhoto: imgToDataURL(rt.tipPhoto), tipSprite: rt.tipSprite || null,
      waypoints: rt.waypoints.map(wp => ({ name: wp.name, lat: wp.lat, lng: wp.lng, color: wp.color, mode: wp.mode || "", speed: wp.speed || 1, photo: imgToDataURL(wp.photo) }))
    })),
    features: features.map(f => ({ name: f.name, geometry: f.geometry, color: f.color, appearT: f.appearT })),
    pois,
    customColors,
    tracks,
    cam: typeof CAM !== "undefined" ? CAM.get() : null,
    marks: typeof MARKS !== "undefined" ? MARKS.get() : [],
    labels: typeof LABELS !== "undefined" ? LABELS.get() : [],
    signs: typeof SIGNS !== "undefined" ? SIGNS.get() : [],
    assets: typeof ASSETS !== "undefined" ? ASSETS.get() : []
  };
}
function downloadJSON(obj, name){
  const blob = new Blob([JSON.stringify(obj)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
}
document.getElementById("projSave").addEventListener("click", () => {
  downloadJSON(typeof SCENES !== "undefined" ? SCENES.serializeAll() : serializeProject(), "kartenprojekt.json");
  setStatus(tr("Projekt gespeichert."));
});

/* Projekt-/Szenenzustand laden (Einstellungen, Routen, Kamera, Ebenen) – feuert danach „ma:loaded“ */
async function loadProject(proj){
  if (typeof MA_TEMPLATES !== "undefined") await MA_TEMPLATES.idle();   // laufendes Neuzeichnen abwarten
  for (const [id, v] of Object.entries(proj.settings || {})){
    const el = document.getElementById(id);
    if (!el) continue;
    if (el.type === "checkbox") el.checked = v; else el.value = v;
  }
  tracks = proj.tracks || {};
  ensureTrackKeys();
  if (typeof CAM !== "undefined") CAM.set(proj.cam);
  if (typeof MARKS !== "undefined") MARKS.set(proj.marks || []);
  if (typeof LABELS !== "undefined") LABELS.set(proj.labels || []);
  if (typeof ASSETS !== "undefined") ASSETS.set(proj.assets || []);
  if (typeof SIGNS !== "undefined") await SIGNS.set(proj.signs || []);
  customColors = proj.customColors || null;
  pois = proj.pois || [];
  features = [];
  featCounter = 0;
  for (const ft of (proj.features || []))
    features.push({ id: ++featCounter, name: ft.name, geometry: ft.geometry, color: ft.color, appearT: ft.appearT ?? null, op: 1 });
  const loadImg = src => new Promise(res => {
    if (!src) return res(null);
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });
  routes = [];
  routeCounter = 0;
  wpCounter = 0;
  const srcRoutes = proj.routes ||
    [{ name: "Route 1", color: PALETTE[0], tipLabel: "", gpx: proj.gpxTrack || null,
       tipPhoto: proj.tipPhoto || null, waypoints: proj.waypoints || [] }];
  for (const pr of srcRoutes){
    const rt = newRoute(pr.name || "Route", pr.color || PALETTE[0]);
    rt.tipLabel = pr.tipLabel || "";
    rt.gpx = pr.gpx || null;
    rt.tipPhoto = await loadImg(pr.tipPhoto);
    rt.tipSprite = pr.tipSprite || null;
    for (const w of (pr.waypoints || [])){
      const photo = await loadImg(w.photo);
      rt.waypoints.push({ id: ++wpCounter, name: w.name, lat: w.lat, lng: w.lng, color: w.color || rt.color, mode: w.mode || "", speed: w.speed || 1, photo });
    }
    routes.push(rt);
  }
  if (!routes.length) routes.push(newRoute("Route 1", PALETTE[0]));
  activeRoute = 0;
  prevStyle = val("mapStyle");
  // Stil neu aufbauen und alles zeichnen
  if (playing) pause();
  playheadT = 0; popT = {};
  await swapStyle(async () => {
    syncRouteInputs();
    renderRoutes();
    renderWpList();
    renderFeatList();
  });
  applyLang();
  document.dispatchEvent(new Event("ma:loaded"));
}
document.getElementById("projLoad").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const proj = JSON.parse(reader.result);
      if (typeof SCENES !== "undefined") await SCENES.loadAll(proj); else await loadProject(proj);
      setStatus(tr("Projekt geladen."));
    } catch (err){
      setStatus("Projekt konnte nicht geladen werden: " + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = "";
});

(() => {
  const sel = document.getElementById("travelMode"), cur = sel.value;
  sel.innerHTML = Object.entries(MODES).map(([k, m]) => `<option value="${k}">${m.icon} ${m.label}</option>`).join("");
  sel.value = MODES[cur] ? cur : "car";
  sel.addEventListener("change", () => renderWpList());
})();
routes.push(newRoute("Route 1", PALETTE[0]));
renderPalettes();
renderRoutes();
syncRouteInputs();
applyLang();
setStatus(tr("Karte lädt …"));

