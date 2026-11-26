"use strict";
/* =========================================================
   Kamera-Abschnitte (wie Baldinger) + Kamera-Presets
   Ein Abschnitt (shot) gilt ab seiner Startzeit bis zum nächsten;
   der Übergang wird über CAM_BLEND Sekunden weich überblendet.
   Modi: follow (Folgen), still (feste Ansicht), overview (ganze Route),
         tripod (Stativ: steht, dreht sich zur Spitze), orbit (kreist um die Spitze)
   Die Kamera ist eine reine Funktion der Zeit → Vorschau, Scrubben und
   Export sind identisch. Keyframes (Profi) haben Vorrang.
   ========================================================= */
const CAM_MODES = {
  follow:   { icon: "🎯", label: "Folgen" },
  still:    { icon: "🖼️", label: "Still" },
  overview: { icon: "🗺️", label: "Übersicht" },
  tripod:   { icon: "📷", label: "Stativ" },
  orbit:    { icon: "🔄", label: "Orbit" }
};
const CAM_BLEND = 1.2;

const CAM = (() => {
  const $ = id => document.getElementById(id);
  let shots = [{ t: 0, mode: "follow", zoom: 7, pitch: 0, bearing: 0, up: "north", look: 0, auto: true }];
  let sel = 0;
  const fitCache = new Map();

  const sorted = () => shots.slice().sort((a, b) => a.t - b.t);
  const ease = f => f < 0.5 ? 4 * f * f * f : 1 - Math.pow(-2 * f + 2, 3) / 2;
  const wrap = a => ((a % 360) + 540) % 360 - 180;
  const merc = ll => maplibregl.MercatorCoordinate.fromLngLat(ll);
  const unmerc = (x, y) => { const c = new maplibregl.MercatorCoordinate(x, y, 0).toLngLat(); return [c.lng, c.lat]; };

  function activePer(){ return anim && (anim.per.find(p => p.ri === activeRoute) || anim.per[0]); }
  function tipAt(p, t){
    const T = timelineTotal();
    const idx = tipIndexFor(p, Math.min(Math.max(t, 0), T));
    const i0 = Math.floor(idx), f = idx - i0, a = p.coords[i0], b = p.coords[Math.min(i0 + 1, p.coords.length - 1)];
    return { ll: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], idx };
  }
  // geglättete Spitze: gewichtetes Mittel über ein Zeitfenster (+ Vorausschau)
  function smoothTip(p, t, look, win){
    let sx = 0, sy = 0, sw = 0, hx = 0, hy = 0, zo = 0;
    const N = 6;
    for (let k = -N; k <= N; k++){
      const w = Math.exp(-(k * k) / (N * N * 0.5));
      const tt = t + look + (k / N) * win;
      const tp = tipAt(p, tt), m = merc(tp.ll);
      sx += m.x * w; sy += m.y * w; sw += w;
      const lg = legAt(p, tp.idx);
      zo += ((MODES[lg.mode] || {}).zoom || 0) * w;
      const h = headingAt(p, tp.idx); hx += Math.cos(h) * w; hy += Math.sin(h) * w;
    }
    // Bildmitte = exakte Fahrzeugposition (Kamera hängt am Fahrzeug); geglättet werden nur Zoom und Richtung
    const exact = tipAt(p, t + look).ll;
    return { ll: exact, modeZoom: zo / sw, heading: Math.atan2(hy, hx) };
  }
  function legFitZoom(p, lg){
    const key = p.ri + ":" + lg.from + ":" + lg.to + ":" + map.getCanvas().width + "x" + map.getCanvas().height;
    if (fitCache.has(key)) return fitCache.get(key);
    const c = map.cameraForBounds(boundsOf(p.coords.slice(lg.from, lg.to + 1)), { padding: 80 });
    const z = c ? c.zoom : 20;
    fitCache.set(key, z);
    return z;
  }
  function autoZoom(p, t){       // über ±1,5 s gemittelt, damit Etappenwechsel nicht ruckeln
    let s = 0, n = 0;
    for (let k = -4; k <= 4; k++){ const tp = tipAt(p, t + k * 0.375); s += legFitZoom(p, legAt(p, tp.idx)); n++; }
    return s / n;
  }
  function headingToBearing(h){ return Math.atan2(Math.cos(h), -Math.sin(h)) * 180 / Math.PI; }   // Mercator-Winkel → Kompass
  function bearingBetween(a, b){
    const A = merc(a), B = merc(b);
    return Math.atan2(B.x - A.x, -(B.y - A.y)) * 180 / Math.PI;
  }
  function overviewCam(){ const o = anim.ovCam; const c = o.center; return { c: c.lng !== undefined ? [c.lng, c.lat] : c, z: o.zoom }; }

  function evalShot(s, t, tEnd){
    const p = activePer();
    const pitch = s.pitch == null ? num("pitch") : s.pitch;
    const zoom = s.zoom == null ? num("zoom") : s.zoom;
    if (s.mode === "overview" || !p){ const o = overviewCam(); return { c: o.c, z: o.z + (s.zoomAdj || 0), b: s.bearing || 0, p: pitch }; }
    if (s.mode === "still"){
      if (!s.center){ const o = overviewCam(); return { c: o.c, z: o.z, b: s.bearing || 0, p: pitch }; }
      return { c: s.center, z: zoom, b: s.bearing || 0, p: pitch };
    }
    const look = s.mode === "follow" ? (s.look || 0) : 0;
    const st = smoothTip(p, t, look, 1.2);
    let z = zoom + st.modeZoom;
    if (s.auto !== false) z = Math.min(z, autoZoom(p, t) + 0.35);
    if (s.mode === "follow"){
      const b = s.up === "travel" ? headingToBearing(st.heading) + (s.bearing || 0) : (s.bearing || 0);
      return { c: st.ll, z, b, p: pitch };
    }
    if (s.mode === "orbit"){
      const dur = Math.max(tEnd - s.t, 1);
      return { c: st.ll, z, b: (s.bearing || 0) + (s.dir || 1) * 360 * (t - s.t) / dur * (s.turns || 0.5), p: pitch || 55 };
    }
    // Stativ: steht neben dem Weg auf halber Strecke des Abschnitts und dreht sich zur Spitze
    const mid = tipAt(p, (s.t + tEnd) / 2), h = headingAt(p, mid.idx);
    const m = merc(mid.ll), off = 140 / (512 * Math.pow(2, z));
    const P = unmerc(m.x - Math.sin(h) * off, m.y + Math.cos(h) * off);
    return { c: st.ll, z, b: bearingBetween(P, st.ll), p: pitch || 50 };
  }

  function at(t){
    const S = sorted(), T = timelineTotal();
    let i = 0;
    for (let k = 0; k < S.length; k++) if (S[k].t <= t + 1e-9) i = k;
    const end = k => (S[k + 1] ? S[k + 1].t : T);
    let cam = evalShot(S[i], t, end(i));
    if (i > 0 && t - S[i].t < CAM_BLEND){
      const prev = evalShot(S[i - 1], t, end(i - 1));
      const f = ease((t - S[i].t) / CAM_BLEND);
      const A = merc(prev.c), B = merc(cam.c);
      cam = { c: unmerc(A.x + (B.x - A.x) * f, A.y + (B.y - A.y) * f),
              z: prev.z + (cam.z - prev.z) * f,
              b: prev.b + wrap(cam.b - prev.b) * f,
              p: prev.p + (cam.p - prev.p) * f };
    }
    return cam;
  }

  /* ---------- Timeline-Zeile ---------- */
  const row = document.createElement("div");
  row.id = "tlShots";
  $("tlBody").insertBefore(row, $("tlTracks"));
  function renderRow(){
    row.innerHTML = '<div class="shlabel"><span class="i18n">Kamera</span><button class="kfadd" title="Abschnitt am Playhead">＋</button></div><div class="shlane"></div>';
    row.querySelector(".kfadd").addEventListener("click", () => addShot());
    const lane = row.querySelector(".shlane"), S = sorted(), T = timelineTotal();
    S.forEach((s, k) => {
      const t1 = S[k + 1] ? S[k + 1].t : T;
      const b = document.createElement("div");
      b.className = "shot sh-" + s.mode + (shots.indexOf(s) === sel ? " sel" : "");
      b.style.left = t2x(s.t) + "px"; b.style.width = Math.max(t2x(t1) - t2x(s.t) - 2, 6) + "px";
      b.innerHTML = `<span>${CAM_MODES[s.mode].icon} ${tr(CAM_MODES[s.mode].label)}${s.mode === "follow" && s.up === "travel" ? " ↑" : ""}</span>` + (k > 0 ? '<i class="edge"></i>' : "");
      b.addEventListener("pointerdown", e => {
        if (e.target.classList.contains("edge")) return;
        sel = shots.indexOf(s); renderRow(); renderEditor();
        setPlayhead(Math.min(s.t + 0.05, T));
      });
      const edge = b.querySelector(".edge");
      if (edge) edge.addEventListener("pointerdown", e => {
        e.stopPropagation(); e.preventDefault();
        const rect = lane.getBoundingClientRect();
        const lo = S[k - 1].t + 0.3, hi = (S[k + 1] ? S[k + 1].t : T) - 0.3;
        const move = ev => { s.t = Math.round(Math.min(Math.max(x2t(ev.clientX - rect.left), lo), hi) * 10) / 10; renderRow(); setPlayhead(s.t); };
        const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); renderEditor(); };
        window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
      });
      lane.appendChild(b);
    });
  }
  const baseRT = renderTimeline;
  window.renderTimeline = renderTimeline = function (){ baseRT(); renderRow(); };

  /* ---------- Editor im Panel ---------- */
  function addShot(mode){
    const S = sorted(), t = Math.round(playheadT * 10) / 10;
    if (S.some(s => Math.abs(s.t - t) < 0.3)){ setStatus(tr("Hier beginnt schon ein Abschnitt.")); return; }
    let base = S[0]; for (const s of S) if (s.t <= t) base = s;
    const ns = Object.assign({}, base, { t, mode: mode || (base.mode === "follow" ? "still" : "follow"), center: null });
    if (ns.mode === "still") captureView(ns);
    shots.push(ns); sel = shots.length - 1;
    changed();
  }
  function captureView(s){ const c = map.getCenter(); s.center = [c.lng, c.lat]; s.zoom = Math.round(map.getZoom() * 100) / 100; s.bearing = Math.round(map.getBearing()); s.pitch = Math.round(map.getPitch()); }
  function changed(){ renderRow(); renderEditor(); if (anim) renderAt(playheadT, false); }

  function seg(opts, cur, onPick){
    return `<div class="seg wide">${opts.map(([v, l]) => `<button type="button" data-v="${v}" class="${String(cur) === String(v) ? "active" : ""}">${l}</button>`).join("")}</div>`;
  }
  function renderEditor(){
    const el = $("shotEditor"); if (!el) return;
    const S = sorted(); if (!shots[sel]) sel = 0;
    const s = shots[sel], idx = S.indexOf(s), T = timelineTotal(), t1 = S[idx + 1] ? S[idx + 1].t : T;
    const rng = (k, label, min, max, step, v) => `<div class="setting"><label>${tr(label)}</label><span class="rangewrap"><input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${v}"><output>${v}</output></span></div>`;
    el.innerHTML =
      `<div class="shothead"><b>${tr("Abschnitt")} ${idx + 1}/${S.length}</b><span>${s.t.toFixed(1)}–${t1.toFixed(1)} s</span>` +
      (S.length > 1 && idx > 0 ? `<button type="button" class="del" data-a="del" title="${tr("Abschnitt löschen")}">✕</button>` : "") + `</div>` +
      `<div class="modes">${Object.entries(CAM_MODES).map(([k, m]) => `<button type="button" data-mode="${k}" class="${s.mode === k ? "active" : ""}"><em>${m.icon}</em>${tr(m.label)}</button>`).join("")}</div>` +
      (s.mode === "follow" ? `<div class="tempo-row"><span>${tr("Oben")}</span>${seg([["north", tr("Norden")], ["travel", tr("Fahrtrichtung")]], s.up || "north")}</div>` : "") +
      (s.mode === "still" ? `<button type="button" class="btn ghost full" data-a="cap">${tr("Aktuelle Kartenansicht übernehmen")}</button>` : "") +
      (s.mode !== "overview" && s.mode !== "still" ? rng("zoom", "Zoom", 2, 16, 0.1, s.zoom == null ? num("zoom") : s.zoom) : "") +
      rng("pitch", "Neigung", 0, 80, 1, s.pitch || 0) +
      (s.mode !== "tripod" ? rng("bearing", s.mode === "orbit" ? "Startwinkel" : "Drehung", -180, 180, 1, s.bearing || 0) : "") +
      (s.mode === "follow" ? rng("look", "Vorausschau (s)", 0, 3, 0.1, s.look || 0) : "") +
      (s.mode === "orbit" ? rng("turns", "Umdrehungen", 0.1, 2, 0.05, s.turns || 0.5) : "") +
      (["follow", "tripod", "orbit"].includes(s.mode) ? `<div class="setting"><label>${tr("Lange Etappen: rauszoomen")}</label><input type="checkbox" data-k="auto" ${s.auto !== false ? "checked" : ""}></div>` : "") +
      `<button type="button" class="btn ghost full" data-a="add">＋ ${tr("Neuer Abschnitt am Playhead")}</button>`;
    el.querySelectorAll(".modes button").forEach(b => b.addEventListener("click", () => {
      s.mode = b.dataset.mode; if (s.mode === "still" && !s.center) captureView(s); changed(); }));
    el.querySelectorAll(".seg button").forEach(b => b.addEventListener("click", () => { s.up = b.dataset.v; changed(); }));
    el.querySelectorAll("input[type=range]").forEach(r => r.addEventListener("input", () => {
      s[r.dataset.k] = parseFloat(r.value); r.nextElementSibling.textContent = r.value;
      r.style.setProperty("--p", (r.value - r.min) / (r.max - r.min) * 100 + "%");
      renderRow(); if (anim) renderAt(playheadT, false); }));
    el.querySelectorAll("input[type=range]").forEach(r => r.style.setProperty("--p", (r.value - r.min) / (r.max - r.min) * 100 + "%"));
    el.querySelectorAll("input[type=checkbox]").forEach(c => c.addEventListener("change", () => { s[c.dataset.k] = c.checked; changed(); }));
    const act = a => el.querySelector(`[data-a="${a}"]`);
    if (act("cap")) act("cap").addEventListener("click", () => { captureView(s); changed(); setStatus(tr("Ansicht übernommen.")); });
    if (act("add")) act("add").addEventListener("click", () => addShot());
    if (act("del")) act("del").addEventListener("click", () => { shots.splice(sel, 1); sel = Math.max(0, sel - 1); changed(); });
  }

  /* ---------- Presets (Kamera + Tempo) ---------- */
  const F = (o) => Object.assign({ mode: "follow", zoom: 7, pitch: 0, bearing: 0, up: "north", look: 0, auto: true }, o);
  const PRESETS = [
    { id: "classic", name: "Folgen", sub: "Standard: Übersicht → folgen → Übersicht", icon: "🎯",
      shots: T => [F({ t: 0, mode: "overview" }), F({ t: 1.4, zoom: 7 }), F({ t: Math.max(T - 2, 2), mode: "overview" })], tempo: { len: 0, feel: "normal" } },
    { id: "navi", name: "Navi", sub: "Fahrtrichtung oben, geneigt", icon: "🧭",
      shots: () => [F({ t: 0, zoom: 10, pitch: 50, up: "travel" })], tempo: { len: 0, feel: "normal" } },
    { id: "flyover", name: "3D-Flyover", sub: "Relive-Stil: tief, schräg, Fahrtrichtung", icon: "🏔️",
      shots: T => [F({ t: 0, mode: "overview", pitch: 45 }), F({ t: 1.6, zoom: 11.5, pitch: 65, up: "travel" }), F({ t: Math.max(T - 2.2, 2), mode: "overview", pitch: 40 })],
      tempo: { len: 30, feel: "gemuetlich" }, terrain: true },
    { id: "recap", name: "Vlog-Recap", sub: "Weit folgen, Übersicht am Ende · flott", icon: "🎬",
      shots: T => [F({ t: 0, zoom: 4.6 }), F({ t: Math.max(T - 1.8, 2), mode: "overview" })], tempo: { len: 30, feel: "rasant" } },
    { id: "static", name: "Feste Karte", sub: "Indiana-Jones-Stil: ganze Route, Linie wächst", icon: "🗺️",
      shots: () => [F({ t: 0, mode: "overview" })], tempo: { len: 15, feel: "gemuetlich" } },
    { id: "snap70", name: "Snap-Zooms", sub: "70-Sekunden-Wiki: Ruck + Drift", icon: "⚡", keyframes: "snap70", tempo: { len: 15, feel: "normal" } },
    { id: "tripod", name: "Stativ", sub: "Kamera steht, schwenkt mit", icon: "📷",
      shots: T => [0, 1, 2].map(k => F({ t: k * T / 3, mode: "tripod", zoom: 9, pitch: 55 })), tempo: { len: 0, feel: "gemuetlich" } },
    { id: "orbitEnd", name: "Orbit am Ziel", sub: "Folgen, am Ende kreisen", icon: "🔄",
      shots: T => [F({ t: 0, zoom: 8, pitch: 35 }), F({ t: Math.max(T * 0.72, 1.5), mode: "orbit", zoom: 9, pitch: 55, turns: 0.6 })], tempo: { len: 0, feel: "normal" } },
    { id: "drone", name: "Drohnenflug", sub: "Steigen, sinken, schwenken", icon: "🚁", keyframes: "drone", tempo: { len: 0, feel: "gemuetlich" } },
    { id: "cine", name: "Cinematic", sub: "Langsamer Schwenk", icon: "🎥", keyframes: "cine", tempo: { len: 0, feel: "gemuetlich" } }
  ];
  async function applyPreset(pr){
    if (playing) pause();
    tracks.pos = []; tracks.zoom = []; tracks.bearing = []; tracks.pitch = [];
    if (!pr.keyframes) shots = pr.shots(timelineTotal());          // vorläufig: Zoom fürs Tempo
    if (pr.tempo) await MA_TEMPLATES.applyTempo(pr.tempo.len, pr.tempo.feel);
    if (pr.terrain && !$("terrain3d").checked){ $("terrain3d").checked = true; if (num("terrainEx") < 1.5) $("terrainEx").value = 1.5; applyTerrain(); }
    await ensureAnim();
    const T = timelineTotal();
    if (pr.keyframes){
      shots = [F({ t: 0 })];
      $("camPreset").value = pr.keyframes; $("camPreset").dispatchEvent(new Event("change"));
    } else shots = pr.shots(T);
    sel = 0; $("camPresetId").value = pr.id;
    document.querySelectorAll(".campre").forEach(b => b.classList.toggle("active", b.dataset.id === pr.id));
    renderTimeline(); renderEditor();
    if (anim) renderAt(playheadT, false);
    setStatus(tr("Kamera") + ": " + pr.name);
  }
  const grid = $("camGrid");
  PRESETS.forEach(pr => {
    const b = document.createElement("button"); b.type = "button"; b.className = "campre"; b.dataset.id = pr.id;
    b.innerHTML = `<em>${pr.icon}</em><span><b></b><small></small></span>`;
    b.querySelector("b").textContent = pr.name; b.querySelector("small").textContent = pr.sub;
    b.addEventListener("click", () => applyPreset(pr));
    grid.appendChild(b);
  });

  Object.assign(EN, { "Folgen": "Follow", "Still": "Still", "Übersicht": "Overview", "Stativ": "Tripod", "Orbit": "Orbit",
    "Kamera": "Camera", "Abschnitt": "Shot", "Oben": "Up", "Norden": "North", "Fahrtrichtung": "Direction of travel",
    "Aktuelle Kartenansicht übernehmen": "Use current map view", "Neigung": "Tilt", "Drehung": "Rotation", "Startwinkel": "Start angle",
    "Vorausschau (s)": "Look-ahead (s)", "Umdrehungen": "Turns", "Lange Etappen: rauszoomen": "Long legs: zoom out",
    "Neuer Abschnitt am Playhead": "New shot at playhead", "Abschnitt löschen": "Delete shot", "Ansicht übernommen.": "View captured.",
    "Hier beginnt schon ein Abschnitt.": "A shot already starts here." });

  return {
    at, renderRow, renderEditor, applyPreset, presets: PRESETS,
    get: () => JSON.parse(JSON.stringify(shots)),
    set(v){ if (Array.isArray(v) && v.length) shots = v; sel = 0; renderTimeline(); renderEditor();
            document.querySelectorAll(".campre").forEach(b => b.classList.toggle("active", b.dataset.id === $("camPresetId").value)); },
    clearCache(){ fitCache.clear(); },
    // Zoom der Folgekamera für die Tempo-Berechnung (null = Kamera steht → Übersichts-Zoom)
    followZoom(){
      const s = sorted().find(x => x.mode === "follow" || x.mode === "tripod" || x.mode === "orbit");
      return s ? (s.zoom == null ? num("zoom") : s.zoom) : null;
    }
  };
})();
