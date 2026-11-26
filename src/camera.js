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
  const erf = x => { const s = Math.sign(x), a = Math.abs(x), t = 1 / (1 + 0.3275911 * a);
    return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a)); };
  const Phi = x => 0.5 * (1 + erf(x / Math.SQRT2));
  // Etappen mit Zeitfenster (Grenze = Mitte der Pause am Stopp) und Richtung Start → Ziel
  function legSpans(p){
    const sc = timelineTotal() / (anim.natural || 1), out = [];
    const segs = p.segs, legsIdx = [];
    segs.forEach((s, i) => { if (s.type === "leg" && !(s.whole && segs.findIndex(x => x.whole === s.whole) !== i)) legsIdx.push(i); });
    legsIdx.forEach((i, k) => {
      const s = segs[i], whole = s.whole, last = whole ? segs.filter(x => x.whole === whole).pop() : s;
      const pb = segs[i - 1], pa = segs[segs.indexOf(last) + 1];
      const a = k === 0 ? -1e9 : ((pb && pb.type === "pause" ? (pb.t0 + pb.t1) / 2 : s.t0) * sc);
      const b = k === legsIdx.length - 1 ? 1e9 : ((pa && pa.type === "pause" ? (pa.t0 + pa.t1) / 2 : last.t1) * sc);
      const lg = legAt(p, (s.from + (whole ? whole.to : s.to)) / 2);
      const A = merc(p.coords[lg.from]), B = merc(p.coords[lg.to]);
      out.push({ a, b, ang: Math.atan2(B.y - A.y, B.x - A.x), mode: lg.mode });
    });
    return out;
  }
  function smoothTip(p, t, look, win){
    const tc = t + look, sig = Math.max(win / 2, 0.2);
    const spans = legSpans(p);
    // stufenlose Mischung der Etappen (Gewicht = Anteil der Glockenkurve im Etappenfenster)
    let cur = spans.find(s => tc >= s.a && tc < s.b) || spans[spans.length - 1];
    let sw = 0, sa = 0, zo = 0;
    for (const s of spans){
      const w = Phi((s.b - tc) / sig) - Phi((s.a - tc) / sig);
      if (w < 1e-4) continue;
      let d = s.ang - cur.ang; d = Math.atan2(Math.sin(d), Math.cos(d));
      sa += d * w; sw += w; zo += ((MODES[s.mode] || {}).zoom || 0) * w;
    }
    const target = cur.ang + (sw ? sa / sw : 0);
    // Fahrtrichtung: Sehne von (t − win) bis (t + win) – glättet Kurven natürlich
    const A = merc(tipAt(p, tc - win).ll), B = merc(tipAt(p, tc + win).ll);
    const heading = (A.x === B.x && A.y === B.y) ? target : Math.atan2(B.y - A.y, B.x - A.x);
    // Bildmitte = exakte Fahrzeugposition (Kamera hängt am Fahrzeug)
    return { ll: tipAt(p, tc).ll, modeZoom: sw ? zo / sw : 0, heading, target };
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
    const r = evalShotBase(s, t, tEnd, p, pitch, zoom);
    if (s.mode !== "orbit" && s.mode !== "tripod"){
      const dt = Math.max(0, t - s.t);
      r.b += (s.drift || 0) * dt; r.z += (s.zoomDrift || 0) * dt; r.p = Math.min(85, r.p + (s.pitchDrift || 0) * dt);
    }
    return r;
  }
  function evalShotBase(s, t, tEnd, p, pitch, zoom){
    if (s.mode === "overview" || !p){ const o = overviewCam(); return { c: o.c, z: s.zoomAbs != null ? s.zoomAbs : o.z + (s.zoomAdj || 0), b: s.bearing || 0, p: pitch }; }
    if (s.mode === "still"){
      if (!s.center){ const o = overviewCam(); return { c: o.c, z: o.z, b: s.bearing || 0, p: pitch }; }
      return { c: s.center, z: zoom, b: s.bearing || 0, p: pitch };
    }
    const look = s.mode === "follow" ? (s.look || 0) : 0;
    const st = smoothTip(p, t, look, s.up === "travel" ? 3 : s.up === "target" ? 1.6 : 1.2);
    let z = zoom + st.modeZoom;
    if (s.auto !== false) z = Math.min(z, autoZoom(p, t) + 0.35);
    if (s.mode === "follow" && s.fitSoFar){
      const idx = tipAt(p, t).idx, end = Math.max(1, Math.ceil(idx)), step = Math.max(1, Math.floor(end / 200));
      const pts = []; for (let i = 0; i <= end; i += step) pts.push(p.coords[i]); pts.push(tipAt(p, t).ll);
      const c = map.cameraForBounds(boundsOf(pts), { padding: 120 });
      const z = Math.min(c ? c.zoom : zoom, s.maxZoom || 9);
      const cc = c ? (c.center.lng !== undefined ? [c.center.lng, c.center.lat] : c.center) : st.ll;
      return { c: cc, z, b: s.bearing || 0, p: pitch };
    }
    if (s.mode === "follow"){
      const b = s.up === "travel" ? headingToBearing(st.heading) + (s.bearing || 0)
              : s.up === "target" ? headingToBearing(st.target) + (s.bearing || 0)
              : (s.bearing || 0);
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

  /* ---------- Whip-Pan: schneller Schwenk am Anfang/Ende ----------
     off = Versatz in Bildbreiten (−: kommt von der Gegenseite, +: schwenkt raus), vel = Tempo (Bildbreiten/s) */
  const WHIP_D = 0.5, WHIP_DIST = 2.2;
  function whipState(t){
    const T = timelineTotal(), zoomMode = val("whipDir") === "zoom", d = { right: [1, 0], left: [-1, 0], up: [0, -1], down: [0, 1] }[val("whipDir")] || [1, 0];
    let off = 0, vel = 0;
    if (checked("whipIn") && t < WHIP_D){ const f = Math.max(t, 0) / WHIP_D; off = -Math.pow(1 - f, 3); vel = 3 * Math.pow(1 - f, 2) / WHIP_D; }
    else if (checked("whipOut") && t > T - WHIP_D){ const f = Math.min((t - (T - WHIP_D)) / WHIP_D, 1); off = Math.pow(f, 3); vel = 3 * f * f / WHIP_D; }
    return { off: off * WHIP_DIST, vel: vel * WHIP_DIST, dx: d[0], dy: d[1], zoom: zoomMode };
  }
  function frameW(){ const [w, h] = val("resolution").split("x").map(Number); return w || 1920; }
  function applyWhip(cam, t){
    const w = whipState(t);
    if (!w.off) return cam;
    // Crash-Zoom: am Anfang von weit draußen hineinstürzen, am Ende hineintauchen
    if (w.zoom) return Object.assign({}, cam, { z: cam.z + (w.off < 0 ? w.off * 1.1 : w.off * 1.4) });
    const b = cam.b * Math.PI / 180, mpp = 1 / (512 * Math.pow(2, cam.z)), dist = w.off * frameW() * mpp;
    // Bildschirm-Richtung → Mercator (Karte um bearing gedreht)
    const mx = w.dx * Math.cos(b) - w.dy * Math.sin(b), my = w.dx * Math.sin(b) + w.dy * Math.cos(b);
    const M = merc(cam.c);
    return Object.assign({}, cam, { c: unmerc(M.x + mx * dist, M.y + my * dist) });
  }
  // Unschärfe-Länge in Export-Pixeln (180°-Verschluss bei 30 fps)
  function whipBlurPx(t, fps){ const w = whipState(t); return Math.min(w.vel * frameW() / (2 * (fps || 30)), frameW() * 0.4); }
  function previewBlur(t){
    const wrap = $("mapwrap"), fe = $("whipBlurFe");
    const px = whipBlurPx(t, 30);
    if (px < 1.5 || mp4Busy){ if (wrap.style.filter) wrap.style.filter = ""; return; }
    const w = whipState(t), sd = px / 3;
    if (w.zoom){ wrap.style.filter = "blur(" + (px / 14).toFixed(1) + "px)"; return; }
    fe.setAttribute("stdDeviation", (Math.abs(w.dx) * sd).toFixed(1) + " " + (Math.abs(w.dy) * sd).toFixed(1));
    wrap.style.filter = "url(#whipBlur)";
  }
  // Export: Bild entlang der Schwenkrichtung verschmieren (gleichgewichtetes Mittel verschobener Kopien)
  let tmpC = null;
  function blurCanvas(g, W, H, t, fps){
    const px = whipBlurPx(t, fps);
    if (px < 1.5) return;
    const w = whipState(t);
    tmpC = tmpC || document.createElement("canvas");
    if (tmpC.width !== W || tmpC.height !== H){ tmpC.width = W; tmpC.height = H; }
    const tg = tmpC.getContext("2d"); tg.clearRect(0, 0, W, H); tg.drawImage(g.canvas, 0, 0);
    const N = Math.min(24, Math.max(6, Math.round(px / 8)));
    if (w.zoom){   // radiale Zoom-Unschärfe: skalierte Kopien um die Bildmitte
      const amt = Math.min(px / W, 0.35);
      for (let k = 0; k < N; k++){
        const sc = 1 + amt * k / (N - 1);
        g.globalAlpha = 1 / (k + 2);
        g.drawImage(tmpC, W / 2 - W * sc / 2, H / 2 - H * sc / 2, W * sc, H * sc);
      }
      g.globalAlpha = 1; return;
    }
    for (let k = 0; k < N; k++){
      const o = (k / (N - 1) - 0.5) * px;
      g.globalAlpha = 1 / (k + 2);
      g.drawImage(tmpC, w.dx * o, w.dy * o);
    }
    g.globalAlpha = 1;
  }

  function at(t){
    return applyWhip(atRaw(t), t);
  }
  function atRaw(t){
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
      b.innerHTML = `<span>${CAM_MODES[s.mode].icon} ${tr(CAM_MODES[s.mode].label)}${s.mode === "follow" && s.up === "travel" ? " ↑" : s.mode === "follow" && s.up === "target" ? " ➜" : ""}</span>` + (k > 0 ? '<i class="edge"></i>' : "");
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
  let lastT = null;
  const baseRA = renderAt;
  window.renderAt = renderAt = function (t, live){ lastT = t; baseRA(t, live); previewBlur(t); };
  // Wolken-Einflug: weiche Wolkenfetzen fliegen in den ersten 0,9 s auseinander und blenden aus
  // Sternenhimmel (Globus): prozedural, deterministisch
  let starsCanvas = null, starsURL = null;
  function stars(){
    if (starsCanvas) return starsCanvas;
    const c = document.createElement("canvas"); c.width = 2048; c.height = 1152;
    const g = c.getContext("2d"), gr = g.createRadialGradient(1024, 576, 100, 1024, 576, 1300);
    gr.addColorStop(0, "#0b1226"); gr.addColorStop(1, "#010205"); g.fillStyle = gr; g.fillRect(0, 0, 2048, 1152);
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 1400; i++){
      const x = rnd() * 2048, y = rnd() * 1152, m = rnd(), r = m > 0.985 ? 1.8 : m > 0.9 ? 1.1 : 0.6;
      g.fillStyle = `rgba(${200 + rnd() * 55 | 0},${210 + rnd() * 45 | 0},255,${(0.35 + rnd() * 0.65).toFixed(2)})`;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    starsCanvas = c; starsURL = c.toDataURL("image/jpeg", 0.9);
    return c;
  }
  const starsOn = () => checked("fxStars") && checked("projGlobe");
  function drawBackdrop(g, W, H){
    if (starsOn()) g.drawImage(stars(), 0, 0, W, H); else g.clearRect(0, 0, W, H);
  }
  let bdOn = null;
  function syncBackdrop(){
    const on = starsOn(); if (on === bdOn) return; bdOn = on;
    const w = $("mapwrap");
    if (on){ stars(); w.style.background = `#010205 url(${starsURL}) center / cover`; } else w.style.background = "";
  }
  ["fxStars", "projGlobe"].forEach(id => $(id).addEventListener("change", syncBackdrop));
  document.addEventListener("ma:settings", syncBackdrop); document.addEventListener("ma:loaded", syncBackdrop);
  const CLOUDS = Array.from({ length: 16 }, (_, i) => { const a = i * 2.39996, r = 0.15 + ((i * 37) % 10) / 22; return { x: Math.cos(a) * r, y: Math.sin(a) * r * 0.7, s: 0.35 + ((i * 53) % 10) / 18 }; });
  const baseDO = drawOverlay;
  window.drawOverlay = drawOverlay = function (){
    baseDO(); syncBackdrop();
    if (checked("fxVignette")){
      const c = $("ovl"), g = c.getContext("2d"), W = c.width, H = c.height;
      const gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.55);
      gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,0.62)");
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
    if (!checked("fxClouds") || lastT == null || lastT > 0.95) return;
    const c = $("ovl"), g = c.getContext("2d"), W = c.width, H = c.height, k = lastT / 0.95;
    g.save();
    g.fillStyle = `rgba(255,255,255,${(0.4 * Math.pow(1 - k, 1.6)).toFixed(3)})`; g.fillRect(0, 0, W, H);   // Dunst
    for (const cl of CLOUDS){
      const sp = 1 + k * 2.6, x = W / 2 + cl.x * W * sp, y = H / 2 + cl.y * H * sp, r = cl.s * Math.max(W, H) * (0.24 + k * 1.1);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(255,255,255,${(0.6 * Math.pow(1 - k, 1.3)).toFixed(3)})`); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  };
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
      (s.mode === "follow" ? `<div class="tempo-row"><span>${tr("Oben")}</span>${seg([["north", tr("Norden")], ["target", tr("Ziel")], ["travel", tr("Fahrtrichtung")]], s.up || "north")}</div>` : "") +
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
    { id: "navi", name: "Richtung Ziel", sub: "Hinter der Figur, Blick zum nächsten Ziel – ruhig", icon: "🧭",
      shots: () => [F({ t: 0, zoom: 10, pitch: 50, up: "target" })], tempo: { len: 0, feel: "normal" } },
    { id: "flyover", name: "3D-Flyover", sub: "Relive-Stil: tief, schräg, Blick zum Ziel", icon: "🏔️",
      shots: T => [F({ t: 0, mode: "overview", pitch: 45 }), F({ t: 1.6, zoom: 11.5, pitch: 65, up: "target" }), F({ t: Math.max(T - 2.2, 2), mode: "overview", pitch: 40 })],
      tempo: { len: 30, feel: "gemuetlich" }, terrain: true },
    { id: "recap", name: "Vlog-Recap", sub: "Whip-Pan rein/raus, weit folgen · flott", icon: "🎬",
      shots: T => [F({ t: 0, zoom: 4.6 }), F({ t: Math.max(T - 1.8, 2), mode: "overview" })], tempo: { len: 30, feel: "rasant" }, whip: true },
    { id: "static", name: "Feste Karte", sub: "Indiana-Jones-Stil: ganze Route, Linie wächst", icon: "🗺️",
      shots: () => [F({ t: 0, mode: "overview" })], tempo: { len: 15, feel: "gemuetlich" } },
    { id: "vloginsert", name: "Vlog-Einschub", sub: "Kara & Nate: kurz, leicht geneigt, folgt dem Avatar", icon: "🚐",
      shots: () => [F({ t: 0, zoom: 7.2, pitch: 22 })], tempo: { len: 5, feel: "normal" } },
    { id: "tracker", name: "Tracker-Reveal", sub: "THE RACE: nah am Team, dann raus bis alle sichtbar", icon: "📡",
      shots: T => [F({ t: 0, zoom: 13, pitch: 0, auto: false }), F({ t: Math.max(T * 0.55, 1.2), mode: "overview" }), F({ t: Math.max(T * 0.85, 1.6), mode: "overview", zoomAdj: -2 })],
      tempo: { len: 8, feel: "normal" } },
    { id: "globeflight", name: "Globus-Flug", sub: "THE RACE: Crash-Zoom rein, Globus, Bogen zum Ziel", icon: "🌍",
      shots: () => [F({ t: 0, mode: "overview", pitch: 30, bearing: -8, zoomAdj: -1.4 })], tempo: { len: 6, feel: "gemuetlich" }, whip: "zoomIn" },
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
    $("whipIn").checked = !!pr.whip; $("whipOut").checked = pr.whip === true;
    if (pr.whip === "zoomIn") $("whipDir").value = "zoom"; else if (pr.whip) $("whipDir").value = "right";
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
  /* ---------- Komplette Shots (aus der Videoanalyse) ----------
     Jeder Shot = Look + Kamera-Abschnitte + Tempo + Effekte, nachgebaut nach gemessenem Ablauf. */
  const lastStop = () => { const p = anim && anim.per[0]; return p ? { p, c: p.coords[p.coords.length - 1] } : null; };
  const arrivalTime = p => { const n = p.coords.length - 1; let lo = 0, hi = timelineTotal(); for (let k = 0; k < 28; k++){ const m = (lo + hi) / 2; if (tipIndexFor(p, m) >= n - 1e-6) hi = m; else lo = m; } return hi; };
  const SHOTS = [
    { id: "s_island", name: "Island-Etappe", sub: "Kara & Nate · 5,5 s: Welt-Einflug durch Wolken → neue Etappe zeichnet sich → halten", icon: "🚐",
      look: "pastellvlog", set: { legFocus: "last", fxClouds: true, whipIn: false, whipOut: false },
      shots: () => [F({ t: 0, mode: "overview", zoomAbs: 2.2, pitch: 0 }), F({ t: 0.35, zoom: 7.2, pitch: 15 })], tempo: { len: 5.5, feel: "normal" } },
    { id: "s_bike", name: "Rad-Etappe", sub: "Radreise · schräg hinter dem Rad, Höhenprofil unten, Mini-Globus oben – für jede Tagesetappe", icon: "🚲",
      look: "pastellvlog", set: { legFocus: "all", fxClouds: false, whipIn: false, whipOut: false, profOn: true, mmOn: true, mmStyle: "globus" },
      shots: () => [F({ t: 0, mode: "overview", pitch: 30, zoomAdj: -0.2 }), F({ t: 1.2, zoom: 12.5, pitch: 55, up: "target", look: 0.15 })], tempo: { len: 12, feel: "normal" } },
    { id: "s_globe", name: "Globus-Flug", sub: "THE RACE · 9 s: Crash-Zoom rein → Bogen zeichnet sich → Zielring → Crash-Zoom ins Ziel", icon: "🌍",
      look: "raceglobe", set: { legFocus: "last", fxClouds: false, whipIn: true, whipOut: true, whipDir: "zoom" },
      shots: () => [F({ t: 0, mode: "overview", pitch: 46, bearing: -14, zoomAdj: -0.7, drift: 2.4, zoomDrift: 0.07, pitchDrift: 0.6 })], tempo: { len: 9, feel: "gemuetlich" },
      extras: ["startPulse", "destPulse"] },
    { id: "s_reveal", name: "Routen-Reveal", sub: "THE RACE · 12 s: Länder füllen sich rot, Linie wächst, Distanz-Chip, Zoom aufs Ziel", icon: "🟥",
      look: "raceborder", set: { legFocus: "all", fxClouds: false, whipIn: false, whipOut: false, lineColor: "#ffffff", lineWidth: 3.5, glow: true },
      shots: T => [F({ t: 0, mode: "overview", pitch: 28, bearing: -6, zoomAdj: -0.25, drift: 1.1, zoomDrift: 0.035 }), F({ t: Math.max(T * 0.8, 1), mode: "still", zoomFromOv: 2.6, pitch: 40, drift: 3, zoomDrift: 0.12 })], tempo: { len: 12, feel: "normal" },
      extras: ["startPulse", "countriesRed", "totalKm", "destPulse"] },
    { id: "s_split", name: "Split-Kachel", sub: "THE RACE · 1:1-Karte für neben das Live-Bild: gestrichelte Route baut sich Stopp für Stopp auf", icon: "🧩",
      look: "racegps", set: { legFocus: "all", fxClouds: false, whipIn: false, whipOut: false, resolution: "1080x1080", lineStyle: "dashed", lineColor: "#ff7a2f", glow: false, dtLabels: false },
      shots: () => [F({ t: 0, pitch: 0, fitSoFar: true, maxZoom: 8 })], tempo: { len: 0, feel: "gemuetlich" }, extras: ["totalKmEnd", "startPulse"] },
    { id: "s_tracker", name: "Team-Tracker", sub: "THE RACE · 6 s: nah am Team auf dem Nacht-Stadtplan, Neon-Spur folgt", icon: "📡",
      look: "racegps", set: { legFocus: "all", fxClouds: false, whipIn: false, whipOut: false },
      shots: () => [F({ t: 0, zoom: 15, pitch: 52, bearing: -24, auto: false, drift: 4, zoomDrift: -0.1 })], tempo: { len: 6, feel: "gemuetlich" } },
    { id: "s_recap", name: "Positions-Recap", sub: "THE RACE · 8 s: alle Teams mit Spuren, Kamera zieht raus bis alle sichtbar", icon: "🏁",
      look: "racegps", set: { legFocus: "all", fxClouds: false, whipIn: false, whipOut: false }, preset: "tracker", tempo: { len: 8, feel: "normal" } }
  ];
  async function applyShot(sh){
    if (playing) pause();
    const look = MA_TEMPLATES.list.find(x => x.id === sh.look);
    if (look) await MA_TEMPLATES.applyTemplate(look);
    for (const [k, v] of Object.entries(sh.set || {})){ const el = $(k); if (!el) continue; if (el.type === "checkbox") el.checked = !!v; else el.value = v; }
    if (sh.set && sh.set.resolution) $("resolution").dispatchEvent(new Event("change"));
    if (sh.set && "dtLabels" in sh.set) { swapStyle(); await styleBusy; }
    if (sh.set && sh.set.lineColor && routes.length === 1){ routes[0].color = sh.set.lineColor; routes[0].waypoints.forEach(w => w.color = sh.set.lineColor); renderRoutes(); renderWpList(); }
    tracks.pos = []; tracks.zoom = []; tracks.bearing = []; tracks.pitch = [];
    if (sh.preset){ await applyPreset(PRESETS.find(p => p.id === sh.preset)); $("whipIn").checked = !!sh.set.whipIn; $("whipOut").checked = !!sh.set.whipOut; }
    else {
      shots = sh.shots(timelineTotal());
      await MA_TEMPLATES.applyTempo(sh.tempo.len, sh.tempo.feel);
      await ensureAnim();
      const T = timelineTotal();
      shots = sh.shots(T);
      // Still-Abschnitt aufs Ziel: Zoom relativ zur Übersicht
      const ls = lastStop();
      shots.forEach(s => { if (s.zoomFromOv != null && anim && ls){ s.center = ls.c; s.zoom = anim.ovCam.zoom + s.zoomFromOv; } });
    }
    // Effekte (ersetzen frühere Shot-Effekte)
    MARKS.removeWhere(m => m.shotExtra); LABELS.removeWhere(l => l.shotExtra);
    await ensureAnim();
    const ls = lastStop();
    for (const ex of sh.extras || []){
      if (!ls) break;
      if (ex === "startPulse"){
        const p0 = anim.per[0].coords[0];
        MARKS.add("Start", { type: "Point", coordinates: p0 }, { shotExtra: true, color: "#ff3b45", t0: 0, t1: Math.max(1.5, arrivalTime(ls.p) * 0.4),
          fx: { draw: false, glow: true, shadow: false, pulse: true, focus: false, extrude: false } });
      } else if (ex === "destPulse"){
        MARKS.add("Ziel", { type: "Point", coordinates: ls.c }, { shotExtra: true, color: "#ffffff", t0: Math.max(0, arrivalTime(ls.p) - 0.2),
          fx: { draw: false, glow: true, shadow: false, pulse: true, focus: false, extrude: false } });
      } else if (ex === "countriesRed"){
        const before = new Set(MARKS.list());
        await MARKS.routeCountries();
        MARKS.list().filter(m => !before.has(m)).forEach(m => Object.assign(m, { shotExtra: true, color: "#c2161f", fillOp: 0.6, stroke: "#ff3b45", width: 2,
          fx: { draw: true, glow: true, shadow: false, pulse: false, focus: false, extrude: false } }));
      } else if (ex === "totalKm" || ex === "totalKmEnd"){
        const km = anim.per.reduce((a, p) => a + p.totalKm, 0);
        const p = ls.p, mid = p.coords[Math.round(p.coords.length * (ex === "totalKmEnd" ? 0.8 : 0.55))];
        const txt = (km >= 100 ? (Math.round(km / 10) * 10).toLocaleString("de-DE") : Math.round(km)) + " KM";
        const t0 = ex === "totalKmEnd" ? arrivalTime(p) : timelineTotal() * 0.5;
        LABELS.add(txt, mid, { shotExtra: true, style: "pill", color: "#d81f2a", textColor: "#ffffff", size: 0.9, anim: "pop", t0: Math.round(t0 * 10) / 10 });
      }
    }
    sel = 0; renderTimeline(); renderEditor();
    await drawStatic();
    if (anim) renderAt(playheadT, false);
    document.querySelectorAll(".shotpre").forEach(b => b.classList.toggle("active", b.dataset.id === sh.id));
    setStatus(tr("Shot") + ": " + sh.name);
  }
  const sgrid = $("shotGrid");
  SHOTS.forEach(sh => {
    const b = document.createElement("button"); b.type = "button"; b.className = "campre shotpre"; b.dataset.id = sh.id;
    b.innerHTML = `<em>${sh.icon}</em><span><b></b><small></small></span>`;
    b.querySelector("b").textContent = sh.name; b.querySelector("small").textContent = sh.sub;
    b.addEventListener("click", () => applyShot(sh));
    sgrid.appendChild(b);
  });

  const grid = $("camGrid");
  PRESETS.forEach(pr => {
    const b = document.createElement("button"); b.type = "button"; b.className = "campre"; b.dataset.id = pr.id;
    b.innerHTML = `<em>${pr.icon}</em><span><b></b><small></small></span>`;
    b.querySelector("b").textContent = pr.name; b.querySelector("small").textContent = pr.sub;
    b.addEventListener("click", () => applyPreset(pr));
    grid.appendChild(b);
  });

  Object.assign(EN, { "Folgen": "Follow", "Still": "Still", "Übersicht": "Overview", "Stativ": "Tripod", "Orbit": "Orbit",
    "Kamera": "Camera", "Shot": "Shot", "Abschnitt": "Shot", "Oben": "Up", "Norden": "North", "Ziel": "Destination", "Fahrtrichtung": "Direction of travel",
    "Aktuelle Kartenansicht übernehmen": "Use current map view", "Neigung": "Tilt", "Drehung": "Rotation", "Startwinkel": "Start angle",
    "Vorausschau (s)": "Look-ahead (s)", "Umdrehungen": "Turns", "Lange Etappen: rauszoomen": "Long legs: zoom out",
    "Neuer Abschnitt am Playhead": "New shot at playhead", "Abschnitt löschen": "Delete shot", "Ansicht übernommen.": "View captured.",
    "Hier beginnt schon ein Abschnitt.": "A shot already starts here.",
    "Übergänge": "Transitions", "Whip-Pan am Anfang": "Whip pan at start", "Whip-Pan am Ende": "Whip pan at end", "Schwenkrichtung": "Pan direction",
    "nach rechts": "right", "Crash-Zoom (rein/raus)": "Crash zoom (in/out)", "nach links": "left", "nach oben": "up", "nach unten": "down" });

  return {
    at, renderRow, renderEditor, applyPreset, presets: PRESETS, blurCanvas, whipBlurPx, applyShot, shots: SHOTS, drawBackdrop, syncBackdrop,
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
