"use strict";
/* =========================================================
   Skript-API: window.MA  (kompatibel zu window.RK aus reliefkarte.html)
     await MA.load(plan)          Plan anwenden (ersetzt das Projekt)
     await MA.render(opts)        framegenaues MP4; opts.bundle → <name>_bundle.json (MP4 base64 + Positionen),
                                  opts.base64 → { mp4: base64, pos, … } zurückgeben (für tools/render.mjs)
     await MA.still(t)            Einzelbild (JPEG-DataURL) inkl. Overlay
     MA.applyAt(t), MA.camAt(t), MA.points(t), MA.state(), MA.plan, MA.map
   Plan-Felder (alle optional):
     name, w, h, fps, dur
     look: "relief" (Look-ID) | style: "atlas" (Kartenstil) | settings: { <Einstellungs-ID>: Wert }
     route: { color, stops: [{ name, c:[lon,lat], mode, speed }] }   oder routes: [ … ]
     camera: "flyover" (Preset-ID) | shots: [ … ] | keys: [{ t, c, z, b, p, e }] (wie Reliefkarte)
     tempo: { len, feel }, exaggeration (3D-Terrain)
     highlight: ["DEU"], hlIn: [t0, t1], marks: [{ iso | search | geom, name, color, fx, t0, t1 }]
     layers: [{ id, url | data, bbox, where, clipTo, width, color, appear:[t0,t1], hiWhere, hiAt, hiColor }]
     labels: [{ text, c, style, … }], signs: [{ type, text, c, show, pause, photo }]
     points: { Name: [lon, lat] }  → Bildschirmposition je Frame im Export
     scenes: [plan, plan, …]       → mehrere Szenen, gerendert in ein Video
   ========================================================= */
(() => {
  const $ = id => document.getElementById(id);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let PLAN = null, defaults = null;
  const EASE = { snap: "snap", out: "easeOut", in: "easeIn", linear: "linear", smooth: "quadInOut" };

  const ready = () => new Promise(r => { const k = () => (typeof mapReady !== "undefined" && mapReady) ? r() : setTimeout(k, 100); k(); });
  ready().then(() => { defaults = JSON.stringify(serializeProject()); });

  function setv(id, v){
    const el = $(id); if (!el) return;
    if (el.tagName === "SELECT" && ![...el.options].some(o => o.value === String(v))){
      const o = document.createElement("option"); o.value = v; o.textContent = String(v).replace("x", " × "); el.appendChild(o);
    }
    if (el.type === "checkbox") el.checked = !!v; else el.value = v;
  }
  const ll = o => Array.isArray(o) ? o : o && o.c ? o.c : o && o.lng != null ? [o.lng, o.lat] : o && o.lon != null ? [o.lon, o.lat] : null;

  /* ---------- Reliefkarte-Linienebenen → Markierungen ---------- */
  async function lineLayer(ly){
    let fc = ly.data;
    if (!fc && ly.url) fc = await (await fetch(ly.url)).json();
    if (!fc) return;
    let feats = fc.features || [];
    if (ly.bbox){ const [x0, y0, x1, y1] = ly.bbox; feats = feats.filter(f => { const b = geomBounds(f.geometry); return b && b[1][0] >= x0 && b[0][0] <= x1 && b[1][1] >= y0 && b[0][1] <= y1; }); }
    if (ly.where){ const fn = new Function("p", "return (" + ly.where + ");"); feats = feats.filter(f => { try { return fn(f.properties || {}); } catch { return false; } }); }
    if (ly.clipTo){
      const j = await MARKS.countries(), c = j.features.find(f => f.properties.ADM0_A3 === ly.clipTo);
      if (c) feats = feats.filter(f => { const g = f.geometry, cs = g.type === "LineString" ? g.coordinates : g.type === "MultiLineString" ? g.coordinates.flat() : [];
        return cs.length && MARKS.inGeom(cs[Math.floor(cs.length / 2)], c.geometry, c._bb); });
    }
    const multi = fs => ({ type: "MultiLineString", coordinates: fs.flatMap(f => f.geometry.type === "LineString" ? [f.geometry.coordinates] : f.geometry.type === "MultiLineString" ? f.geometry.coordinates : []) });
    const [a0, a1] = ly.appear || [0, 0];
    MARKS.add(ly.id || "Linien", multi(feats), { color: ly.color || "#0a56c8", stroke: ly.color || "#0a56c8", width: ly.width || 3.4, t0: a0, drawDur: Math.max(a1 - a0, 0.05),
      t1: ly.show ? ly.show[1] : null, fx: { draw: a1 > a0, glow: false, shadow: ly.casing !== false, pulse: false, focus: false, extrude: false } });
    if (ly.hiWhere){
      const [k, v] = ly.hiWhere, hi = feats.filter(f => (f.properties || {})[k] === v);
      for (const [x, y] of ly.hiAt || [[a0, null]])
        MARKS.add((ly.id || "Linien") + " " + v, multi(hi), { color: ly.hiColor || "#dc2828", stroke: ly.hiColor || "#dc2828", width: (ly.width || 3.4) * 1.4, t0: x, t1: y,
          fx: { draw: false, glow: true, shadow: false, pulse: false, focus: false, extrude: false } });
    }
  }

  /* ---------- Plan anwenden ---------- */
  async function applyPlan(P){
    PLAN = P;
    // Format
    if (P.w && P.h) setv("resolution", P.w + "x" + P.h);
    else if (P.keys) setv("resolution", "1080x1920");          // Reliefkarte-Standard
    if (P.fps) setv("expFps", P.fps);
    $("resolution").dispatchEvent(new Event("change"));
    // Look / Stil
    const rkPlan = P.keys && typeof P.look !== "string" && !P.style;          // Plan aus reliefkarte.html
    const lookId = typeof P.look === "string" ? P.look : (rkPlan ? "relief" : null);
    if (rkPlan){ setv("dtLabels", false); }
    if (lookId){ const t = MA_TEMPLATES.list.find(x => x.id === lookId); if (t) await MA_TEMPLATES.applyTemplate(t); }
    if (rkPlan){ ["rgMtn", "rgLand", "rgSea"].forEach(id => setv(id, false)); await swapStyle(); }   // ohne Beschriftung neu aufbauen
    if (P.style && P.style !== val("mapStyle")){ setv("mapStyle", P.style); $("mapStyle").dispatchEvent(new Event("change")); await sleep(30); await styleBusy; }
    for (const [k, v] of Object.entries(P.settings || {})) setv(k, v);
    if (P.exaggeration != null){ setv("terrain3d", P.exaggeration > 0); setv("terrainEx", P.exaggeration); applyTerrain(); }
    if (P.dur) setv("totalDur", P.dur);
    // Routen
    const rs = P.routes || (P.route ? [P.route] : []);
    routes = [];
    rs.forEach((r, i) => {
      const rt = newRoute(r.name || "Route " + (i + 1), r.color || (rs.length === 1 ? val("lineColor") : PALETTE[i % PALETTE.length]));
      rt.tipLabel = r.tipLabel || "";
      for (const s of r.stops || []){ const c = ll(s); if (!c) continue;
        rt.waypoints.push({ id: ++wpCounter, name: s.name || "", lat: c[1], lng: c[0], color: s.color || rt.color, mode: s.mode || "", speed: s.speed || 1, photo: null }); }
      routes.push(rt);
    });
    if (!routes.length) routes.push(newRoute("Route 1", PALETTE[0]));
    activeRoute = 0;
    syncRouteInputs(); renderRoutes(); renderWpList();
    if (P.tempo) await MA_TEMPLATES.applyTempo(P.tempo.len ?? 0, P.tempo.feel || "normal"); else await drawStatic();
    if (P.dur){ setv("totalDur", P.dur); await drawStatic(); }
    // Markierungen
    const hlOp = P.look && typeof P.look === "object" && P.look.hlOpacity != null ? P.look.hlOpacity : 0.66;   // Reliefkarte-Standard
    const hlIn = P.hlIn || [0, 0];
    for (const iso of P.highlight || [])
      await MARKS.addCountry(iso, { color: (P.look && P.look.hlFill) || "#86ccff", fillOp: hlOp, width: 6, t0: hlIn[0], drawDur: Math.max(hlIn[1] - hlIn[0], 0.05),
        fx: { draw: hlIn[1] > hlIn[0], glow: false, shadow: true, pulse: false, focus: false, extrude: false } });
    for (const m of P.marks || []){
      const opt = Object.assign({}, m, { fx: Object.assign({ draw: true, glow: true, shadow: true, pulse: false, focus: false, extrude: false }, m.fx || {}) });
      if (m.iso) await MARKS.addCountry(m.iso, opt);
      else if (m.geom) MARKS.add(m.name || "Markierung", m.geom, opt);
      else if (m.search){ const r = await (await fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&polygon_geojson=1&polygon_threshold=0.003&accept-language=de&q=" + encodeURIComponent(m.search))).json();
        if (r[0] && r[0].geojson) MARKS.add(m.name || r[0].display_name.split(",")[0], r[0].geojson, opt); }
    }
    for (const ly of P.layers || []) await lineLayer(ly);
    // Labels & Schilder
    for (const l of P.labels || []){ const c = ll(l); if (c) LABELS.add(l.text || "", c, Object.assign({}, l, { lngLat: c })); }
    for (const sg of P.signs || []){
      const c = ll(sg); if (!c) continue;
      let img = null, src = null;
      if (sg.photo){ img = await new Promise(r => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => r(i); i.onerror = () => r(null); i.src = sg.photo; }); src = img ? sg.photo : null; }
      SIGNS.add(Object.assign({ type: img ? "photo" : "pin" }, sg, { lngLat: c, img, src }));
    }
    await drawStatic();
    // Kamera
    tracks.pos = []; tracks.zoom = []; tracks.bearing = []; tracks.pitch = [];
    if (P.keys && P.keys.length){
      let last = { c: [10, 51], z: 5, b: 0, p: 45 };
      for (const k of P.keys){
        const n = Object.assign({}, last, k), e = EASE[k.e] || (k === P.keys[0] ? "linear" : "quadInOut");
        tracks.pos.push({ t: n.t, lng: n.c[0], lat: n.c[1], follow: false, ease: e });
        tracks.zoom.push({ t: n.t, v: n.z, ease: e }); tracks.bearing.push({ t: n.t, v: n.b, ease: e }); tracks.pitch.push({ t: n.t, v: n.p, ease: e });
        last = n;
      }
    } else if (P.shots) CAM.set(P.shots);
    else if (P.camera){ const pr = CAM.presets.find(x => x.id === P.camera); if (pr) await CAM.applyPreset(pr); if (P.dur){ setv("totalDur", P.dur); await drawStatic(); } }
    if (P.whip){ setv("whipIn", P.whip === true || P.whip === "in" || P.whip === "both"); setv("whipOut", P.whip === true || P.whip === "out" || P.whip === "both"); }
    renderTimeline();
    await ensureAnim();
    setPlayhead(0, true);
    await waitIdle(20000);
  }

  async function load(plan){
    await ready();
    if (typeof plan === "string") plan = JSON.parse(plan);
    if (!defaults) defaults = JSON.stringify(serializeProject());
    await SCENES.loadAll(JSON.parse(defaults));          // sauberer Ausgangszustand
    const list = Array.isArray(plan.scenes) && plan.scenes.length ? plan.scenes.map(s => Object.assign({}, plan, { scenes: undefined }, s)) : [plan];
    for (let i = 0; i < list.length; i++){
      if (i > 0) await SCENES.addScene(false);
      await applyPlan(list[i]);
    }
    if (list.length > 1) await SCENES.switchTo(0);
    PLAN = plan;
    setStatus("Plan „" + (plan.name || "ohne Namen") + "“ geladen (" + list.length + " " + (list.length > 1 ? "Szenen" : "Szene") + ").");
    return true;
  }

  function points(){
    const o = {};
    for (const [k, c] of Object.entries((PLAN && PLAN.points) || {})){ const p = map.project(c); o[k] = [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]; }
    return o;
  }
  const b64 = blob => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(",")[1]); fr.readAsDataURL(blob); });
  async function render(opts = {}){
    const name = (PLAN && PLAN.name) || "karte";
    const res = await exportMP4({ download: !opts.bundle && !opts.base64, points: (PLAN && PLAN.points) || {}, wantPos: true, allScenes: true, name });
    if (!res) throw new Error("Nichts zu rendern (Route oder Dauer fehlt).");
    const meta = { name, fps: res.fps, w: res.w, h: res.h, n: res.frames, pos: res.pos, err: res.err };
    if (opts.base64) return Object.assign(meta, { mp4: await b64(res.blob) });
    if (opts.bundle){
      const j = new Blob([JSON.stringify(Object.assign(meta, { mp4: await b64(res.blob) }))], { type: "application/json" });
      dl(j, name + "_bundle.json");
    }
    return `Fertig: ${res.frames} Frames, ${(res.blob.size / 1e6).toFixed(1)} MB` + (res.err ? " FEHLER " + res.err : "");
  }
  async function still(t){
    setPlayhead(t, true); await waitIdle();
    const mc = map.getCanvas(), c = document.createElement("canvas"); c.width = mc.width; c.height = mc.height;
    const g = c.getContext("2d"); g.drawImage(mc, 0, 0); g.drawImage($("ovl"), 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.85);
  }
  function camAt(t){ setPlayhead(t, true); const c = map.getCenter(); return { c: [c.lng, c.lat], z: map.getZoom(), b: map.getBearing(), p: map.getPitch() }; }

  window.MA = {
    load, render, still, points, camAt,
    applyAt: t => setPlayhead(t, true),
    state: () => SCENES.serializeAll(),
    loadProject: p => SCENES.loadAll(p),
    run: s => (0, eval)(s),
    get map(){ return map; }, get plan(){ return PLAN; }, ready
  };
  window.RK = window.RK || window.MA;          // alte Skripte für reliefkarte.html laufen weiter

  // index.html?plan=<URL> lädt einen Plan direkt
  const q = new URLSearchParams(location.search).get("plan");
  if (q) ready().then(() => fetch(q)).then(r => r.json()).then(load).catch(e => setStatus("Plan-Fehler: " + e.message));
})();
