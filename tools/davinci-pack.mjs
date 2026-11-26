// Baut das DaVinci-Resolve-Paket mit allen Assets aus dem Asset-Studio (ohne Browser-Dialog):
//   node tools/davinci-pack.mjs                       → dist/DaVinci-Paket/ (16:9 + 9:16, 30 fps)
//   node tools/davinci-pack.mjs --only 16x9 --fps 25 --brand "#14b8a6"
//   node tools/davinci-pack.mjs --install             → zusätzlich direkt in DaVincis Templates-Ordner kopieren
// Inhalt: Templates/Edit/Titles/Mapanimator/…        (16:9: alle Asset-Typen als Titel + 6 bearbeitbare Text-Titel)
//         Templates/Edit/Titles/Mapanimator-9x16/…   (Hochformat-Varianten)
// Jede Grafik ist eine PNG-Sequenz mit Transparenz + .setting (Fusion-Titel mit Loader und Position/Größe/Drehung).
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const OUT = path.resolve((opt("--out") || path.join(ROOT, "dist", "DaVinci-Paket")).replace(/^~/, os.homedir()));
const FPS = opt("--fps") || "30", BRAND = opt("--brand") || "#ff5a36", ONLY = opt("--only");
const FORMATS = [["1920x1080", "Mapanimator", "16x9"], ["1080x1920", "Mapanimator-9x16", "9x16"]].filter(f => !ONLY || ONLY.split(",").includes(f[2]));
const TEMPLATES = path.join(os.homedir(), "Library/Application Support/Blackmagic Design/DaVinci Resolve/Fusion/Templates");

const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()){ res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": p.endsWith(".html") ? "text/html" : "application/octet-stream" }); fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, r));
const browser = await chromium.launch({ channel: "chrome", args: ["--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on("pageerror", e => console.log("  Seitenfehler:", e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
await page.waitForFunction(() => typeof ASSETS !== "undefined" && typeof DAVINCI !== "undefined" && typeof mapReady !== "undefined" && mapReady, null, { timeout: 60000 });
await page.evaluate(([fps, brand]) => { document.getElementById("expFps").value = fps; document.getElementById("asBrand").value = brand; }, [FPS, BRAND]);

fs.rmSync(path.join(OUT, "Templates"), { recursive: true, force: true });
const write = (name, buf) => { const p = path.join(OUT, "Templates", name); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, buf); };
const types = await page.evaluate(() => Object.entries(ASSETS.types).map(([k, t]) => [k, t.name]));
let nFiles = 0, nBytes = 0; const t0 = Date.now();

// bearbeitbare Text-Titel (auflösungsunabhängig)
for (const f of await page.evaluate(() => DAVINCI.textFiles().map(f => ({ name: f.name, txt: new TextDecoder().decode(f.data) })))){ write(f.name, f.txt); nFiles++; }

for (const [size, folder, tag] of FORMATS){
  console.log(`\n${tag} (${size}, ${FPS} fps) → Titles/${folder}`);
  for (const [type, label] of types){
    process.stdout.write(`  ${label.padEnd(28)} `);
    const files = await page.evaluate(async ([type, size, folder]) => {
      const fl = await DAVINCI.exportAsset(ASSETS.make(type), { collect: true, size, folder });
      const toB64 = u8 => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(",")[1]); fr.readAsDataURL(new Blob([u8])); });
      return Promise.all(fl.map(async f => ({ name: f.name, b64: await toB64(f.data) })));
    }, [type, size, folder]);
    let bytes = 0; for (const f of files){ const buf = Buffer.from(f.b64, "base64"); write(f.name, buf); bytes += buf.length; }
    nFiles += files.length; nBytes += bytes;
    console.log(`${String(files.length - 1).padStart(4)} Bilder  ${(bytes / 1048576).toFixed(1).padStart(6)} MB`);
  }
}
await browser.close(); server.close();

fs.writeFileSync(path.join(OUT, "INSTALLIEREN.txt"), `Mapanimator – Assets für DaVinci Resolve
==========================================

Installieren (einmalig):
  1. DaVinci Resolve schließen.
  2. Den Ordner  Templates/Edit/Titles/Mapanimator  (und Mapanimator-9x16) kopieren nach:
     ~/Library/Application Support/Blackmagic Design/DaVinci Resolve/Fusion/Templates/Edit/Titles/
     (im Finder: Gehe zu → Gehe zum Ordner … → Pfad einfügen; Ordner „Edit/Titles“ anlegen, falls er fehlt)
     oder im Projektordner:  node tools/davinci-pack.mjs --install
  3. DaVinci starten → Edit-Seite → Effects → Titles → „Mapanimator“ (16:9) bzw. „Mapanimator-9x16“.

Benutzen:
  • Titel auf eine Spur über dein Video ziehen. Länge = Länge der Animation.
  • Inspector → Settings: Position, Größe, Drehung.
  • „MA …“-Titel (Kapitel-Chip, Uhrzeit-Chip, Info-Box, Geld-Pille, Challenge-Karte, Neues Land) sind komplett
    bearbeitbar: Text, Schrift, Farben, Box-Größe.
  • Alle anderen sind fertige Animationen mit Beispieltexten. Eigene Texte/Länder: im Mapanimator (Tab Assets)
    ändern und „→ DaVinci-Titel“ klicken – landet im selben Ordner.
  • Ohne Installation: die Unterordner mit den PNG-Bildern einfach in den Media Pool ziehen
    (DaVinci erkennt sie als Bildsequenz mit Transparenz).

Erstellt: ${new Date().toLocaleString("de-DE")} · ${FPS} fps · Hausfarbe ${BRAND}
`);
console.log(`\nFertig: ${nFiles} Dateien, ${(nBytes / 1048576).toFixed(0)} MB in ${((Date.now() - t0) / 1000).toFixed(0)} s → ${OUT}`);

if (args.includes("--install")){
  const dst = path.join(TEMPLATES, "Edit", "Titles"); fs.mkdirSync(dst, { recursive: true });
  for (const [, folder] of [["", "Mapanimator"], ...FORMATS.map(f => ["", f[1]])].filter((v, i, a) => a.findIndex(x => x[1] === v[1]) === i)){
    const src = path.join(OUT, "Templates", "Edit", "Titles", folder); if (!fs.existsSync(src)) continue;
    fs.rmSync(path.join(dst, folder), { recursive: true, force: true });
    execFileSync("ditto", [src, path.join(dst, folder)]);
    console.log("Installiert:", path.join(dst, folder));
  }
  console.log("DaVinci neu starten → Effects → Titles → Mapanimator");
}
