"use strict";
/* =========================================================
   Vorlagen (komplette Looks) + Tempo-Vorlagen (Länge & Gefühl)
   Eine Vorlage setzt Stil, Linie, Spitze, Kamera, Tempo und Format –
   die Orte bleiben erhalten.
   ========================================================= */
const TEMPLATES = [
  { id: "kamel", name: "Vlog-Recap", sub: "Kamelfamilie-Look · 9:16", icon: "🐪", bg: ["#e7b9a3", "#5b78c2"],
    set: { mapStyle: "atlas", lineColor: "#e3262b", lineWidth: 7, lineStyle: "solid", lineCasing: true, glow: false,
           tipStyle: "stop", pinStyle: "dot", popStyle: "pop", camMode: "follow", zoom: 4.6, pitch: 0, rotSpeed: 0,
           ovOn: true, ovPrefix: "TAG #", ovPos: "top", endOverview: true, resolution: "1080x1920", travelMode: "car" },
    tempo: { len: 30, feel: "rasant" } },
  { id: "sw70", name: "3D-Relief-Erklärer", sub: "70-Sekunden-Wiki-Look · Snap-Zooms", icon: "⛰️", bg: ["#97a3b9", "#121d38"],
    set: { mapStyle: "relief", lineColor: "#dc2828", lineWidth: 7, lineStyle: "solid", lineCasing: false, glow: false,
           tipStyle: "dot", pinStyle: "dot", pinFont: "display", labelSize: 18, terrain3d: true, terrainEx: 12,
           resolution: "1080x1920", travelMode: "fly" },
    cam: "snap70", tempo: { len: 15, feel: "normal" } },
  { id: "roadtrip", name: "Roadtrip 3D", sub: "Folgekamera, geneigt · 16:9", icon: "🚗", bg: ["#f7f4ee", "#d6e4ee"],
    set: { mapStyle: "minimal", lineColor: "#e4472f", lineWidth: 6, lineStyle: "solid", lineCasing: true, glow: false,
           tipStyle: "model3d", tipScale: 1, pinStyle: "photo", camMode: "follow", zoom: 8, pitch: 40, smooth: 0.7,
           endOverview: true, resolution: "1920x1080", travelMode: "car" },
    tempo: { len: 0, feel: "normal" } },
  { id: "world", name: "Weltreise", sub: "Flüge im Bogen · Atlas", icon: "✈️", bg: ["#f3d2bf", "#5b78c2"],
    set: { mapStyle: "atlas", lineColor: "#ffffff", lineWidth: 5.5, lineStyle: "solid", lineCasing: false, glow: false,
           tipStyle: "model3d", pinStyle: "badge", camMode: "follow", zoom: 5.4, pitch: 25, smooth: 0.75,
           endOverview: true, resolution: "1920x1080", travelMode: "fly" },
    tempo: { len: 30, feel: "normal" } },
  { id: "hike", name: "Bergtour", sub: "Wandern · 3D-Berge · Drohne", icon: "🥾", bg: ["#8e9bb3", "#46557a"],
    set: { mapStyle: "relief", lineColor: "#ff5a3c", lineWidth: 6.5, lineStyle: "solid", lineCasing: true,
           tipStyle: "model3d", pinStyle: "photo", camMode: "follow", zoom: 12, pitch: 55, terrain3d: true, terrainEx: 1.8,
           resolution: "1080x1920", travelMode: "foot" },
    cam: "drone", tempo: { len: 30, feel: "gemuetlich" } },
  { id: "bike", name: "Radreise", sub: "Fahrrad · weiße Kontur", icon: "🚲", bg: ["#e5e8da", "#d6e4ee"],
    set: { mapStyle: "minimal", lineColor: "#2b7de9", lineWidth: 6, lineStyle: "solid", lineCasing: true,
           tipStyle: "model3d", pinStyle: "badge", camMode: "follow", zoom: 9.5, pitch: 30,
           resolution: "1920x1080", travelMode: "bike" },
    tempo: { len: 0, feel: "gemuetlich" } },
  { id: "rail", name: "Interrail", sub: "Zug durch Europa", icon: "🚆", bg: ["#f3eee5", "#c6dbe8"],
    set: { mapStyle: "hell", lineColor: "#6d2e38", lineWidth: 6, lineStyle: "solid", lineCasing: false,
           tipStyle: "model3d", pinStyle: "badge", camMode: "follow", zoom: 6.4, pitch: 20,
           resolution: "1080x1920", travelMode: "train" },
    tempo: { len: 30, feel: "normal" } },
  { id: "island", name: "Inselhopping", sub: "Fähre & Boot", icon: "⛴️", bg: ["#f3eee5", "#7fb2d6"],
    set: { mapStyle: "hell", lineColor: "#1f6fb2", lineWidth: 6, lineStyle: "solid", lineCasing: true,
           tipStyle: "model3d", pinStyle: "photo", camMode: "follow", zoom: 8, pitch: 35,
           resolution: "1080x1920", travelMode: "ferry" },
    tempo: { len: 30, feel: "gemuetlich" } },
  { id: "race", name: "Race Night", sub: "Dunkel, Glow, schnell", icon: "🏁", bg: ["#1d1e22", "#303a46"],
    set: { mapStyle: "dunkel", lineColor: "#f2506e", lineWidth: 5.5, lineStyle: "solid", lineCasing: false, glow: true,
           tipStyle: "dot", pinStyle: "dot", legEase: "linear", resolution: "1920x1080", travelMode: "car" },
    cam: "cine", tempo: { len: 15, feel: "rasant" } },
  { id: "drone", name: "Satellit-Drohne", sub: "Luftbild, Kamerafahrt", icon: "🛰️", bg: ["#3f5530", "#1d3550"],
    set: { mapStyle: "satellit", lineColor: "#ffd23f", lineWidth: 6, lineStyle: "solid", lineCasing: false, glow: true,
           tipStyle: "model3d", pinStyle: "photo", resolution: "1920x1080" },
    cam: "drone", tempo: { len: 0, feel: "gemuetlich" } },
  { id: "explain", name: "Länder-Erklärer", sub: "Übersicht, Länder leuchten · 9:16", icon: "🗺️", bg: ["#d9a390", "#5b78c2"],
    set: { mapStyle: "atlas", lineColor: "#e3262b", lineWidth: 7, lineStyle: "dashed", lineCasing: true,
           tipStyle: "mode", pinStyle: "dot", camMode: "overview", pitch: 0, hlLine: true, hlOp: 0.7,
           resolution: "1080x1920" },
    tempo: { len: 15, feel: "normal" } },
  { id: "clean", name: "Clean & Minimal", sub: "Ruhig, gestrichelt · 1:1", icon: "◻️", bg: ["#f7f4ee", "#d6e4ee"],
    set: { mapStyle: "minimal", lineColor: "#3a6fb0", lineWidth: 4.5, lineStyle: "dashed", lineCasing: false, glow: false,
           tipStyle: "dot", pinStyle: "badge", camMode: "overview", pitch: 0, resolution: "1080x1080" },
    tempo: { len: 0, feel: "gemuetlich" } }
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
    const job = chain.then(async () => { queued = null; await baseDraw(); await fit(); });
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
    tracks.pos = []; tracks.zoom = []; tracks.bearing = []; tracks.pitch = [];
    for (const [k, v] of Object.entries(s)) if (k !== "mapStyle") setv(k, v);
    $("resolution").dispatchEvent(new Event("change"));
    $("travelMode").dispatchEvent(new Event("change"));
    applyTerrain();
    if (tpl.tempo) await applyTempo(tpl.tempo.len, tpl.tempo.feel); else await drawStatic();
    if (tpl.cam && anim){ setv("camPreset", tpl.cam); $("camPreset").dispatchEvent(new Event("change")); }
    renderTimeline(); changed();
    document.querySelectorAll(".tpl").forEach(b => b.classList.toggle("active", b.dataset.id === tpl.id));
    setv("tplId", tpl.id);
    setStatus(tr("Vorlage") + " „" + tpl.name + "“ " + (anim ? "" : "– " + tr("jetzt Orte hinzufügen")));
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
