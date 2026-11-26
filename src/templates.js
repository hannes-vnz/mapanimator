"use strict";
/* =========================================================
   Vorlagen (komplette Looks) + Tempo-Vorlagen (Länge & Gefühl)
   Eine Vorlage setzt Stil, Linie, Spitze, Kamera, Tempo und Format –
   die Orte bleiben erhalten.
   ========================================================= */
const TEMPLATES = [
  { id: "vlog", name: "Vlog-Atlas", sub: "Kamelfamilie: Länder-Töne, rote Linie", icon: "🐪", bg: ["#e7b9a3", "#5b78c2"],
    set: { rgMtn: true, rgLand: false, rgSea: true, mapStyle: "atlas", lineColor: "#e3262b", lineWidth: 7, lineStyle: "solid", lineCasing: true, glow: false,
           tipStyle: "avatar", pinStyle: "dot", popStyle: "pop", pinFont: "display" } },
  { id: "relief", name: "3D-Relief", sub: "70 Sekunden Wiki: Berge, Snap-Look", icon: "⛰️", bg: ["#97a3b9", "#121d38"],
    set: { rgMtn: true, rgLand: true, rgSea: true, mapStyle: "relief", lineColor: "#dc2828", lineWidth: 7, lineStyle: "solid", lineCasing: false, glow: false,
           tipStyle: "dot", pinStyle: "dot", pinFont: "display", labelSize: 18 } },
  { id: "adventure", name: "Abenteuer-Karte", sub: "Indiana-Jones-Stil: Pergament, rote Linie", icon: "🧭", bg: ["#e9dcbc", "#a9c3c1"],
    set: { rgMtn: true, rgLand: true, rgSea: true, mapStyle: "vintage", lineColor: "#c1272d", lineWidth: 6, lineStyle: "solid", lineCasing: false, glow: false,
           tipStyle: "model3d", pinStyle: "dot", pinFont: "serif", labelSize: 16 } },
  { id: "gmaps", name: "Navi-Look", sub: "Google-Maps-Stil: blau mit Kontur", icon: "📍", bg: ["#f7f4ee", "#aecbfa"],
    set: { rgMtn: false, rgLand: false, rgSea: false, mapStyle: "minimal", lineColor: "#1a73e8", lineWidth: 7, lineStyle: "solid", lineCasing: true, glow: false,
           tipStyle: "pin", pinStyle: "badge", pinFont: "system" } },
  { id: "earth", name: "Satellit", sub: "Google-Earth-Stil: Luftbild, gelbe Linie", icon: "🛰️", bg: ["#3f5530", "#1d3550"],
    set: { rgMtn: false, rgLand: false, rgSea: false, mapStyle: "satellit", lineColor: "#ffd23f", lineWidth: 6, lineStyle: "solid", lineCasing: false, glow: true,
           tipStyle: "model3d", pinStyle: "photo" } },
  { id: "sport", name: "Sport-Track", sub: "Strava-Stil: hell, orange", icon: "🏃", bg: ["#f7f4ee", "#e0e7d4"],
    set: { rgMtn: false, rgLand: false, rgSea: false, mapStyle: "minimal", lineColor: "#fc4c02", lineWidth: 6, lineStyle: "solid", lineCasing: true, glow: false,
           tipStyle: "model3d", pinStyle: "badge", pinFont: "display" } },
  { id: "cream", name: "Vlog Hell", sub: "Creme, Weinrot, Foto-Badges", icon: "📸", bg: ["#f3eee5", "#c6dbe8"],
    set: { rgMtn: false, rgLand: false, rgSea: false, mapStyle: "hell", lineColor: "#6d2e38", lineWidth: 5, lineStyle: "solid", lineCasing: false, glow: false,
           tipStyle: "stop", pinStyle: "badge", pinFont: "rounded" } },
  { id: "night", name: "Neon Nacht", sub: "Dunkel, Glow, Race-Look", icon: "🏁", bg: ["#1d1e22", "#303a46"],
    set: { rgMtn: false, rgLand: false, rgSea: false, mapStyle: "dunkel", lineColor: "#f2506e", lineWidth: 5.5, lineStyle: "solid", lineCasing: false, glow: true,
           tipStyle: "dot", pinStyle: "dot", pinFont: "display" } },
  { id: "explain", name: "Erklär-Atlas", sub: "Länder leuchten, gestrichelt", icon: "🗺️", bg: ["#d9a390", "#5b78c2"],
    set: { rgMtn: true, rgLand: false, rgSea: true, mapStyle: "atlas", lineColor: "#ffffff", lineWidth: 6, lineStyle: "dashed", lineCasing: false, glow: false,
           tipStyle: "mode", pinStyle: "dot", hlLine: true, hlOp: 0.7 } },
  { id: "clean", name: "Clean & Minimal", sub: "Ruhig, dünn, blau", icon: "◻️", bg: ["#f7f4ee", "#d6e4ee"],
    set: { rgMtn: false, rgLand: false, rgSea: false, mapStyle: "minimal", lineColor: "#3a6fb0", lineWidth: 4.5, lineStyle: "dashed", lineCasing: false, glow: false,
           tipStyle: "dot", pinStyle: "badge", pinFont: "system" } }
];

/* Tempo: Gefühl = Pausen/Kurven/Kamera, Länge = Zieldauer in Sekunden (0 = aus Etappen) */
const FEELS = {
  gemuetlich: { label: "Gemütlich", pauseDur: 2.2, legEase: "easeInOut", smooth: 0.75, legDur: 5,  popStyle: "soft" },
  normal:     { label: "Normal",    pauseDur: 1.4, legEase: "easeInOut", smooth: 0.6,  legDur: 4,  popStyle: "pop" },
  rasant:     { label: "Rasant",    pauseDur: 0.5, legEase: "quadInOut", smooth: 0.4,  legDur: 2.4, popStyle: "pop" }
};
const LENGTHS = [0, 8, 15, 30, 60];

(() => {
  const $ = id => document.getElementById(id);
  const setv = (id, v) => { const el = $(id); if (!el) return; if (el.type === "checkbox") el.checked = !!v; else el.value = v; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const changed = () => document.dispatchEvent(new Event("ma:settings"));

  Object.assign(EN, {
    "Vorlagen": "Templates", "Tempo": "Pace", "Länge": "Length", "Gemütlich": "Relaxed", "Normal": "Normal", "Rasant": "Fast",
    "Auto": "Auto", "Vorlage": "Template"
  });

  /* ---------- Länge automatisch einpassen ----------
     drawStatic wird serialisiert (parallele Aufrufe würden sich die Animation
     gegenseitig wegnehmen) und passt danach speedMult an die Ziel-Länge an. */
  const baseDraw = drawStatic;
  async function fit(){
    const target = parseFloat(val("tplLen")) || 0;
    if (!target || !anim || tracks.line.length || num("totalDur")) return;
    for (let k = 0; k < 3 && anim && Math.abs(anim.natural - target) > 0.2; k++){
      const sp = Math.min(Math.max((num("speedMult") || 1) * anim.natural / target, 0.1), 8);
      setv("speedMult", Math.round(sp * 1000) / 1000);
      await baseDraw();
    }
  }
  let chain = Promise.resolve(), queued = null;
  window.drawStatic = drawStatic = function (){
    if (queued) return queued;
    const job = chain.then(async () => {
      queued = null; await baseDraw(); await fit();
      if (anim && !playing && !mp4Busy && playheadT > 0.01) renderAt(playheadT, false);   // Vorschau bleibt am Playhead
    });
    queued = job;
    chain = job.catch(() => {});
    return job;
  };

  function applyFeel(name){
    const f = FEELS[name] || FEELS.normal;
    setv("tplFeel", name);
    ["pauseDur", "legEase", "smooth", "legDur", "popStyle"].forEach(k => setv(k, f[k]));
    setv("speedMult", 1);
  }
  async function applyTempo(len, feel){
    if (feel) applyFeel(feel);
    if (len != null){ setv("tplLen", len); setv("totalDur", ""); if (!len) setv("speedMult", 1); }
    syncTempo();
    await drawStatic();
    renderTimeline(); changed();
    const T = timelineTotal();
    setStatus(tr("Tempo") + ": " + tr((FEELS[val("tplFeel")] || FEELS.normal).label) + " · " + T.toFixed(1) + " s");
  }

  /* ---------- Vorlage anwenden ---------- */
  async function applyTemplate(tpl){
    if (playing) pause();
    const s = tpl.set;
    if (s.mapStyle && s.mapStyle !== val("mapStyle")){
      setv("mapStyle", s.mapStyle);
      $("mapStyle").dispatchEvent(new Event("change"));
      await styleBusy;
    }
    for (const [k, v] of Object.entries(s)) if (k !== "mapStyle") setv(k, v);
    applyTerrain();
    if (typeof REGIONS !== "undefined") REGIONS.apply();
    await drawStatic();
    if (anim) renderAt(playheadT, false);
    renderTimeline(); changed();
    document.querySelectorAll(".tpl").forEach(b => b.classList.toggle("active", b.dataset.id === tpl.id));
    setv("tplId", tpl.id);
    setStatus("Look „" + tpl.name + "“" + (anim ? "" : " – " + tr("jetzt Orte hinzufügen")));
  }

  /* ---------- UI ---------- */
  const grid = $("tplGrid");
  TEMPLATES.forEach(tpl => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "tpl"; b.dataset.id = tpl.id;
    b.innerHTML = `<span class="tpl-sw" style="background:linear-gradient(135deg,${tpl.bg[0]} 0 58%,${tpl.bg[1]} 58%)"><i style="--lc:${tpl.set.lineColor}"></i><em>${tpl.icon}</em></span>` +
      `<span class="tpl-tx"><b></b><small></small></span>`;
    b.querySelector("b").textContent = tpl.name;
    b.querySelector("small").textContent = tpl.sub;
    b.addEventListener("click", () => applyTemplate(tpl));
    grid.appendChild(b);
  });
  const cur = val("tplId"); if (cur) grid.querySelectorAll(".tpl").forEach(b => b.classList.toggle("active", b.dataset.id === cur));

  const lenBox = $("tempoLen"), feelBox = $("tempoFeel");
  LENGTHS.forEach(L => {
    const b = document.createElement("button"); b.type = "button"; b.dataset.len = L;
    b.textContent = L ? L + " s" : tr("Auto");
    if (!L) b.className = "i18n";
    b.addEventListener("click", () => applyTempo(L, null));
    lenBox.appendChild(b);
  });
  Object.entries(FEELS).forEach(([k, f]) => {
    const b = document.createElement("button"); b.type = "button"; b.dataset.feel = k; b.className = "i18n";
    b.textContent = f.label;
    b.addEventListener("click", () => applyTempo(null, k));
    feelBox.appendChild(b);
  });
  function syncTempo(){
    const L = String(parseFloat(val("tplLen")) || 0), F = val("tplFeel") || "normal";
    lenBox.querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.len === L));
    feelBox.querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.feel === F));
  }
  syncTempo();
  $("projLoad").addEventListener("change", () => setTimeout(() => {
    syncTempo();
    const id = val("tplId"); grid.querySelectorAll(".tpl").forEach(b => b.classList.toggle("active", b.dataset.id === id));
  }, 400));

  window.MA_TEMPLATES = { applyTemplate, applyTempo, list: TEMPLATES };
})();
