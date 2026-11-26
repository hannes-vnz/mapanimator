// Rendert Pläne ohne Klicken: startet Chrome (Playwright), lädt index.html, ruft MA.load(plan) + MA.render().
//   node tools/render.mjs plan.json                → <name>.mp4 + <name>_pos.json im Ordner renders/
//   node tools/render.mjs ab_plans.json --only m1,m3 --out ~/Kartenvideos/out
// Plan-Datei: ein Plan-Objekt, ein Array von Plänen oder { P: { id: plan }, PTS: { Name: [lon,lat] } } (Reliefkarte-Format).
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const file = args.find(a => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--only" && args[args.indexOf(a) - 1] !== "--out");
if (!file){ console.log("Aufruf: node tools/render.mjs <plan.json> [--only id1,id2] [--out ordner] [--show]"); process.exit(1); }
const outDir = path.resolve((opt("--out") || "renders").replace(/^~/, os.homedir()));
fs.mkdirSync(outDir, { recursive: true });

const raw = JSON.parse(fs.readFileSync(path.resolve(file.replace(/^~/, os.homedir())), "utf8"));
let plans;
if (raw.P) plans = Object.entries(raw.P).map(([id, p]) => Object.assign({ name: id, points: raw.PTS || {} }, p, { _id: id }));
else plans = (Array.isArray(raw) ? raw : [raw]).map((p, i) => Object.assign({ _id: p.name || "plan" + (i + 1) }, p));
const only = opt("--only");
if (only){ const ids = only.split(","); plans = plans.filter(p => ids.includes(p._id) || ids.includes(p.name)); }

const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()){ res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": p.endsWith(".html") ? "text/html" : "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, r));
let browser;
try { browser = await chromium.launch({ channel: "chrome", headless: !args.includes("--show"), args: ["--enable-gpu", "--ignore-gpu-blocklist"] }); }
catch { browser = await chromium.launch({ headless: !args.includes("--show") }); }
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on("pageerror", e => console.log("  JS-Fehler:", e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
await page.waitForFunction(() => window.MA && typeof mapReady !== "undefined" && mapReady, null, { timeout: 60000 });

for (const plan of plans){
  const t0 = Date.now();
  process.stdout.write(`▶ ${plan._id} … `);
  const { _id, ...clean } = plan;
  await page.evaluate(p => MA.load(p), clean);
  const r = await page.evaluate(() => MA.render({ base64: true }));
  const name = r.name || _id;
  fs.writeFileSync(path.join(outDir, name + ".mp4"), Buffer.from(r.mp4, "base64"));
  fs.writeFileSync(path.join(outDir, name + "_pos.json"), JSON.stringify({ name, fps: r.fps, w: r.w, h: r.h, n: r.n, pos: r.pos }));
  console.log(`${r.n} Frames, ${(r.mp4.length * 0.75 / 1e6).toFixed(1)} MB, ${((Date.now() - t0) / 1000).toFixed(0)} s${r.err ? " FEHLER " + r.err : ""}`);
}
await browser.close();
server.close();
console.log("Fertig →", outDir);
