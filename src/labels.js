"use strict";
/* =========================================================
   Labels (GeoLayers-Stil) – gezeichnet aufs Overlay (#ovl), das beim
   Export auf jedes Frame gelegt wird. Anker: Punkt (lng/lat).
   Stile: pill, callout (Linie zum Punkt), marker (Punkt + Name), spaced (gesperrter Großtext), plain
   Animationen: pop, fade, type (Schreibmaschine), none. Zeitfenster t0 … t1 (null = bis Ende).
   ========================================================= */
const LABELS = (() => {
  const $ = id => document.getElementById(id);
  const STYLES = { pill: "▭ Pille", callout: "↗ Callout", marker: "● Marker", spaced: "A B C Gesperrt", plain: "Aa Text" };
  const ANIMS = { pop: "Pop", fade: "Fade", type: "Schreibmaschine", none: "Ohne" };
  const IN = 0.45, OUT = 0.35;
  let list = [], counter = 0, sel = null, picking = false, lastT = null;

  function add(text, lngLat, opt = {}){
    const l = Object.assign({ id: ++counter, text, lngLat, style: "pill", color: "#e3262b", textColor: "#ffffff",
      size: 1, t0: Math.round(playheadT * 10) / 10, t1: null, anim: "pop", dx: 0.09, dy: -0.11 }, opt);
    list.push(l); sel = l.id; changed();
    return l;
  }
  function remove(l){ list = list.filter(x => x !== l); if (sel === l.id) sel = null; changed(); }
  function changed(){ renderList(); renderRows(); drawOverlay(); }

  /* ---------- Zeichnen ---------- */
  const clamp = x => Math.min(Math.max(x, 0), 1);
  const backOut = x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  function rr(g, x, y, w, h, r){ g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function draw(){
    if (!list.length) return;
    const c = $("ovl"), g = c.getContext("2d"), W = c.width, H = c.height;
    const u = Math.min(W, H), T = timelineTotal(), t = lastT;
    for (const l of list){
      let k = 1, out = 1;
      if (t != null){
        if (t < l.t0) continue;
        if (l.t1 != null && t > l.t1) continue;
        k = clamp((t - l.t0) / (l.anim === "type" ? Math.max(IN, l.text.length * 0.045) : IN));
        out = l.t1 == null ? 1 : clamp((l.t1 - t) / OUT);
      }
      if (l.anim === "none") k = 1;
      const p = map.project(l.lngLat);
      if (p.x < -W * 0.5 || p.x > W * 1.5 || p.y < -H * 0.5 || p.y > H * 1.5) continue;
      const alpha = (l.anim === "fade" ? k : Math.min(1, k * 3)) * out;
      const sc = l.anim === "pop" ? Math.max(0.01, backOut(k)) : 1;
      const txt = l.anim === "type" ? l.text.slice(0, Math.ceil(l.text.length * k)) : l.text;
      const fs = Math.round(u * 0.038 * l.size);
      g.save(); g.globalAlpha = alpha;
      const font = (w, px) => w + " " + px + "px 'Archivo Black','Arial Black','Helvetica Neue',system-ui,sans-serif";
      if (l.style === "spaced"){
        const px = Math.round(fs * 1.3);
        g.font = font(900, px); g.textAlign = "center"; g.textBaseline = "middle";
        const s = txt.toUpperCase().split("").join("  ");
        g.translate(p.x, p.y); g.scale(sc, sc);
        g.lineJoin = "round"; g.lineWidth = px * 0.18; g.strokeStyle = "rgba(0,0,0,0.35)"; g.strokeText(s, 0, px * 0.04);
        g.fillStyle = l.textColor; g.fillText(s, 0, 0);
      } else if (l.style === "plain"){
        g.font = font(800, fs); g.textAlign = "center"; g.textBaseline = "middle";
        g.translate(p.x, p.y); g.scale(sc, sc);
        g.lineJoin = "round"; g.lineWidth = fs * 0.28; g.strokeStyle = l.color; g.strokeText(txt, 0, 0);
        g.fillStyle = l.textColor; g.fillText(txt, 0, 0);
      } else if (l.style === "marker"){
        const r = fs * 0.32;
        g.translate(p.x, p.y); g.scale(sc, sc);
        g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = fs * 0.3;
        g.fillStyle = l.color; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
        g.shadowBlur = 0; g.lineWidth = r * 0.45; g.strokeStyle = "#fff"; g.stroke();
        g.font = font(800, fs); g.textAlign = "left"; g.textBaseline = "middle";
        g.lineJoin = "round"; g.lineWidth = fs * 0.24; g.strokeStyle = "rgba(255,255,255,.92)"; g.strokeText(txt, r * 2.1, 0);
        g.fillStyle = "#15171c"; g.fillText(txt, r * 2.1, 0);
      } else {
        // pill + callout
        g.font = font(800, fs);
        const tw = g.measureText(l.text).width, padX = fs * 0.6, bh = fs * 1.7, bw = tw + padX * 2;
        let bx = p.x - bw / 2, by = p.y - bh / 2;
        if (l.style === "callout"){
          const ex = p.x + l.dx * u, ey = p.y + l.dy * u, lk = clamp(k * 1.6);
          g.strokeStyle = "#ffffff"; g.lineWidth = Math.max(2, fs * 0.09); g.lineCap = "round";
          g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = fs * 0.2;
          g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + (ex - p.x) * lk, p.y + (ey - p.y) * lk); g.stroke();
          g.fillStyle = l.color; g.beginPath(); g.arc(p.x, p.y, fs * 0.22, 0, Math.PI * 2); g.fill();
          g.lineWidth = fs * 0.08; g.stroke();
          bx = ex - (l.dx >= 0 ? 0 : bw); by = ey - bh / 2;
          const kb = clamp((k - 0.35) / 0.65); if (kb <= 0){ g.restore(); continue; }
          const ox = l.dx >= 0 ? bx : bx + bw;
          g.translate(ox, ey); g.scale(l.anim === "pop" ? Math.max(0.01, backOut(kb)) : 1, l.anim === "pop" ? Math.max(0.01, backOut(kb)) : 1); g.translate(-ox, -ey);
        } else {
          g.translate(p.x, p.y); g.scale(sc, sc); g.translate(-p.x, -p.y);
        }
        g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = fs * 0.35; g.shadowOffsetY = fs * 0.08;
        g.fillStyle = l.color; rr(g, bx, by, bw, bh, bh / 2); g.fill();
        g.shadowColor = "transparent";
        g.fillStyle = l.textColor; g.textAlign = "left"; g.textBaseline = "middle";
        g.fillText(txt, bx + padX, by + bh / 2 + fs * 0.04);
      }
      g.restore();
    }
  }

  /* ---------- Quellen ---------- */
  function centroidOf(geom){
    if (geom.type === "Point") return geom.coordinates;
    const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.type === "MultiPolygon" ? geom.coordinates : null;
    if (!polys){ const b = geomBounds(geom); return [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2]; }
    // größtes Teilpolygon, Flächenschwerpunkt
    let best = null, bestA = 0;
    for (const p of polys){ const r = p[0]; let a = 0, cx = 0, cy = 0;
      for (let i = 0, j = r.length - 1; i < r.length; j = i++){ const f = r[j][0] * r[i][1] - r[i][0] * r[j][1]; a += f; cx += (r[j][0] + r[i][0]) * f; cy += (r[j][1] + r[i][1]) * f; }
      if (Math.abs(a) > bestA){ bestA = Math.abs(a); best = [cx / (3 * a), cy / (3 * a)]; } }
    return best;
  }
  function fromMarks(){
    if (typeof MARKS === "undefined" || !MARKS.list().length){ setStatus(tr("Erst Markierungen anlegen (Tab Ebenen).")); return; }
    let n = 0;
    for (const m of MARKS.list()){
      if (list.some(l => l.markId === m.id)) continue;
      add(m.name, centroidOf(m.geom), { markId: m.id, color: m.color, style: "spaced", textColor: "#ffffff", t0: Math.round((m.t0 + 0.6) * 10) / 10, t1: m.t1, anim: "fade", size: 1 });
      n++;
    }
    setStatus(n + " " + tr("Namen hinzugefügt."));
  }
  async function distances(){
    const a = await ensureAnim();
    if (!a){ setStatus(tr("Mindestens zwei Orte (oder ein GPX-Track) nötig.")); return; }
    let n = 0;
    for (const p of a.per) p.segs.filter(s => s.type === "leg" && (!s.whole || p.segs.find(x => x.whole === s.whole) === s)).map(s => s.whole ? Object.assign({}, s.whole, { t0: s.t0, t1: p.segs.filter(x => x.whole === s.whole).pop().t1 }) : s).forEach(s => {
      const mid = p.coords[Math.round((s.from + s.to) / 2)];
      const km = s.km != null ? s.km : p.cum[s.to] - p.cum[s.from];
      const txt = km >= 100 ? Math.round(km / 10) * 10 + " km" : km >= 10 ? Math.round(km) + " km" : km.toFixed(1).replace(".", ",") + " km";
      const T = timelineTotal(), sc = T / a.natural;
      add(txt, mid, { style: "pill", color: "#15171c", textColor: "#ffffff", size: 0.8, anim: "pop", t0: Math.round(((s.t0 + s.t1) / 2) * sc * 10) / 10, dist: true });
      n++;
    });
    setStatus(n + " " + tr("Distanz-Labels hinzugefügt."));
  }

  /* ---------- Panel ---------- */
  function renderList(){
    const el = $("labelList"); if (!el) return;
    el.innerHTML = "";
    list.forEach(l => {
      const d = document.createElement("div");
      d.className = "mark" + (l.id === sel ? " sel" : "");
      d.innerHTML = `<div class="mhead"><input type="color" data-k="color" value="${l.color}" title="${tr("Farbe")}"><input type="text" class="ltext" data-k="text" value="${escapeHtml(l.text)}">` +
        `<span>${l.t0.toFixed(1)}–${l.t1 == null ? tr("Ende") : l.t1.toFixed(1)} s</span><button type="button" class="del" data-a="del" title="${tr("Entfernen")}">✕</button></div>` +
        `<div class="fxrow lstyles">${Object.entries(STYLES).map(([k, n]) => `<button type="button" data-style="${k}" class="${l.style === k ? "on" : ""}">${tr(n)}</button>`).join("")}</div>` +
        (l.id === sel ? `<div class="medit">
          <div class="setting"><label>${tr("Animation")}</label><select data-k="anim">${Object.entries(ANIMS).map(([k, n]) => `<option value="${k}" ${l.anim === k ? "selected" : ""}>${tr(n)}</option>`).join("")}</select></div>
          <div class="setting"><label>${tr("Größe")}</label><span class="rangewrap"><input type="range" data-k="size" min="0.4" max="3" step="0.05" value="${l.size}"><output>${l.size}</output></span></div>
          <div class="setting"><label>${tr("Textfarbe")}</label><input type="color" data-k="textColor" value="${l.textColor}"></div>
          <div class="setting"><label>${tr("Start / Ende (s)")}</label><span class="pair"><input type="number" data-k="t0" min="0" step="0.1" value="${l.t0}"><input type="number" data-k="t1" min="0" step="0.1" value="${l.t1 == null ? "" : l.t1}" placeholder="${tr("Ende")}"></span></div>
          ${l.style === "callout" ? `<div class="setting"><label>${tr("Callout-Richtung")}</label><span class="pair"><input type="number" data-k="dx" step="0.01" value="${l.dx}"><input type="number" data-k="dy" step="0.01" value="${l.dy}"></span></div>` : ""}
          <div class="btnrow"><button type="button" class="btn ghost" data-a="now">${tr("Start = Playhead")}</button><button type="button" class="btn ghost" data-a="move">${tr("Neu platzieren")}</button></div></div>` : "");
      d.addEventListener("click", e => { if (e.target.closest("input,button,select")) return; sel = l.id; renderList(); renderRows(); });
      d.querySelectorAll("[data-style]").forEach(b => b.addEventListener("click", () => { l.style = b.dataset.style; sel = l.id; changed(); }));
      d.querySelectorAll("[data-k]").forEach(inp => inp.addEventListener(inp.type === "range" || inp.type === "text" ? "input" : "change", () => {
        const k = inp.dataset.k;
        if (k === "t1") l.t1 = inp.value === "" ? null : Math.max(parseFloat(inp.value), l.t0 + 0.2);
        else if (["color", "textColor", "text", "anim"].includes(k)) l[k] = inp.value;
        else l[k] = parseFloat(inp.value) || 0;
        if (inp.type === "range"){ inp.nextElementSibling.textContent = inp.value; inp.style.setProperty("--p", (inp.value - inp.min) / (inp.max - inp.min) * 100 + "%"); }
        if (inp.type === "range" || inp.type === "text"){ drawOverlay(); renderRows(); return; }
        changed();
      }));
      d.querySelectorAll("input[type=range]").forEach(r => r.style.setProperty("--p", (r.value - r.min) / (r.max - r.min) * 100 + "%"));
      const act = a => d.querySelector(`[data-a="${a}"]`);
      act("del").addEventListener("click", () => remove(l));
      if (act("now")) act("now").addEventListener("click", () => { l.t0 = Math.round(playheadT * 10) / 10; if (l.t1 != null && l.t1 <= l.t0) l.t1 = null; changed(); });
      if (act("move")) act("move").addEventListener("click", () => startPick(l));
      el.appendChild(d);
    });
    $("labelEmpty").hidden = list.length > 0;
  }

  /* ---------- Timeline-Balken ---------- */
  const rows = document.createElement("div");
  rows.id = "tlLabels";
  $("tlBody").insertBefore(rows, $("tlTracks"));
  function renderRows(){
    rows.innerHTML = "";
    const T = timelineTotal();
    list.forEach(l => {
      const r = document.createElement("div"); r.className = "mrow";
      r.innerHTML = `<div class="shlabel"><i style="background:${l.color}"></i><span>🏷 ${escapeHtml(l.text)}</span></div><div class="shlane"></div>`;
      const lane = r.querySelector(".shlane"), bar = document.createElement("div");
      const t1 = l.t1 == null ? T : Math.min(l.t1, T);
      bar.className = "mbar lbar" + (l.id === sel ? " sel" : "");
      bar.style.left = t2x(l.t0) + "px"; bar.style.width = Math.max(t2x(t1) - t2x(l.t0), 8) + "px";
      bar.style.setProperty("--c", l.color);
      bar.innerHTML = `<i class="eL"></i><span>🏷 ${escapeHtml(l.text)}</span><i class="eR"></i>`;
      bar.addEventListener("pointerdown", e => {
        e.preventDefault(); e.stopPropagation();
        sel = l.id; renderList();
        const rect = lane.getBoundingClientRect(), x0 = e.clientX, a0 = l.t0, b0 = l.t1 == null ? T : l.t1;
        const what = e.target.classList.contains("eL") ? "L" : e.target.classList.contains("eR") ? "R" : "M";
        const r1 = v => Math.round(v * 10) / 10;
        const move = ev => {
          const dt = (ev.clientX - x0) / rect.width * T;
          if (what === "L") l.t0 = r1(Math.min(Math.max(a0 + dt, 0), b0 - 0.3));
          else if (what === "R"){ const v = r1(Math.max(b0 + dt, l.t0 + 0.3)); l.t1 = v >= T - 0.05 ? null : v; }
          else { const len = b0 - a0; l.t0 = r1(Math.min(Math.max(a0 + dt, 0), T - 0.3)); if (l.t1 != null) l.t1 = r1(l.t0 + len); }
          renderRows(); setPlayhead(what === "R" ? (l.t1 == null ? T : l.t1) - 0.05 : l.t0 + 0.6);
        };
        const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); renderList(); };
        window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
      });
      lane.appendChild(bar); rows.appendChild(r);
    });
  }

  /* ---------- Platzieren per Klick ---------- */
  let moving = null;
  function startPick(l){
    picking = true; moving = l || null;
    $("labelPick").classList.add("on"); map.getCanvas().style.cursor = "crosshair";
    setStatus(tr("Auf die Karte klicken, um das Label zu setzen …"));
  }
  map.on("click", e => {
    if (!picking) return;
    picking = false; $("labelPick").classList.remove("on"); map.getCanvas().style.cursor = "";
    const ll = [e.lngLat.lng, e.lngLat.lat];
    if (moving){ moving.lngLat = ll; moving = null; changed(); return; }
    add(tr("Neues Label"), ll);
    setTimeout(() => { const i = document.querySelector("#labelList .mark.sel .ltext"); if (i){ i.focus(); i.select(); } }, 50);
  });
  map.on("move", () => { if (!playing && !mp4Busy) drawOverlay(); });

  /* ---------- Einhängen ---------- */
  const baseRA = renderAt;
  window.renderAt = renderAt = function (t, live){ lastT = stopmoT(t); baseRA(t, live); };
  const baseDO = drawOverlay;
  window.drawOverlay = drawOverlay = function (){ baseDO(); draw(); };
  const baseDS = drawStatic;
  window.drawStatic = drawStatic = async function (){ await baseDS(); if (playheadT <= 0.01) lastT = null; drawOverlay(); };
  const baseRT = renderTimeline;
  window.renderTimeline = renderTimeline = function (){ baseRT(); renderRows(); };

  $("labelPick").addEventListener("click", () => picking ? (picking = false, $("labelPick").classList.remove("on"), map.getCanvas().style.cursor = "") : startPick());
  $("labelMarks").addEventListener("click", fromMarks);
  $("labelDist").addEventListener("click", distances);

  Object.assign(EN, { "Labels": "Labels", "▭ Pille": "▭ Pill", "↗ Callout": "↗ Callout", "● Marker": "● Marker", "A B C Gesperrt": "A B C Spaced", "Aa Text": "Aa Text",
    "Pop": "Pop", "Fade": "Fade", "Schreibmaschine": "Typewriter", "Ohne": "None", "Animation": "Animation", "Größe": "Size", "Textfarbe": "Text color",
    "Callout-Richtung": "Callout direction", "Neu platzieren": "Re-place", "Neues Label": "New label", "Farbe": "Color",
    "Auf die Karte klicken, um das Label zu setzen …": "Click the map to place the label …", "Erst Markierungen anlegen (Tab Ebenen).": "Add highlights first (Layers tab).",
    "Namen hinzugefügt.": "names added.", "Distanz-Labels hinzugefügt.": "distance labels added.",
    "📍 Label setzen": "📍 Place label", "🏷️ Namen der Markierungen": "🏷️ Highlight names", "📏 Distanzen": "📏 Distances" });

  return {
    add, draw, fromMarks, distances, list: () => list, any: () => list.length > 0,
    removeWhere(fn){ list = list.filter(l => !fn(l)); sel = null; changed(); },
    get: () => list.map(({ id, ...rest }) => rest),
    set(arr){ list = []; sel = null; (arr || []).forEach(o => add(o.text, o.lngLat, Object.assign({}, o))); sel = null; changed(); }
  };
})();
