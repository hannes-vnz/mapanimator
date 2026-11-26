"use strict";
/* =========================================================
   Asset-Studio: animierte Einblendungen ohne Karte, zum Drüberlegen im Schnitt
   (Look angelehnt an THE RACE: dunkle Glas-Karten, weiße Piktogramme, schmale Großschrift).
   Export je Asset: PNG-Sequenz mit Transparenz (ZIP; Premiere, DaVinci, Final Cut, After Effects)
   oder Greenscreen-MP4 (CapCut: Chroma-Key). Mehrere Länder (Komma) → ein Asset je Land.
   Typen: hexflag, rchallenge, rules, money, clock, info, medal, stamp, flag, challenge (Banner), flags (Sammlung)
   Flaggen: flagcdn.com (CORS frei); Ländernamen → ISO über Natural Earth (MARKS.countries).
   ========================================================= */
const ASSETS = (() => {
  const $ = id => document.getElementById(id);
  const TYPES = {
    hexflag:    { icon: "⬢", name: "Hexagon-Flagge + Lametta", dur: 3.6 },
    rchallenge: { icon: "🎯", name: "Challenge-Karte", dur: 4.5 },
    rules:      { icon: "🚫", name: "Regel-Karten", dur: 4.5 },
    money:      { icon: "🪙", name: "Geld-Zähler", dur: 3 },
    clock:      { icon: "⏱", name: "Uhrzeit-Chip", dur: 3 },
    info:       { icon: "ⓘ", name: "Info-Box", dur: 5 },
    medal:      { icon: "🥇", name: "Platzierung", dur: 4 },
    stamp:      { icon: "🛂", name: "Reisepass (Neues Land)", dur: 5 },
    teamcard:   { icon: "👥", name: "Team-Status", dur: 5 },
    chapter:    { icon: "⏩", name: "Kapitel-Chip", dur: 3 },
    flag:       { icon: "🏳️", name: "Flagge (weht)", dur: 3.2 },
    challenge:  { icon: "📣", name: "Challenge-Banner", dur: 4.5 },
    flags:      { icon: "🎌", name: "Flaggen-Sammlung", dur: 7 }
  };
  const STAMP_INK = ["#c0262d", "#1f4fa8", "#1e7a46", "#6b2fa0", "#b35a00", "#0f6f78"];
  let list = [], counter = 0, sel = null, start = performance.now(), loopOn = false;
  const drawOverlay = () => {};                 // Flaggen geladen → Vorschau zeichnet ohnehin jedes Bild neu
  /* ---------- Hilfen ---------- */
  const clamp = x => Math.min(Math.max(x, 0), 1);
  const easeOut = x => 1 - Math.pow(1 - x, 3);
  const easeIn = x => x * x * x;
  const backOut = x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const F = (px, w = 900) => w + " " + Math.round(px) + "px 'Archivo Black','Arial Black',Impact,sans-serif";
  const FS = (px, w = 700) => w + " " + Math.round(px) + "px 'Inter','Helvetica Neue',Arial,sans-serif";
  const MONO = px => "700 " + Math.round(px) + "px 'SF Mono','Courier New',monospace";
  function rr(g, x, y, w, h, r){ g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  const hash = s => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
  const accent = () => { const c = (routes[0] && routes[0].color) || "#e3262b", m = /^#?([0-9a-f]{6})$/i.exec(c); if (!m) return c;
    const n = parseInt(m[1], 16), L = (0.2126 * (n >> 16) + 0.7152 * (n >> 8 & 255) + 0.0722 * (n & 255)) / 255; return L < 0.3 ? "#e3262b" : c; };
  function wrapText(g, txt, maxW){
    const words = String(txt || "").split(/\s+/), lines = []; let cur = "";
    for (const w of words){ const t = cur ? cur + " " + w : w; if (g.measureText(t).width > maxW && cur){ lines.push(cur); cur = w; } else cur = t; }
    if (cur) lines.push(cur); return lines;
  }

  /* ---------- Länder (Name/ISO3 → ISO2) und Flaggenbilder ---------- */
  let ctry = null, ctryJob = null;
  function countriesReady(){
    if (ctry || ctryJob) return ctryJob;
    ctryJob = MARKS.countries().then(j => {
      const byName = new Map(), byA3 = new Map();
      for (const f of j.features){
        const p = f.properties, a2 = (p.ISO_A2_EH && p.ISO_A2_EH !== "-99" ? p.ISO_A2_EH : p.ISO_A2 || "").toLowerCase();
        if (!a2 || a2 === "-99") continue;
        const rec = { a2, name: p.NAME_DE || p.NAME || p.ADMIN };
        byA3.set(p.ADM0_A3, rec);
        for (const n of [p.NAME_DE, p.NAME, p.NAME_EN, p.ADMIN, p.NAME_LONG, p.ISO_A3, a2]) if (n) byName.set(String(n).toLowerCase(), rec);
      }
      ctry = { byName, byA3 }; drawOverlay();
    }).catch(e => { console.warn("Länder:", e); ctryJob = null; });
    return ctryJob;
  }
  function lookup(name){ countriesReady(); return ctry && name ? ctry.byName.get(String(name).trim().toLowerCase()) || null : null; }
  const flags = new Map();
  function flagImg(a2){
    if (!a2) return null;
    if (!flags.has(a2)){
      const img = new Image(); img.crossOrigin = "anonymous";
      const job = new Promise(res => { img.onload = () => { res(); drawOverlay(); }; img.onerror = () => res(); });
      img.src = "https://flagcdn.com/w640/" + a2 + ".png";
      flags.set(a2, { img, job });
    }
    const f = flags.get(a2); return f.img.complete && f.img.naturalWidth ? f.img : null;
  }
  // Flagge mit Wellenbewegung (Streifen versetzt + Licht/Schatten)
  let tmp = null;
  function wavyFlag(g, img, x, y, w, h, t, amp){
    tmp = tmp || document.createElement("canvas");
    const pad = Math.ceil(amp * 2 + 4); tmp.width = Math.ceil(w); tmp.height = Math.ceil(h + pad * 2);
    const tg = tmp.getContext("2d"), N = 48;
    for (let i = 0; i < N; i++){
      const f = i / N, ph = f * Math.PI * 2.4 - t * 5.5, off = Math.sin(ph) * amp * (0.15 + f);
      const sx = img.naturalWidth * f, sw = img.naturalWidth / N + 1, dx = w * f, dw = w / N + 1;
      tg.drawImage(img, sx, 0, sw, img.naturalHeight, dx, pad + off, dw, h);
      const sh = Math.cos(ph) * (0.15 + f * 0.25);
      tg.globalCompositeOperation = "source-atop";
      tg.fillStyle = sh > 0 ? `rgba(255,255,255,${(sh * 0.55).toFixed(3)})` : `rgba(0,0,0,${(-sh * 0.7).toFixed(3)})`;
      tg.fillRect(dx, 0, dw, tmp.height);
      tg.globalCompositeOperation = "source-over";
    }
    g.drawImage(tmp, x, y - pad);
  }
  function flagCircle(g, img, cx, cy, r, ring){
    g.save(); g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.closePath();
    g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = r * 0.4; g.shadowOffsetY = r * 0.08; g.fillStyle = "#fff"; g.fill(); g.restore();
    g.save(); g.beginPath(); g.arc(cx, cy, r * 0.88, 0, Math.PI * 2); g.clip();
    if (img){ const s = Math.max(2 * r / img.naturalWidth, 2 * r / img.naturalHeight); g.drawImage(img, cx - img.naturalWidth * s / 2, cy - img.naturalHeight * s / 2, img.naturalWidth * s, img.naturalHeight * s); }
    else { g.fillStyle = "#ccc"; g.fillRect(cx - r, cy - r, 2 * r, 2 * r); }
    const gr = g.createLinearGradient(cx, cy - r, cx, cy + r); gr.addColorStop(0, "rgba(255,255,255,.28)"); gr.addColorStop(0.5, "rgba(255,255,255,0)"); gr.addColorStop(1, "rgba(0,0,0,.18)");
    g.fillStyle = gr; g.fillRect(cx - r, cy - r, 2 * r, 2 * r); g.restore();
    if (ring){ g.strokeStyle = ring; g.lineWidth = r * 0.12; g.beginPath(); g.arc(cx, cy, r * 1.06, 0, Math.PI * 2); g.stroke(); }
  }
  const anchorY = (p, H, h) => p.pos === "top" ? H * 0.08 : p.pos === "bottom" ? H * 0.9 - h : (H - h) / 2;

  /* ---------- Zeichnen je Typ (lt = Sekunden seit Start) ---------- */
  const DRAW = {
    flag(g, W, H, p, lt, dur){
      const u = Math.min(W, H) * (p.size || 1), c = lookup(p.country), img = c && flagImg(c.a2);
      const fw = u * 0.52, fh = img ? fw * img.naturalHeight / img.naturalWidth : fw * 0.66;
      const out = clamp((dur - lt) / 0.45), rise = easeOut(clamp(lt / 0.7));
      const blockH = fh + u * 0.42, y0 = anchorY(p, H, blockH);
      const poleX = W / 2 - fw / 2, poleTop = y0, poleBot = y0 + fh + u * 0.2;
      g.save(); g.globalAlpha = out;
      g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = u * 0.02;
      g.fillStyle = "#e9e9e9"; g.fillRect(poleX - u * 0.012, poleTop - u * 0.02, u * 0.012, poleBot - poleTop + u * 0.02);
      g.fillStyle = "#f5c542"; g.beginPath(); g.arc(poleX - u * 0.006, poleTop - u * 0.025, u * 0.016, 0, Math.PI * 2); g.fill();
      g.shadowBlur = 0;
      // Flagge gleitet an der Stange hoch
      const fy = poleTop + (1 - rise) * (poleBot - poleTop - fh * 0.3);
      g.save(); g.beginPath(); g.rect(poleX, poleTop - u * 0.1, W, poleBot - poleTop + u * 0.1); g.clip();
      if (img) wavyFlag(g, img, poleX, fy, fw, fh, lt, fh * 0.07);
      else { g.fillStyle = "#bbb"; g.fillRect(poleX, fy, fw, fh); }
      g.restore();
      // Text
      const tk = clamp((lt - 0.45) / 0.35);
      if (tk > 0){
        g.textAlign = "center"; g.textBaseline = "alphabetic"; g.shadowColor = "rgba(0,0,0,.55)"; g.shadowBlur = u * 0.025;
        g.globalAlpha = out * tk; g.fillStyle = "#fff"; g.font = FS(u * 0.04, 800);
        g.fillText((p.text || "WILLKOMMEN IN").toUpperCase().split("").join(" "), W / 2, poleBot + u * 0.07);
        g.save(); g.translate(W / 2, poleBot + u * 0.18); const s = backOut(tk); g.scale(s, s);
        g.font = F(u * 0.11); g.fillText((p.title || (c ? c.name : p.country) || "").toUpperCase(), 0, 0, W * 0.9); g.restore();
        if (p.sub){ g.font = FS(u * 0.034, 700); g.fillStyle = accent(); g.fillText(p.sub.toUpperCase(), W / 2, poleBot + u * 0.25); }
      }
      g.restore();
    },

    /* Reisepass wie THE RACE („Neues Land erreicht“): Titel wischt rein, Konfetti in Teamfarbe,
       Länder-Abzeichen ploppt auf, aufgeklappter Pass mit Teamname + alten Stempeln kommt dazu,
       Abzeichen fliegt auf die rechte Seite und wird zum Tintenstempel. */
    stamp(g, W, H, p, lt, dur){
      const u = Math.min(W, H) * (p.size || 1), team = p.color || "#b06ae8";
      const out = 1 - easeIn(clamp((lt - (dur - 0.45)) / 0.45));
      const pw = Math.min(W * 0.66, u * 1.05), ph = pw * 0.6, px = (W - pw) / 2, py = H * 0.56 - ph / 2;
      const shake = lt > 2.0 && lt < 2.25 ? Math.sin(lt * 120) * u * 0.006 * (2.25 - lt) / 0.25 : 0;
      // Konfetti
      if (p.confetti !== false) flakes(g, W, H, u, lt, team, out, hash(p.country || "x"));
      // Titel (leicht gebogen, wischt von links rein)
      const hk = clamp(lt / 0.5), hOut = 1 - clamp((lt - 2.0) / 0.4);
      if (hk > 0 && hOut > 0){
        const txt = (p.headline || "NEUES LAND ERREICHT").toUpperCase();
        g.save(); g.globalAlpha = out * hOut; g.font = CF(u * 0.06, 900); g.textAlign = "center"; g.textBaseline = "middle";
        const tw = g.measureText(txt).width + txt.length * u * 0.006, cx = W / 2, cy = py - u * 0.07, bend = u * 0.04;
        g.beginPath(); g.rect(cx - tw / 2 - u * 0.05, cy - u * 0.2, (tw + u * 0.1) * easeOut(hk), u * 0.4); g.clip();
        let x = cx - tw / 2;
        for (const ch of txt){
          const w = g.measureText(ch).width, f = (x + w / 2 - cx) / (tw / 2), y = cy + bend * f * f - bend * 0.5;
          g.save(); g.translate(x + w / 2, y); g.rotate(f * 0.08);
          g.fillStyle = team; g.fillText(ch, u * 0.004, u * 0.005); g.fillStyle = "#ffffff"; g.fillText(ch, 0, 0); g.restore();
          x += w + u * 0.006;
        }
        g.restore();
      }
      // Pass
      const pk = easeOut(clamp((lt - 1.05) / 0.4));
      if (pk > 0){
        g.save(); g.globalAlpha = pk * out; g.translate(W / 2 + shake, py + ph / 2); g.scale(0.92 + 0.08 * pk, 0.92 + 0.08 * pk); g.translate(-W / 2, -(py + ph / 2));
        passport(g, px, py, pw, ph, u, p, team);
        g.restore();
      }
      // Abzeichen: Mitte → rechte Seite, dann Tinte
      const bk = clamp((lt - 0.25) / 0.4); if (bk <= 0) return;
      const mk = easeInOut(clamp((lt - 1.5) / 0.5)), inked = clamp((lt - 2.0) / 0.2);
      const R0 = u * 0.17, R1 = ph * 0.2, R = (R0 + (R1 - R0) * mk) * (mk > 0 ? 1 : backOut(bk));
      const x0 = W / 2, y0 = py + ph * 0.45, x1 = px + pw * 0.76 + shake, y1 = py + ph * 0.52;
      const cx = x0 + (x1 - x0) * mk, cy = y0 + (y1 - y0) * mk;
      const c = lookup(firstCountry(p)), name = (p.title || (c ? c.name : firstCountry(p)) || "").toUpperCase();
      g.save(); g.globalAlpha = out * Math.min(1, bk * 2.5);
      if (inked < 1) badge(g, cx, cy, R, name, p, 1 - inked, false);
      if (inked > 0) badge(g, cx, cy, R, name, p, inked, true);
      g.restore();
    },

    teamcard(g, W, H, p, lt, dur){
      const u = Math.min(W, H) * (p.size || 1), col = p.color || "#9b59d0";
      const cw = u * 0.62, ch = u * 0.42, [x, y] = place(p, W, H, cw, ch, "bl");
      const k = easeOut(clamp(lt / 0.4)), outK = easeIn(clamp((lt - (dur - 0.35)) / 0.35));
      g.save(); g.globalAlpha = k * (1 - outK); g.translate((1 - k) * -u * 0.2 - outK * u * 0.2, 0);
      rcard(g, x, y, cw, ch, u * 0.03, u);
      const r = ch * 0.2, ax = x + u * 0.03 + r, ay = y + u * 0.03 + r;          // Teamfoto
      g.save(); g.beginPath(); g.arc(ax, ay, r, 0, Math.PI * 2); g.fillStyle = col; g.fill();
      g.beginPath(); g.arc(ax, ay, r * 0.88, 0, Math.PI * 2); g.clip();
      const img = userImg(p.img);
      if (img){ const s = Math.max(2 * r / img.naturalWidth, 2 * r / img.naturalHeight); g.drawImage(img, ax - img.naturalWidth * s / 2, ay - img.naturalHeight * s / 2, img.naturalWidth * s, img.naturalHeight * s); }
      else { g.fillStyle = "#2b2c31"; g.fillRect(ax - r, ay - r, 2 * r, 2 * r); picto(g, "👥", ax, ay, r * 1.1, "#ffffff"); }
      g.restore();
      const lx = ax + r + u * 0.03, lw = x + cw - u * 0.03 - lx;
      g.fillStyle = "#fff"; g.font = CF(u * 0.03, 800); g.textAlign = "left"; g.textBaseline = "middle";
      coins(g, lx + u * 0.012, ay - r * 0.45, u * 0.01, "#fff"); g.fillText((p.label || "AKTUELLES BUDGET").toUpperCase(), lx + u * 0.035, ay - r * 0.45);
      const vk = backOut(clamp((lt - 0.35) / 0.35));
      if (vk > 0){
        g.save(); g.translate(lx + lw / 2, ay + r * 0.35); g.scale(vk, vk);
        g.fillStyle = col; rr(g, -lw / 2, -u * 0.032, lw, u * 0.064, u * 0.032); g.fill();
        g.fillStyle = "#fff"; g.font = CF(u * 0.045, 900); g.textAlign = "center"; g.fillText(p.value || "21,57 €", 0, u * 0.002); g.restore();
      }
      const by = ay + r + u * 0.02, bw = (cw - u * 0.08) / 2, bh = u * 0.1;        // zwei Werte-Kästen
      [[p.l1 || "ZURÜCKGELEGT", p.v1 || "1.186 KM"], [p.l2 || "BIS ZUM ZIEL", p.v2 || "2.936 KM"]].forEach(([l, v], i) => {
        const bx = x + u * 0.03 + i * (bw + u * 0.02), kk = easeOut(clamp((lt - 0.5 - i * 0.1) / 0.3)); if (kk <= 0) return;
        g.save(); g.globalAlpha *= kk; g.fillStyle = hexA(col, 0.35); rr(g, bx, by, bw, bh, u * 0.018); g.fill();
        g.fillStyle = "#fff"; g.font = CF(u * 0.022, 800); g.textAlign = "center"; g.fillText(l.toUpperCase(), bx + bw / 2, by + bh * 0.28);
        g.fillStyle = hexA("#000000", 0.35); rr(g, bx + bw * 0.12, by + bh * 0.48, bw * 0.76, bh * 0.4, bh * 0.2); g.fill();
        g.fillStyle = "#fff"; g.font = CF(u * 0.03, 900); g.fillText(v, bx + bw / 2, by + bh * 0.69); g.restore();
      });
      const list = String(p.countries || "").split(",").map(s => s.trim()).filter(Boolean), slots = Math.max(list.length, +p.slots || 7);
      const fr = Math.min(u * 0.022, (cw - u * 0.08) / slots / 2.4), fy = y + ch - u * 0.045, fx0 = x + u * 0.04 + fr;
      for (let i = 0; i < slots; i++){
        const fx = fx0 + i * fr * 2.5, kk = backOut(clamp((lt - 0.7 - i * 0.08) / 0.3)); if (kk <= 0) continue;
        g.save(); g.translate(fx, fy); g.scale(kk, kk);
        if (i < list.length){ const cc = lookup(list[i]); flagCircle(g, cc && flagImg(cc.a2), 0, 0, fr, null); }
        else { g.fillStyle = hexA(col, 0.45); g.beginPath(); g.arc(0, 0, fr * 0.85, 0, Math.PI * 2); g.fill(); }
        g.restore();
      }
      g.restore();
    },

    chapter(g, W, H, p, lt, dur){
      const u = Math.min(W, H) * (p.size || 1), txt = p.text || "Was bisher geschah";
      g.font = CF(u * 0.042, 800); const ph = u * 0.07, pw = g.measureText(txt).width + ph * 1.5, [x, y] = place(p, W, H, pw, ph, "tl");
      const k = easeOut(clamp(lt / 0.35)), outK = easeIn(clamp((lt - (dur - 0.3)) / 0.3));
      g.save(); g.globalAlpha = k * (1 - outK); g.translate((1 - k) * -u * 0.12, 0);
      g.fillStyle = "rgba(14,15,18,.72)"; rr(g, x, y, pw, ph, ph / 2); g.fill();
      const r = ph * 0.32, cx = x + ph * 0.5, cy = y + ph / 2; g.fillStyle = p.color || "#f5c542"; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#15171c"; for (const dx of [-r * 0.42, r * 0.12]){ g.beginPath(); g.moveTo(cx + dx, cy - r * 0.4); g.lineTo(cx + dx + r * 0.5, cy); g.lineTo(cx + dx, cy + r * 0.4); g.closePath(); g.fill(); }
      g.fillStyle = "#fff"; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText(txt, x + ph * 0.95, cy + u * 0.003);
      g.restore();
    },

    challenge(g, W, H, p, lt, dur){
      const u = Math.min(W, H) * (p.size || 1), col = p.color || accent();
      const outK = easeIn(clamp((lt - (dur - 0.4)) / 0.4)), dx = -outK * W * 1.2;
      const yC = p.pos === "top" ? H * 0.2 : p.pos === "bottom" ? H * 0.7 : H * 0.42;
      g.save(); g.translate(dx, 0);
      // diagonaler Streifen fegt durchs Bild
      const sk = easeOut(clamp(lt / 0.35)), sh = u * 0.2;
      g.save(); g.translate(W / 2, yC); g.rotate(-6 * Math.PI / 180);
      g.fillStyle = col; g.fillRect(-W * 0.8, -sh / 2, W * 1.6 * sk, sh);
      g.fillStyle = "#111"; g.fillRect(-W * 0.8, sh / 2, W * 1.6 * sk, u * 0.018);
      // Titel
      const tk = clamp((lt - 0.2) / 0.25);
      if (tk > 0){
        const s = 1 + 0.8 * (1 - easeOut(tk)); g.save(); g.scale(s, s); g.globalAlpha = tk;
        g.fillStyle = "#fff"; g.font = F(u * 0.13); g.textAlign = "center"; g.textBaseline = "middle";
        g.shadowColor = "rgba(0,0,0,.35)"; g.shadowOffsetX = u * 0.008; g.shadowOffsetY = u * 0.008;
        g.fillText((p.title || "CHALLENGE").toUpperCase(), 0, u * 0.005, W * 0.9); g.restore();
      }
      g.restore();
      // Aufgaben-Karte
      const ck = easeOut(clamp((lt - 0.45) / 0.35));
      if (ck > 0 && p.text){
        g.font = FS(u * 0.05, 800); const lines = wrapText(g, p.text, Math.min(W * 0.78, u * 0.9)).slice(0, 4);
        const lh = u * 0.064, cw = Math.min(W * 0.86, u * 1), chh = lines.length * lh + u * 0.07, cx = (W - cw) / 2, cy = yC + sh * 0.85 + (1 - ck) * u * 0.15;
        g.save(); g.globalAlpha = ck; g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = u * 0.03; g.fillStyle = "#fff"; rr(g, cx, cy, cw, chh, u * 0.022); g.fill(); g.restore();
        g.save(); g.globalAlpha = ck; g.fillStyle = "#15171c"; g.textAlign = "center"; g.textBaseline = "middle";
        lines.forEach((ln, i) => g.fillText(ln, W / 2, cy + u * 0.035 + lh * (i + 0.5)));
        g.restore();
        // Ziel-Chips
        const chips = [p.goal, p.time].filter(Boolean);
        let x = W / 2 - chips.reduce((a, t) => { g.font = FS(u * 0.038, 800); return a + g.measureText(t).width + u * 0.07; }, 0) / 2;
        chips.forEach((t, i) => {
          const k = backOut(clamp((lt - 0.8 - i * 0.12) / 0.3)); if (k <= 0) return;
          g.font = FS(u * 0.038, 800); const w = g.measureText(t).width + u * 0.05, hh = u * 0.065, yy = cy + chh + u * 0.03;
          g.save(); g.translate(x + w / 2, yy + hh / 2); g.scale(k, k);
          g.fillStyle = "#111"; rr(g, -w / 2, -hh / 2, w, hh, hh / 2); g.fill();
          g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(t, 0, 2); g.restore();
          x += w + u * 0.02;
        });
      }
      // geschafft / gescheitert
      if (p.status === "done" || p.status === "fail"){
        const k = clamp((lt - 1.25) / 0.25);
        if (k > 0){
          const ok = p.status === "done", s = 1 + 1.5 * (1 - easeIn(k));
          g.save(); g.translate(W / 2 + u * 0.22, yC - u * 0.16); g.rotate(-14 * Math.PI / 180); g.scale(s, s); g.globalAlpha = k;
          g.strokeStyle = ok ? "#1fa34a" : "#d8282c"; g.fillStyle = g.strokeStyle; g.lineWidth = u * 0.012;
          const txt = ok ? "✓ GESCHAFFT" : "✗ GESCHEITERT"; g.font = F(u * 0.06); const w = g.measureText(txt).width + u * 0.06;
          rr(g, -w / 2, -u * 0.055, w, u * 0.11, u * 0.02); g.stroke(); g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(txt, 0, u * 0.004);
          g.restore();
        }
      }
      g.restore();
    },

    flags(g, W, H, p, lt, dur){
      const u = Math.min(W, H) * (p.size || 1);
      const items = itemsFor(p); if (!items.length) return;
      const r = u * 0.058, gap = r * 0.45, perRow = Math.max(3, Math.floor((W * 0.84) / (2 * r + gap)));
      const x0 = W * 0.08 + r, y0 = (p.pos === "bottom" ? H * 0.72 : H * 0.09) + u * 0.13;
      const shown = items.filter(it => it.t <= lt), n = shown.length + (p.start || 0);
      const outA = clamp((dur - lt) / 0.4);
      g.save(); g.globalAlpha = outA;
      // Zähler
      const last = shown[shown.length - 1], since = last ? lt - last.t : 9;
      const pop = since < 0.4 ? 1 + 0.25 * Math.sin(since / 0.4 * Math.PI) : 1;
      g.save(); g.translate(W * 0.08, y0 - r - u * 0.04); g.scale(pop, pop);
      g.shadowColor = "rgba(0,0,0,.45)"; g.shadowBlur = u * 0.02; g.fillStyle = "#fff"; g.textBaseline = "alphabetic";
      g.font = F(u * 0.1); const ns = String(n); g.fillText(ns, 0, 0); const nm = g.measureText(ns), nw = Math.max(nm.width, nm.actualBoundingBoxRight || 0);
      g.font = F(u * 0.038); g.fillText((p.word || "LÄNDER").toUpperCase(), nw + u * 0.03, 0);
      g.restore();
      shown.forEach((it, i) => {
        const k = backOut(clamp((lt - it.t) / 0.45)), row = Math.floor(i / perRow), col = i % perRow;
        const cx = x0 + col * (2 * r + gap), cy = y0 + row * (2 * r + gap) - (1 - clamp((lt - it.t) / 0.3)) * u * 0.08;
        g.save(); g.translate(cx, cy); g.scale(k, k); g.rotate((1 - clamp((lt - it.t) / 0.45)) * -0.8);
        flagCircle(g, flagImg(it.a2), 0, 0, r, i === shown.length - 1 && since < 1.2 ? accent() : null); g.restore();
      });
      if (last && since < 2){
        const a = clamp(since / 0.2) * clamp((2 - since) / 0.35), i = shown.length - 1, row = Math.floor(i / perRow), col = i % perRow;
        const cx = x0 + col * (2 * r + gap), cy = y0 + row * (2 * r + gap) + r * 1.35;
        g.save(); g.globalAlpha = outA * a; g.font = FS(u * 0.032, 800); const txt = (last.name || "").toUpperCase(), w = g.measureText(txt).width + u * 0.04, h = u * 0.05;
        const bx = Math.min(Math.max(cx - w / 2, W * 0.02), W * 0.98 - w);
        g.fillStyle = "#fff"; rr(g, bx, cy, w, h, h / 2); g.fill(); g.fillStyle = "#15171c"; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText(txt, bx + u * 0.02, cy + h / 2 + 1);
        g.restore();
      }
      g.restore();
    },

    /* ===== THE-RACE-Look ===== */
    hexflag(g, W, H, p, lt, dur){
      const u = Math.min(W, H) * (p.size || 1), c = lookup(firstCountry(p)), img = c && flagImg(c.a2), R = u * 0.17;
      const cx = W / 2, cy = p.pos === "top" ? H * 0.28 : p.pos === "bottom" ? H * 0.66 : H * 0.42;
      const inK = clamp(lt / 0.5), outK = clamp((lt - (dur - 0.4)) / 0.4), s = backOut(inK) * (1 - easeIn(outK));
      const seed = hash(firstCountry(p) || "x"), tinsel = p.lametta !== false;
      if (tinsel) lametta(g, cx, cy, u, lt, 0.22, seed, 0, outK);
      if (s > 0.001){
        g.save(); g.translate(cx, cy); g.rotate((1 - easeOut(inK)) * -0.7); g.scale(s, s);
        g.save(); g.shadowColor = "rgba(0,0,0,.5)"; g.shadowBlur = R * 0.35; g.shadowOffsetY = R * 0.06;
        const gold = g.createLinearGradient(-R, -R, R, R); gold.addColorStop(0, "#fff3b0"); gold.addColorStop(0.35, "#e9b949"); gold.addColorStop(0.55, "#fff1a8"); gold.addColorStop(1, "#b67d1c");
        g.fillStyle = gold; hexPath(g, 0, 0, R * 1.16); g.fill(); g.restore();
        g.fillStyle = "#ffffff"; hexPath(g, 0, 0, R * 1.05); g.fill();
        g.save(); hexPath(g, 0, 0, R * 0.97); g.clip();
        if (img){ const fh = R * 2.1, fw = fh * img.naturalWidth / img.naturalHeight; wavyFlag(g, img, -fw / 2, -fh / 2, fw, fh, lt, R * 0.05); }
        else { g.fillStyle = "#666"; g.fillRect(-R, -R, 2 * R, 2 * R); }
        const sh = g.createLinearGradient(0, -R, 0, R); sh.addColorStop(0, "rgba(255,255,255,.22)"); sh.addColorStop(0.5, "rgba(255,255,255,0)"); sh.addColorStop(1, "rgba(0,0,0,.25)"); g.fillStyle = sh; g.fillRect(-R, -R, 2 * R, 2 * R);
        const sw = clamp((lt - 0.55) / 0.5);                                // Glanz fährt drüber
        if (sw > 0 && sw < 1){ g.rotate(0.5); const x = -R * 1.6 + sw * R * 3.2; const gr = g.createLinearGradient(x - R * 0.3, 0, x + R * 0.3, 0); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, "rgba(255,255,255,.55)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(-R * 2, -R * 2, R * 4, R * 4); }
        g.restore(); g.restore();
      }
      if (tinsel) lametta(g, cx, cy, u, lt, 0.22, seed, 1, outK);
      const nk = easeOut(clamp((lt - 0.4) / 0.35)) * (1 - outK);           // Namensschild
      if (nk > 0){
        const name = (p.title || (c ? c.name : firstCountry(p)) || "").toUpperCase();
        g.save(); g.globalAlpha = nk; g.font = CF(u * 0.075, 800); const tw = g.measureText(name).width, pw = tw + u * 0.09, ph = u * 0.1, py = cy + R * 1.32 + (1 - nk) * u * 0.05;
        rcard(g, cx - pw / 2, py, pw, ph, ph * 0.3, u);
        g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(name, cx, py + ph / 2 + u * 0.003);
        if (p.sub){ g.font = CF(u * 0.036, 800); g.fillStyle = p.color || "#f5c542"; g.shadowColor = "rgba(0,0,0,.6)"; g.shadowBlur = u * 0.015; g.fillText(p.sub.toUpperCase().split("").join(" "), cx, py + ph + u * 0.04); }
        g.restore();
      }
    },

    rchallenge(g, W, H, p, lt, dur){
      const u = Math.min(W, H) * (p.size || 1), col = p.color || "#ff3b45";
      const cw = Math.min(W * 0.9, u * 0.95), ch = u * 0.42, [x, y] = place(p, W, H, cw, ch, "center");
      const fk = easeOut(clamp(lt / 0.4)), outK = easeIn(clamp((lt - (dur - 0.4)) / 0.4));
      g.save(); g.globalAlpha = 1 - outK; g.translate(x + cw / 2, y + ch / 2 + outK * u * 0.15); g.scale(Math.max(0.001, fk), 0.85 + 0.15 * fk); g.translate(-cw / 2, -ch / 2);
      rcard(g, 0, 0, cw, ch, u * 0.03, u);
      const ck = clamp((lt - 0.3) / 0.3);
      g.globalAlpha = (1 - outK) * ck;
      g.font = CF(u * 0.04, 800); const lab = (p.label || "CHALLENGE").toUpperCase(), lw = g.measureText(lab).width + u * 0.05;
      g.fillStyle = col; rr(g, u * 0.035, u * 0.035, lw, u * 0.06, u * 0.03); g.fill();
      g.fillStyle = "#fff"; g.textBaseline = "middle"; g.textAlign = "left"; g.fillText(lab, u * 0.06, u * 0.067);
      picto(g, p.icon || "🏆", u * 0.13, ch * 0.52, u * 0.13, "#ffffff");
      g.font = CF(u * 0.065, 800); g.fillStyle = "#fff";
      const lines = wrapText(g, (p.text || "").toUpperCase(), cw - u * 0.3).slice(0, 3);
      lines.forEach((ln, i) => g.fillText(ln, u * 0.25, ch * 0.42 + i * u * 0.068 - (lines.length - 1) * u * 0.02));
      let cx = u * 0.25;
      [p.goal, p.time].filter(Boolean).forEach((t, i) => {
        const k = backOut(clamp((lt - 0.7 - i * 0.12) / 0.3)); if (k <= 0) return;
        g.font = CF(u * 0.04, 800); const w = g.measureText(t).width + u * 0.05, h = u * 0.06, yy = ch - u * 0.095;
        g.save(); g.translate(cx + w / 2, yy + h / 2); g.scale(k, k);
        g.fillStyle = "rgba(255,255,255,.1)"; rr(g, -w / 2, -h / 2, w, h, h / 2); g.fill(); g.strokeStyle = "rgba(255,255,255,.18)"; g.lineWidth = 1.5; g.stroke();
        g.fillStyle = "#fff"; g.textAlign = "center"; g.fillText(t, 0, u * 0.002); g.restore();
        cx += w + u * 0.02;
      });
      g.restore();
      if (p.status === "done" || p.status === "fail"){
        const k = clamp((lt - 1.2) / 0.22);
        if (k > 0 && outK < 1){
          const ok = p.status === "done", s = 1 + 1.4 * (1 - easeIn(k));
          g.save(); g.globalAlpha = k * (1 - outK); g.translate(x + cw * 0.86, y - u * 0.01); g.rotate(-10 * Math.PI / 180); g.scale(s, s);
          g.strokeStyle = ok ? "#3ddc6f" : "#ff3b45"; g.fillStyle = g.strokeStyle; g.lineWidth = u * 0.01; g.shadowColor = g.strokeStyle; g.shadowBlur = u * 0.02;
          const txt = ok ? "GESCHAFFT" : "GESCHEITERT"; g.font = CF(u * 0.06, 900); const w = g.measureText(txt).width + u * 0.06;
          rr(g, -w / 2, -u * 0.05, w, u * 0.1, u * 0.02); g.stroke(); g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(txt, 0, u * 0.004); g.restore();
        }
      }
    },

    rules(g, W, H, p, lt, dur){
      const u = Math.min(W, H) * (p.size || 1);
      const items = String(p.items || "").split("\n").map(l => l.split("|").map(x => x.trim())).filter(a => a[0] || a[1]);
      if (!items.length) return;
      const cw = u * 0.25, ch = u * 0.28, gap = u * 0.025, n = items.length, perRow = Math.min(n, W > H ? 5 : 3);
      const rows = Math.ceil(n / perRow), totW = perRow * cw + (perRow - 1) * gap, totH = rows * (ch + u * 0.09);
      const [x0, y0] = place(p, W, H, totW, totH, "center"), outK = easeIn(clamp((lt - (dur - 0.35)) / 0.35));
      items.forEach(([icon, text, flag], i) => {
        const t0 = 0.1 + i * 0.14, k = clamp((lt - t0) / 0.4); if (k <= 0) return;
        const row = Math.floor(i / perRow), inRow = Math.min(perRow, n - row * perRow), col = i % perRow;
        const rx = x0 + (totW - (inRow * cw + (inRow - 1) * gap)) / 2 + col * (cw + gap), ry = y0 + row * (ch + u * 0.09);
        const e = backOut(k), forbid = /^(x|nein|verboten|-)$/i.test(flag || ""), allow = /^(ok|ja|erlaubt|\+)$/i.test(flag || "");
        g.save(); g.globalAlpha = Math.min(1, k * 2) * (1 - outK);
        g.translate(rx + cw / 2, ry + ch / 2 + (1 - e) * u * 0.25 + outK * u * 0.2); g.rotate((1 - e) * (i % 2 ? 0.25 : -0.25)); g.scale(0.85 + 0.15 * e, 0.85 + 0.15 * e);
        rcard(g, -cw / 2, -ch / 2, cw, ch, u * 0.025, u);
        picto(g, icon || "•", 0, -ch * 0.1, u * 0.12, "#ffffff");
        g.font = CF(u * 0.03, 800); g.fillStyle = "rgba(255,255,255,.92)"; g.textAlign = "center"; g.textBaseline = "middle";
        wrapText(g, (text || "").toUpperCase(), cw * 0.86).slice(0, 3).forEach((ln, j, a) => g.fillText(ln, 0, ch * 0.3 + (j - (a.length - 1) / 2) * u * 0.034));
        if (forbid){                                                       // roter Leuchtstrich
          const sk = easeOut(clamp((lt - t0 - 0.35) / 0.25)), a = [-cw * 0.28, ch * 0.1], b = [cw * 0.28, -ch * 0.32];
          g.save(); g.strokeStyle = "#ff3b45"; g.lineWidth = u * 0.014; g.lineCap = "round"; g.shadowColor = "#ff3b45"; g.shadowBlur = u * 0.03;
          g.beginPath(); g.moveTo(b[0], b[1]); g.lineTo(b[0] + (a[0] - b[0]) * sk, b[1] + (a[1] - b[1]) * sk); g.stroke(); g.restore();
        }
        g.restore();
        if ((forbid || allow) && p.pills !== false){
          const pk = clamp((lt - t0 - 0.45) / 0.25); if (pk > 0){
            g.save(); g.globalAlpha = pk * (1 - outK); const txt = forbid ? "VERBOTEN" : "ERLAUBT", pw = cw * 0.8, ph = u * 0.045, px = rx + (cw - pw) / 2, py = ry + ch + u * 0.02;
            g.fillStyle = forbid ? "rgba(255,59,69,.25)" : "rgba(61,220,111,.22)"; rr(g, px, py, pw, ph, ph / 2); g.fill();
            g.strokeStyle = forbid ? "#ff3b45" : "#3ddc6f"; g.lineWidth = 1.5; g.stroke();
            g.fillStyle = forbid ? "#ff6b72" : "#5be37d"; g.font = CF(u * 0.028, 800); g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(txt, px + pw / 2, py + ph / 2 + 1);
            g.restore();
          }
        }
      });
    },

    money(g, W, H, p, lt, dur){
      const u = Math.min(W, H) * (p.size || 1), from = num0(p.from), to = num0(p.to), cur = p.cur || "€";
      const fmt = v => v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + cur;
      const v = from + (to - from) * easeInOut(clamp((lt - 0.55) / 0.9));
      g.font = CF(u * 0.07, 800); const tw = g.measureText(fmt(Math.max(from, to))).width;
      const ph = u * 0.1, pw = tw + ph * 1.5, [x, y] = place(p, W, H, pw, ph, "top");
      const k = backOut(clamp(lt / 0.35)), outK = easeIn(clamp((lt - (dur - 0.3)) / 0.3)), up = to >= from;
      const flash = clamp(1 - Math.abs(lt - 1.45) / 0.4) * (to !== from ? 1 : 0);
      g.save(); g.translate(x + pw / 2, y + ph / 2); g.scale(k * (1 - outK) + 0.001, k * (1 - outK) + 0.001); g.translate(-pw / 2, -ph / 2);
      rcard(g, 0, 0, pw, ph, ph / 2, u);
      if (flash > 0){ g.save(); g.globalAlpha = flash; g.strokeStyle = up ? "#3ddc6f" : "#ff3b45"; g.lineWidth = u * 0.005; g.shadowColor = g.strokeStyle; g.shadowBlur = u * 0.03; rr(g, 0, 0, pw, ph, ph / 2); g.stroke(); g.restore(); }
      coins(g, ph * 0.55, ph / 2, ph * 0.22, flash > 0 ? (up ? "#5be37d" : "#ff6b72") : "#d8d8dc");
      g.font = CF(u * 0.07, 800); g.fillStyle = flash > 0.3 ? (up ? "#7dffa0" : "#ff8a90") : "#fff"; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText(fmt(v), ph * 1.0, ph / 2 + u * 0.004);
      g.restore();
      const dk = clamp((lt - 0.45) / 1.4);
      if (to !== from && dk > 0 && dk < 1){
        const d = to - from, txt = (d > 0 ? "+" : "−") + fmt(Math.abs(d));
        g.save(); g.globalAlpha = Math.sin(dk * Math.PI) * (1 - outK); g.font = CF(u * 0.04, 800); g.fillStyle = up ? "#5be37d" : "#ff6b72";
        g.textAlign = "left"; g.textBaseline = "middle"; g.shadowColor = "rgba(0,0,0,.6)"; g.shadowBlur = u * 0.015;
        g.fillText(txt, x + pw + u * 0.025, y + ph / 2 - dk * u * 0.05); g.restore();
      }
    },

    clock(g, W, H, p, lt, dur){
      const u = Math.min(W, H) * (p.size || 1), txt = p.text || "14:00";
      g.font = CF(u * 0.05, 800); const ph = u * 0.075, pw = g.measureText(txt).width + ph * 1.4, [x, y] = place(p, W, H, pw, ph, "tl");
      const k = easeOut(clamp(lt / 0.3)), outK = easeIn(clamp((lt - (dur - 0.3)) / 0.3));
      g.save(); g.globalAlpha = k * (1 - outK); g.translate((1 - k) * -u * 0.1, 0);
      g.fillStyle = "rgba(14,15,18,.72)"; rr(g, x, y, pw, ph, ph / 2); g.fill();
      const r = ph * 0.3, cx = x + ph * 0.5, cy = y + ph / 2, col = p.color || "#3ddc6f";
      g.fillStyle = col; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
      const [hh, mm] = txt.split(":").map(Number), ang = (lt * 1.5) % (Math.PI * 2);
      g.strokeStyle = "#0e0f12"; g.lineWidth = r * 0.22; g.lineCap = "round"; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(((hh || 0) % 12) / 12 * Math.PI * 2) * r * 0.5, cy - Math.cos(((hh || 0) % 12) / 12 * Math.PI * 2) * r * 0.5); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(((mm || 0) / 60) * Math.PI * 2 + ang) * r * 0.75, cy - Math.cos(((mm || 0) / 60) * Math.PI * 2 + ang) * r * 0.75); g.stroke();
      g.font = CF(u * 0.05, 800); g.fillStyle = "#fff"; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText(txt, x + ph * 0.95, cy + u * 0.003);
      g.restore();
    },

    info(g, W, H, p, lt, dur){
      const u = Math.min(W, H) * (p.size || 1), maxW = Math.min(W * 0.62, u * 0.85);
      g.font = FS(u * 0.032, 600); const lines = wrapText(g, p.text || "", maxW - u * 0.11).slice(0, 4);
      const lh = u * 0.042, bw = Math.min(maxW, Math.max(...lines.map(l => g.measureText(l).width)) + u * 0.11), bh = lines.length * lh + u * 0.04;
      const [x, y] = place(p, W, H, bw, bh, "bl"), k = easeOut(clamp(lt / 0.35)), outK = easeIn(clamp((lt - (dur - 0.35)) / 0.35));
      g.save(); g.globalAlpha = k * (1 - outK); g.translate((1 - k) * -u * 0.15 - outK * u * 0.15, 0);
      g.fillStyle = "rgba(14,15,18,.72)"; rr(g, x, y, bw, bh, u * 0.018); g.fill();
      const r = u * 0.018, cx = x + u * 0.04, cy = y + u * 0.02 + lh / 2;
      g.fillStyle = "#fff"; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#0e0f12"; g.font = "800 " + Math.round(r * 1.5) + "px Georgia, serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("i", cx, cy + 1);
      g.fillStyle = "#fff"; g.font = FS(u * 0.032, 600); g.textAlign = "left";
      lines.forEach((ln, i) => g.fillText(ln, x + u * 0.075, y + u * 0.02 + lh * (i + 0.5)));
      g.restore();
    },

    medal(g, W, H, p, lt, dur){
      const u = Math.min(W, H) * (p.size || 1), podium = !!p.podium;
      const amounts = String(p.amount || "").split(",").map(s => s.trim());
      const cards = podium ? [[2, amounts[1] || ""], [1, amounts[0] || ""], [3, amounts[2] || ""]] : [[+p.place || 1, amounts[0] || ""]];
      const cw = u * 0.24, ch = u * 0.3, gap = u * 0.03, totW = cards.length * cw + (cards.length - 1) * gap;
      const [x0, y0] = place(p, W, H, totW, ch + u * 0.1, "center"), outK = easeIn(clamp((lt - (dur - 0.35)) / 0.35));
      cards.forEach(([pl, amt], i) => {
        const t0 = podium ? [0.3, 0.05, 0.55][i] : 0.05, k = clamp((lt - t0) / 0.45); if (k <= 0) return;
        const lift = podium ? (pl === 1 ? -u * 0.06 : pl === 2 ? 0 : u * 0.03) : 0, e = backOut(k);
        const cx = x0 + i * (cw + gap) + cw / 2, cy = y0 + ch / 2 + u * 0.05 + lift;
        g.save(); g.globalAlpha = Math.min(1, k * 2) * (1 - outK); g.translate(cx, cy + (1 - e) * u * 0.2); g.scale(0.8 + 0.2 * e, 0.8 + 0.2 * e);
        rcard(g, -cw / 2, -ch / 2, cw, ch, u * 0.025, u);
        const M = { 1: ["#fff3b0", "#e9b949", "#a8730f"], 2: ["#ffffff", "#c9ccd3", "#8a8e97"], 3: ["#ffd2a8", "#cd7f32", "#7a4a1b"] }[pl] || ["#fff", "#ccc", "#888"];
        const r = cw * 0.2, my = -ch * 0.1;
        g.fillStyle = "#3b6fd8"; g.beginPath(); g.moveTo(-r * 0.9, my - r * 2.1); g.lineTo(-r * 0.15, my - r * 2.1); g.lineTo(r * 0.35, my - r * 0.6); g.lineTo(-r * 0.35, my - r * 0.6); g.closePath(); g.fill();
        g.fillStyle = "#e23b3b"; g.beginPath(); g.moveTo(r * 0.9, my - r * 2.1); g.lineTo(r * 0.15, my - r * 2.1); g.lineTo(-r * 0.35, my - r * 0.6); g.lineTo(r * 0.35, my - r * 0.6); g.closePath(); g.fill();
        const gr = g.createLinearGradient(-r, my - r, r, my + r); gr.addColorStop(0, M[0]); gr.addColorStop(0.5, M[1]); gr.addColorStop(1, M[2]);
        g.fillStyle = gr; g.beginPath(); g.arc(0, my, r, 0, Math.PI * 2); g.fill(); g.strokeStyle = M[2]; g.lineWidth = r * 0.12; g.beginPath(); g.arc(0, my, r * 0.78, 0, Math.PI * 2); g.stroke();
        g.fillStyle = M[2]; g.font = CF(r * 1.1, 900); g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(pl), 0, my + r * 0.05);
        const sw = clamp((lt - t0 - 0.4) / 0.45); if (sw > 0 && sw < 1){ g.save(); g.beginPath(); g.arc(0, my, r, 0, Math.PI * 2); g.clip(); g.rotate(0.6); const xx = -r * 1.6 + sw * r * 3.2; const s2 = g.createLinearGradient(xx - r * 0.3, 0, xx + r * 0.3, 0); s2.addColorStop(0, "rgba(255,255,255,0)"); s2.addColorStop(0.5, "rgba(255,255,255,.7)"); s2.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = s2; g.fillRect(-r * 2, -r * 2, r * 4, r * 4); g.restore(); }
        g.fillStyle = "#fff"; g.font = CF(u * 0.036, 800); g.fillText(pl + ". " + (p.word || "PLATZ"), 0, ch * 0.24);
        if (amt){ g.font = CF(u * 0.03, 700); g.fillStyle = "rgba(255,255,255,.75)"; g.fillText(amt, 0, ch * 0.36); }
        g.restore();
      });
    }
  };
  /* ---------- Reisepass-Bausteine ---------- */
  // Motiv + Farbe je Land für das Abzeichen (eigenes Motiv/Farbe über die Felder)
  const COUNTRY_ART = {
    vietnam: ["⛵", "#c8312f"], laos: ["🐘", "#6b4aa8"], thailand: ["👹", "#2f9a3f"], kambodscha: ["🛕", "#c46a1a"], malaysia: ["🌺", "#1f5fb5"],
    singapur: ["🦁", "#d6262f"], indonesien: ["🌋", "#c0262d"], philippinen: ["🏝️", "#1d6fd1"], myanmar: ["🛕", "#d9a21b"], china: ["🐉", "#c8312f"],
    japan: ["🗻", "#d22f3a"], südkorea: ["🏯", "#2e5aa8"], indien: ["🐅", "#e07b16"], nepal: ["🏔️", "#b8232f"], "sri lanka": ["🐘", "#a8322a"],
    mongolei: ["🐎", "#2b62b5"], türkei: ["🕌", "#d0262d"], griechenland: ["🏛️", "#1f62b8"], italien: ["🍕", "#2f8f46"], frankreich: ["🥖", "#2a4fa0"],
    spanien: ["💃", "#c8202c"], portugal: ["🐓", "#2f8f46"], deutschland: ["🥨", "#2b2b2b"], österreich: ["🏔️", "#c8202c"], schweiz: ["🧀", "#d0262d"],
    niederlande: ["🌷", "#e06a12"], kroatien: ["⛵", "#1f56a8"], norwegen: ["🏔️", "#1d4e9c"], schweden: ["🫎", "#1f63b0"], island: ["🌋", "#2a5fb0"],
    "vereinigtes königreich": ["💂", "#1f3f8c"], irland: ["🍀", "#2f8f46"], usa: ["🗽", "#2a4fa0"], "vereinigte staaten": ["🗽", "#2a4fa0"], kanada: ["🍁", "#c8202c"],
    mexiko: ["🌵", "#2f8f46"], peru: ["🦙", "#c8202c"], brasilien: ["🦜", "#2f9a3f"], argentinien: ["🧉", "#3a8fd6"], chile: ["🗿", "#c8202c"], kolumbien: ["☕", "#d9a21b"],
    marokko: ["🐪", "#c8312f"], ägypten: ["🐫", "#c9a227"], kenia: ["🦒", "#2f8f46"], südafrika: ["🦁", "#2f8f46"], tansania: ["🦓", "#2f9a3f"],
    australien: ["🦘", "#1f3f8c"], neuseeland: ["🥝", "#1f3f8c"], georgien: ["🍇", "#c8202c"], albanien: ["🦅", "#c8202c"], polen: ["🥟", "#c8202c"], tschechien: ["🍺", "#2a4fa0"]
  };
  function artFor(p, name){
    const c = lookup(name), key = (c ? c.name : name || "").toLowerCase(), d = COUNTRY_ART[key];
    const pal = ["#c8312f", "#2f9a3f", "#2a5fb0", "#6b4aa8", "#c46a1a", "#0f6f78"];
    return { icon: p.icon || (d && d[0]) || "", color: p.badgeColor || (d && d[1]) || pal[hash(key) % pal.length], a2: c && c.a2 };
  }
  const shade = (hex, f) => { const n = parseInt(String(hex).replace("#", ""), 16); const ch = s => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f))); return "rgb(" + ch(16) + "," + ch(8) + "," + ch(0) + ")"; };
  const hexA = (hex, a) => { const n = parseInt(String(hex).replace("#", ""), 16); return "rgba(" + (n >> 16 & 255) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + a + ")"; };
  // Abzeichen in eigener Leinwand (Briefmarke hinten, farbige Scheibe, Motiv, Name); Tinten-Version = einfarbig mit Fehlstellen
  const badgeCache = new Map();
  function badgeCanvas(name, p, R, ink, inkColor){
    const art = artFor(p, name), img = !art.icon && art.a2 ? flagImg(art.a2) : null;
    const key = [name, art.icon, art.color, Math.round(R), ink ? inkColor : "", img ? 1 : 0].join("|");
    if (badgeCache.has(key)) return badgeCache.get(key);
    const S = Math.ceil(R * 2.9), c = document.createElement("canvas"); c.width = c.height = S; const t = c.getContext("2d"), m = S / 2;
    // Briefmarke mit Zacken
    t.save(); t.translate(m, m); t.rotate(-0.1);
    const s = R * 1.05; t.fillStyle = ink ? "#ececec" : "#c9b48a"; t.fillRect(-s, -s, 2 * s, 2 * s);
    t.strokeStyle = "#4a3b26"; t.lineWidth = R * 0.03; t.strokeRect(-s * 0.86, -s * 0.86, s * 1.72, s * 1.72);
    t.globalCompositeOperation = "destination-out"; const n = 9, rr0 = s / n * 0.55;
    for (let i = 0; i <= n; i++){ const q = -s + 2 * s * i / n; for (const [x, y] of [[q, -s], [q, s], [-s, q], [s, q]]){ t.beginPath(); t.arc(x, y, rr0, 0, Math.PI * 2); t.fill(); } }
    t.restore();
    // Scheibe
    t.save(); t.translate(m, m);
    const disc = ink ? "#f4f4f4" : art.color, dark = ink ? "#202020" : shade(art.color, 0.55);
    t.fillStyle = disc; t.beginPath(); t.arc(0, 0, R, 0, Math.PI * 2); t.fill();
    t.lineWidth = R * 0.09; t.strokeStyle = dark; t.stroke();
    if (ink){ t.lineWidth = R * 0.03; t.beginPath(); t.arc(0, 0, R * 0.82, 0, Math.PI * 2); t.stroke(); }
    t.lineWidth = R * 0.025; t.strokeStyle = "rgba(255,255,255,.35)"; t.beginPath(); t.arc(0, 0, R * 0.84, 0, Math.PI * 2); t.stroke();
    t.beginPath(); t.arc(0, 0, R * 0.95, 0, Math.PI * 2); t.clip();
    if (img){ const fh = R * 0.9, fw = fh * img.naturalWidth / img.naturalHeight; t.drawImage(img, -fw / 2, -R * 0.62, fw, fh); }
    else if (art.icon){ if (ink) t.filter = "grayscale(1) contrast(1.6) brightness(0.9)"; t.font = Math.round(R * 0.95) + "px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif"; t.textAlign = "center"; t.textBaseline = "middle"; t.fillText(art.icon, 0, -R * 0.16); t.filter = "none"; }
    if (!ink){ t.fillStyle = "rgba(255,255,255,.2)"; t.fillRect(-R, R * 0.36, 2 * R, R * 0.36); }   // helles Band unten
    t.font = CF(R * 0.28, 900); t.textAlign = "center"; t.textBaseline = "middle"; t.fillStyle = ink ? "#202020" : shade(art.color, 0.38);
    t.fillText(name, 0, R * 0.55, R * 1.6);
    t.restore();
    if (ink){                                                                                      // → Tintenstempel
      const d = t.getImageData(0, 0, S, S), px = d.data, ic = parseInt(String(inkColor).replace("#", ""), 16), ir = ic >> 16 & 255, ig = ic >> 8 & 255, ib = ic & 255;
      let sd = hash(name) + 7; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < px.length; i += 4){
        const lum = (0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2]) / 255, a = px[i + 3] / 255;
        let al = Math.max(0, Math.min(1, (0.8 - lum) * 1.9)) * a;
        if (rnd() < 0.18) al *= 0.35;
        px[i] = ir; px[i + 1] = ig; px[i + 2] = ib; px[i + 3] = al * 230;
      }
      t.putImageData(d, 0, 0);
    }
    if (badgeCache.size > 120) badgeCache.clear(); badgeCache.set(key, c);
    return c;
  }
  function badge(g, cx, cy, R, name, p, alpha, ink){
    const art = artFor(p, name), c = badgeCanvas(name, p, R, ink, p.inkColor || art.color);
    g.save(); g.globalAlpha *= alpha; if (ink) g.globalCompositeOperation = "multiply";
    if (!ink){ g.shadowColor = "rgba(0,0,0,.45)"; g.shadowBlur = R * 0.25; g.shadowOffsetY = R * 0.06; }
    g.drawImage(c, cx - c.width / 2, cy - c.height / 2); g.restore();
  }
  function passport(g, x, y, w, h, u, p, team){
    g.save(); g.shadowColor = "rgba(0,0,0,.45)"; g.shadowBlur = u * 0.04; g.shadowOffsetY = u * 0.012;
    g.fillStyle = "#e8e6e3"; rr(g, x, y, w, h, u * 0.025); g.fill(); g.restore();
    g.save(); rr(g, x, y, w, h, u * 0.025); g.clip();
    g.strokeStyle = "rgba(120,120,128,.16)"; g.lineWidth = Math.max(1, u * 0.0022);             // Wellenlinien
    for (let k = 0; k < 34; k++){ const xx = x + w * (k + 0.5) / 34; g.beginPath(); for (let yy = 0; yy <= h; yy += 6){ const X = xx + Math.sin(yy / h * Math.PI * 7 + k * 0.6) * w * 0.006; yy ? g.lineTo(X, y + yy) : g.moveTo(X, y + yy); } g.stroke(); }
    const fold = g.createLinearGradient(x + w / 2 - w * 0.06, 0, x + w / 2 + w * 0.06, 0);        // Falz
    fold.addColorStop(0, "rgba(0,0,0,0)"); fold.addColorStop(0.48, "rgba(0,0,0,.16)"); fold.addColorStop(0.5, "rgba(0,0,0,.28)"); fold.addColorStop(0.52, "rgba(0,0,0,.16)"); fold.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = fold; g.fillRect(x + w / 2 - w * 0.06, y, w * 0.12, h);
    const vig = g.createRadialGradient(x + w / 2, y + h / 2, h * 0.3, x + w / 2, y + h / 2, w * 0.62); vig.addColorStop(0, "rgba(0,0,0,0)"); vig.addColorStop(1, "rgba(0,0,0,.18)");
    g.fillStyle = vig; g.fillRect(x, y, w, h);
    g.restore();
    if (p.team){                                                                                    // Teamname oben links
      g.save(); g.font = CF(h * 0.075, 900); g.textAlign = "left"; g.textBaseline = "top";
      g.lineWidth = h * 0.012; g.strokeStyle = shade(team, 0.55); g.strokeText(p.team.toUpperCase(), x + w * 0.04, y + h * 0.05);
      g.fillStyle = team; g.fillText(p.team.toUpperCase(), x + w * 0.04, y + h * 0.05); g.restore();
    }
    const prev = String(p.prev || "").split(",").map(s => s.trim()).filter(Boolean);           // alte Stempel links
    prev.slice(0, 4).forEach((nm, i) => {
      const c = lookup(nm), name = (c ? c.name : nm).toUpperCase(), R = h * 0.17;
      const sx = x + w * (0.13 + (i % 2) * 0.2), sy = y + h * (0.4 + Math.floor(i / 2) * 0.32 + (i % 2) * 0.12);
      g.save(); g.translate(sx, sy); g.rotate(((hash(nm) % 24) - 12) * Math.PI / 180);
      badge(g, 0, 0, R, name, Object.assign({}, p, { icon: "", badgeColor: "" }), 0.95, true); g.restore();
    });
  }
  // Konfetti-Flocken in Teamfarbe
  function flakes(g, W, H, u, lt, col, out, seed){
    let sd = seed % 2147483646 + 3; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 90; i++){
      const x0 = rnd() * W, t0 = rnd() * 0.6, sp = u * (0.12 + rnd() * 0.18), sw = rnd() * 6, s = u * (0.005 + rnd() * 0.008), rot = rnd() * 6, spin = 2 + rnd() * 5, light = rnd();
      const t = lt - t0; if (t <= 0) continue;
      const fade = clamp((3.4 - t) / 0.8) * out; if (fade <= 0) continue;
      const x = x0 + Math.sin(t * 1.7 + sw) * u * 0.04, y = -u * 0.05 + t * sp + rnd() * H * 0.8;
      g.save(); g.globalAlpha = fade * 0.9; g.translate(x, y); g.rotate(rot + t * spin); g.scale(1, Math.abs(Math.cos(t * 4 + sw)) + 0.2);
      g.fillStyle = light > 0.6 ? shade(col, 1.35) : col; g.fillRect(-s, -s * 0.6, s * 2, s * 1.2); g.restore();
    }
  }
  // eigene Bilder (Teamfoto) als Data-URL
  const userImgs = new Map();
  function userImg(src){
    if (!src) return null;
    if (!userImgs.has(src)){ const im = new Image(); im.src = src; userImgs.set(src, im); }
    const im = userImgs.get(src); return im.complete && im.naturalWidth ? im : null;
  }

  /* ---------- Bausteine ---------- */
  const CF = (px, w = 800) => w + " " + Math.round(px) + "px 'Avenir Next Condensed','Arial Narrow','Roboto Condensed','Helvetica Neue',sans-serif";
  const easeInOut = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const num0 = v => { const n = parseFloat(String(v ?? "0").replace(/\./g, "").replace(",", ".")); return isNaN(n) ? 0 : n; };
  const firstCountry = p => String(p.country || "").split(",")[0].trim();
  function hexPath(g, cx, cy, R){ g.beginPath(); for (let k = 0; k < 6; k++){ const a = -Math.PI / 2 + k * Math.PI / 3; k ? g.lineTo(cx + R * Math.cos(a), cy + R * Math.sin(a)) : g.moveTo(cx + R * Math.cos(a), cy + R * Math.sin(a)); } g.closePath(); }
  function rcard(g, x, y, w, h, r, u){                                     // dunkle Glas-Karte (THE RACE)
    g.save(); g.shadowColor = "rgba(0,0,0,.55)"; g.shadowBlur = u * 0.035; g.shadowOffsetY = u * 0.01;
    const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, "#34353b"); gr.addColorStop(1, "#1c1d21");
    g.fillStyle = gr; rr(g, x, y, w, h, r); g.fill(); g.restore();
    g.save(); g.strokeStyle = "rgba(255,255,255,.09)"; g.lineWidth = Math.max(1, u * 0.002); rr(g, x + 0.5, y + 0.5, w - 1, h - 1, r); g.stroke(); g.restore();
  }
  const pictoCache = new Map();                                            // Emoji → einfarbiges Piktogramm (weiße Silhouette)
  function picto(g, emoji, cx, cy, size, color){
    const key = emoji + "|" + Math.round(size) + "|" + color;
    let c = pictoCache.get(key);
    if (!c){
      c = document.createElement("canvas"); c.width = c.height = Math.ceil(size * 1.4);
      const t = c.getContext("2d"); t.font = Math.round(size) + "px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";
      t.textAlign = "center"; t.textBaseline = "middle"; t.fillText(emoji, c.width / 2, c.height / 2 + size * 0.06);
      t.globalCompositeOperation = "source-in"; t.fillStyle = color; t.fillRect(0, 0, c.width, c.height);
      if (pictoCache.size > 200) pictoCache.clear(); pictoCache.set(key, c);
    }
    g.drawImage(c, cx - c.width / 2, cy - c.height / 2);
  }
  function coins(g, cx, cy, r, col){ g.save(); g.strokeStyle = col; g.lineWidth = r * 0.28; g.beginPath(); g.arc(cx - r * 0.35, cy, r, 0, Math.PI * 2); g.stroke(); g.fillStyle = "#26272c"; g.beginPath(); g.arc(cx + r * 0.35, cy, r, 0, Math.PI * 2); g.fill(); g.stroke(); g.beginPath(); g.arc(cx + r * 0.35, cy, r * 0.5, 0, Math.PI * 2); g.stroke(); g.restore(); }
  function place(p, W, H, w, h, def){                                      // Position: Mitte, oben, unten oder Ecken
    const pos = p.pos || def, m = Math.min(W, H) * 0.05, portrait = H > W * 1.2;
    const top = H * (portrait ? 0.1 : 0.06), bot = H * (portrait ? 0.78 : 0.94) - h;
    switch (pos){
      case "top": return [(W - w) / 2, top];
      case "bottom": return [(W - w) / 2, bot];
      case "tl": return [m, top]; case "tr": return [W - m - w, top];
      case "bl": return [m, bot]; case "br": return [W - m - w, bot];
      default: return [(W - w) / 2, (H - h) / 2];
    }
  }
  // Lametta: Metallstreifen fliegen aus der Mitte, flattern und fallen (layer 0 = hinten, 1 = vorne)
  function lametta(g, cx, cy, u, lt, t0, seed, layer, outK){
    const t = lt - t0; if (t <= 0) return;
    let sd = seed % 2147483646 + 1; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    const COLS = ["#ffe27a", "#f5c542", "#fff4c2", "#e8e8f0", "#b9bcc6", "#ffffff", "#ff5a6e", "#58c4ff"];
    for (let i = 0; i < 110; i++){
      const a = -Math.PI / 2 + (rnd() - 0.5) * Math.PI * 1.9, v = u * (0.7 + rnd() * 1.6), dl = rnd() * 0.1, rot0 = rnd() * 6, spin = 3 + rnd() * 8;
      const len = u * (0.025 + rnd() * 0.035), wid = u * (0.006 + rnd() * 0.004), col = COLS[Math.floor(rnd() * COLS.length)], ph = rnd() * 6;
      if ((i & 1) !== layer) continue;
      const tt = t - dl; if (tt <= 0) continue;
      const k = 2.6, e = (1 - Math.exp(-k * tt)) / k;
      const x = cx + Math.cos(a) * v * e + Math.sin(tt * 3 + ph) * u * 0.02, y = cy + Math.sin(a) * v * e + u * 0.35 * tt * tt;
      const fade = clamp((3.2 - tt) / 0.8) * (1 - outK); if (fade <= 0) continue;
      const fl = Math.cos(tt * 12 + ph);
      g.save(); g.globalAlpha = fade; g.translate(x, y); g.rotate(rot0 + tt * spin); g.scale(Math.max(0.15, Math.abs(fl)), 1);
      g.fillStyle = col; g.fillRect(-wid / 2, -len / 2, wid, len);
      if (fl > 0.7){ g.fillStyle = "rgba(255,255,255,.8)"; g.fillRect(-wid / 2, -len / 2, wid, len * 0.35); }
      g.restore();
    }
  }

  // Flaggen-Sammlung: automatisch aus Länder-Markierungen der Route oder aus der Liste
  function itemsFor(p){
    countriesReady(); if (!ctry) return [];
    const out = [];
    if (p.auto !== false && typeof MARKS !== "undefined"){
      MARKS.list().filter(m => m.iso).sort((a, b) => a.t0 - b.t0).forEach(m => { const c = ctry.byA3.get(m.iso); if (c) out.push({ a2: c.a2, name: m.name || c.name, t: Math.max(0, m.t0 - (p.t0 || 0)) }); });
    }
    if (p.countries){
      const names = p.countries.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean), step = p.step || 0.7;
      names.forEach((nm, i) => { const c = lookup(nm); if (c && !out.some(o => o.a2 === c.a2)) out.push({ a2: c.a2, name: c.name, t: 0.4 + (out.length) * step }); });
    }
    return out;
  }

  function drawAsset(g, W, H, a, lt){
    g.save(); g.translate((a.dx || 0) * W, (a.dy || 0) * H);
    try { DRAW[a.type](g, W, H, a, Math.min(Math.max(lt, 0), a.dur), a.dur); } finally { g.restore(); }
  }
  /* ---------- Vorschau (eigene Bühne ohne Karte) ---------- */
  const stageEl = $("assetStage"), cv = $("assetCanvas");
  function res(){ return (val("asRes") || "1920x1080").split("x").map(Number); }
  function fit(){
    const [W, H] = res(); if (cv.width !== W || cv.height !== H){ cv.width = W; cv.height = H; }
    const r = stageEl.getBoundingClientRect(), s = Math.min((r.width - 40) / W, (r.height - 40) / H);
    cv.style.width = Math.max(50, W * s) + "px"; cv.style.height = Math.max(50, H * s) + "px";
  }
  function frame(){
    if (!loopOn) return;
    fit();
    const g = cv.getContext("2d"), [W, H] = res(); g.clearRect(0, 0, W, H);
    const bg = val("asBg"); if (bg === "black"){ g.fillStyle = "#000"; g.fillRect(0, 0, W, H); } else if (bg === "green"){ g.fillStyle = "#00ff00"; g.fillRect(0, 0, W, H); }
    const a = list.find(x => x.id === sel);
    if (a){ const hold = drag ? drag.t : null, lt = ((performance.now() - start) / 1000) % (a.dur + 0.8); try { drawAsset(g, W, H, a, hold != null ? hold : lt); } catch (e) { console.warn("Asset:", e); } }
    else { g.fillStyle = "rgba(255,255,255,.55)"; g.font = FS(Math.min(W, H) * 0.035, 600); g.textAlign = "center"; g.fillText(tr("Links ein Asset wählen oder hinzufügen"), W / 2, H / 2); }
    requestAnimationFrame(frame);
  }
  function setMode(on){
    stageEl.hidden = !on;
    if (on && !loopOn){ loopOn = true; requestAnimationFrame(frame); } else if (!on) loopOn = false;
  }
  // Verschieben per Ziehen, Größe per Mausrad (Animation pausiert dabei im aktuellen Moment)
  let drag = null;
  const cur = () => list.find(x => x.id === sel);
  const toCanvas = e => { const r = cv.getBoundingClientRect(), [W, H] = res(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; };
  cv.addEventListener("pointerdown", e => {
    const a = cur(); if (!a) return;
    const [x, y] = toCanvas(e), [W, H] = res(), lt = ((performance.now() - start) / 1000) % (a.dur + 0.8);
    drag = { x, y, dx: a.dx || 0, dy: a.dy || 0, t: Math.min(Math.max(lt, a.dur * 0.6), a.dur - 0.5), W, H };
    cv.setPointerCapture(e.pointerId); cv.style.cursor = "grabbing";
  });
  cv.addEventListener("pointermove", e => {
    const a = cur(); if (!drag || !a) return;
    const [x, y] = toCanvas(e); a.dx = drag.dx + (x - drag.x) / drag.W; a.dy = drag.dy + (y - drag.y) / drag.H;
    if (Math.abs(a.dx) < 0.012) a.dx = 0; if (Math.abs(a.dy) < 0.012) a.dy = 0;          // rastet in der Mitte ein
  });
  const endDrag = () => { if (!drag) return; drag = null; cv.style.cursor = ""; start = performance.now(); };
  cv.addEventListener("pointerup", endDrag); cv.addEventListener("pointercancel", endDrag);
  cv.addEventListener("wheel", e => {
    const a = cur(); if (!a) return; e.preventDefault();
    a.size = Math.min(2.5, Math.max(0.3, (a.size || 1) * (e.deltaY < 0 ? 1.06 : 1 / 1.06)));
    const r = document.querySelector('#asList [data-k="size"]'); if (r) r.value = a.size;
  }, { passive: false });
  document.addEventListener("ma:tab", e => setMode(e.detail === "assets"));
  setMode(document.body.classList.contains("assets-mode"));

  /* ---------- Daten vorladen ---------- */
  const countriesOf = a => String(a.country || "").split(",").map(s => s.trim()).filter(Boolean);
  async function ready(arr = list){
    if (!arr.length) return;
    await countriesReady();
    const jobs = [];
    for (const a of arr){
      const names = [...countriesOf(a), ...String(a.countries || "").split(","), ...String(a.prev || "").split(",")].map(s => s.trim()).filter(Boolean);
      const a2s = a.type === "flags" ? itemsFor(a).map(i => i.a2) : names.map(n => lookup(n) && lookup(n).a2);
      for (const a2 of a2s) if (a2){ flagImg(a2); jobs.push(flags.get(a2).job); }
    }
    await Promise.all(jobs);
  }

  /* ---------- Export ---------- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++){ let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zip(files){                                                     // ZIP ohne Kompression (PNG ist schon komprimiert)
    const enc = new TextEncoder(), parts = [], cent = []; let off = 0;
    for (const f of files){
      const name = enc.encode(f.name), crc = crc32(f.data), n = f.data.length;
      const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint32(14, crc, true); h.setUint32(18, n, true); h.setUint32(22, n, true); h.setUint16(26, name.length, true);
      parts.push(new Uint8Array(h.buffer), name, f.data);
      const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint32(16, crc, true); c.setUint32(20, n, true); c.setUint32(24, n, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
      cent.push(new Uint8Array(c.buffer), name);
      off += 30 + name.length + n;
    }
    const cs = cent.reduce((a, b) => a + b.length, 0), e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cs, true); e.setUint32(16, off, true);
    return new Blob([...parts, ...cent, new Uint8Array(e.buffer)], { type: "application/zip" });
  }
  function download(blob, name){ const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
  async function exportAsset(a, fmt, opt = {}){
    const [W, H] = (opt.size || val("asRes") || "1920x1080").split("x").map(Number), fps = opt.fps || parseInt(val("expFps")) || 30;
    const multi = ["hexflag", "stamp", "flag"].includes(a.type) ? countriesOf(a) : [];
    const variants = multi.length > 1 ? multi.map(n => Object.assign({}, a, { country: n })) : [a];
    await ready(variants);
    const c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
    const nameOf = v => (TYPES[v.type].name.split(" ")[0] + "-" + (firstCountry(v) || v.title || v.label || v.text || v.id)).slice(0, 40).replace(/[^\wäöüÄÖÜß-]+/g, "_");
    const files = [], blobs = [];
    for (const v of variants){
      const n = Math.ceil(v.dur * fps), base = nameOf(v);
      const draw = i => { g.clearRect(0, 0, W, H); if (fmt === "green"){ g.fillStyle = "#00ff00"; g.fillRect(0, 0, W, H); } drawAsset(g, W, H, v, i / fps); };
      if (fmt === "png"){
        for (let i = 0; i < n; i++){
          draw(i);
          const b = await new Promise(r => c.toBlob(r, "image/png"));
          files.push({ name: base + "/" + base + "_" + String(i).padStart(4, "0") + ".png", data: new Uint8Array(await b.arrayBuffer()) });
          if (i % 10 === 0) setStatus(tr("Asset") + " " + base + " " + Math.round(i / n * 100) + " %");
        }
        continue;
      }
      let codec = "avc1.640034"; if (!(await VideoEncoder.isConfigSupported({ codec, width: W, height: H })).supported) codec = "avc1.4d0034";
      const muxer = new Mp4Muxer.Muxer({ target: new Mp4Muxer.ArrayBufferTarget(), video: { codec: "avc", width: W, height: H, frameRate: fps }, fastStart: "in-memory" });
      let err = null; const enc = new VideoEncoder({ output: (ch, m) => muxer.addVideoChunk(ch, m), error: e => err = e });
      enc.configure({ codec, width: W, height: H, bitrate: 16e6, framerate: fps });
      for (let i = 0; i < n && !err; i++){
        draw(i);
        const vf = new VideoFrame(c, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
        enc.encode(vf, { keyFrame: i % fps === 0 }); vf.close();
        while (enc.encodeQueueSize > 6) await new Promise(r => setTimeout(r, 5));
      }
      await enc.flush(); muxer.finalize(); if (err) throw err;
      const blob = new Blob([muxer.target.buffer], { type: "video/mp4" }); blobs.push(blob);
      if (!opt.noDownload) download(blob, base + "_greenscreen.mp4");
    }
    if (fmt === "png"){
      const blob = zip(files);
      if (!opt.noDownload) download(blob, nameOf(variants[0]) + (variants.length > 1 ? "_und_weitere" : "") + "_png.zip");
      setStatus(tr("PNG-Sequenz fertig") + " · " + files.length + " " + tr("Bilder"));
      return { blob, frames: files.length };
    }
    setStatus(tr("Greenscreen-MP4 fertig") + (blobs.length > 1 ? " · " + blobs.length + " " + tr("Dateien") : ""));
    return { blob: blobs[0], frames: Math.ceil(a.dur * fps) };
  }

  /* ---------- Verwaltung + Oberfläche ---------- */
  const today = () => new Date().toLocaleDateString("de-DE");
  const DEFAULTS = {
    hexflag: { country: "Laos", sub: "LAND #4", lametta: true },
    rchallenge: { label: "CHALLENGE", icon: "🏆", text: "Mit 100 € in 3 Tagen nach Bangkok", goal: "💶 100 €", time: "⏱ 3 TAGE", status: "open" },
    rules: { items: "🏃 | Nur in Teams\n🤝 | Keine Versprechen | x\n✈️ | Kommerzielle Flüge | x\n🚌 | Busse & Trampen | ok", pills: true },
    money: { from: "0", to: "25,80", cur: "€", pos: "top" },
    clock: { text: "14:00", pos: "tl" },
    info: { text: "Thuốc lào ist eine traditionelle vietnamesische Art, Tabak durch eine Wasserpfeife zu rauchen.", pos: "bl" },
    medal: { place: 1, amount: "15.000 €, 10.000 €, 5.000 €", podium: true, word: "PLATZ" },
    stamp: { country: "Thailand", team: "Hannes", color: "#b06ae8", prev: "Vietnam, Laos", headline: "NEUES LAND ERREICHT", confetti: true },
    teamcard: { color: "#9b59d0", label: "AKTUELLES BUDGET", value: "21,57 €", l1: "ZURÜCKGELEGT", v1: "1.186 KM", l2: "BIS ZUM ZIEL", v2: "2.936 KM", countries: "Vietnam, Laos", slots: 7, pos: "bl" },
    chapter: { text: "Was bisher geschah", color: "#f5c542", pos: "tl" },
    flag: { country: "Laos", text: "WILLKOMMEN IN", sub: "" },
    challenge: { title: "CHALLENGE", text: "Mit 100 € in 3 Tagen nach Bangkok", goal: "💶 100 €", time: "⏱ 3 TAGE", status: "open" },
    flags: { auto: false, countries: "Vietnam, Laos, Thailand, Kambodscha", word: "LÄNDER", start: 0, pos: "top" }
  };
  const POS = [["center", "Mitte"], ["top", "oben"], ["bottom", "unten"], ["tl", "oben links"], ["tr", "oben rechts"], ["bl", "unten links"], ["br", "unten rechts"]];
  const STATUS = [["open", "läuft"], ["done", "geschafft ✓"], ["fail", "gescheitert ✗"]];
  const FIELDS = {
    hexflag: [["country", "Land (mehrere mit Komma = je ein Asset)", "text"], ["title", "Name (leer = Land)", "text"], ["sub", "Zeile darunter", "text"], ["color", "Farbe Zeile", "color"], ["lametta", "Lametta", "check"]],
    rchallenge: [["label", "Kopf", "text"], ["icon", "Icon (Emoji)", "text"], ["text", "Aufgabe", "text"], ["goal", "Chip 1", "text"], ["time", "Chip 2", "text"], ["status", "Status", "select", STATUS], ["color", "Farbe", "color"]],
    rules: [["items", "Karten: Icon | Text | x (verboten) / ok (erlaubt), je Zeile", "textarea"], ["pills", "VERBOTEN/ERLAUBT-Pillen", "check"]],
    money: [["from", "Von", "text"], ["to", "Auf", "text"], ["cur", "Währung", "text"]],
    clock: [["text", "Uhrzeit", "text"], ["color", "Farbe", "color"]],
    info: [["text", "Text", "textarea"]],
    medal: [["podium", "Podest (1–3)", "check"], ["place", "Platz (ohne Podest)", "number"], ["amount", "Beträge (Komma: 1., 2., 3.)", "text"], ["word", "Wort", "text"]],
    stamp: [["country", "Neues Land (mehrere mit Komma)", "text"], ["team", "Name im Pass", "text"], ["color", "Teamfarbe", "color"], ["prev", "Schon im Pass (Komma)", "text"], ["headline", "Titel", "text"],
      ["icon", "Motiv (Emoji, leer = passend zum Land)", "text"], ["badgeColor", "Abzeichen-Farbe", "color"], ["title", "Name auf dem Abzeichen (leer = Land)", "text"], ["confetti", "Konfetti", "check"]],
    teamcard: [["img", "Teamfoto", "image"], ["color", "Teamfarbe", "color"], ["label", "Überschrift", "text"], ["value", "Wert", "text"], ["l1", "Kasten 1", "text"], ["v1", "Wert 1", "text"], ["l2", "Kasten 2", "text"], ["v2", "Wert 2", "text"], ["countries", "Besuchte Länder (Komma)", "text"], ["slots", "Plätze gesamt", "number"]],
    chapter: [["text", "Text", "text"], ["color", "Farbe", "color"]],
    flag: [["country", "Land (mehrere mit Komma)", "text"], ["text", "Zeile oben", "text"], ["title", "Name (leer = Land)", "text"], ["sub", "Unterzeile", "text"]],
    challenge: [["title", "Titel", "text"], ["text", "Aufgabe", "text"], ["goal", "Chip 1", "text"], ["time", "Chip 2", "text"], ["status", "Status", "select", STATUS]],
    flags: [["countries", "Länder (Komma)", "text"], ["auto", "+ Länder-Markierungen der Route", "check"], ["word", "Wort", "text"], ["start", "Zählt ab", "number"]]
  };
  function add(type, opt = {}){
    const a = Object.assign({ id: ++counter, type, dur: TYPES[type].dur, size: 1, t0: 0 }, JSON.parse(JSON.stringify(DEFAULTS[type] || {})), opt);
    list.push(a); sel = a.id; start = performance.now(); render(); ready([a]);
    return a;
  }
  const labelOf = a => a.country || a.countries || a.label || a.title || a.text || "";
  function render(){
    const box = $("asList"); if (!box) return;
    box.innerHTML = "";
    for (const a of list){
      const T = TYPES[a.type], el = document.createElement("div"); el.className = "insitem" + (sel === a.id ? " open" : "");
      el.innerHTML = `<div class="inshead"><span>${T.icon} ${tr(T.name)}</span><em></em><button type="button" data-a="dup" title="${tr("Duplizieren")}">⧉</button><button type="button" data-a="del" title="${tr("Löschen")}">✕</button></div>`;
      el.querySelector("em").textContent = labelOf(a);
      if (sel === a.id){
        const body = document.createElement("div"); body.className = "insbody";
        const fld = (k, lab, type, opts) => type === "select" ? `<div class="setting"><label>${tr(lab)}</label><select data-k="${k}">${opts.map(([v, l]) => `<option value="${v}"${String(a[k] ?? "") === v ? " selected" : ""}>${tr(l)}</option>`).join("")}</select></div>`
          : type === "check" ? `<div class="setting"><label>${tr(lab)}</label><input type="checkbox" data-k="${k}"></div>`
          : type === "textarea" ? `<div class="setting col"><label>${tr(lab)}</label><textarea data-k="${k}" rows="4"></textarea></div>`
          : type === "image" ? `<div class="setting"><label>${tr(lab)}</label><label class="photo-label">${a[k] ? "✓ " : ""}${tr("Wählen")}<input type="file" accept="image/*" data-img="${k}" hidden></label></div>`
          : `<div class="setting"><label>${tr(lab)}</label><input type="${type}" data-k="${k}"></div>`;
        body.innerHTML = FIELDS[a.type].map(f => fld(...f)).join("") + fld("dur", "Dauer (s)", "number") + fld("pos", "Position", "select", POS) +
          `<div class="setting"><label>${tr("Größe")}</label><input type="range" data-k="size" min="0.3" max="2.5" step="0.05"></div>` +
          `<div class="hint">${tr("In der Vorschau ziehen = verschieben, Mausrad = Größe.")} <a href="#" data-a="center">${tr("Zur Mitte")}</a></div>` +
          `<div class="insexp"><span>${tr("Exportieren")} (${val("asRes")}):</span><button type="button" class="btn" data-a="png">PNG transparent (ZIP)</button><button type="button" class="btn ghost" data-a="green">Greenscreen-MP4</button></div>`;
        body.querySelectorAll("[data-k]").forEach(inp => {
          const k = inp.dataset.k;
          if (inp.type === "checkbox") inp.checked = !!a[k];
          else if (inp.tagName !== "SELECT") inp.value = a[k] ?? (inp.type === "color" ? ({ stamp: "#b06ae8", teamcard: "#9b59d0", chapter: "#f5c542", hexflag: "#f5c542", clock: "#3ddc6f" }[a.type] || "#ff3b45") : "");
          if (k === "pos" && !a.pos) inp.value = { money: "top", clock: "tl", info: "bl", flags: "top" }[a.type] || "center";
          inp.addEventListener("input", () => {
            a[k] = inp.type === "checkbox" ? inp.checked : (inp.type === "number" || inp.type === "range") ? parseFloat(inp.value) || 0 : inp.value;
            if (k === "country" || k === "countries") ready([a]);
            el.querySelector("em").textContent = labelOf(a);
            if (k !== "size" && k !== "pos") start = performance.now();
          });
        });
        body.querySelectorAll("[data-img]").forEach(inp => inp.addEventListener("change", () => {
          const f = inp.files[0]; if (!f) return; const rd = new FileReader();
          rd.onload = () => { const im = new Image(); im.onload = () => { const c = document.createElement("canvas"), s = Math.min(1, 512 / Math.max(im.width, im.height)); c.width = im.width * s; c.height = im.height * s; c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); a[inp.dataset.img] = c.toDataURL("image/jpeg", 0.88); render(); }; im.src = rd.result; };
          rd.readAsDataURL(f);
        }));
        el.appendChild(body);
        const ex = x => body.querySelector(`[data-a="${x}"]`);
        ex("center").addEventListener("click", e => { e.preventDefault(); a.dx = 0; a.dy = 0; });
        ex("png").addEventListener("click", () => exportAsset(a, "png").catch(e => setStatus("Export-Fehler: " + e.message)));
        ex("green").addEventListener("click", () => exportAsset(a, "green").catch(e => setStatus("Export-Fehler: " + e.message)));
      }
      el.querySelector(".inshead").addEventListener("click", e => { if (e.target.closest("button")) return; sel = sel === a.id ? null : a.id; start = performance.now(); render(); });
      el.querySelector('[data-a="del"]').addEventListener("click", () => { list = list.filter(x => x !== a); if (sel === a.id) sel = null; render(); });
      el.querySelector('[data-a="dup"]').addEventListener("click", () => { const b = Object.assign({}, a, { id: ++counter }); list.splice(list.indexOf(a) + 1, 0, b); sel = b.id; render(); });
      box.appendChild(el);
    }
  }
  const addBox = $("asAdd");
  if (addBox) addBox.innerHTML = Object.entries(TYPES).map(([k, t]) => `<button type="button" class="btn ghost" data-as="${k}"><b>${t.icon}</b> ${tr(t.name)}</button>`).join("");
  document.querySelectorAll("[data-as]").forEach(b => b.addEventListener("click", () => add(b.dataset.as)));
  ["asRes", "asBg"].forEach(id => $(id).addEventListener("input", () => { start = performance.now(); render(); }));

  Object.assign(EN, { "Asset": "Asset", "Hexagon-Flagge + Lametta": "Hexagon flag + tinsel", "Challenge-Karte": "Challenge card", "Regel-Karten": "Rule cards", "Geld-Zähler": "Money counter",
    "Uhrzeit-Chip": "Time chip", "Info-Box": "Info box", "Platzierung": "Placement", "Reisepass-Stempel": "Passport stamp", "Flagge (weht)": "Waving flag",
    "Challenge-Banner": "Challenge banner", "Flaggen-Sammlung": "Flag collection", "Exportieren": "Export", "PNG-Sequenz fertig": "PNG sequence done", "Bilder": "frames",
    "Greenscreen-MP4 fertig": "Green-screen MP4 done", "Dateien": "files", "Links ein Asset wählen oder hinzufügen": "Pick or add an asset on the left", "Duplizieren": "Duplicate" });

  return {
    add, list: () => list, ready, exportAsset, types: TYPES, draw: DRAW, select: id => { sel = id; start = performance.now(); render(); },
    get: () => list.map(x => Object.assign({}, x)),
    set: arr => { list = (arr || []).map(x => Object.assign({}, x)); counter = list.reduce((m, x) => Math.max(m, x.id), 0); sel = list.length ? list[0].id : null; render(); }
  };
})();
