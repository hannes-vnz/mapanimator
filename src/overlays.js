"use strict";
/* =========================================================
   Info-Overlays (aufs #ovl gezeichnet → automatisch im MP4):
   - Höhenprofil: Kurve der Route 1 aus dem Terrarium-DEM (Mapzen/AWS),
     gefüllt bis zur Linienspitze, Punkt mit aktueller Höhe, Gipfel-Marke,
     Höhenmeter bergauf, Stopp-Striche.
   - Mini-Karte: kleiner Globus (orthografisch) oder Weltkarte in einer Ecke,
     zeigt Route, aktuelle Position und den Ausschnitt der großen Karte.
   Daten werden asynchron geladen; waitIdle wartet darauf (Export/Still).
   ========================================================= */
const OVL = (() => {
  const $ = id => document.getElementById(id);
  const DEM = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/";
  const LAND = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson";
  const N = 320;                                   // Abtastpunkte des Profils
  let prof = null, profKey = "", profJob = null, lastT = null;
  const tiles = new Map();

  /* ---------- DEM ---------- */
  function lonLatToTile(lon, lat, z){
    const n = 2 ** z, x = (lon + 180) / 360 * n;
    const r = lat * Math.PI / 180, y = (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n;
    return [x, Math.min(Math.max(y, 0), n - 1e-9)];
  }
  function tile(z, x, y){
    const k = z + "/" + x + "/" + y;
    if (!tiles.has(k)) tiles.set(k, fetch(DEM + k + ".png").then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); })
      .then(createImageBitmap).then(bm => {
        const c = document.createElement("canvas"); c.width = c.height = 256;
        const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(bm, 0, 0);
        return g.getImageData(0, 0, 256, 256).data;
      }).catch(() => null));
    return tiles.get(k);
  }
  async function elevation(lon, lat, z){
    const [fx, fy] = lonLatToTile(lon, lat, z), n = 2 ** z;
    const tx = ((Math.floor(fx) % n) + n) % n, ty = Math.floor(fy);
    const d = await tile(z, tx, ty); if (!d) return null;
    const px = Math.min(255, Math.floor((fx - Math.floor(fx)) * 256)), py = Math.min(255, Math.floor((fy - ty) * 256)), i = (py * 256 + px) * 4;
    return d[i] * 256 + d[i + 1] + d[i + 2] / 256 - 32768;
  }
  function keyOf(p){ const c = p.coords; return c.length + ":" + c[0] + ":" + c[c.length - 1] + ":" + p.totalKm.toFixed(3); }
  function demZoom(km){ return km < 40 ? 12 : km < 150 ? 11 : km < 500 ? 10 : km < 1500 ? 9 : km < 5000 ? 7 : 5; }

  async function buildProfile(p){
    const z = demZoom(p.totalKm), cum = p.cum, pts = [];
    let j = 0;
    for (let i = 0; i < N; i++){
      const km = p.totalKm * i / (N - 1);
      while (j < cum.length - 2 && cum[j + 1] < km) j++;
      const a = p.coords[j], b = p.coords[Math.min(j + 1, p.coords.length - 1)], span = (cum[j + 1] - cum[j]) || 1, f = Math.min(1, Math.max(0, (km - cum[j]) / span));
      pts.push({ km, ll: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f] });
    }
    const legs = p.legs || [], modeAt = km => { for (const lg of legs) if (km >= cum[lg.from] - 1e-9 && km <= cum[lg.to] + 1e-9) return lg.mode; return null; };
    const raw = await Promise.all(pts.map(q => { const md = modeAt(q.km); return md === "fly" ? -1 : md === "ferry" ? 0 : elevation(q.ll[0], q.ll[1], z); }));
    for (let i = 0; i < raw.length; i++) if (raw[i] === -1){                  // Flug: Start- zu Landehöhe, kein Gelände darunter
      let b = i; while (b < raw.length - 1 && raw[b + 1] === -1) b++;
      const va = i > 0 && raw[i - 1] != null ? raw[i - 1] : 0, vb = b < raw.length - 1 && raw[b + 1] != null && raw[b + 1] !== -1 ? raw[b + 1] : va;
      for (let k = i; k <= b; k++) raw[k] = va + (vb - va) * (k - i + 1) / (b - i + 2);
      i = b;
    }
    let e = raw.map(v => v == null ? 0 : Math.max(0, v));                      // Meer = 0 m
    const w = 2; e = e.map((_, i) => { let s = 0, n = 0; for (let k = -w; k <= w; k++){ const v = e[i + k]; if (v != null){ s += v; n++; } } return s / n; });
    let up = 0, down = 0, ref = e[0];                                          // Höhenmeter mit 4-m-Hysterese gegen Rauschen
    for (const v of e){ if (v - ref > 4){ up += v - ref; ref = v; } else if (ref - v > 4){ down += ref - v; ref = v; } }
    let top = 0; e.forEach((v, i) => { if (v > e[top]) top = i; });
    const stops = p.segs.filter(s => s.type === "pause" && !s.sign).map(s => cum[s.at] / p.totalKm);
    return { km: p.totalKm, e, up, down, top, min: Math.min(...e), max: Math.max(...e), stops, ok: pts.some(q => { const md = modeAt(q.km); return md !== "fly" && md !== "ferry"; }) && raw.some(v => v != null) };
  }
  function ensureProfile(){
    if (!checked("profOn") || !anim || !anim.per[0]) return null;
    const p = anim.per[0], k = keyOf(p);
    if (k !== profKey){
      profKey = k; prof = null;
      const job = profJob = buildProfile(p).then(r => { if (profJob === job){ prof = r; drawOverlay(); } }).catch(e => { console.warn("Höhenprofil:", e); });
    }
    return prof;
  }

  /* ---------- Land für die Mini-Karte ---------- */
  let land = null, landJob = null;
  function ensureLand(){
    if (land || landJob || !checked("mmOn")) return;
    landJob = fetch(LAND).then(r => r.json()).then(d => {
      land = [];
      for (const f of d.features){
        const g = f.geometry, polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
        for (const pl of polys) land.push(pl[0]);
      }
      drawOverlay();
    }).catch(e => { console.warn("Mini-Karte:", e); landJob = null; });
  }

  /* ---------- Hilfen ---------- */
  const fmt = n => Math.round(n).toLocaleString("de-DE");
  function rr(g, x, y, w, h, r){ g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function tipFrac(){
    const p = anim && anim.per[0]; if (!p) return 0;
    if (lastT == null) return 1;
    const idx = p._tipIdx || 0, i = Math.min(Math.floor(idx), p.cum.length - 1), f = idx - i;
    const a = p.cum[i], b = p.cum[Math.min(i + 1, p.cum.length - 1)];
    return Math.min(1, (a + (b - a) * f) / p.totalKm);
  }
  function tipLL(){
    const p = anim && anim.per[0]; if (!p) return null;
    const idx = lastT == null ? p.coords.length - 1 : (p._tipIdx || 0), i = Math.min(Math.floor(idx), p.coords.length - 1), f = idx - i;
    const a = p.coords[i], b = p.coords[Math.min(i + 1, p.coords.length - 1)];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  }
  // Akzentfarbe: Routenfarbe, außer sie geht auf dem Hintergrund unter
  function accent(th){
    const c = routeColor(), m = /^#?([0-9a-f]{6})$/i.exec(c); if (!m) return c;
    const n = parseInt(m[1], 16), L = (0.2126 * (n >> 16) + 0.7152 * (n >> 8 & 255) + 0.0722 * (n & 255)) / 255;
    if (th.txt === "#ffffff" && L < 0.3) return "#ff5a36";
    if (th.txt !== "#ffffff" && L > 0.85) return "#e3262b";
    return c;
  }
  const routeColor = () => (routes[0] && routes[0].color) || "#e3262b";
  const THEME = {
    dunkel: { bg: "rgba(14,16,22,0.72)", txt: "#ffffff", sub: "rgba(255,255,255,0.65)", rest: "rgba(255,255,255,0.18)", grid: "rgba(255,255,255,0.10)" },
    hell:   { bg: "rgba(255,255,255,0.88)", txt: "#15171c", sub: "rgba(20,22,28,0.6)", rest: "rgba(20,22,28,0.14)", grid: "rgba(20,22,28,0.08)" },
    ohne:   { bg: null, txt: "#ffffff", sub: "rgba(255,255,255,0.8)", rest: "rgba(255,255,255,0.28)", grid: "rgba(255,255,255,0.0)" }
  };

  /* ---------- Höhenprofil zeichnen ---------- */
  function drawProfile(g, W, H){
    const pr = ensureProfile(); if (!pr || !pr.ok) return;
    const th = THEME[val("profStyle")] || THEME.dunkel, size = num("profSize") || 1;
    const u = Math.min(W, H), portrait = H > W * 1.2;
    const bw = Math.round(W * (portrait ? 0.86 : 0.62)), bh = Math.round(u * 0.23 * size);
    const x0 = Math.round((W - bw) / 2);
    const y0 = val("profPos") === "top" ? Math.round(H * (portrait ? 0.07 : 0.05)) : Math.round(H * (portrait ? 0.79 : 0.95)) - bh;
    const pad = Math.round(u * 0.022), fs = Math.round(u * 0.026 * Math.sqrt(size)), fsBig = Math.round(fs * 1.45);
    const font = (px, w = 800) => w + " " + px + "px 'Inter','Helvetica Neue',Arial,sans-serif";
    if (th.bg){ g.save(); g.shadowColor = "rgba(0,0,0,0.35)"; g.shadowBlur = u * 0.02; g.fillStyle = th.bg; rr(g, x0, y0, bw, bh, u * 0.02); g.fill(); g.restore(); }
    else { g.save(); const gr = g.createLinearGradient(0, y0 - bh * 0.3, 0, y0 + bh); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,0.45)"); g.fillStyle = gr; g.fillRect(0, y0 - bh * 0.3, W, bh * 1.3 + pad); g.restore(); }
    // Diagrammfläche
    const cx = x0 + pad, cw = bw - pad * 2, top = y0 + pad + fsBig * 1.15, cb = y0 + bh - pad, ch = cb - top;
    const lo = Math.max(0, pr.min - (pr.max - pr.min) * 0.05), hi = pr.max + Math.max(40, (pr.max - pr.min) * 0.3);
    const X = i => cx + cw * i / (pr.e.length - 1), Y = v => cb - ch * (v - lo) / (hi - lo);
    const fr = tipFrac(), fi = fr * (pr.e.length - 1), col = accent(th);
    g.strokeStyle = th.grid; g.lineWidth = 1;
    for (let k = 1; k < 3; k++){ const y = top + ch * k / 3; g.beginPath(); g.moveTo(cx, y); g.lineTo(cx + cw, y); g.stroke(); }
    const path = (i0, i1) => { g.beginPath(); g.moveTo(X(i0), cb); for (let i = Math.floor(i0); i <= Math.ceil(i1) && i < pr.e.length; i++) g.lineTo(X(Math.min(Math.max(i, i0), i1)), Y(at(Math.min(Math.max(i, i0), i1)))); g.lineTo(X(i1), cb); g.closePath(); };
    const at = i => { const a = Math.floor(i), b = Math.min(a + 1, pr.e.length - 1); return pr.e[a] + (pr.e[b] - pr.e[a]) * (i - a); };
    g.fillStyle = th.rest; path(0, pr.e.length - 1); g.fill();
    if (fi > 0){
      const gr = g.createLinearGradient(0, top, 0, cb); gr.addColorStop(0, col); gr.addColorStop(1, col + "55");
      g.fillStyle = gr; path(0, fi); g.fill();
      g.strokeStyle = col; g.lineWidth = Math.max(2, u * 0.004); g.lineJoin = "round";
      g.beginPath(); for (let i = 0; i <= Math.ceil(fi); i++){ const ii = Math.min(i, fi); i === 0 ? g.moveTo(X(ii), Y(at(ii))) : g.lineTo(X(ii), Y(at(ii))); } g.stroke();
    }
    // Stopps
    g.fillStyle = th.sub;
    for (const s of pr.stops){ if (s <= 0.001 || s >= 0.999) continue; g.fillRect(cx + cw * s - 1, cb - ch * 0.12, 2, ch * 0.12); }
    // Gipfel
    if (pr.max - pr.min > 60){
      const tx = X(pr.top), ty = Y(pr.e[pr.top]), reached = fi >= pr.top;
      g.fillStyle = reached ? th.txt : th.sub; g.font = font(Math.round(fs * 0.85), 700); g.textAlign = tx > cx + cw * 0.85 ? "right" : tx < cx + cw * 0.15 ? "left" : "center";
      g.fillText("▲ " + fmt(pr.e[pr.top]) + " m", tx, ty - fs * 0.5);
    }
    // Punkt + aktuelle Höhe
    const px = X(fi), py = Y(at(fi)), r = Math.max(4, u * 0.009);
    g.save(); g.shadowColor = col; g.shadowBlur = r * 2.5; g.fillStyle = "#ffffff"; g.beginPath(); g.arc(px, py, r * 1.35, 0, Math.PI * 2); g.fill(); g.restore();
    g.fillStyle = col; g.beginPath(); g.arc(px, py, r * 0.8, 0, Math.PI * 2); g.fill();
    // Kopfzeile: Höhe jetzt · km · Höhenmeter bis hier
    let upSoFar = 0, ref = pr.e[0];
    for (let i = 1; i <= fi; i++){ const v = pr.e[i]; if (v - ref > 4){ upSoFar += v - ref; ref = v; } else if (ref - v > 4) ref = v; }
    const yT = y0 + pad + fsBig * 0.95;
    g.textAlign = "left"; g.fillStyle = th.txt; g.font = font(fsBig, 900);
    const hTxt = fmt(at(fi)) + " m"; g.fillText(hTxt, cx, yT);
    let xx = cx + g.measureText(hTxt).width + fs * 0.8;
    g.font = font(fs, 700); g.fillStyle = th.sub;
    g.fillText(fmt(pr.km * fr) + " / " + fmt(pr.km) + " km", xx, yT);
    g.textAlign = "right"; g.fillStyle = th.txt; g.font = font(fs, 800);
    g.fillText("↗ " + fmt(upSoFar) + " Hm", cx + cw, yT);
    g.textAlign = "left";
  }

  /* ---------- Mini-Karte ---------- */
  function drawMini(g, W, H){
    if (!checked("mmOn") || !anim) return;
    ensureLand();
    const z = map.getZoom(), fade = checked("mmAuto") ? Math.min(1, Math.max(0, (z - 3.2) / 1.2)) : 1;
    if (fade <= 0.01) return;
    const u = Math.min(W, H), size = num("mmSize") || 1, globe = val("mmStyle") !== "welt";
    const R = Math.round(u * 0.105 * size), mw = globe ? R * 2 : Math.round(R * 2.9), mh = globe ? R * 2 : Math.round(mw / 2);
    const m = Math.round(u * 0.045), portrait = H > W * 1.2, pos = val("mmPos") || "tr";
    const left = pos[1] === "l", topSide = pos[0] === "t";
    const bx = left ? m : W - m - mw - (portrait ? 0 : 0), by = topSide ? Math.round(H * (portrait ? 0.11 : 0.06)) : Math.round(H * (portrait ? 0.74 : 0.94)) - mh;
    const ll = tipLL() || [map.getCenter().lng, map.getCenter().lat];
    const c = map.getCenter(), l0 = c.lng * Math.PI / 180, p0 = Math.max(-70, Math.min(70, c.lat)) * Math.PI / 180;
    const ocean = val("mmTheme") === "hell" ? "#bcd6ea" : "#17324f", landC = val("mmTheme") === "hell" ? "#f4efe4" : "#3d6b4f", edge = "#ffffff";
    let proj;
    if (globe){
      const cx = bx + R, cy = by + R, sp0 = Math.sin(p0), cp0 = Math.cos(p0);
      proj = (lon, lat) => {
        const l = lon * Math.PI / 180 - l0, p = lat * Math.PI / 180, cp = Math.cos(p);
        let x = cp * Math.sin(l), y = cp0 * Math.sin(p) - sp0 * cp * Math.cos(l);
        const vis = sp0 * Math.sin(p) + cp0 * cp * Math.cos(l);
        if (vis < 0){ const n = Math.hypot(x, y) || 1; x /= n; y /= n; }
        return [cx + x * R, cy - y * R, vis >= 0];
      };
    } else {
      const lonC = c.lng;
      proj = (lon, lat) => { let d = lon - lonC; d = ((d + 540) % 360) - 180; return [bx + mw / 2 + d / 360 * mw, by + mh / 2 - lat / 180 * mh, true]; };
    }
    g.save(); g.globalAlpha = fade;
    // Schatten + Grund
    g.save(); g.shadowColor = "rgba(0,0,0,0.45)"; g.shadowBlur = u * 0.025; g.fillStyle = ocean;
    if (globe){ g.beginPath(); g.arc(bx + R, by + R, R, 0, Math.PI * 2); g.fill(); } else { rr(g, bx, by, mw, mh, u * 0.012); g.fill(); }
    g.restore();
    g.save();
    if (globe){ g.beginPath(); g.arc(bx + R, by + R, R, 0, Math.PI * 2); g.clip(); } else { rr(g, bx, by, mw, mh, u * 0.012); g.clip(); }
    // Gradnetz
    g.strokeStyle = "rgba(255,255,255,0.12)"; g.lineWidth = 1;
    for (let lo = -180; lo < 180; lo += 30){ g.beginPath(); let pen = false; for (let la = -80; la <= 80; la += 5){ const q = proj(lo, la); if (!q[2]){ pen = false; continue; } pen ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); pen = true; } g.stroke(); }
    for (let la = -60; la <= 60; la += 30){ g.beginPath(); let pen = false; for (let lo = -180; lo <= 180; lo += 5){ const q = proj(lo, la); if (!q[2] || (!globe && Math.abs(lo - c.lng) < 1e-9)){ pen = false; continue; } pen ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); pen = true; } g.stroke(); }
    // Land
    if (land){
      g.fillStyle = landC;
      for (const ring of land){
        g.beginPath(); let any = false, prevX = null;
        for (let i = 0; i < ring.length; i++){
          const q = proj(ring[i][0], ring[i][1]); if (q[2]) any = true;
          if (!globe && prevX != null && Math.abs(q[0] - prevX) > mw / 2){ g.closePath(); g.moveTo(q[0], q[1]); }
          else i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]);
          prevX = q[0];
        }
        if (any) g.fill();
      }
    }
    // Ausschnitt der großen Karte
    try {
      const b = map.getBounds(), dLon = b.getEast() - b.getWest(), dLat = b.getNorth() - b.getSouth();
      if (dLon < 80 && dLat < 60){
        const cs = [[b.getWest(), b.getNorth()], [b.getEast(), b.getNorth()], [b.getEast(), b.getSouth()], [b.getWest(), b.getSouth()]].map(q => proj(q[0], q[1]));
        const minPx = u * 0.012, ctr = proj(c.lng, c.lat);
        let w = Math.abs(cs[1][0] - cs[0][0]), h = Math.abs(cs[3][1] - cs[0][1]);
        g.strokeStyle = "rgba(255,255,255,0.9)"; g.lineWidth = Math.max(1.5, u * 0.0025);
        if (w < minPx || h < minPx){ w = Math.max(w, minPx); h = Math.max(h, minPx); g.strokeRect(ctr[0] - w / 2, ctr[1] - h / 2, w, h); }
        else { g.beginPath(); cs.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.closePath(); g.stroke(); }
      }
    } catch (e) {}
    // Route: ganz blass, gefahren kräftig
    const p = anim.per[0], col = routeColor(), step = Math.max(1, Math.floor(p.coords.length / 400));
    const line = (n, style, lw) => {
      g.strokeStyle = style; g.lineWidth = lw; g.lineJoin = g.lineCap = "round"; g.beginPath(); let pen = false, prevX = null;
      for (let i = 0; i <= n; i += step){ const q = proj(p.coords[i][0], p.coords[i][1]); if (!q[2] || (prevX != null && Math.abs(q[0] - prevX) > mw / 2)){ pen = false; } pen ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); pen = q[2]; prevX = q[0]; }
      g.stroke();
    };
    line(p.coords.length - 1, "rgba(255,255,255,0.45)", Math.max(1.5, u * 0.0028));
    const idx = lastT == null ? p.coords.length - 1 : Math.floor(p._tipIdx || 0);
    if (idx > 0) line(idx, col, Math.max(2, u * 0.0042));
    // Position (pulsierend)
    const q = proj(ll[0], ll[1]);
    if (q[2]){
      const ph = ((lastT || 0) * 1.2) % 1, r = Math.max(3, u * 0.0075);
      g.strokeStyle = col; g.globalAlpha = fade * (1 - ph); g.lineWidth = Math.max(1.5, u * 0.003);
      g.beginPath(); g.arc(q[0], q[1], r + r * 2.6 * ph, 0, Math.PI * 2); g.stroke(); g.globalAlpha = fade;
      g.fillStyle = "#ffffff"; g.beginPath(); g.arc(q[0], q[1], r * 1.3, 0, Math.PI * 2); g.fill();
      g.fillStyle = col; g.beginPath(); g.arc(q[0], q[1], r * 0.85, 0, Math.PI * 2); g.fill();
    }
    // Glanz auf dem Globus
    if (globe){ const gr = g.createRadialGradient(bx + R * 0.65, by + R * 0.55, R * 0.1, bx + R, by + R, R); gr.addColorStop(0, "rgba(255,255,255,0.10)"); gr.addColorStop(0.7, "rgba(255,255,255,0)"); gr.addColorStop(1, "rgba(0,0,0,0.35)"); g.fillStyle = gr; g.fillRect(bx, by, mw, mh); }
    g.restore();
    // Rand
    g.strokeStyle = edge; g.lineWidth = Math.max(2, u * 0.005);
    if (globe){ g.beginPath(); g.arc(bx + R, by + R, R, 0, Math.PI * 2); g.stroke(); } else { rr(g, bx, by, mw, mh, u * 0.012); g.stroke(); }
    g.restore();
  }

  /* ---------- Länderzähler: „7 LÄNDER“ + Name des neuesten Landes ----------
     Zählt Länder-Markierungen (MARKS mit ISO-Code), sobald ihre Startzeit erreicht ist. */
  function drawCountries(g, W, H){
    if (!checked("cntOn") || typeof MARKS === "undefined") return;
    const ms = MARKS.list().filter(m => m.iso).sort((a, b) => a.t0 - b.t0);
    if (!ms.length) return;
    const t = lastT == null ? 1e9 : lastT, done = ms.filter(m => m.t0 <= t), n = done.length;
    const u = Math.min(W, H), portrait = H > W * 1.2, k0 = num("cntStart") || 0;
    const last = done[done.length - 1], since = last ? t - last.t0 : 99;
    const pop = since < 0.5 ? 1 + 0.35 * Math.sin(Math.min(1, since / 0.5) * Math.PI) * (1 - since / 0.5) : 1;
    const x = Math.round(W * (portrait ? 0.08 : 0.06)), y = val("cntPos") === "bottom" ? Math.round(H * (portrait ? 0.74 : 0.82)) : Math.round(H * (portrait ? 0.1 : 0.08));
    const big = Math.round(u * 0.16), small = Math.round(u * 0.04);
    const font = (px, w = 900) => w + " " + px + "px 'Archivo Black','Arial Black',Impact,sans-serif";
    const word0 = (val("cntLabel") || "LÄNDER").toUpperCase(), word = (k0 + n) === 1 && word0 === "LÄNDER" ? "LAND" : word0;
    g.save();
    g.shadowColor = "rgba(0,0,0,0.45)"; g.shadowBlur = u * 0.02; g.shadowOffsetY = u * 0.004;
    g.translate(x, y + big); g.scale(pop, pop);
    g.fillStyle = "#ffffff"; g.font = font(big); g.textBaseline = "alphabetic"; g.textAlign = "left";
    const num1 = String(k0 + n); g.fillText(num1, 0, 0);
    const nm = g.measureText(num1), nw = Math.max(nm.width, nm.actualBoundingBoxRight || 0);
    g.font = font(small); g.fillText(word, nw + small * 1.0, 0);          // Wort auf der Grundlinie, deutlich neben der Zahl
    g.restore();
    // neuestes Land als Chip darunter (blendet nach 2 s aus)
    if (last && since < 2.2){
      const a = Math.min(1, since / 0.25) * Math.min(1, (2.2 - since) / 0.4);
      g.save(); g.globalAlpha = a; g.font = font(Math.round(small * 0.9), 800);
      const txt = "+ " + (last.name || "").toUpperCase(), w = g.measureText(txt).width + small * 1.2, h = small * 1.5, yy = y + big * 1.25;
      g.fillStyle = last.color || "#e3262b"; rr(g, x, yy, w, h, h / 2); g.fill();
      g.fillStyle = "#ffffff"; g.textBaseline = "middle"; g.fillText(txt, x + small * 0.6, yy + h / 2 + 1);
      g.restore();
    }
  }

  /* ---------- Einbinden ---------- */
  const baseRA = renderAt;
  window.renderAt = renderAt = function (t, live){ lastT = stopmoT(t); baseRA(t, live); };
  const baseDS = drawStatic;
  window.drawStatic = drawStatic = async function (){ await baseDS(); if (playheadT <= 0.01) lastT = null; drawOverlay(); };
  const baseDO = drawOverlay;
  window.drawOverlay = drawOverlay = function (){
    baseDO();
    const c = $("ovl"), g = c.getContext("2d");
    try { drawMini(g, c.width, c.height); drawProfile(g, c.width, c.height); drawCountries(g, c.width, c.height); } catch (e) { console.warn("Overlay:", e); }
  };
  // Export/Still: auf Profil- und Landdaten warten
  async function ready(){
    if (checked("profOn")) { ensureProfile(); if (profJob) await profJob; }
    if (checked("mmOn")) { ensureLand(); if (landJob) await landJob; }
  }
  const baseWI = waitIdle;
  window.waitIdle = waitIdle = async function (...a){ await ready(); return baseWI(...a); };

  ["cntOn", "cntPos", "cntLabel", "cntStart", "profOn", "profPos", "profStyle", "profSize", "mmOn", "mmPos", "mmStyle", "mmSize", "mmAuto", "mmTheme"].forEach(id => {
    const el = $(id); if (el) el.addEventListener("input", () => drawOverlay());
  });
  map.on("move", () => { if (!playing && !mp4Busy && checked("mmOn")) drawOverlay(); });

  Object.assign(EN, { "Höhenprofil": "Elevation profile", "Mini-Karte": "Mini map" });
  return { ready, profile: () => prof, refresh: () => { profKey = ""; drawOverlay(); } };
})();
