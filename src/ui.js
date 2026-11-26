"use strict";
/* =========================================================
   Oberflächen-Logik (läuft nach app.js)
   Schritte/Tabs, Bottom-Sheet (mobil), Format-Buttons, Safe-Zone,
   Theme-Kacheln, Regler mit Wertanzeige, Tastenkürzel
   ========================================================= */
(() => {
  const $ = id => document.getElementById(id);
  const body = document.body;
  const mobile = () => matchMedia("(max-width:860px)").matches;

  Object.assign(EN, {
    "Route": "Route", "Karte": "Map", "Ebenen": "Layers", "Kamera": "Camera", "Export": "Export",
    "Speichern": "Save", "Laden": "Load", "Exportieren": "Export",
    "Linie & Tempo": "Line & timing", "Pins & Spitze": "Pins & tip", "Karten-Stil": "Map style",
    "3D-Terrain": "3D terrain", "Länder hervorheben": "Highlight countries", "Zähler-Overlay": "Counter overlay",
    "Land": "Land", "Wasser": "Water", "Grenzen": "Borders", "Labels": "Labels"
  });

  /* ---------- Schritte / Tabs ---------- */
  const tabs = [...document.querySelectorAll("#tabs button")];
  function openTab(name, toggle){
    const btn = tabs.find(b => b.dataset.tab === name);
    if (!btn) return;
    if (toggle && mobile() && btn.classList.contains("active") && body.classList.contains("sheet-open")){
      body.classList.remove("sheet-open"); return;
    }
    tabs.forEach(b => { b.classList.toggle("active", b === btn); b.setAttribute("aria-selected", b === btn); });
    document.querySelectorAll(".pane").forEach(p => p.classList.toggle("active", p.dataset.pane === name));
    $("panels").scrollTop = 0;
    if (mobile()) body.classList.add("sheet-open");
    try { localStorage.setItem("ma.tab", name); } catch {}
  }
  tabs.forEach(b => b.addEventListener("click", () => openTab(b.dataset.tab, true)));
  try { const t = localStorage.getItem("ma.tab"); if (t) openTab(t); } catch {}
  body.classList.remove("sheet-open");

  /* Bottom-Sheet nach unten wegziehen */
  const grab = document.querySelector(".sheet-grab"), sheet = $("sidebar");
  let y0 = null;
  grab.addEventListener("pointerdown", e => { y0 = e.clientY; grab.setPointerCapture(e.pointerId); sheet.style.transition = "none"; });
  grab.addEventListener("pointermove", e => { if (y0 != null) sheet.style.transform = "translateY(" + Math.max(0, e.clientY - y0) + "px)"; });
  const endDrag = e => {
    if (y0 == null) return;
    const dy = e.clientY - y0; y0 = null;
    sheet.style.transition = ""; sheet.style.transform = "";
    if (dy > 70) body.classList.remove("sheet-open");
  };
  grab.addEventListener("pointerup", endDrag);
  grab.addEventListener("pointercancel", endDrag);
  $("exportTop").addEventListener("click", () => openTab("export"));

  /* ---------- Format + Vorschau im Exportformat ---------- */
  const resSel = $("resolution");
  function syncFormat(){
    const [w, h] = resSel.value.split("x").map(Number);
    const r = w / h;
    document.querySelectorAll("#formatBar button").forEach(b => {
      const [bw, bh] = b.dataset.res.split("x").map(Number);
      b.classList.toggle("active", Math.abs(bw / bh - r) < 0.01);
    });
  }
  document.querySelectorAll("#formatBar button").forEach(b => b.addEventListener("click", () => {
    const [bw, bh] = b.dataset.res.split("x").map(Number);
    const [w, h] = resSel.value.split("x").map(Number);
    if (Math.abs(bw / bh - w / h) < 0.01) return;
    resSel.value = b.dataset.res;
    resSel.dispatchEvent(new Event("change"));
  }));
  resSel.addEventListener("change", () => { syncFormat(); if (!stageLock) sizeStage(null); });
  syncFormat();
  let roRaf = 0;
  new ResizeObserver(() => { cancelAnimationFrame(roRaf); roRaf = requestAnimationFrame(() => { if (!stageLock) sizeStage(null); renderTimeline(); }); }).observe($("stage"));

  $("safeBtn").addEventListener("click", () => {
    const on = body.classList.toggle("safe");
    $("safeBtn").setAttribute("aria-pressed", on);
  });

  /* ---------- Projekt-Buttons oben ---------- */
  $("projSaveTop").addEventListener("click", () => $("projSave").click());
  $("projLoadTop").addEventListener("change", e => {
    if (!e.target.files.length) return;
    $("projLoad").files = e.target.files;
    $("projLoad").dispatchEvent(new Event("change"));
  });
  // nach Projekt-Laden Format/Regler/Theme aktualisieren
  $("projLoad").addEventListener("change", () => setTimeout(() => { syncFormat(); syncRanges(); syncThemes(); sizeStage(null); }, 300));

  /* ---------- Timeline ein-/ausklappen ---------- */
  $("tlToggle").addEventListener("click", () => {
    const c = $("timeline").classList.toggle("collapsed");
    $("tlToggle").textContent = c ? "▴" : "▾";
  });

  /* ---------- Regler mit Wertanzeige ---------- */
  const ranges = [...document.querySelectorAll(".setting input[type=range]")];
  function fmt(r){ const s = parseFloat(r.step) || 1; return (+r.value).toFixed(s < 0.1 ? 2 : s < 1 ? 1 : 0); }
  function paint(r, out){
    const p = (r.value - r.min) / (r.max - r.min) * 100;
    r.style.setProperty("--p", p + "%");
    out.textContent = fmt(r);
  }
  ranges.forEach(r => {
    const wrap = document.createElement("span"); wrap.className = "rangewrap";
    const out = document.createElement("output");
    r.replaceWith(wrap); wrap.append(r, out);
    r._out = out; paint(r, out);
    r.addEventListener("input", () => paint(r, out));
    r.addEventListener("change", () => paint(r, out));
  });
  function syncRanges(){ ranges.forEach(r => paint(r, r._out)); }

  /* ---------- Theme-Kacheln ---------- */
  const styleSel = $("mapStyle"), grid = $("themeGrid");
  const preview = {
    hell: ["#f3eee5", "#c6dbe8"], relief: ["#97a3b9", "#e6ebf3"], atlas: ["#e7b9a3", "#5b78c2"],
    dunkel: ["#1d1e22", "#303a46"], satellit: ["#4d5a3a", "#1d3550"], vintage: ["#e9dcbc", "#a9c3c1"], minimal: ["#f7f4ee", "#d6e4ee"]
  };
  [...styleSel.options].forEach(o => {
    const t = THEMES[o.value] || {}, [land, water] = preview[o.value] || [t.bg || "#888", t.water || "#567"];
    const b = document.createElement("button");
    b.type = "button"; b.className = "theme"; b.dataset.v = o.value; b.title = o.text;
    b.innerHTML = '<span class="sw"></span><span class="nm"></span>';
    const sw = b.firstChild;
    sw.style.background = `linear-gradient(135deg, ${land} 0 55%, ${water} 55% 100%)`;
    if (o.value === "relief") sw.style.background = `radial-gradient(circle at 35% 40%, #fff 0, ${land} 35%, #46557a 75%), ${water}`;
    if (o.value === "satellit") sw.style.background = "radial-gradient(circle at 30% 35%, #8a7a4c 0, #3f5530 40%, #1d3550 75%)";
    sw.style.setProperty("--line-c", t.defaultLine || "#e33");
    b.querySelector(".nm").textContent = o.text.replace(/\s*\(.*\)$/, "");
    b.addEventListener("click", () => {
      if (styleSel.value === o.value) return;
      styleSel.value = o.value; styleSel.dispatchEvent(new Event("change")); syncThemes();
    });
    grid.appendChild(b);
  });
  function syncThemes(){ grid.querySelectorAll(".theme").forEach(b => b.classList.toggle("active", b.dataset.v === styleSel.value)); }
  styleSel.addEventListener("change", () => setTimeout(() => { syncThemes(); syncRanges(); }, 0));
  syncThemes();

  /* ---------- Einfach / Profi ---------- */
  const pro = $("proMode");
  try { pro.checked = localStorage.getItem("ma.pro") === "1"; } catch {}
  const applyPro = () => { body.classList.toggle("pro", pro.checked); try { localStorage.setItem("ma.pro", pro.checked ? "1" : "0"); } catch {} renderTimeline(); };
  pro.addEventListener("change", applyPro); applyPro();
  document.addEventListener("ma:settings", () => { syncFormat(); syncRanges(); syncThemes(); });
  $("projLoad").addEventListener("change", () => setTimeout(() => CAM.set(null), 600));

  /* ---------- Tastenkürzel ---------- */
  const order = tabs.map(b => b.dataset.tab);
  document.addEventListener("keydown", e => {
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "select" || tag === "textarea" || e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^[1-9]$/.test(e.key) && order[+e.key - 1]){ openTab(order[+e.key - 1]); e.preventDefault(); }
    else if (e.key === " " || e.code === "Space"){ if (tag === "button") e.target.blur(); $("tlPlay").click(); e.preventDefault(); }
    else if (e.key === "Escape"){ body.classList.remove("sheet-open"); }
  });

  applyLang();
})();
