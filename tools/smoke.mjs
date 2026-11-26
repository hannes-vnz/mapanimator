// Smoke-Test: lädt die gebaute index.html, schaltet alle Themes durch,
// rendert 1 s MP4 und schlägt fehl, sobald ein JS-Fehler auftritt.
//   npm test            (baut vorher)
//   node tools/smoke.mjs [datei.html]
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = process.argv[2] || "index.html";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };

const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()){ res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, r));
const url = `http://127.0.0.1:${server.address().port}/${FILE}`;

let browser;
try { browser = await chromium.launch({ channel: "chrome", args: ["--enable-gpu", "--ignore-gpu-blocklist"] }); }
catch { browser = await chromium.launch(); }
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on("pageerror", e => errors.push("pageerror: " + e.message));
page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|net::/.test(m.text())) errors.push("console: " + m.text()); });

const step = async (name, fn) => {
  const t0 = Date.now();
  const before = errors.length;
  const out = await fn();
  const ok = errors.length === before;
  console.log(`${ok ? "✔" : "✘"} ${name} (${((Date.now() - t0) / 1000).toFixed(1)} s)${out ? " – " + out : ""}`);
  if (!ok) errors.slice(before).forEach(e => console.log("    " + e));
};

try {
  await page.goto(url);
  await step("Seite laden", async () => {
    await page.waitForFunction(() => window.mapReady === true || (typeof mapReady !== "undefined" && mapReady), null, { timeout: 30000 });
  });
  await step("Route anlegen", () => page.evaluate(async () => {
    addWaypoint("München", 48.137, 11.575); addWaypoint("Wien", 48.208, 16.372); addWaypoint("Venedig", 45.44, 12.33);
    await drawStatic();
  }));
  await step("Verkehrsmittel pro Etappe", () => page.evaluate(async () => {
    addWaypoint("Split", 43.508, 16.44); addWaypoint("Tunis", 36.8, 10.18);
    const w = R().waypoints; w[2].mode = "bus"; w[3].mode = "ferry"; w[4].mode = "fly";
    renderWpList(); await drawStatic();
    const p = anim.per[0], modes = p.legs.map(l => l.mode).join(",");
    if (p.legs.length !== 4 || !/bus,ferry,fly$/.test(modes)) throw new Error("Etappen falsch: " + modes);
    if (document.querySelectorAll(".legsel").length !== 4) throw new Error("Anreise-Auswahl fehlt");
    return modes;
  }));
  await step("3D-Modell + Symbol-Spitze", () => page.evaluate(async () => {
    const leg = anim.per[0].segs.filter(s => s.type === "leg")[3];
    for (const ts of ["model3d", "mode"]){
      document.getElementById("tipStyle").value = ts; await drawStatic();
      setPlayhead((leg.t0 + leg.t1) / 2, true); await waitIdle(15000);
    }
    if (!map.getLayer("tip-3d")) throw new Error("3D-Ebene fehlt");
    if (!map.hasImage("tipmode-fly-" + routes[0].id)) throw new Error("Symbol fehlt");
    document.getElementById("tipStyle").value = "model3d";
    return "ok";
  }));
  await step("Looks", () => page.evaluate(async () => {
    for (const t of MA_TEMPLATES.list){
      await MA_TEMPLATES.applyTemplate(t);
      if (!anim) throw new Error(t.id + ": keine Animation");
      if (val("mapStyle") !== t.set.mapStyle) throw new Error(t.id + ": Stil " + val("mapStyle"));
    }
    return MA_TEMPLATES.list.length + " Looks";
  }));
  await step("Kamera-Presets + Tempo", () => page.evaluate(async () => {
    for (const pr of CAM.presets){
      await CAM.applyPreset(pr);
      const T = timelineTotal();
      if (pr.tempo.len && Math.abs(T - pr.tempo.len) > 0.6) throw new Error(pr.id + ": Länge " + T.toFixed(1));
      setPlayhead(T * 0.5, true);
      if (!pr.keyframes){
        const c = CAM.at(T * 0.5);
        if (Math.abs(map.getZoom() - c.z) > 0.05 || Math.abs(map.getPitch() - Math.min(c.p, 85)) > 0.5) throw new Error(pr.id + ": Kamera nicht angewendet");
      }
    }
    await CAM.applyPreset(CAM.presets[0]);
    return CAM.presets.length + " Presets";
  }));
  const themes = await page.evaluate(() => [...document.getElementById("mapStyle").options].map(o => o.value));
  for (const th of themes){
    await step("Theme " + th, () => page.evaluate(async th => {
      const sel = document.getElementById("mapStyle");
      sel.value = th; sel.dispatchEvent(new Event("change"));
      await new Promise(r => setTimeout(r, 1500));
      await waitIdle(15000);
      return map.getStyle().layers.length + " Layer";
    }, th));
  }
  await step("Markierungen", () => page.evaluate(async () => {
    await MARKS.routeCountries();
    await MARKS.pickAt({ lng: 2.35, lat: 48.85 });
    const L = MARKS.list();
    if (L.length < 3) throw new Error("zu wenige Markierungen: " + L.length);
    L[0].fx.focus = true; L[1].fx.extrude = true; L[1].fx.pulse = true;
    setPlayhead(timelineTotal() * 0.6, true); await waitIdle(15000);
    if (!map.getLayer("mk1-fill") || document.querySelectorAll(".mbar").length !== L.length) throw new Error("Ebenen/Balken fehlen");
    return L.map(m => m.name).join(", ");
  }));
  await step("Labels (alle Stile) + Speichern/Laden", () => page.evaluate(async () => {
    LABELS.fromMarks(); await LABELS.distances();
    for (const st of ["pill", "callout", "marker", "spaced", "plain"]) LABELS.add("Test " + st, [12, 47], { style: st, t0: 0, anim: st === "plain" ? "type" : "pop" });
    setPlayhead(timelineTotal() * 0.8, true);
    const c = document.getElementById("ovl"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let n = 0; for (let i = 3; i < d.length; i += 400) if (d[i] > 0) n++;
    if (!n) throw new Error("Overlay leer");
    const saved = LABELS.get(); LABELS.set(saved);
    if (LABELS.list().length !== saved.length) throw new Error("Laden verliert Labels");
    return saved.length + " Labels";
  }));
  await step("Schilder + Fotos + Halt", () => page.evaluate(async () => {
    const c = document.createElement("canvas"); c.width = 200; c.height = 150; c.getContext("2d").fillRect(0, 0, 200, 150);
    const src = c.toDataURL("image/jpeg");
    const img = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; });
    const p = anim.per[0], mid = p.coords[Math.round(p.coords.length * 0.3)];
    SIGNS.add({ type: "photo", img, src, text: "Foto", lngLat: mid, show: "passHide", pause: 2 });
    for (const ty of ["pin", "tent", "hotel", "flag", "star", "view"]) SIGNS.add({ type: ty, text: ty, lngLat: mid, show: "always" });
    await drawStatic();
    if (!anim.per[0].segs.some(s => s.sign)) throw new Error("Halt fehlt");
    const [a] = SIGNS.windowOf(SIGNS.list()[0]); setPlayhead(a + 0.7, true);
    const saved = SIGNS.get(); await SIGNS.set(saved);
    if (SIGNS.list().length !== saved.length || !SIGNS.list()[0].img) throw new Error("Laden verliert Schilder/Fotos");
    return SIGNS.list().length + " Schilder";
  }));
  await step("Avatar an der Spitze", () => page.evaluate(async () => {
    const c = document.createElement("canvas"); c.width = 120; c.height = 120; c.getContext("2d").fillRect(0, 0, 120, 120);
    routes[0].tipPhoto = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = c.toDataURL(); });
    document.getElementById("tipStyle").value = "avatar"; await drawStatic();
    setPlayhead(timelineTotal() * 0.5, true);
    if (!map.hasImage("tipavatar-" + routes[0].id)) throw new Error("Avatar-Bild fehlt");
    if (map.getPaintProperty("tip-pin", "icon-opacity") !== 1) throw new Error("Avatar unsichtbar");
    routes[0].tipPhoto = null; await updateTipPin();
    document.getElementById("tipStyle").value = "model3d";
    return "ok";
  }));
  await step("Regionslabels", () => page.evaluate(async () => {
    ["rgMtn", "rgLand", "rgSea"].forEach(id => document.getElementById(id).checked = true);
    await REGIONS.apply();
    map.jumpTo({ center: [10, 42], zoom: 3.5 }); await waitIdle(15000);
    const vis = map.queryRenderedFeatures().filter(f => f.layer.id.startsWith("rg")).map(f => f.properties.de);
    if (!vis.includes("ALPEN")) throw new Error("ALPEN fehlt: " + vis.join(","));
    return vis.length + " sichtbar";
  }));
  await step("Szenen (wechseln, speichern/laden)", () => page.evaluate(async () => {
    const n0 = R().waypoints.length;
    await SCENES.addScene(false);
    if (R().waypoints.length !== 0) throw new Error("neue Szene nicht leer");
    addWaypoint("Rom", 41.9, 12.5); addWaypoint("Neapel", 40.85, 14.27); await drawStatic();
    await SCENES.switchTo(0);
    if (R().waypoints.length !== n0) throw new Error("Szene 1 verloren");
    const saved = SCENES.serializeAll();
    await SCENES.loadAll(JSON.parse(JSON.stringify(saved)));
    await SCENES.switchTo(1);
    if (R().waypoints.map(w => w.name).join() !== "Rom,Neapel") throw new Error("Szene 2 nach Laden falsch");
    await SCENES.switchTo(0);
    return SCENES.count() + " Szenen";
  }));
  await step("Whip-Pan (Kamera + Unschärfe)", () => page.evaluate(async () => {
    document.getElementById("whipIn").checked = true;
    const a = CAM.at(0.05).c, b = CAM.at(0.6).c;
    if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) < 1e-4) throw new Error("kein Schwenk");
    if (CAM.whipBlurPx(0.05, 30) < 20) throw new Error("keine Unschärfe");
    return "ok";
  }));
  await step("Skript-API (Reliefkarte-Plan + eigener Plan)", () => page.evaluate(async () => {
    await MA.load({ name: "rk", dur: 1, fps: 25, keys: [{ t: 0, c: [10.35, 51.05], z: 5.4, b: -4, p: 50 }, { t: 1, z: 5.6, e: "linear" }], highlight: ["DEU"], points: { Berlin: [13.4, 52.52] } });
    const r1 = await MA.render({ base64: true });
    if (r1.n !== 25 || !r1.pos[0].Berlin) throw new Error("RK-Plan: " + r1.n + " Frames");
    await MA.load({ name: "ma", w: 1080, h: 1080, fps: 25, look: "vlog", camera: "navi", tempo: { len: 1, feel: "rasant" },
      route: { stops: [{ name: "München", c: [11.575, 48.137] }, { name: "Wien", c: [16.372, 48.208], mode: "train" }] },
      labels: [{ text: "Hallo", c: [13, 48], style: "pill" }] });
    const r2 = await MA.render({ base64: true });
    if (r2.n < 20 || r2.w !== 1080 || r2.h !== 1080) throw new Error("MA-Plan: " + r2.n + " Frames " + r2.w + "x" + r2.h);
    return r1.n + " + " + r2.n + " Frames";
  }));
  await step("MP4 1 s rendern", () => page.evaluate(async () => {
    let got = null;
    window.dl = (b, n) => { if (!got) got = { n, size: b.size }; };
    document.getElementById("totalDur").value = 1;
    document.getElementById("totalDur").dispatchEvent(new Event("change"));
    document.getElementById("resolution").value = "1080x1920";
    document.getElementById("expFps").value = "25";
    document.getElementById("mp4Btn").click();
    const t0 = Date.now();
    while (!got && Date.now() - t0 < 120000) await new Promise(r => setTimeout(r, 250));
    if (!got) throw new Error("kein MP4 erzeugt: " + document.getElementById("status").textContent);
    if (got.size < 10000) throw new Error("MP4 zu klein: " + got.size);
    return got.n + ", " + (got.size / 1e6).toFixed(1) + " MB";
  }));
} catch (e){
  errors.push("Testabbruch: " + e.message);
  console.log("✘ " + e.message);
} finally {
  await browser.close();
  server.close();
}
if (errors.length){ console.log(`\n${errors.length} Fehler`); process.exit(1); }
console.log("\nAlles grün.");
