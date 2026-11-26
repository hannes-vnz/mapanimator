"use strict";
/* =========================================================
   Gesperrte Regionslabels („A L P E N“, „S A H A R A“, „M I T T E L M E E R“)
   Daten: Natural Earth 1:50 Mio. geography_regions_polys + geography_marine_polys
   (deutsche Namen NAME_DE). Labelpunkt = Schwerpunkt des größten Teilpolygons.
   Sichtbarkeit nach Rang (MIN_LABEL) in Zoom-Stufen; Farben passend zum Theme.
   ========================================================= */
const REGIONS = (() => {
  const $ = id => document.getElementById(id);
  const BASE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/";
  const CLASSES = {
    mtn:  ["Range/mtn", "Plateau", "Foothills", "Gorge", "Valley"],
    land: ["Desert", "Plain", "Basin", "Tundra", "Lowland", "Delta", "Wetlands", "Geoarea", "Peninsula", "Pen/cape", "Isthmus"],
    sea:  ["ocean", "sea", "bay", "gulf", "strait", "channel", "sound"]
  };
  const BUCKETS = [[0, 2.5, 0], [2.5, 3.5, 2.6], [3.5, 4.5, 3.8], [4.5, 5.5, 5], [5.5, 99, 6.2]];   // [minLabel von, bis, minzoom]
  let data = null, loading = null;

  function centroid(g){
    const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
    let best = null, bestA = 0;
    for (const p of polys){
      const r = p[0]; let a = 0, cx = 0, cy = 0;
      for (let i = 0, j = r.length - 1; i < r.length; j = i++){ const f = r[j][0] * r[i][1] - r[i][0] * r[j][1]; a += f; cx += (r[j][0] + r[i][0]) * f; cy += (r[j][1] + r[i][1]) * f; }
      if (Math.abs(a) > bestA && a !== 0){ bestA = Math.abs(a); best = [cx / (3 * a), cy / (3 * a)]; }
    }
    return best;
  }
  async function load(){
    if (data) return data;
    loading = loading || Promise.all(["ne_50m_geography_regions_polys", "ne_50m_geography_marine_polys"].map(f => fetch(BASE + f + ".geojson").then(r => r.json())))
      .then(([land, sea]) => {
        const feats = [];
        const push = (f, cls, P) => {
          const c = centroid(f.geometry); if (!c) return;
          const de = P("NAME_DE") || P("NAME"), en = P("NAME_EN") || P("NAME");
          if (!de) return;
          const min = parseFloat(P("MIN_LABEL")) || 5, rank = parseFloat(P("SCALERANK")) || 4;
          feats.push({ type: "Feature", geometry: { type: "Point", coordinates: c },
            properties: { de: String(de).toUpperCase(), en: String(en).toUpperCase(), cls, min, k: rank <= 1 ? 1.35 : rank <= 2 ? 1.15 : rank <= 3 ? 1 : 0.85 } });
        };
        for (const f of land.features){
          const P = k => f.properties[k];
          const cl = P("FEATURECLA");
          const cls = CLASSES.mtn.includes(cl) ? "mtn" : CLASSES.land.includes(cl) ? "land" : null;
          if (cls) push(f, cls, P);
        }
        for (const f of sea.features){
          const P = k => f.properties[k.toLowerCase()];
          if (CLASSES.sea.includes(P("featurecla"))) push(f, "sea", P);
        }
        return { type: "FeatureCollection", features: feats };
      });
    data = await loading;
    return data;
  }

  const hex = h => { const n = parseInt((h || "#888888").slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, f) => "#" + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * f).toString(16).padStart(2, "0")).join("");
  function colors(){
    const t = THEMES[val("mapStyle")] || THEMES.hell, cc = (typeof customColors !== "undefined" && customColors) || {};
    if (t.raster) return { land: "#ffffff", halo: "rgba(0,0,0,.65)", sea: "#d8ecff", seaHalo: "rgba(0,0,0,.55)" };
    const lab = cc.label || t.country.color, halo = cc.land || t.country.halo, water = cc.water || t.water || "#9cc";
    return { land: lab, halo, sea: mix(water, "#0b1a33", 0.55), seaHalo: mix(water, "#ffffff", 0.35) };
  }
  const ids = () => BUCKETS.map((b, i) => "rg-" + i);
  function before(){ return ["hl-fill", "feat-fill", "route-glow"].find(id => map.getLayer(id)); }
  async function apply(){
    if (!map.getStyle()) return;
    const on = { mtn: checked("rgMtn"), land: checked("rgLand"), sea: checked("rgSea") };
    const any = on.mtn || on.land || on.sea;
    if (!any){ ids().forEach(id => map.getLayer(id) && map.setLayoutProperty(id, "visibility", "none")); return; }
    let d; try { d = await load(); } catch { setStatus(tr("Regionsdaten konnten nicht geladen werden.")); return; }
    try {
      if (!map.getSource("regions")) map.addSource("regions", { type: "geojson", data: d });
      const c = colors(), sz = num("rgSize") || 1, en = lang === "en";
      const cls = Object.keys(on).filter(k => on[k]);
      // Wichtige Regionen zuletzt hinzufügen → werden bei Überlappung bevorzugt platziert
      BUCKETS.map((b, i) => [b, i]).reverse().forEach(([[lo, hi, mz], i]) => {
        const id = "rg-" + i;
        if (!map.getLayer(id)) map.addLayer({ id, type: "symbol", source: "regions", minzoom: mz,
          layout: { "text-field": ["get", "de"], "text-font": ["Noto Sans Bold"], "text-allow-overlap": false, "text-padding": 14,
                    "text-max-width": 9, "text-transform": "uppercase", "symbol-sort-key": ["get", "min"] },
          paint: {} }, before());
        map.setFilter(id, ["all", [">=", ["get", "min"], lo], ["<", ["get", "min"], hi], ["in", ["get", "cls"], ["literal", cls]]]);
        map.setLayoutProperty(id, "visibility", "visible");
        map.setLayoutProperty(id, "text-field", ["get", en ? "en" : "de"]);
        map.setLayoutProperty(id, "text-font", ["case", ["==", ["get", "cls"], "sea"], ["literal", ["Noto Sans Italic"]], ["literal", ["Noto Sans Bold"]]]);
        map.setLayoutProperty(id, "text-size", ["interpolate", ["linear"], ["zoom"], 1, ["*", 12 * sz, ["get", "k"]], 5, ["*", 20 * sz, ["get", "k"]], 9, ["*", 30 * sz, ["get", "k"]]]);
        map.setLayoutProperty(id, "text-letter-spacing", ["case", ["==", ["get", "cls"], "sea"], 0.35, 0.6]);
        map.setPaintProperty(id, "text-color", ["case", ["==", ["get", "cls"], "sea"], c.sea, c.land]);
        map.setPaintProperty(id, "text-halo-color", ["case", ["==", ["get", "cls"], "sea"], c.seaHalo, c.halo]);
        map.setPaintProperty(id, "text-halo-width", 1.4);
        map.setPaintProperty(id, "text-opacity", ["case", ["==", ["get", "cls"], "mtn"], 0.85, 0.75]);
      });
    } catch { /* Stil lädt noch – addRuntimeLayers ruft erneut */ }
  }

  const baseARL = addRuntimeLayers;
  window.addRuntimeLayers = addRuntimeLayers = function (){ baseARL(); apply(); };
  ["rgMtn", "rgLand", "rgSea", "rgSize"].forEach(id => $(id).addEventListener(id === "rgSize" ? "input" : "change", apply));
  $("mapStyle").addEventListener("change", () => setTimeout(apply, 50));
  document.querySelectorAll("#langSel .lbtn").forEach(b => b.addEventListener("click", () => setTimeout(apply, 0)));
  document.addEventListener("ma:loaded", apply);

  Object.assign(EN, { "Regionslabels": "Region labels", "Gebirge": "Mountains", "Wüsten & Landschaften": "Deserts & landscapes", "Meere & Buchten": "Seas & bays",
    "Regionsdaten konnten nicht geladen werden.": "Region data could not be loaded.",
    "Gesperrte Namen wie „A L P E N“ oder „M I T T E L M E E R“ (Natural Earth). Wichtige Regionen erscheinen schon weit draußen, kleinere erst beim Reinzoomen.": "Spaced names like “A L P S” or “M E D I T E R R A N E A N” (Natural Earth). Major regions show when zoomed out, smaller ones when you zoom in." });

  return { apply, load };
})();
