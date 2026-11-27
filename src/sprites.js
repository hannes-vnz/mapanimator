"use strict";
/* =========================================================
   2D-Figuren an der Linienspitze (Spitzen-Stil „2D-Figur“):
   flache Seitenansicht je Verkehrsmittel (Bus, Auto, Camper, Rad, Motorrad, Wanderer,
   Zug, Fähre, Boot, Kajak, Flugzeug, Heli, Ballon …) in Routenfarbe – oder ein eigenes Bild.
   Schaut in Fahrtrichtung (spiegelt sich), neigt sich mit der Strecke, wippt beim Fahren,
   Räder/Pedale drehen sich. Optional weißer Sticker-Rand (Papier-Cutout-Look).
   Gezeichnet aufs Overlay (#ovl) → automatisch im MP4.
   ========================================================= */
const SPRITES = (() => {
  const $ = id => document.getElementById(id);
  let lastT = null, state = new Map();
  const tmp = document.createElement("canvas"), out = document.createElement("canvas");

  /* ---------- Zeichnungen (Entwurf 200×140, Boden y=130, Blick nach rechts) ---------- */
  const shade = (hex, f) => { const n = parseInt(String(hex).replace("#", ""), 16); const c = s => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f))); return `rgb(${c(16)},${c(8)},${c(0)})`; };
  function rr(g, x, y, w, h, r){ g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function wheel(g, x, y, r, ph){
    g.fillStyle = "#23252b"; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#c9ccd3"; g.beginPath(); g.arc(x, y, r * 0.5, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#7d828c"; g.lineWidth = r * 0.14; g.beginPath();
    for (let k = 0; k < 3; k++){ const a = ph + k * Math.PI * 2 / 3; g.moveTo(x, y); g.lineTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5); } g.stroke();
  }
  const GLASS = "#bfe3ff", DARK = "#23252b", SKIN = "#f1c7a3";
  const DRAW = {
    bus(g, c, ph){ rr(g, 8, 34, 184, 82, 14); g.fillStyle = c; g.fill();
      g.fillStyle = "#ffffff"; g.fillRect(8, 88, 184, 8);
      g.fillStyle = GLASS; for (let i = 0; i < 5; i++) rr(g, 22 + i * 30, 46, 24, 28, 4), g.fill();
      rr(g, 170, 44, 18, 40, 5); g.fill(); g.fillStyle = shade(c, 0.7); rr(g, 154, 46, 12, 56, 3); g.fill();
      g.fillStyle = "#ffd54a"; g.fillRect(186, 98, 6, 8); wheel(g, 50, 116, 15, ph); wheel(g, 152, 116, 15, ph); },
    car(g, c, ph){ g.fillStyle = c; g.beginPath(); g.moveTo(14, 112); g.lineTo(14, 86); g.quadraticCurveTo(16, 76, 40, 74); g.lineTo(66, 50); g.quadraticCurveTo(72, 46, 84, 46); g.lineTo(130, 46); g.quadraticCurveTo(140, 46, 148, 56); g.lineTo(166, 74);
      g.quadraticCurveTo(190, 76, 190, 92); g.lineTo(190, 112); g.closePath(); g.fill();
      g.fillStyle = GLASS; g.beginPath(); g.moveTo(74, 72); g.lineTo(90, 54); g.lineTo(110, 54); g.lineTo(110, 72); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(116, 72); g.lineTo(116, 54); g.lineTo(134, 54); g.lineTo(150, 72); g.closePath(); g.fill();
      g.fillStyle = "#ffd54a"; g.fillRect(182, 84, 8, 6); wheel(g, 52, 112, 16, ph); wheel(g, 152, 112, 16, ph); },
    camper(g, c, ph){ rr(g, 12, 30, 176, 84, 26); g.fillStyle = "#f4f1ea"; g.fill();
      g.save(); g.beginPath(); g.rect(0, 76, 200, 60); g.clip(); rr(g, 12, 30, 176, 84, 26); g.fillStyle = c; g.fill(); g.restore();
      g.fillStyle = GLASS; rr(g, 28, 42, 34, 26, 6); g.fill(); rr(g, 70, 42, 34, 26, 6); g.fill(); rr(g, 140, 40, 40, 30, 10); g.fill();
      g.fillStyle = "#f4f1ea"; g.beginPath(); g.moveTo(166, 76); g.lineTo(188, 76); g.lineTo(188, 98); g.closePath(); g.fill();   // V-Front
      g.fillStyle = "#ffd54a"; g.fillRect(182, 86, 6, 6);
      wheel(g, 52, 114, 15, ph); wheel(g, 150, 114, 15, ph); },
    truck(g, c, ph){ rr(g, 8, 26, 124, 88, 6); g.fillStyle = "#f4f1ea"; g.fill(); g.strokeStyle = shade(c, 0.6); g.lineWidth = 3; g.stroke();
      rr(g, 136, 50, 54, 64, 10); g.fillStyle = c; g.fill(); g.fillStyle = GLASS; rr(g, 158, 58, 26, 22, 4); g.fill();
      wheel(g, 40, 114, 15, ph); wheel(g, 100, 114, 15, ph); wheel(g, 164, 114, 15, ph); },
    bike(g, c, ph){                                                         // Radfahrer mit tretenden Beinen
      const w1 = [52, 104], w2 = [148, 104], r = 26;
      g.lineWidth = 5; g.strokeStyle = DARK; for (const w of [w1, w2]){ g.beginPath(); g.arc(w[0], w[1], r, 0, Math.PI * 2); g.stroke(); }
      g.lineWidth = 2; g.strokeStyle = "#9aa0aa"; for (const w of [w1, w2]) for (let k = 0; k < 4; k++){ const a = ph + k * Math.PI / 4; g.beginPath(); g.moveTo(w[0] - Math.cos(a) * r, w[1] - Math.sin(a) * r); g.lineTo(w[0] + Math.cos(a) * r, w[1] + Math.sin(a) * r); g.stroke(); }
      const bb = [98, 104], seat = [86, 62], bar = [136, 58];
      g.lineWidth = 6; g.strokeStyle = c; g.lineCap = "round"; g.beginPath(); g.moveTo(w1[0], w1[1]); g.lineTo(bb[0], bb[1]); g.lineTo(seat[0], seat[1]); g.moveTo(bb[0], bb[1]); g.lineTo(bar[0] - 6, bar[1] + 8); g.lineTo(seat[0] + 4, seat[1] + 4); g.moveTo(w2[0], w2[1]); g.lineTo(bar[0], bar[1]); g.lineTo(bar[0] + 8, bar[1] - 4); g.stroke();
      g.fillStyle = shade(c, 0.6); g.fillRect(64, 78, 18, 14);                             // Gepäcktasche
      const pd = a => [bb[0] + Math.cos(a) * 14, bb[1] + Math.sin(a) * 14], p1 = pd(ph * 2), p2 = pd(ph * 2 + Math.PI), hip = [88, 50];
      const knee = p => [(hip[0] + p[0]) / 2 + 14, (hip[1] + p[1]) / 2 - 6];
      g.strokeStyle = "#2f3a55"; g.lineWidth = 9; for (const p of [p2, p1]){ const k = knee(p); g.beginPath(); g.moveTo(hip[0], hip[1]); g.lineTo(k[0], k[1]); g.lineTo(p[0], p[1]); g.stroke(); }
      g.strokeStyle = c; g.lineWidth = 14; g.beginPath(); g.moveTo(hip[0], hip[1]); g.lineTo(112, 22); g.stroke();
      g.strokeStyle = SKIN; g.lineWidth = 7; g.beginPath(); g.moveTo(110, 26); g.lineTo(138, 50); g.stroke();
      g.fillStyle = SKIN; g.beginPath(); g.arc(120, 10, 11, 0, Math.PI * 2); g.fill();
      g.fillStyle = shade(c, 0.55); g.beginPath(); g.arc(119, 6, 12, Math.PI, 0); g.fill(); },
    moto(g, c, ph){ wheel(g, 48, 110, 20, ph); wheel(g, 152, 110, 20, ph);
      g.fillStyle = c; g.beginPath(); g.moveTo(60, 100); g.lineTo(80, 74); g.lineTo(134, 70); g.lineTo(150, 96); g.closePath(); g.fill();
      g.fillStyle = DARK; rr(g, 70, 64, 50, 10, 5); g.fill(); g.strokeStyle = DARK; g.lineWidth = 5; g.beginPath(); g.moveTo(150, 100); g.lineTo(136, 52); g.lineTo(126, 50); g.stroke();
      g.strokeStyle = "#2f3a55"; g.lineWidth = 11; g.lineCap = "round"; g.beginPath(); g.moveTo(92, 62); g.lineTo(112, 80); g.lineTo(108, 98); g.stroke();
      g.strokeStyle = shade(c, 0.5); g.lineWidth = 16; g.beginPath(); g.moveTo(92, 62); g.lineTo(108, 30); g.stroke();
      g.strokeStyle = shade(c, 0.5); g.lineWidth = 7; g.beginPath(); g.moveTo(106, 36); g.lineTo(130, 50); g.stroke();
      g.fillStyle = c; g.beginPath(); g.arc(112, 18, 13, 0, Math.PI * 2); g.fill(); g.fillStyle = GLASS; g.fillRect(114, 12, 11, 8); },
    foot(g, c, ph){ const sw = Math.sin(ph * 1.5) * 16, hip = [100, 72];
      g.strokeStyle = "#2f3a55"; g.lineWidth = 11; g.lineCap = "round";
      for (const s of [-1, 1]){ g.beginPath(); g.moveTo(hip[0], hip[1]); g.lineTo(hip[0] + s * sw * 0.6, 100); g.lineTo(hip[0] + s * sw, 126); g.stroke(); }
      g.fillStyle = shade(c, 0.6); rr(g, 70, 26, 26, 42, 8); g.fill();                     // Rucksack
      g.strokeStyle = c; g.lineWidth = 22; g.beginPath(); g.moveTo(100, 34); g.lineTo(100, 72); g.stroke();
      g.strokeStyle = SKIN; g.lineWidth = 7; g.beginPath(); g.moveTo(104, 40); g.lineTo(104 + sw * 0.5, 66); g.stroke();
      g.fillStyle = SKIN; g.beginPath(); g.arc(104, 18, 12, 0, Math.PI * 2); g.fill(); g.fillStyle = shade(c, 0.5); g.beginPath(); g.ellipse(104, 9, 15, 5, 0, 0, Math.PI * 2); g.fill(); },
    train(g, c, ph){ g.fillStyle = c; g.beginPath(); g.moveTo(4, 112); g.lineTo(4, 40); g.lineTo(150, 40); g.quadraticCurveTo(196, 44, 196, 96); g.lineTo(196, 112); g.closePath(); g.fill();
      g.fillStyle = "#ffffff"; g.fillRect(4, 92, 192, 6); g.fillStyle = GLASS; for (let i = 0; i < 4; i++) rr(g, 14 + i * 32, 52, 24, 24, 4), g.fill();
      g.beginPath(); g.moveTo(152, 52); g.quadraticCurveTo(182, 56, 186, 78); g.lineTo(152, 78); g.closePath(); g.fill();
      for (const x of [30, 60, 130, 160]) wheel(g, x, 116, 10, ph); },
    ferry(g, c, ph){ g.fillStyle = "#6fb6e8"; for (let k = 0; k < 3; k++){ g.beginPath(); g.arc(30 + k * 60 + (ph * 6) % 20, 132, 14, Math.PI, 0); g.fill(); }
      g.fillStyle = c; g.beginPath(); g.moveTo(6, 92); g.lineTo(194, 92); g.lineTo(176, 126); g.lineTo(22, 126); g.closePath(); g.fill();
      g.fillStyle = "#ffffff"; rr(g, 34, 60, 130, 32, 6); g.fill(); rr(g, 60, 38, 80, 24, 6); g.fill();
      g.fillStyle = GLASS; for (let i = 0; i < 6; i++) g.fillRect(42 + i * 20, 68, 12, 10);
      g.fillStyle = shade(c, 0.8); g.fillRect(104, 14, 18, 26); g.fillStyle = DARK; g.fillRect(104, 10, 18, 6); },
    boat(g, c, ph){ g.fillStyle = "#6fb6e8"; for (let k = 0; k < 3; k++){ g.beginPath(); g.arc(30 + k * 60 + (ph * 6) % 20, 132, 12, Math.PI, 0); g.fill(); }
      g.fillStyle = c; g.beginPath(); g.moveTo(20, 104); g.lineTo(186, 104); g.lineTo(162, 126); g.lineTo(40, 126); g.closePath(); g.fill();
      g.strokeStyle = DARK; g.lineWidth = 4; g.beginPath(); g.moveTo(100, 104); g.lineTo(100, 8); g.stroke();
      g.fillStyle = "#ffffff"; g.beginPath(); g.moveTo(104, 12); g.lineTo(168, 96); g.lineTo(104, 96); g.closePath(); g.fill();
      g.fillStyle = shade(c, 1.4); g.beginPath(); g.moveTo(96, 24); g.lineTo(50, 96); g.lineTo(96, 96); g.closePath(); g.fill(); },
    kayak(g, c, ph){ g.fillStyle = "#6fb6e8"; rr(g, 0, 116, 200, 14, 7); g.fill();
      g.fillStyle = c; g.beginPath(); g.moveTo(10, 112); g.quadraticCurveTo(100, 132, 190, 112); g.quadraticCurveTo(100, 100, 10, 112); g.fill();
      g.strokeStyle = shade(c, 0.5); g.lineWidth = 14; g.lineCap = "round"; g.beginPath(); g.moveTo(100, 106); g.lineTo(100, 70); g.stroke();
      g.fillStyle = SKIN; g.beginPath(); g.arc(102, 58, 11, 0, Math.PI * 2); g.fill();
      const a = Math.sin(ph * 1.5) * 0.6; g.strokeStyle = DARK; g.lineWidth = 4; g.beginPath(); g.moveTo(100 - Math.cos(a) * 60, 80 + Math.sin(a) * 30); g.lineTo(100 + Math.cos(a) * 60, 80 - Math.sin(a) * 30); g.stroke(); },
    gondola(g, c, ph){ g.strokeStyle = DARK; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 6); g.lineTo(200, 0); g.stroke(); g.lineWidth = 4; g.beginPath(); g.moveTo(100, 3); g.lineTo(100, 40); g.stroke();
      rr(g, 60, 40, 80, 80, 14); g.fillStyle = c; g.fill(); g.fillStyle = GLASS; rr(g, 70, 52, 60, 34, 6); g.fill(); g.fillStyle = shade(c, 0.7); g.fillRect(60, 100, 80, 6); },
    fly(g, c){ g.fillStyle = "#ffffff"; g.beginPath(); g.moveTo(10, 70); g.quadraticCurveTo(10, 56, 40, 56); g.lineTo(170, 56); g.quadraticCurveTo(196, 58, 196, 70); g.quadraticCurveTo(196, 82, 170, 84); g.lineTo(40, 84); g.quadraticCurveTo(10, 84, 10, 70); g.fill();
      g.fillStyle = c; g.beginPath(); g.moveTo(14, 60); g.lineTo(4, 18); g.lineTo(26, 18); g.lineTo(52, 58); g.closePath(); g.fill();
      g.fillStyle = shade(c, 0.8); g.beginPath(); g.moveTo(80, 74); g.lineTo(130, 74); g.lineTo(100, 112); g.lineTo(84, 112); g.closePath(); g.fill();
      g.fillStyle = c; g.fillRect(20, 74, 176, 5); g.fillStyle = GLASS; for (let i = 0; i < 8; i++) g.fillRect(56 + i * 13, 62, 7, 7);
      g.fillStyle = DARK; g.beginPath(); g.moveTo(178, 62); g.lineTo(190, 66); g.lineTo(178, 70); g.closePath(); g.fill(); },
    heli(g, c, ph){ g.strokeStyle = DARK; g.lineWidth = 4; g.beginPath(); g.moveTo(100 - 90 * Math.abs(Math.cos(ph * 4)), 22); g.lineTo(100 + 90 * Math.abs(Math.cos(ph * 4)), 22); g.stroke();
      g.fillRect(98, 22, 4, 16); g.fillStyle = c; g.beginPath(); g.ellipse(110, 70, 50, 32, 0, 0, Math.PI * 2); g.fill(); g.fillRect(10, 62, 70, 12);
      g.fillStyle = GLASS; g.beginPath(); g.ellipse(132, 62, 22, 18, 0, -Math.PI / 2, Math.PI / 2); g.fill();
      g.strokeStyle = DARK; g.lineWidth = 4; g.beginPath(); g.moveTo(76, 112); g.lineTo(150, 112); g.moveTo(92, 100); g.lineTo(92, 112); g.moveTo(134, 100); g.lineTo(134, 112); g.stroke(); },
    balloon(g, c){ g.fillStyle = c; g.beginPath(); g.moveTo(100, 96); g.bezierCurveTo(40, 70, 40, 4, 100, 4); g.bezierCurveTo(160, 4, 160, 70, 100, 96); g.fill();
      g.fillStyle = "#ffffff"; g.globalAlpha = 0.8; g.beginPath(); g.moveTo(100, 96); g.bezierCurveTo(84, 70, 84, 4, 100, 4); g.bezierCurveTo(116, 4, 116, 70, 100, 96); g.fill(); g.globalAlpha = 1;
      g.strokeStyle = DARK; g.lineWidth = 2; g.beginPath(); g.moveTo(88, 92); g.lineTo(90, 110); g.moveTo(112, 92); g.lineTo(110, 110); g.stroke(); g.fillStyle = "#8a5a2b"; rr(g, 86, 108, 28, 20, 4); g.fill(); }
  };
  const ALIAS = { run: "foot", horse: "foot", ski: "foot", caravan: "camper", cruise: "ferry", cablecar: "gondola", chairlift: "gondola", paraglider: "balloon" };
  const AIR = new Set(["fly", "heli", "balloon", "paraglider", "cablecar", "chairlift"]);

  /* ---------- Figur rendern (mit Sticker-Rand) ---------- */
  function figure(mode, color, ph, hpx, sticker, img){
    const k = hpx / 120, W = Math.ceil(210 * k), H = Math.ceil(150 * k), pad = Math.ceil(hpx * 0.06) + 2;
    tmp.width = W + pad * 2; tmp.height = H + pad * 2; const t = tmp.getContext("2d");
    t.save(); t.translate(pad, pad);
    if (img){ const s = Math.min(W / img.naturalWidth, H / img.naturalHeight); t.drawImage(img, (W - img.naturalWidth * s) / 2, H - img.naturalHeight * s, img.naturalWidth * s, img.naturalHeight * s); }
    else { t.scale(k, k); const d = DRAW[mode] || DRAW[ALIAS[mode]];
      if (d) d(t, color, ph); else { t.font = "110px 'Apple Color Emoji','Segoe UI Emoji',sans-serif"; t.textAlign = "center"; t.textBaseline = "bottom"; t.save(); t.translate(200, 0); t.scale(-1, 1); t.fillText((MODES[mode] || {}).icon || "📍", 100, 140); t.restore(); } }
    t.restore();
    out.width = tmp.width; out.height = tmp.height; const o = out.getContext("2d"); o.clearRect(0, 0, out.width, out.height);
    if (sticker){ const b = Math.max(2, hpx * 0.045);
      for (let a = 0; a < 16; a++) o.drawImage(tmp, Math.cos(a / 16 * Math.PI * 2) * b, Math.sin(a / 16 * Math.PI * 2) * b);
      o.globalCompositeOperation = "source-in"; o.fillStyle = "#ffffff"; o.fillRect(0, 0, out.width, out.height); o.globalCompositeOperation = "source-over"; }
    o.drawImage(tmp, 0, 0);
    return { c: out, pad, W, H };
  }

  /* ---------- pro Bild: Position, Richtung, Neigung ---------- */
  function lngLatAt(p, idx){ const i = Math.max(0, Math.min(Math.floor(idx), p.coords.length - 1)), f = idx - i, a = p.coords[i], b = p.coords[Math.min(i + 1, p.coords.length - 1)]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; }
  function draw(){
    if (val("tipStyle") !== "sprite" || !anim || lastT == null) return;
    const c = $("ovl"), g = c.getContext("2d"), W = c.width, H = c.height, u = Math.min(W, H);
    const hpx = u * 0.11 * (num("tipScale") || 1), sticker = checked("spriteSticker");
    for (const p of anim.per){
      const idx = p._tipIdx || 0, ll = lngLatAt(p, idx), pt = map.project(ll), lg = legAt(p, idx), mode = lg.mode;
      const st = state.get(p) || { face: 1, idx: idx, tilt: 0, ph: 0 };
      // Fahrtrichtung auf dem Bildschirm (Punkte etwas vor/hinter der Spitze)
      const span = Math.max(1, p.coords.length * 0.004), a = map.project(lngLatAt(p, Math.max(0, idx - span))), b = map.project(lngLatAt(p, Math.min(p.coords.length - 1, idx + span)));
      const dx = b.x - a.x, dy = b.y - a.y, moving = Math.abs(idx - st.idx) > 1e-4;
      if (Math.abs(dx) > 2) st.face = dx < 0 ? -1 : 1;
      const maxTilt = AIR.has(mode) ? 0.5 : 0.3, want = Math.max(-maxTilt, Math.min(maxTilt, Math.atan2(dy, Math.abs(dx) + 1e-6))) * (Math.abs(dx) + Math.abs(dy) > 3 ? 1 : 0);
      st.tilt += (want - st.tilt) * 0.25; st.ph = lastT * 9; st.idx = idx; state.set(p, st);
      const img = p.rt._spriteImg && p.rt._spriteImg.complete && p.rt._spriteImg.naturalWidth ? p.rt._spriteImg : null;
      const f = figure(mode, p.rt.color, moving ? st.ph : 0, hpx, sticker, img);
      const bob = moving && !AIR.has(mode) ? Math.abs(Math.sin(lastT * 14)) * hpx * 0.025 : AIR.has(mode) ? Math.sin(lastT * 3) * hpx * 0.04 : 0;
      const anchorY = AIR.has(mode) ? f.pad + f.H * 0.55 : f.pad + f.H * (130 / 150);
      g.save(); g.translate(pt.x, pt.y - bob); g.rotate(st.tilt * st.face); g.scale(st.face, 1);
      g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = hpx * 0.12; g.shadowOffsetX = hpx * 0.04 * st.face; g.shadowOffsetY = hpx * 0.06;
      g.drawImage(f.c, -f.c.width / 2, -anchorY);
      g.restore();
      if (p.rt.tipLabel){                                                     // Name über der Figur
        const txt = p.rt.tipLabel.toUpperCase(); g.save(); g.font = "800 " + Math.round(hpx * 0.2) + "px 'Avenir Next Condensed','Arial Narrow',sans-serif";
        const tw = g.measureText(txt).width + hpx * 0.2, th = hpx * 0.28, ty = pt.y - bob - anchorY + f.pad - th - hpx * 0.05;
        g.fillStyle = p.rt.color; rr(g, pt.x - tw / 2, ty, tw, th, th / 2); g.fill(); g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(txt, pt.x, ty + th / 2 + 1); g.restore();
      }
    }
  }

  /* ---------- Einbinden ---------- */
  const baseRA = renderAt;
  window.renderAt = renderAt = function (t, live){ lastT = t; baseRA(t, live); };
  const baseDS = drawStatic;
  window.drawStatic = drawStatic = async function (){ await baseDS(); if (playheadT <= 0.01) lastT = null; drawOverlay(); };
  const baseDO = drawOverlay;
  window.drawOverlay = drawOverlay = function (){ baseDO(); try { draw(); } catch (e) { console.warn("2D-Figur:", e); } };
  // eigenes Bild als Figur (PNG mit transparentem Hintergrund am besten)
  const inp = $("tipSprite");
  if (inp) inp.addEventListener("change", () => {
    const fl = inp.files[0]; if (!fl) return; const rd = new FileReader();
    rd.onload = () => { const im = new Image(); im.onload = () => { R()._spriteImg = im; R().tipSprite = rd.result; $("tipStyle").value = "sprite"; $("tipSpriteLbl").childNodes[0].textContent = tr("Bild ✓");
      if (anim) renderAt(playheadT, false); else drawOverlay(); }; im.src = rd.result; };
    rd.readAsDataURL(fl);
  });
  const clr = $("tipSpriteClear");
  if (clr) clr.addEventListener("click", () => { R()._spriteImg = null; R().tipSprite = null; $("tipSpriteLbl").childNodes[0].textContent = tr("Wählen"); if (anim) renderAt(playheadT, false); });
  ["spriteSticker", "tipScale", "tipStyle"].forEach(id => $(id) && $(id).addEventListener("input", () => { if (anim) renderAt(playheadT, false); else drawOverlay(); }));
  document.addEventListener("ma:loaded", () => { for (const rt of routes) if (rt.tipSprite && !rt._spriteImg){ const im = new Image(); im.src = rt.tipSprite; rt._spriteImg = im; } });

  Object.assign(EN, { "Bild ✓": "Image ✓" });
  return { draw, figure, modes: Object.keys(DRAW) };
})();
