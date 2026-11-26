"use strict";
/* =========================================================
   Markierungen (GeoLayers-Stil)
   Flächen/Linien/Punkte hervorheben mit animierten Effekten:
   Kontur zeichnet sich (line-gradient), Füllung blendet ein, Glühen, Schatten,
   Pulsieren, Fokus (Rest abdunkeln), 3D-Block (fill-extrusion).
   Jede Markierung ist ein Balken in der Timeline (t0 … t1, t1 = null → bis Ende).
   ========================================================= */
const MARKS = (() => {
  const $ = id => document.getElementById(id);
  const NE_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson";
  const DRAW = 1.1, FADE_IN = 0.6, FADE_OUT = 0.45;
  const COLORS = ["#ffcf33", "#ff5a5f", "#4fc3f7", "#7bd389", "#b388ff", "#ff9a3c", "#f06292", "#26c6da"];
  let list = [], counter = 0, sel = null, picking = false, ne = null, neLoading = null;
  const cache = new Map();   // Paint-Werte, um setPaintProperty nur bei Änderung zu rufen

  /* ---------- Geometrie-Helfer ---------- */
  const polys = g => g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
  const lines = g => g.type === "LineString" ? [g.coordinates] : g.type === "MultiLineString" ? g.coordinates
    : polys(g).flatMap(p => p);                                            // Polygon-Ringe als Linien
  const area = r => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]); return a / 2; };
  function inRing(pt, r){
    let ins = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++){
      const [xi, yi] = r[i], [xj, yj] = r[j];
      if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) ins = !ins;
    }
    return ins;
  }
  function inGeom(pt, g, bb){
    if (bb && (pt[0] < bb[0][0] || pt[0] > bb[1][0] || pt[1] < bb[0][1] || pt[1] > bb[1][1])) return false;
    return polys(g).some(p => inRing(pt, p[0]) && !p.slice(1).some(h => inRing(pt, h)));
  }
  function maskFC(g){
    const world = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]];
    const holes = polys(g).map(p => { const r = p[0].slice(); return area(r) > 0 === area(world) > 0 ? r.reverse() : r; });
    return { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [world, ...holes] } }] };
  }
  const fc = g => ({ type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: g }] });
  const linesFC = g => ({ type: "FeatureCollection", features: lines(g).map(c => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: c } })) });
  const ptsFC = g => g.type === "Point" ? fc(g) : g.type === "MultiPoint" ? fc(g) : { type: "FeatureCollection", features: [] };

  async function countries(){
    if (ne) return ne;
    neLoading = neLoading || fetch(NE_URL).then(r => r.json()).then(j => {
      j.features.forEach(f => f._bb = geomBounds(f.geometry));
      return j;
    });
    ne = await neLoading;
    return ne;
  }
  const countryName = p => p.NAME_DE || p.NAME || p.ADMIN;

  /* ---------- Datenmodell ---------- */
  function add(name, geom, opt = {}){
    const m = Object.assign({
      id: ++counter, name, geom, color: COLORS[(counter - 1) % COLORS.length], fillOp: 0.55,
      stroke: "#ffffff", width: 3, t0: 0, t1: null,
      fx: { draw: true, glow: true, shadow: true, pulse: false, focus: false, extrude: false }
    }, opt);
    list.push(m); sel = m.id;
    addLayersFor(m);
    changed();
    return m;
  }
  function remove(m){ removeLayersFor(m); list = list.filter(x => x !== m); if (sel === m.id) sel = null; changed(); }
  function changed(){ renderList(); renderRows(); render(curT()); }
  const curT = () => (anim && playheadT > 0.01) ? playheadT : null;

  /* ---------- MapLibre-Ebenen ---------- */
  const L = (m, k) => "mk" + m.id + "-" + k;
  const S = (m, k) => "mk" + m.id + k;
  function before(){ return map.getLayer("route-glow") ? "route-glow" : undefined; }
  function addLayersFor(m){
    try { addLayersRaw(m); } catch (e){ removeLayersFor(m); }   // Stil lädt noch → später erneut (render)
  }
  function addLayersRaw(m){
    if (!map.getStyle() || map.getSource(S(m, "a"))) return;
    const g = m.geom, b = before();
    map.addSource(S(m, "a"), { type: "geojson", data: polys(g).length ? fc(g) : { type: "FeatureCollection", features: [] } });
    map.addSource(S(m, "l"), { type: "geojson", data: linesFC(g), lineMetrics: true });
    map.addSource(S(m, "m"), { type: "geojson", data: polys(g).length ? maskFC(g) : { type: "FeatureCollection", features: [] } });
    map.addSource(S(m, "p"), { type: "geojson", data: ptsFC(g) });
    const zw = (a, c) => ["interpolate", ["exponential", 1.5], ["zoom"], 3, a, 10, c];
    map.addLayer({ id: L(m, "focus"), type: "fill", source: S(m, "m"), paint: { "fill-color": "#05070d", "fill-opacity": 0 } }, b);
    map.addLayer({ id: L(m, "fill"), type: "fill", source: S(m, "a"), paint: { "fill-color": m.color, "fill-opacity": 0 } }, b);
    map.addLayer({ id: L(m, "ext"), type: "fill-extrusion", source: S(m, "a"),
      paint: { "fill-extrusion-color": m.color, "fill-extrusion-height": 0, "fill-extrusion-opacity": 0.9 } }, b);
    map.addLayer({ id: L(m, "shadow"), type: "line", source: S(m, "l"), layout: { "line-join": "round" },
      paint: { "line-color": "#0b1630", "line-opacity": 0, "line-width": zw(5, 30), "line-blur": zw(4, 20), "line-translate": [4, 9] } }, b);
    map.addLayer({ id: L(m, "glow"), type: "line", source: S(m, "l"), layout: { "line-join": "round" },
      paint: { "line-color": m.color, "line-opacity": 0, "line-width": 14, "line-blur": 10 } }, b);
    map.addLayer({ id: L(m, "line"), type: "line", source: S(m, "l"), layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-width": m.width, "line-gradient": ["step", ["line-progress"], "rgba(0,0,0,0)", 0.999, "rgba(0,0,0,0)"] } }, b);
    map.addLayer({ id: L(m, "pt"), type: "circle", source: S(m, "p"),
      paint: { "circle-radius": 9, "circle-color": m.color, "circle-opacity": 0, "circle-stroke-color": "#ffffff", "circle-stroke-width": 3, "circle-stroke-opacity": 0 } }, b);
    map.addLayer({ id: L(m, "ring"), type: "circle", source: S(m, "p"),
      paint: { "circle-radius": 9, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": m.color, "circle-stroke-width": 3, "circle-stroke-opacity": 0 } }, b);
    cache.delete(m.id);
  }
  function removeLayersFor(m){
    ["ring", "pt", "line", "glow", "shadow", "ext", "fill", "focus"].forEach(k => { if (map.getLayer(L(m, k))) map.removeLayer(L(m, k)); });
    ["a", "l", "m", "p"].forEach(k => { if (map.getSource(S(m, k))) map.removeSource(S(m, k)); });
    cache.delete(m.id);
  }
  function addLayers(){ list.forEach(addLayersFor); render(curT()); }

  /* ---------- Animation ---------- */
  const clamp = x => Math.min(Math.max(x, 0), 1);
  const eo = x => 1 - Math.pow(1 - x, 3);
  function set(m, layer, prop, v){
    const c = cache.get(m.id) || {}; cache.set(m.id, c);
    const key = layer + prop, s = typeof v === "object" ? JSON.stringify(v) : v;
    if (c[key] === s) return;
    c[key] = s;
    if (map.getLayer(L(m, layer))) map.setPaintProperty(L(m, layer), prop, v);
  }
  function hexA(h, a){ const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a.toFixed(3)})`; }
  function render(t){
    if (!map.getStyle()) return;
    const T = timelineTotal();
    for (const m of list){
      if (!map.getLayer(L(m, "fill"))){ addLayersFor(m); if (!map.getLayer(L(m, "fill"))) continue; }
      let vis = 1, draw = 1, fillK = 1, life = 99;
      if (t != null){
        const t1 = m.t1 == null ? T + 99 : m.t1;
        life = t - m.t0;
        const out = clamp((t1 - t) / FADE_OUT);
        const dd = m.drawDur || DRAW;
        draw = m.fx.draw ? clamp(life / dd) : (life >= 0 ? 1 : 0);
        fillK = m.fx.draw ? clamp((life - dd * 0.45) / FADE_IN) : clamp(life / FADE_IN);
        vis = (life >= 0 ? 1 : 0) * out;
        fillK = eo(fillK) * out; draw = eo(draw);
      }
      const pulse = m.fx.pulse && t != null ? 0.5 + 0.5 * Math.sin(life * Math.PI * 2 * 1.1) : 0.5;
      const pk = m.fx.pulse ? 0.6 + 0.4 * pulse : 1;
      // Füllung / 3D
      set(m, "fill", "fill-color", m.color);
      set(m, "fill", "fill-opacity", m.fx.extrude ? 0 : m.fillOp * fillK * pk);
      set(m, "ext", "fill-extrusion-color", m.color);
      set(m, "ext", "fill-extrusion-opacity", m.fx.extrude ? 0.92 : 0);
      set(m, "ext", "fill-extrusion-height", m.fx.extrude ? Math.round(extrudeH(m) * fillK) : 0);
      // Kontur (zeichnet sich)
      const sc = hexA(m.stroke, vis);
      const grad = draw >= 0.999 ? ["step", ["line-progress"], sc, 0.9999, sc]
        : draw <= 0.001 ? ["step", ["line-progress"], "rgba(0,0,0,0)", 0.9999, "rgba(0,0,0,0)"]
        : ["step", ["line-progress"], sc, draw, "rgba(0,0,0,0)"];
      set(m, "line", "line-gradient", grad);
      set(m, "line", "line-width", m.width * (m.fx.pulse ? 0.85 + 0.3 * pulse : 1));
      set(m, "glow", "line-color", m.color);
      set(m, "glow", "line-opacity", m.fx.glow ? 0.85 * fillK * pk : 0);
      set(m, "glow", "line-width", (m.width * 4 + 6) * (m.fx.pulse ? 0.8 + 0.5 * pulse : 1));
      set(m, "shadow", "line-opacity", m.fx.shadow ? 0.45 * fillK : 0);
      set(m, "focus", "fill-opacity", m.fx.focus ? 0.5 * fillK : 0);
      // Punkte
      set(m, "pt", "circle-color", m.color);
      set(m, "pt", "circle-opacity", fillK);
      set(m, "pt", "circle-stroke-opacity", fillK);
      set(m, "ring", "circle-stroke-color", m.color);
      const rp = t == null ? 0.5 : (life * 0.9) % 1;
      const u = Math.min(map.getCanvas().width, map.getCanvas().height) / (map.getPixelRatio() || 1) / 1080;   // in Export-Pixeln skalieren
      set(m, "ring", "circle-radius", (14 + 70 * rp) * u);
      set(m, "ring", "circle-stroke-width", 5 * u);
      set(m, "pt", "circle-radius", 12 * u);
      set(m, "ring", "circle-stroke-opacity", (m.fx.pulse || m.fx.glow) ? Math.pow(1 - rp, 1.3) * fillK : 0);
    }
  }
  function extrudeH(m){
    const b = geomBounds(m.geom); if (!b) return 0;
    const km = haversine(b[0], b[1]);
    return Math.min(Math.max(km * 1000 * 0.035, 800), 120000);
  }

  /* ---------- Quellen: Suche, Klick, Route ---------- */
  async function search(q){
    setStatus(tr("Suche") + " „" + q + "“ …");
    try {
      const r = await fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&polygon_geojson=1&polygon_threshold=0.003&accept-language=de&q=" + encodeURIComponent(q));
      const res = await r.json();
      if (!res.length){ setStatus(tr("Nichts gefunden.")); return; }
      const h = res[0], name = h.display_name.split(",")[0];
      const geom = h.geojson && h.geojson.type !== "Point" ? h.geojson : { type: "Point", coordinates: [parseFloat(h.lon), parseFloat(h.lat)] };
      add(name, geom, { t0: Math.round(playheadT * 10) / 10 });
      const b = geomBounds(geom); if (b && !playing) map.fitBounds(b, { padding: 80, duration: 700, maxZoom: 11 });
      setStatus(tr("Markiert") + ": " + name);
    } catch { setStatus(tr("Suche fehlgeschlagen.")); }
  }
  async function pickAt(lngLat){
    const j = await countries(), pt = [lngLat.lng, lngLat.lat];
    const f = j.features.find(f => inGeom(pt, f.geometry, f._bb));
    if (!f){ setStatus(tr("Hier ist kein Land.")); return; }
    if (list.some(m => m.iso === f.properties.ADM0_A3)){ setStatus(countryName(f.properties) + " " + tr("ist schon markiert.")); return; }
    add(countryName(f.properties), f.geometry, { iso: f.properties.ADM0_A3, t0: Math.round(playheadT * 10) / 10 });
  }
  function timeAtIdx(p, idx){
    let lo = 0, hi = timelineTotal();
    for (let k = 0; k < 30; k++){ const mid = (lo + hi) / 2; if (tipIndexFor(p, mid) >= idx) hi = mid; else lo = mid; }
    return hi;
  }
  async function routeCountries(){
    const a = await ensureAnim();
    if (!a){ setStatus(tr("Mindestens zwei Orte (oder ein GPX-Track) nötig.")); return; }
    setStatus(tr("Suche Länder entlang der Route …"));
    const j = await countries();
    const found = new Map();
    for (const p of a.per){
      const step = Math.max(1, Math.floor(p.coords.length / 600));
      let last = null;
      const idxs = [];
      for (let i = 0; i < p.coords.length; i += step) idxs.push(i);
      p.legs.forEach(lg => idxs.push(lg.from, lg.to));
      idxs.sort((x, y) => x - y);
      for (const i of idxs){
        const lg = legAt(p, i);
        if (["fly", "heli", "balloon", "paraglider"].includes(lg.mode) && i !== lg.from && i !== lg.to) continue;   // überflogene Länder zählen nicht
        const c = p.coords[i];
        const f = (last && inGeom(c, last.geometry, last._bb)) ? last : j.features.find(f => inGeom(c, f.geometry, f._bb));
        if (!f) continue;
        last = f;
        const iso = f.properties.ADM0_A3;
        if (!found.has(iso)) found.set(iso, { f, t: timeAtIdx(p, i) });
      }
    }
    let n = 0;
    for (const [iso, { f, t }] of found){
      if (list.some(m => m.iso === iso)) continue;
      add(countryName(f.properties), f.geometry, { iso, t0: Math.max(0, Math.round((t - 0.3) * 10) / 10), fx: { draw: true, glow: false, shadow: true, pulse: false, focus: false, extrude: false } });
      n++;
    }
    setStatus(n + " " + tr("Länder markiert – sie leuchten auf, wenn die Route sie erreicht."));
  }
  function importGeo(j){
    const feats = j.type === "FeatureCollection" ? j.features : j.type === "Feature" ? [j] : [{ type: "Feature", properties: {}, geometry: j }];
    let n = 0;
    for (const ft of feats.slice(0, 50)){ if (!ft.geometry) continue;
      add((ft.properties && (ft.properties.name || ft.properties.NAME)) || "GeoJSON " + (n + 1), ft.geometry); n++; }
    setStatus(n + " " + tr("Markierung(en) importiert."));
  }

  /* ---------- Panel ---------- */
  const FX = [["draw", "✏️", "Zeichnen"], ["glow", "✨", "Glühen"], ["shadow", "🌑", "Schatten"], ["pulse", "💓", "Puls"], ["focus", "🔦", "Fokus"], ["extrude", "🧊", "3D"]];
  function renderList(){
    const el = $("markList"); if (!el) return;
    const T = timelineTotal();
    el.innerHTML = "";
    list.forEach(m => {
      const d = document.createElement("div");
      d.className = "mark" + (m.id === sel ? " sel" : "");
      d.innerHTML = `<div class="mhead"><input type="color" data-k="color" value="${m.color}"><b>${escapeHtml(m.name)}</b>` +
        `<span>${m.t0.toFixed(1)}–${m.t1 == null ? tr("Ende") : m.t1.toFixed(1)} s</span>` +
        `<button type="button" data-a="fit" title="${tr("Zeigen")}">⌖</button><button type="button" class="del" data-a="del" title="${tr("Entfernen")}">✕</button></div>` +
        `<div class="fxrow">${FX.map(([k, ic, lb]) => `<button type="button" data-fx="${k}" class="${m.fx[k] ? "on" : ""}" title="${tr(lb)}"><em>${ic}</em>${tr(lb)}</button>`).join("")}</div>` +
        (m.id === sel ? `<div class="medit">
          <div class="setting"><label>${tr("Deckkraft")}</label><span class="rangewrap"><input type="range" data-k="fillOp" min="0" max="1" step="0.05" value="${m.fillOp}"><output>${m.fillOp}</output></span></div>
          <div class="setting"><label>${tr("Kontur")}</label><span class="pair"><input type="color" data-k="stroke" value="${m.stroke}"><input type="number" data-k="width" min="0" max="20" step="0.5" value="${m.width}"></span></div>
          <div class="setting"><label>${tr("Start / Ende (s)")}</label><span class="pair"><input type="number" data-k="t0" min="0" step="0.1" value="${m.t0}"><input type="number" data-k="t1" min="0" step="0.1" value="${m.t1 == null ? "" : m.t1}" placeholder="${tr("Ende")}"></span></div>
          <div class="btnrow"><button type="button" class="btn ghost" data-a="now">${tr("Start = Playhead")}</button></div></div>` : "");
      d.addEventListener("click", e => { if (e.target.closest("input,button")) return; sel = m.id; renderList(); renderRows(); });
      d.querySelectorAll("[data-fx]").forEach(b => b.addEventListener("click", () => { m.fx[b.dataset.fx] = !m.fx[b.dataset.fx]; sel = m.id; changed(); }));
      d.querySelectorAll("[data-k]").forEach(inp => inp.addEventListener(inp.type === "range" ? "input" : "change", () => {
        const k = inp.dataset.k;
        if (k === "t1") m.t1 = inp.value === "" ? null : Math.max(parseFloat(inp.value), m.t0 + 0.2);
        else if (k === "color" || k === "stroke") m[k] = inp.value;
        else m[k] = parseFloat(inp.value) || 0;
        if (inp.type === "range"){ inp.nextElementSibling.textContent = inp.value; inp.style.setProperty("--p", inp.value * 100 + "%"); render(curT()); renderRows(); return; }
        changed();
      }));
      d.querySelectorAll("input[type=range]").forEach(r => r.style.setProperty("--p", (r.value - r.min) / (r.max - r.min) * 100 + "%"));
      const act = a => d.querySelector(`[data-a="${a}"]`);
      act("del").addEventListener("click", () => remove(m));
      act("fit").addEventListener("click", () => { const b = geomBounds(m.geom); if (b) map.fitBounds(b, { padding: 80, duration: 700, maxZoom: 11 }); });
      if (act("now")) act("now").addEventListener("click", () => { m.t0 = Math.round(playheadT * 10) / 10; if (m.t1 != null && m.t1 <= m.t0) m.t1 = null; changed(); });
      el.appendChild(d);
    });
    $("markEmpty").hidden = list.length > 0;
  }

  /* ---------- Timeline-Balken ---------- */
  const rows = document.createElement("div");
  rows.id = "tlMarks";
  $("tlBody").insertBefore(rows, $("tlTracks"));
  function renderRows(){
    rows.innerHTML = "";
    const T = timelineTotal();
    list.forEach(m => {
      const r = document.createElement("div"); r.className = "mrow";
      r.innerHTML = `<div class="shlabel" title="${escapeHtml(m.name)}"><i style="background:${m.color}"></i><span>${escapeHtml(m.name)}</span></div><div class="shlane"></div>`;
      const lane = r.querySelector(".shlane");
      const bar = document.createElement("div");
      const t1 = m.t1 == null ? T : Math.min(m.t1, T);
      bar.className = "mbar" + (m.id === sel ? " sel" : "");
      bar.style.left = t2x(m.t0) + "px"; bar.style.width = Math.max(t2x(t1) - t2x(m.t0), 8) + "px";
      bar.style.setProperty("--c", m.color);
      bar.innerHTML = `<i class="eL"></i><span>${escapeHtml(m.name)}</span><i class="eR"></i>`;
      bar.addEventListener("pointerdown", e => {
        e.preventDefault(); e.stopPropagation();
        sel = m.id; renderList();
        const rect = lane.getBoundingClientRect(), x0 = e.clientX, a0 = m.t0, b0 = m.t1 == null ? T : m.t1;
        const what = e.target.classList.contains("eL") ? "L" : e.target.classList.contains("eR") ? "R" : "M";
        const move = ev => {
          const dt = (ev.clientX - x0) / rect.width * T;
          const r1 = v => Math.round(v * 10) / 10;
          if (what === "L") m.t0 = r1(Math.min(Math.max(a0 + dt, 0), b0 - 0.3));
          else if (what === "R"){ const v = r1(Math.max(b0 + dt, m.t0 + 0.3)); m.t1 = v >= T - 0.05 ? null : v; }
          else { const len = b0 - a0; m.t0 = r1(Math.min(Math.max(a0 + dt, 0), T - 0.3)); if (m.t1 != null) m.t1 = r1(m.t0 + len); }
          renderRows(); setPlayhead(what === "R" ? (m.t1 == null ? T : m.t1) : m.t0 + 0.05);
        };
        const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); renderList(); };
        window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
      });
      lane.appendChild(bar);
      rows.appendChild(r);
    });
  }

  /* ---------- Einhängen ---------- */
  const baseRA = renderAt;
  window.renderAt = renderAt = function (t, live){ baseRA(t, live); render(t); };
  const baseRT = renderTimeline;
  window.renderTimeline = renderTimeline = function (){ baseRT(); renderRows(); };
  const baseARL = addRuntimeLayers;
  window.addRuntimeLayers = addRuntimeLayers = function (){ baseARL(); addLayers(); };
  const baseDS = drawStatic;
  window.drawStatic = drawStatic = async function (){ await baseDS(); render(curT()); };

  $("markBtn").addEventListener("click", () => { const q = $("markInput").value.trim(); if (q){ search(q); $("markInput").value = ""; } });
  $("markInput").addEventListener("keydown", e => { if (e.key === "Enter") $("markBtn").click(); });
  $("markPick").addEventListener("click", () => {
    picking = !picking; $("markPick").classList.toggle("on", picking);
    map.getCanvas().style.cursor = picking ? "crosshair" : "";
    setStatus(picking ? tr("Land auf der Karte anklicken …") : "");
    if (picking) countries();
  });
  map.on("click", e => {
    if (!picking) return;
    picking = false; $("markPick").classList.remove("on"); map.getCanvas().style.cursor = "";
    pickAt(e.lngLat);
  });
  $("markRoute").addEventListener("click", routeCountries);
  $("markGeojson").addEventListener("change", e => {
    const f = e.target.files[0]; if (!f) return;
    f.text().then(t => { try { importGeo(JSON.parse(t)); } catch (err){ setStatus("GeoJSON ungültig: " + err.message); } });
    e.target.value = "";
  });

  // Alte Projekte: „Länder hervorheben“ (hlIso) und Features → Markierungen
  async function migrate(){
    const iso = (val("hlIso") || "").toUpperCase().split(/[\s,;]+/).filter(Boolean);
    if (iso.length){
      const j = await countries(), t0 = parseFloat(val("hlT0"));
      for (const code of iso){
        const f = j.features.find(f => f.properties.ADM0_A3 === code || f.properties.ISO_A3 === code);
        if (f && !list.some(m => m.iso === f.properties.ADM0_A3))
          add(countryName(f.properties), f.geometry, { iso: f.properties.ADM0_A3, color: val("hlColor") || "#86ccff", fillOp: num("hlOp") || 0.66,
            t0: isNaN(t0) ? 0 : t0, fx: { draw: !isNaN(t0), glow: false, shadow: checked("hlLine"), pulse: false, focus: false, extrude: false } });
      }
      $("hlIso").value = ""; refreshHighlight();
    }
    if (features.length){
      for (const f of features) add(f.name, f.geometry, { color: f.color, t0: f.appearT == null ? 0 : f.appearT,
        fx: { draw: f.appearT != null, glow: false, shadow: false, pulse: false, focus: false, extrude: false } });
      features = []; refreshFeatures(); renderFeatList();
    }
  }
  document.addEventListener("ma:loaded", migrate);

  Object.assign(EN, { "Markierungen": "Highlights", "Zeichnen": "Draw", "Glühen": "Glow", "Schatten": "Shadow", "Puls": "Pulse", "Fokus": "Focus",
    "Deckkraft": "Opacity", "Kontur": "Outline", "Start / Ende (s)": "Start / end (s)", "Ende": "end", "Start = Playhead": "Start = playhead",
    "Zeigen": "Show", "Markiert": "Highlighted", "Nichts gefunden.": "Nothing found.", "Suche fehlgeschlagen.": "Search failed.",
    "Hier ist kein Land.": "No country here.", "ist schon markiert.": "is already highlighted.", "Land auf der Karte anklicken …": "Click a country on the map …",
    "Suche Länder entlang der Route …": "Finding countries along the route …", "Länder markiert – sie leuchten auf, wenn die Route sie erreicht.": "countries highlighted – they light up when the route reaches them.",
    "Markierung(en) importiert.": "highlight(s) imported.", "Land anklicken": "Click country", "Länder der Route": "Route countries",
    "Land, Region, Stadt, See, Gebirge …": "Country, region, city, lake, mountains …" });

  async function addCountry(iso, opt = {}){
    const j = await countries();
    const f = j.features.find(f => f.properties.ADM0_A3 === iso || f.properties.ISO_A3 === iso);
    if (!f) return null;
    return add(countryName(f.properties), f.geometry, Object.assign({ iso: f.properties.ADM0_A3 }, opt));
  }
  function removeWhere(fn){ list.filter(fn).forEach(m => removeLayersFor(m)); list = list.filter(m => !fn(m)); sel = null; changed(); }
  return {
    add, addCountry, countries, inGeom, render, search, routeCountries, pickAt, removeWhere,
    get: () => list.map(m => ({ name: m.name, geom: m.geom, color: m.color, fillOp: m.fillOp, stroke: m.stroke, width: m.width, t0: m.t0, t1: m.t1, fx: m.fx, iso: m.iso, drawDur: m.drawDur, shotExtra: m.shotExtra })),
    set(arr){ list.forEach(removeLayersFor); list = []; sel = null; (arr || []).forEach(o => add(o.name, o.geom, Object.assign({}, o))); changed(); },
    list: () => list
  };
})();
