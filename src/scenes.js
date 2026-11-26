"use strict";
/* =========================================================
   Szenen: mehrere Animationen pro Projekt (wie Baldinger)
   Eine Szene = kompletter Zustand (serializeProject). Die aktive Szene lebt
   in der App, die anderen liegen als JSON in `scenes`. Neue Szenen übernehmen
   die Einstellungen der aktuellen (Look, Kamera-Stil, Tempo), aber ohne Orte.
   Export: „Alle Szenen in einem Video“ rendert sie nacheinander in ein MP4.
   ========================================================= */
const SCENES = (() => {
  const $ = id => document.getElementById(id);
  let scenes = [{ name: "Szene 1", data: null }], active = 0, busy = false;

  const bar = document.createElement("div");
  bar.id = "sceneBar";
  $("main").insertBefore(bar, $("stage"));

  function blankFrom(d){
    const b = JSON.parse(JSON.stringify(d));
    b.routes = [{ name: "Route 1", color: (d.routes && d.routes[0] && d.routes[0].color) || PALETTE[0], tipLabel: "", gpx: null, tipPhoto: null, waypoints: [] }];
    b.tracks = {}; b.features = []; b.pois = []; b.marks = []; b.labels = []; b.signs = [];
    b.cam = [{ t: 0, mode: "follow", zoom: num("zoom"), pitch: 0, bearing: 0, up: "north", look: 0, auto: true }];
    if (b.settings) b.settings.camPresetId = "";
    return b;
  }
  async function switchTo(i){
    if (i === active || busy || !scenes[i]) return;
    busy = true;
    try {
      scenes[active].data = serializeProject();
      const prev = scenes[active].data;
      active = i;
      if (!scenes[i].data) scenes[i].data = blankFrom(prev);
      setStatus(tr("Szene") + " " + (i + 1) + " …");
      await loadProject(scenes[i].data);
      setStatus(tr("Szene") + " „" + scenes[i].name + "“");
    } finally { busy = false; render(); }
  }
  async function addScene(copy){
    if (busy) return;
    const cur = serializeProject();
    scenes[active].data = cur;
    scenes.splice(active + 1, 0, { name: copy ? scenes[active].name + " " + tr("Kopie") : tr("Szene") + " " + (scenes.length + 1),
      data: copy ? JSON.parse(JSON.stringify(cur)) : blankFrom(cur) });
    await switchTo(active + 1);
  }
  async function removeScene(i){
    if (scenes.length < 2 || busy) return;
    if (!confirm(tr("Szene löschen?") + " „" + scenes[i].name + "“")) return;
    const wasActive = i === active;
    scenes.splice(i, 1);
    if (wasActive){ active = -1; const n = Math.max(0, i - 1); active = n; busy = true; try { await loadProject(scenes[n].data); } finally { busy = false; } }
    else if (i < active) active--;
    render();
  }
  function rename(i, el){
    const inp = document.createElement("input");
    inp.className = "screname"; inp.value = scenes[i].name;
    el.replaceWith(inp); inp.focus(); inp.select();
    const done = () => { scenes[i].name = inp.value.trim() || scenes[i].name; render(); };
    inp.addEventListener("blur", done);
    inp.addEventListener("keydown", e => { if (e.key === "Enter") inp.blur(); if (e.key === "Escape"){ inp.value = scenes[i].name; inp.blur(); } });
  }

  function render(){
    bar.innerHTML = "";
    scenes.forEach((sc, i) => {
      const b = document.createElement("div");
      b.className = "scene" + (i === active ? " active" : "");
      b.innerHTML = `<span class="scn">${i + 1}</span><span class="scname"></span>` +
        (i === active ? `<button type="button" class="scact" data-a="dup" title="${tr("Szene duplizieren")}">⧉</button>` +
          (scenes.length > 1 ? `<button type="button" class="scact" data-a="del" title="${tr("Szene löschen")}">✕</button>` : "") : "");
      b.querySelector(".scname").textContent = sc.name;
      b.addEventListener("click", e => { if (e.target.closest(".scact")) return; if (i === active) return; switchTo(i); });
      b.querySelector(".scname").addEventListener("dblclick", e => { if (i === active) rename(i, e.target); });
      const act = a => b.querySelector(`[data-a="${a}"]`);
      if (act("dup")) act("dup").addEventListener("click", () => addScene(true));
      if (act("del")) act("del").addEventListener("click", () => removeScene(i));
      bar.appendChild(b);
    });
    const plus = document.createElement("button");
    plus.type = "button"; plus.className = "scplus"; plus.title = tr("Neue Szene (übernimmt Look und Kamera-Stil)");
    plus.textContent = "＋ " + tr("Szene");
    plus.addEventListener("click", () => addScene(false));
    bar.appendChild(plus);
    const row = $("expAllScenesRow"); if (row) row.hidden = scenes.length < 2;
  }

  async function loadAll(proj){
    if (proj && Array.isArray(proj.scenes) && proj.scenes.length){
      scenes = proj.scenes.map((s, i) => ({ name: s.name || tr("Szene") + " " + (i + 1), data: s.data }));
      active = Math.min(proj.active || 0, scenes.length - 1);
      busy = true;
      try { await loadProject(scenes[active].data); } finally { busy = false; }
    } else {
      scenes = [{ name: tr("Szene") + " 1", data: null }]; active = 0;
      busy = true;
      try { await loadProject(proj); } finally { busy = false; }
    }
    render();
  }
  function serializeAll(){
    scenes[active].data = serializeProject();
    return { version: 6, active, scenes: scenes.map(s => ({ name: s.name, data: s.data })) };
  }

  Object.assign(EN, { "Szene": "Scene", "Szenen": "scenes", "Kopie": "copy", "Szene duplizieren": "Duplicate scene", "Szene löschen": "Delete scene",
    "Szene löschen?": "Delete scene?", "Neue Szene (übernimmt Look und Kamera-Stil)": "New scene (keeps look and camera style)",
    "Alle Szenen in einem Video": "All scenes in one video" });
  render();

  return { switchTo, addScene, loadAll, serializeAll, count: () => scenes.length, active: () => active, list: () => scenes };
})();
