"use strict";
/* =========================================================
   Intro-Titelkarten: kleine animierte Einstiege in den ersten Sekunden,
   aufs Overlay gezeichnet (→ automatisch im MP4).
   Stile: stamp (Reisepass-Stempel knallt rein), boarding (Bordkarte
   schiebt sich hoch), coords (Koordinaten tippen sich, dann Ortsname),
   spaced (gesperrter Titel baut sich Buchstabe für Buchstabe auf),
   chapter (Kinobalken öffnen sich, große Tag-Nummer).
   Tipp: „Start halten“ (Übergänge) so lang wie das Intro, dann wartet die Linie.
   ========================================================= */
const INTRO = (() => {
  const $ = id => document.getElementById(id);
  let lastT = null;
  const clamp = x => Math.min(Math.max(x, 0), 1);
  const easeOut = x => 1 - Math.pow(1 - x, 3);
  const backOut = x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const F = (px, w = 900, fam = "'Archivo Black','Arial Black',Impact,sans-serif") => w + " " + px + "px " + fam;
  const MONO = "'SF Mono','Courier New',monospace";
  function rr(g, x, y, w, h, r){ g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  function stops(){ const r = routes[0]; return r ? r.waypoints.filter(w => w.name) : []; }
  function title(){ const t = val("introTitle").trim(); if (t) return t; const s = stops(); return s.length ? s[s.length - 1].name : "LOS GEHT'S"; }
  function sub(){ return val("introSub").trim(); }
  const code = n => (n || "").normalize("NFD").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "???";
  // Routenfarbe als Akzent – zu dunkle Farben (z. B. Pastell-Look) werden durch Rot ersetzt
  const accent = () => { const c = (routes[0] && routes[0].color) || "#e3262b", m = /^#?([0-9a-f]{6})$/i.exec(c); if (!m) return c;
    const n = parseInt(m[1], 16), L = (0.2126 * (n >> 16) + 0.7152 * (n >> 8 & 255) + 0.0722 * (n & 255)) / 255; return L < 0.3 ? "#d9302c" : c; };

  const STYLES = {
    stamp(g, W, H, k, out){
      const u = Math.min(W, H), T = title().toUpperCase(), S = sub() || new Date().toLocaleDateString("de-DE");
      const s = 1 + 1.4 * Math.pow(1 - clamp(k / 0.22), 3), a = clamp(k / 0.12) * out;
      const shake = k > 0.22 && k < 0.34 ? Math.sin(k * 160) * u * 0.006 * (0.34 - k) / 0.12 : 0;
      g.save(); g.globalAlpha = a; g.translate(W / 2 + shake, H * 0.45); g.rotate(-0.12); g.scale(s, s);
      g.font = F(Math.round(u * 0.09)); const tw = Math.min(g.measureText(T).width, W * 0.8), w = tw + u * 0.12, h = u * 0.24;
      const col = accent();
      g.fillStyle = "rgba(250,246,238,0.88)"; rr(g, -w / 2, -h / 2, w, h, u * 0.03); g.fill();
      g.strokeStyle = col; g.fillStyle = col; g.lineWidth = u * 0.008; rr(g, -w / 2, -h / 2, w, h, u * 0.03); g.stroke();
      g.lineWidth = u * 0.003; rr(g, -w / 2 + u * 0.014, -h / 2 + u * 0.014, w - u * 0.028, h - u * 0.028, u * 0.02); g.stroke();
      g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(T, 0, -h * 0.08, W * 0.8);
      g.font = F(Math.round(u * 0.03), 700, MONO); g.fillText("✦ " + S.toUpperCase() + " ✦", 0, h * 0.28);
      g.restore();
    },
    boarding(g, W, H, k, out){
      const u = Math.min(W, H), s = stops(), A = s[0] ? s[0].name : "START", B = s.length > 1 ? s[s.length - 1].name : title();
      const w = Math.min(W * 0.86, u * 1.1), h = u * 0.42, x = (W - w) / 2;
      const y = H * 0.5 - h / 2 + (1 - easeOut(clamp(k / 0.3))) * H * 0.6 - (1 - out) * H * 0.7;
      g.save(); g.shadowColor = "rgba(0,0,0,.4)"; g.shadowBlur = u * 0.04; g.fillStyle = "#fbf8f2"; rr(g, x, y, w, h, u * 0.03); g.fill(); g.restore();
      const col = accent(); g.fillStyle = col; rr(g, x, y, w, h * 0.2, u * 0.03); g.fill(); g.fillRect(x, y + h * 0.1, w, h * 0.1);
      g.fillStyle = "#fff"; g.font = F(Math.round(u * 0.032), 800); g.textBaseline = "middle"; g.textAlign = "left";
      g.fillText("BOARDING PASS", x + u * 0.04, y + h * 0.1); g.textAlign = "right"; g.fillText(sub() || "TAG 1", x + w - u * 0.04, y + h * 0.1);
      const cy = y + h * 0.5; g.fillStyle = "#15171c"; g.font = F(Math.round(u * 0.12)); g.textAlign = "left"; g.fillText(code(A), x + u * 0.05, cy);
      g.textAlign = "right"; g.fillText(code(B), x + w - u * 0.05, cy);
      g.font = F(Math.round(u * 0.026), 700); g.fillStyle = "rgba(20,22,28,.6)"; g.textAlign = "left"; g.fillText(A.toUpperCase(), x + u * 0.05, cy + u * 0.085, w * 0.4);
      g.textAlign = "right"; g.fillText(B.toUpperCase(), x + w - u * 0.05, cy + u * 0.085, w * 0.4);
      const pk = easeOut(clamp((k - 0.3) / 0.35)), x0 = x + w * 0.36, x1 = x + w * 0.64;            // Flugzeug fliegt von A nach B
      g.strokeStyle = "rgba(20,22,28,.3)"; g.setLineDash([u * 0.01, u * 0.01]); g.lineWidth = u * 0.004; g.beginPath(); g.moveTo(x0, cy); g.lineTo(x1, cy); g.stroke(); g.setLineDash([]);
      g.fillStyle = col; g.font = F(Math.round(u * 0.05), 400, "sans-serif"); g.textAlign = "center"; g.fillText("✈", x0 + (x1 - x0) * pk, cy);
      g.setLineDash([u * 0.012, u * 0.012]); g.strokeStyle = "rgba(20,22,28,.25)"; g.beginPath(); g.moveTo(x + u * 0.04, y + h * 0.8); g.lineTo(x + w - u * 0.04, y + h * 0.8); g.stroke(); g.setLineDash([]);
      g.fillStyle = "rgba(20,22,28,.75)"; g.font = F(Math.round(u * 0.024), 700, MONO); g.textAlign = "left"; g.fillText(new Date().toLocaleDateString("de-DE"), x + u * 0.05, y + h * 0.9);
      g.textAlign = "right"; g.fillText("SEAT 1A · GATE ✦", x + w - u * 0.05, y + h * 0.9);
    },
    coords(g, W, H, k, out){
      const u = Math.min(W, H), s = stops(), wp = s[s.length - 1] || { lat: 0, lng: 0 };
      const C = Math.abs(wp.lat).toFixed(4) + "° " + (wp.lat >= 0 ? "N" : "S") + "   " + Math.abs(wp.lng).toFixed(4) + "° " + (wp.lng >= 0 ? "E" : "W");
      const n = Math.floor(clamp(k / 0.4) * C.length), T = title().toUpperCase();
      g.save(); g.globalAlpha = out; g.textAlign = "center"; g.textBaseline = "middle";
      g.shadowColor = "rgba(0,0,0,.6)"; g.shadowBlur = u * 0.02;
      g.fillStyle = "#ffffff"; g.font = F(Math.round(u * 0.04), 700, MONO);
      g.fillText(C.slice(0, n) + (k < 0.45 && Math.floor(k * 12) % 2 ? "▍" : " "), W / 2, H * 0.42);
      const tk = clamp((k - 0.42) / 0.25);
      if (tk > 0){
        g.globalAlpha = out * tk; g.font = F(Math.round(u * 0.12)); g.save(); g.translate(W / 2, H * 0.52); g.scale(0.9 + 0.1 * easeOut(tk), 0.9 + 0.1 * easeOut(tk)); g.fillText(T, 0, 0, W * 0.9); g.restore();
        if (sub()){ g.font = F(Math.round(u * 0.035), 700); g.fillStyle = accent(); g.fillText(sub().toUpperCase(), W / 2, H * 0.6); }
      }
      // Fadenkreuz in der Mitte
      g.globalAlpha = out * 0.8; g.strokeStyle = "#fff"; g.lineWidth = u * 0.003; const r = u * 0.05 * (2 - easeOut(clamp(k / 0.4)));
      g.beginPath(); g.arc(W / 2, H * 0.3, r, 0, Math.PI * 2); g.moveTo(W / 2 - r * 1.5, H * 0.3); g.lineTo(W / 2 + r * 1.5, H * 0.3); g.moveTo(W / 2, H * 0.3 - r * 1.5); g.lineTo(W / 2, H * 0.3 + r * 1.5); g.stroke();
      g.restore();
    },
    spaced(g, W, H, k, out){
      const u = Math.min(W, H), T = title().toUpperCase(), n = T.length;
      g.save(); g.globalAlpha = out; g.textBaseline = "middle"; g.shadowColor = "rgba(0,0,0,.5)"; g.shadowBlur = u * 0.025;
      let px = Math.round(u * 0.11); g.font = F(px);
      const sp = px * 0.45; let tw = 0; for (const ch of T) tw += g.measureText(ch).width + sp; tw -= sp;
      if (tw > W * 0.9){ px = Math.round(px * W * 0.9 / tw); g.font = F(px); tw = W * 0.9; }
      const sp2 = px * 0.45; let x = (W - tw) / 2;
      [...T].forEach((ch, i) => {
        const kk = clamp((k - i * 0.35 / n) / 0.2); const w = g.measureText(ch).width;
        g.globalAlpha = out * kk; g.fillStyle = "#ffffff"; g.fillText(ch, x, H * 0.47 + (1 - easeOut(kk)) * px * 0.5); x += w + sp2;
      });
      const lk = easeOut(clamp((k - 0.35) / 0.3)); g.globalAlpha = out; g.fillStyle = accent();
      g.fillRect(W / 2 - tw / 2 * lk, H * 0.47 + px * 0.7, tw * lk, Math.max(3, u * 0.006));
      if (sub()){ g.globalAlpha = out * lk; g.font = F(Math.round(u * 0.032), 700); g.textAlign = "center"; g.fillStyle = "#fff"; g.fillText(sub().toUpperCase().split("").join(" "), W / 2, H * 0.47 + px * 1.25); }
      g.restore();
    },
    chapter(g, W, H, k, out){
      const u = Math.min(W, H), open = easeOut(clamp((k - 0.55) / 0.4)), bar = H * 0.5 * (1 - open);
      g.save(); g.fillStyle = "#0b0b0d"; g.fillRect(0, 0, W, bar); g.fillRect(0, H - bar, W, bar);
      const a = clamp(k / 0.15) * (1 - clamp((k - 0.5) / 0.15));
      if (a > 0){
        g.globalAlpha = a; g.textAlign = "center"; g.textBaseline = "middle";
        const S = sub() || "KAPITEL 1", T = title().toUpperCase();
        g.fillStyle = accent(); g.font = F(Math.round(u * 0.035), 800); g.fillText(S.toUpperCase().split("").join(" "), W / 2, H * 0.42);
        g.fillStyle = "#fff"; g.font = F(Math.round(u * 0.11)); g.save(); g.translate(W / 2, H * 0.51); const sc = backOut(clamp(k / 0.25)); g.scale(sc, sc); g.fillText(T, 0, 0, W * 0.9); g.restore();
      }
      g.restore();
    }
  };

  function draw(){
    if (!checked("introOn") || lastT == null) return;
    const dur = Math.max(0.8, num("introDur") || 2.8);
    if (lastT > dur) return;
    const c = $("ovl"), g = c.getContext("2d"), W = c.width, H = c.height;
    const k = lastT / dur, out = 1 - clamp((lastT - (dur - 0.45)) / 0.45);
    const st = val("introStyle"), fn = STYLES[st] || STYLES.stamp;
    if (st !== "chapter"){ g.save(); g.fillStyle = "rgba(0,0,0," + (0.35 * out * clamp(lastT / 0.3)).toFixed(3) + ")"; g.fillRect(0, 0, W, H); g.restore(); }
    fn(g, W, H, k, out);
  }

  const baseRA = renderAt;
  window.renderAt = renderAt = function (t, live){ lastT = stopmoT(t); baseRA(t, live); };
  const baseDS = drawStatic;
  window.drawStatic = drawStatic = async function (){ await baseDS(); if (playheadT <= 0.01) lastT = null; drawOverlay(); };
  const baseDO = drawOverlay;
  window.drawOverlay = drawOverlay = function (){ baseDO(); try { draw(); } catch (e) { console.warn("Intro:", e); } };

  ["introOn", "introStyle", "introTitle", "introSub", "introDur"].forEach(id => $(id).addEventListener("input", () => {
    if (id === "introOn" || id === "introStyle"){ if (anim) setPlayhead(Math.min(num("introDur") * 0.6, timelineTotal()), true); }
    else drawOverlay();
  }));
  $("introHoldBtn").addEventListener("click", async () => { $("introHold").value = num("introDur"); await drawStatic(); setStatus(tr("Linie wartet jetzt bis zum Ende des Intros.")); });

  Object.assign(EN, { "Linie wartet jetzt bis zum Ende des Intros.": "Line now waits until the intro ends." });
  return { styles: Object.keys(STYLES), draw };
})();
