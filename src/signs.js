"use strict";
/* =========================================================
   Schilder & Fotokarten (wie Baldinger „Signs“)
   - Fotos: Polaroid-Karte an einer Schnur zu ihrem Ort; Ort aus EXIF-GPS
   - Schild-Typen: Pin, Zelt, Hotel, Ziel, Stern, Aussicht
   - Anzeige: immer | beim Passieren | beim Passieren, dann weg | Zeitfenster
   - „Hier anhalten“: Halt der Linie am Schild (fließt in prepareAnim ein)
   Gezeichnet aufs Overlay (#ovl) → automatisch im MP4.
   ========================================================= */
const SIGNS = (() => {
  const $ = id => document.getElementById(id);
  const TYPES = { photo: ["📷", "Foto"], pin: ["📍", "Pin"], tent: ["⛺", "Zelt"], hotel: ["🏨", "Hotel"], flag: ["🏁", "Ziel"], star: ["⭐", "Stern"], view: ["🏔️", "Aussicht"] };
  const SHOW = { pass: "Beim Passieren", passHide: "Beim Passieren, dann weg", always: "Immer", window: "Zeitfenster" };
  const POP = 0.5, OUT = 0.35;
  let list = [], counter = 0, sel = null, picking = null, lastT = null, queue = [];

  function add(o){
    const s = Object.assign({ id: ++counter, type: "pin", text: "", lngLat: null, show: "pass", hold: 3, pause: 0,
      t0: 0, t1: null, scale: 1, rot: (Math.random() - 0.5) * 8, img: null, src: null }, o);
    list.push(s); sel = s.id; changed(true);
    return s;
  }
  function remove(s){ const p = s.pause; list = list.filter(x => x !== s); if (sel === s.id) sel = null; changed(p > 0); }
  function changed(retime){
    renderList(); renderRows();
    if (retime) drawStatic(); else drawOverlay();
  }

  /* ---------- Zeiten ---------- */
  function routeFor(s){
    if (!anim) return null;
    let best = null;
    for (const p of anim.per){
      const i = nearestIndex(p.coords, s.lngLat), d = haversine(p.coords[i], s.lngLat);
      if (!best || d < best.d) best = { p, i, d };
    }
    return best;
  }
  function timeAtIdx(p, idx){
    let lo = 0, hi = timelineTotal();
    for (let k = 0; k < 28; k++){ const mid = (lo + hi) / 2; if (tipIndexFor(p, mid) >= idx - 1e-6) hi = mid; else lo = mid; }
    return hi;
  }
  function windowOf(s){            // [Start, Ende] in Sekunden
    const T = timelineTotal();
    if (s.show === "always") return [0, T];
    if (s.show === "window") return [s.t0, s.t1 == null ? T : s.t1];
    const r = routeFor(s);
    const t = r ? timeAtIdx(r.p, r.i) : 0;
    return s.show === "passHide" ? [t, t + Math.max(s.hold, 0.5) + (s.pause || 0)] : [t, T];
  }
  // für prepareAnim: Halte-Punkte je Route (Index im Linienzug + Dauer)
  function pausesFor(rt, coords){
    const out = [];
    for (const s of list){
      if (!(s.pause > 0) || !s.lngLat) continue;
      const i = nearestIndex(coords, s.lngLat);
      const d = haversine(coords[i], s.lngLat);
      const others = routes.filter(r => r !== rt && r._coords).some(r => haversine(r._coords[nearestIndex(r._coords, s.lngLat)], s.lngLat) < d);
      if (!others) out.push({ idx: i, dur: s.pause });
    }
    return out;
  }

  /* ---------- Zeichnen ---------- */
  const clamp = x => Math.min(Math.max(x, 0), 1);
  const backOut = x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  function rr(g, x, y, w, h, r){ g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function draw(){
    if (!list.length) return;
    const c = $("ovl"), g = c.getContext("2d"), W = c.width, H = c.height, u = Math.min(W, H);
    const base = num("signScale") || 1, t = lastT;
    const vis = [];
    for (const s of list){
      if (!s.lngLat) continue;
      let k = 1;
      if (t != null && anim){
        const [a, b] = windowOf(s);
        if (t < a || t > b + OUT) continue;
        k = Math.min(clamp((t - a) / POP), s.show === "always" ? 1 : clamp((b + OUT - t) / OUT));
        if (s.show === "always") k = 1;
      }
      const p = map.project(s.lngLat);
      if (p.x < -W * 0.3 || p.x > W * 1.3 || p.y < -H * 0.3 || p.y > H * 1.3) continue;
      vis.push({ s, p, k, sc: base * s.scale });
    }
    // Fotokarten nebeneinander statt übereinander
    const cards = vis.filter(v => v.s.type === "photo" && v.s.img).sort((a, b) => a.p.x - b.p.x);
    let lastR = -Infinity;
    for (const v of cards){
      const w = u * 0.26 * v.sc; v.cx = Math.max(v.p.x, lastR + w / 2 + u * 0.015); lastR = v.cx + w / 2;
    }
    for (const v of vis){
      const { s, p, k, sc } = v, e = s.type === "photo" ? backOut(k) : backOut(k);
      g.save(); g.globalAlpha = Math.min(1, k * 2.5);
      if (s.type === "photo" && s.img) drawCard(g, s, p, v.cx, e, sc, u);
      else if (s.type === "photo") drawPin(g, s, p, e, sc, u);          // kein Bild → nur Marker
      else if (s.type === "pin") drawPin(g, s, p, e, sc, u);
      else drawBubble(g, s, p, e, sc, u);
      g.restore();
    }
  }
  function caption(g, txt, x, y, fs, dark){
    if (!txt) return;
    g.font = "800 " + fs + "px 'Archivo Black','Arial Black',system-ui,sans-serif";
    const w = g.measureText(txt).width + fs * 1.1, h = fs * 1.65;
    g.fillStyle = dark ? "#15171c" : "#ffffff"; g.shadowColor = "rgba(0,0,0,.3)"; g.shadowBlur = fs * 0.3;
    rr(g, x - w / 2, y - h / 2, w, h, h / 2); g.fill(); g.shadowColor = "transparent";
    g.fillStyle = dark ? "#ffffff" : "#15171c"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(txt, x, y + fs * 0.04);
  }
  function drawPin(g, s, p, e, sc, u){
    const r = u * 0.03 * sc;
    g.translate(p.x, p.y); g.scale(e, e);
    g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = r * 0.6; g.shadowOffsetY = r * 0.15;
    g.fillStyle = "#e3262b"; g.beginPath();
    g.moveTo(0, 0); g.bezierCurveTo(-r * 0.25, -r * 0.9, -r, -r * 1.3, -r, -r * 2.1);
    g.arc(0, -r * 2.1, r, Math.PI, 0); g.bezierCurveTo(r, -r * 1.3, r * 0.25, -r * 0.9, 0, 0); g.fill();
    g.shadowColor = "transparent"; g.fillStyle = "#fff"; g.beginPath(); g.arc(0, -r * 2.1, r * 0.38, 0, Math.PI * 2); g.fill();
    caption(g, s.text, 0, -r * 3.9, Math.round(u * 0.026 * sc), false);
  }
  function drawBubble(g, s, p, e, sc, u){
    const r = u * 0.034 * sc;
    g.translate(p.x, p.y); g.scale(e, e);
    g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = r * 0.5; g.shadowOffsetY = r * 0.12;
    g.fillStyle = "#ffffff"; g.beginPath(); g.moveTo(-r * 0.35, -r * 0.95); g.lineTo(0, 0); g.lineTo(r * 0.35, -r * 0.95); g.fill();
    g.beginPath(); g.arc(0, -r * 1.75, r, 0, Math.PI * 2); g.fill();
    g.shadowColor = "transparent";
    g.font = Math.round(r * 1.15) + "px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";
    g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(TYPES[s.type][0], 0, -r * 1.68);
    caption(g, s.text, 0, -r * 3.35, Math.round(u * 0.024 * sc), true);
  }
  function drawCard(g, s, p, cx, e, sc, u){
    const W = g.canvas.width, H = g.canvas.height;
    const w = u * 0.26 * sc, img = s.img;
    const ar = img ? Math.min(Math.max(img.width / img.height, 0.75), 1.33) : 1;
    const ph = w * 0.88 / ar, pad = w * 0.06, hh = ph + pad * 2 + (s.text ? w * 0.17 : pad);
    const gap = u * 0.07 * sc, m = u * 0.025;
    cx = Math.min(Math.max(cx, w / 2 + m), W - w / 2 - m);              // seitlich im Bild halten
    const below = p.y - gap - hh < m && p.y + gap + hh < H - m;          // oben kein Platz → unter den Punkt
    const cy = below ? p.y + gap : p.y - gap - hh;
    const ay = below ? cy : cy + hh;                                     // Schnur-Ende = Kartenkante
    // Schnur + Punkt
    g.strokeStyle = "rgba(255,255,255,.9)"; g.lineWidth = Math.max(1.5, u * 0.0025); g.shadowColor = "rgba(0,0,0,.4)"; g.shadowBlur = 4;
    g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + (cx - p.x) * Math.min(e, 1), p.y + (ay - p.y) * Math.min(e, 1)); g.stroke();
    g.fillStyle = "#e3262b"; g.beginPath(); g.arc(p.x, p.y, u * 0.007 * sc, 0, Math.PI * 2); g.fill();
    g.translate(cx, ay); g.scale(e, e); g.rotate(s.rot * Math.PI / 180); g.translate(-cx, -ay);
    g.shadowColor = "rgba(0,0,0,.4)"; g.shadowBlur = u * 0.02; g.shadowOffsetY = u * 0.006;
    g.fillStyle = "#fbfaf7"; g.fillRect(cx - w / 2, cy, w, hh);
    g.shadowColor = "transparent";
    const px = cx - w / 2 + pad, py = cy + pad, pw = w - pad * 2;
    if (img){
      const ir = img.width / img.height, tr2 = pw / ph;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (ir > tr2){ sw = img.height * tr2; sx = (img.width - sw) / 2; } else { sh = img.width / tr2; sy = (img.height - sh) / 2; }
      g.drawImage(img, sx, sy, sw, sh, px, py, pw, ph);
    } else { g.fillStyle = "#d9d6cf"; g.fillRect(px, py, pw, ph); }
    if (s.text){
      g.fillStyle = "#2b2b2b"; g.textAlign = "center"; g.textBaseline = "middle";
      g.font = "700 " + Math.round(w * 0.085) + "px 'Marker Felt','Bradley Hand','Comic Sans MS',system-ui,sans-serif";
      g.fillText(s.text, cx, cy + ph + pad + w * 0.085);
    }
  }

  /* ---------- Fotos + EXIF-GPS ---------- */
  function exifGPS(buf){
    const v = new DataView(buf);
    if (v.getUint16(0) !== 0xFFD8) return null;
    let o = 2;
    while (o < v.byteLength - 4){
      const mk = v.getUint16(o), len = v.getUint16(o + 2);
      if (mk === 0xFFE1 && v.getUint32(o + 4) === 0x45786966){
        const t = o + 10, le = v.getUint16(t) === 0x4949;
        const u16 = x => v.getUint16(x, le), u32 = x => v.getUint32(x, le);
        const ifd = (off, cb) => { const n = u16(t + off); for (let i = 0; i < n; i++){ const e = t + off + 2 + i * 12; cb(u16(e), u16(e + 2), u32(e + 4), e + 8); } };
        let gpsOff = null, exifOff = null, out = {};
        ifd(u32(t + 4), (tag, ty, cnt, vo) => { if (tag === 0x8825) gpsOff = u32(vo); if (tag === 0x8769) exifOff = u32(vo); });
        const rat3 = off => [0, 1, 2].map(k => u32(t + off + k * 8) / (u32(t + off + k * 8 + 4) || 1));
        if (gpsOff != null){
          let lat, lon, latR = "N", lonR = "E";
          ifd(gpsOff, (tag, ty, cnt, vo) => {
            if (tag === 1) latR = String.fromCharCode(v.getUint8(vo));
            if (tag === 3) lonR = String.fromCharCode(v.getUint8(vo));
            if (tag === 2) lat = rat3(u32(vo)); if (tag === 4) lon = rat3(u32(vo));
          });
          if (lat && lon){
            out.lat = (lat[0] + lat[1] / 60 + lat[2] / 3600) * (latR === "S" ? -1 : 1);
            out.lng = (lon[0] + lon[1] / 60 + lon[2] / 3600) * (lonR === "W" ? -1 : 1);
          }
        }
        if (exifOff != null) ifd(exifOff, (tag, ty, cnt, vo) => {
          if (tag === 0x9003){ let st = ""; const so = t + u32(vo); for (let i = 0; i < 19; i++) st += String.fromCharCode(v.getUint8(so + i)); out.time = st; }
        });
        return out;
      }
      if ((mk & 0xFF00) !== 0xFF00) break;
      o += 2 + len;
    }
    return null;
  }
  function shrink(img, max){
    const c = document.createElement("canvas"), s = Math.min(1, max / Math.max(img.width, img.height));
    c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.86);
  }
  const loadImg = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
  async function addPhotos(files){
    let placed = 0, noLoc = [];
    for (const f of files){
      const buf = await f.arrayBuffer();
      let ex = null; try { ex = exifGPS(buf); } catch {}
      const raw = await loadImg(URL.createObjectURL(f)); if (!raw) continue;
      const src = shrink(raw, 900), img = await loadImg(src);
      const o = { type: "photo", text: "", img, src, time: ex && ex.time, show: "passHide", hold: 2.5 };
      if (ex && ex.lat != null){ add(Object.assign(o, { lngLat: [ex.lng, ex.lat] })); placed++; }
      else noLoc.push(o);
    }
    // Fotos ohne Ort: zwischen zeitlich benachbarten Fotos einordnen, sonst per Klick setzen
    const timed = list.filter(s => s.type === "photo" && s.time && s.lngLat).sort((a, b) => a.time.localeCompare(b.time));
    for (const o of noLoc.slice()){
      if (!o.time || timed.length < 2) continue;
      const after = timed.findIndex(s => s.time > o.time);
      if (after <= 0) continue;
      const A = timed[after - 1], B = timed[after];
      add(Object.assign(o, { lngLat: [(A.lngLat[0] + B.lngLat[0]) / 2, (A.lngLat[1] + B.lngLat[1]) / 2] })); placed++;
      noLoc.splice(noLoc.indexOf(o), 1);
    }
    queue = noLoc;
    if (queue.length){ setStatus(placed + " " + tr("Fotos platziert") + " · " + queue.length + " " + tr("ohne Ort – jetzt auf die Karte klicken.")); startPick(); }
    else setStatus(placed + " " + tr("Fotos an ihren Aufnahmeort gesetzt."));
  }

  /* ---------- Panel ---------- */
  function renderList(){
    const el = $("signList"); if (!el) return;
    el.innerHTML = "";
    list.forEach(s => {
      const d = document.createElement("div");
      d.className = "mark" + (s.id === sel ? " sel" : "");
      const thumb = s.type === "photo" && s.src ? `<img class="sthumb" src="${s.src}">` : `<span class="sicon">${TYPES[s.type][0]}</span>`;
      d.innerHTML = `<div class="mhead">${thumb}<input type="text" class="ltext" data-k="text" value="${escapeHtml(s.text)}" placeholder="${tr("Beschriftung")}">` +
        `<span>${tr(SHOW[s.show].split(",")[0])}${s.pause ? " · ⏸" + s.pause + "s" : ""}</span><button type="button" class="del" data-a="del" title="${tr("Entfernen")}">✕</button></div>` +
        (s.id === sel ? `<div class="medit">
          <div class="fxrow stypes">${Object.entries(TYPES).filter(([k]) => k !== "photo" || s.src).map(([k, [ic, n]]) => `<button type="button" data-type="${k}" class="${s.type === k ? "on" : ""}"><em>${ic}</em>${tr(n)}</button>`).join("")}</div>
          <div class="setting"><label>${tr("Anzeigen")}</label><select data-k="show">${Object.entries(SHOW).map(([k, n]) => `<option value="${k}" ${s.show === k ? "selected" : ""}>${tr(n)}</option>`).join("")}</select></div>
          ${s.show === "passHide" ? `<div class="setting"><label>${tr("Sichtbar (s)")}</label><input type="number" data-k="hold" min="0.5" max="30" step="0.5" value="${s.hold}"></div>` : ""}
          ${s.show === "window" ? `<div class="setting"><label>${tr("Start / Ende (s)")}</label><span class="pair"><input type="number" data-k="t0" min="0" step="0.1" value="${s.t0}"><input type="number" data-k="t1" min="0" step="0.1" value="${s.t1 == null ? "" : s.t1}" placeholder="${tr("Ende")}"></span></div>` : ""}
          <div class="setting"><label>${tr("Hier anhalten")}</label><select data-k="pause">${[0, 0.5, 1, 1.5, 2, 3, 4, 5].map(x => `<option value="${x}" ${s.pause === x ? "selected" : ""}>${x ? x + " s" : tr("nein")}</option>`).join("")}</select></div>
          <div class="setting"><label>${tr("Größe")}</label><span class="rangewrap"><input type="range" data-k="scale" min="0.4" max="2.5" step="0.05" value="${s.scale}"><output>${s.scale}</output></span></div>
          <div class="btnrow"><button type="button" class="btn ghost" data-a="move">${tr("Neu platzieren")}</button><button type="button" class="btn ghost" data-a="fit">${tr("Zeigen")}</button></div></div>` : "");
      d.addEventListener("click", e => { if (e.target.closest("input,button,select")) return; sel = s.id; renderList(); renderRows(); });
      d.querySelectorAll("[data-type]").forEach(b => b.addEventListener("click", () => { s.type = b.dataset.type; changed(false); }));
      d.querySelectorAll("[data-k]").forEach(inp => inp.addEventListener(inp.type === "range" || inp.type === "text" ? "input" : "change", () => {
        const k = inp.dataset.k;
        if (k === "t1") s.t1 = inp.value === "" ? null : parseFloat(inp.value);
        else if (k === "text" || k === "show") s[k] = inp.value;
        else s[k] = parseFloat(inp.value) || 0;
        if (inp.type === "range"){ inp.nextElementSibling.textContent = inp.value; inp.style.setProperty("--p", (inp.value - inp.min) / (inp.max - inp.min) * 100 + "%"); }
        if (inp.type === "range" || inp.type === "text"){ drawOverlay(); return; }
        changed(k === "pause");
      }));
      d.querySelectorAll("input[type=range]").forEach(r => r.style.setProperty("--p", (r.value - r.min) / (r.max - r.min) * 100 + "%"));
      const act = a => d.querySelector(`[data-a="${a}"]`);
      act("del").addEventListener("click", () => remove(s));
      if (act("move")) act("move").addEventListener("click", () => startPick(s));
      if (act("fit")) act("fit").addEventListener("click", () => map.easeTo({ center: s.lngLat, duration: 600 }));
      el.appendChild(d);
    });
    $("signEmpty").hidden = list.length > 0;
  }

  /* ---------- Timeline ---------- */
  const rows = document.createElement("div");
  rows.id = "tlSigns";
  $("tlBody").insertBefore(rows, $("tlTracks"));
  function renderRows(){
    rows.innerHTML = "";
    if (!anim) return;
    const T = timelineTotal();
    list.forEach(s => {
      if (!s.lngLat) return;
      const [a, b] = windowOf(s);
      const r = document.createElement("div"); r.className = "mrow";
      r.innerHTML = `<div class="shlabel"><span>${TYPES[s.type][0]} ${escapeHtml(s.text || tr(TYPES[s.type][1]))}</span></div><div class="shlane"></div>`;
      const bar = document.createElement("div");
      bar.className = "mbar sbar" + (s.id === sel ? " sel" : "");
      bar.style.left = t2x(Math.min(a, T)) + "px"; bar.style.width = Math.max(t2x(Math.min(b, T)) - t2x(Math.min(a, T)), 8) + "px";
      bar.innerHTML = `<span>${TYPES[s.type][0]} ${escapeHtml(s.text || tr(TYPES[s.type][1]))}${s.pause ? " ⏸" + s.pause + "s" : ""}</span>`;
      bar.addEventListener("pointerdown", e => { e.stopPropagation(); sel = s.id; renderList(); renderRows(); setPlayhead(Math.min(a + 0.6, T)); });
      r.querySelector(".shlane").appendChild(bar); rows.appendChild(r);
    });
  }

  /* ---------- Platzieren ---------- */
  let moving = null;
  function startPick(s){ picking = true; moving = s || null; $("signPick").classList.add("on"); map.getCanvas().style.cursor = "crosshair";
    if (!queue.length) setStatus(tr("Auf die Karte klicken, um das Schild zu setzen …")); }
  map.on("click", e => {
    if (!picking) return;
    const ll = [e.lngLat.lng, e.lngLat.lat];
    if (moving){ moving.lngLat = ll; moving = null; }
    else if (queue.length){ add(Object.assign(queue.shift(), { lngLat: ll })); if (queue.length){ setStatus(queue.length + " " + tr("ohne Ort – weiter klicken.")); return; } }
    else add({ type: "pin", text: tr("Hier"), lngLat: ll });
    picking = false; $("signPick").classList.remove("on"); map.getCanvas().style.cursor = "";
    changed(true);
  });

  /* ---------- Einhängen ---------- */
  const baseRA = renderAt;
  window.renderAt = renderAt = function (t, live){ lastT = t; baseRA(t, live); };
  const baseDO = drawOverlay;
  window.drawOverlay = drawOverlay = function (){ baseDO(); draw(); };
  const baseDS = drawStatic;
  window.drawStatic = drawStatic = async function (){ await baseDS(); if (playheadT <= 0.01) lastT = null; renderRows(); drawOverlay(); };
  const baseRT = renderTimeline;
  window.renderTimeline = renderTimeline = function (){ baseRT(); renderRows(); };

  $("signPick").addEventListener("click", () => picking ? (picking = false, $("signPick").classList.remove("on"), map.getCanvas().style.cursor = "") : startPick());
  $("signPhotos").addEventListener("change", e => { const f = [...e.target.files]; e.target.value = ""; if (f.length) addPhotos(f); });
  $("signScale").addEventListener("input", () => drawOverlay());

  Object.assign(EN, { "Foto": "Photo", "Pin": "Pin", "Zelt": "Tent", "Hotel": "Hotel", "Ziel": "Finish", "Stern": "Star", "Aussicht": "Viewpoint",
    "Beim Passieren": "When passed", "Beim Passieren, dann weg": "When passed, then hide", "Immer": "Always", "Zeitfenster": "Time window",
    "Anzeigen": "Show", "Sichtbar (s)": "Visible (s)", "Hier anhalten": "Pause here", "nein": "no", "Beschriftung": "Caption", "Hier": "Here",
    "Fotos platziert": "photos placed", "ohne Ort – jetzt auf die Karte klicken.": "without location – click the map now.",
    "ohne Ort – weiter klicken.": "without location – keep clicking.", "Fotos an ihren Aufnahmeort gesetzt.": "photos placed where they were taken.",
    "Auf die Karte klicken, um das Schild zu setzen …": "Click the map to place the sign …", "Schilder & Fotos": "Signs & photos",
    "📷 Fotos hinzufügen": "📷 Add photos", "📍 Schild setzen": "📍 Place sign", "Schildgröße": "Sign size" });

  return {
    add, draw, pausesFor, windowOf, exifGPS, list: () => list,
    get: () => list.map(({ id, img, ...rest }) => rest),
    async set(arr){
      list = []; sel = null;
      for (const o of arr || []){ const img = o.src ? await loadImg(o.src) : null; list.push(Object.assign({ id: ++counter }, o, { img })); }
      changed(true);
    }
  };
})();
