// Baut das native DaVinci-Paket (Fusion-Titel, voll bearbeitbar) als Mapanimator.drfx.
//   node tools/davinci-native.mjs                 → dist/Mapanimator.drfx (+ Prüfung mit DaVincis Parser)
//   node tools/davinci-native.mjs --install-test  → zusätzlich Test-Skript nach DaVinci (Arbeitsbereich → Skripte → Mapanimator Test)
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ALL } from "./fusion/titles.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist"), STAGE = path.join(DIST, "drfx-stage"), DIR = path.join(STAGE, "Edit", "Titles", "Mapanimator");
const FUSCRIPT = "/Applications/DaVinci Resolve/DaVinci Resolve.app/Contents/Libraries/Fusion/fuscript";
const SCRIPTS = path.join(os.homedir(), "Library/Application Support/Blackmagic Design/DaVinci Resolve/Fusion/Scripts/Utility");

fs.rmSync(STAGE, { recursive: true, force: true }); fs.mkdirSync(DIR, { recursive: true });
const names = [];
for (const fn of ALL){ const [label, txt] = fn(); fs.writeFileSync(path.join(DIR, label + ".setting"), txt); names.push(label); }
console.log(names.length + " Titel:", names.join(", "));

// Prüfen mit DaVincis eigenem Parser (offline, ohne laufendes Resolve)
if (fs.existsSync(FUSCRIPT)){
  const lua = path.join(DIST, "check.lua");
  fs.writeFileSync(lua, `local bad = {}\n` + names.map(n => `if not bmd.readfile([[${path.join(DIR, n + ".setting")}]]) then table.insert(bad, [[${n}]]) end`).join("\n") + `\nprint("PARSER " .. (#bad == 0 and "OK" or ("FEHLER: " .. table.concat(bad, ", "))))\nos.exit(0)\n`);
  try { const out = execFileSync(FUSCRIPT, ["-l", "lua", lua], { timeout: 20000 }).toString(); console.log(out.split("\n").filter(l => l.startsWith("PARSER")).join("\n")); }
  catch (e){ const out = String(e.stdout || ""); console.log(out.split("\n").filter(l => l.startsWith("PARSER")).join("\n") || "Parser-Prüfung nicht möglich"); }
}

// .drfx = ZIP mit Edit/Titles/…
const drfx = path.join(DIST, "Mapanimator.drfx"); fs.rmSync(drfx, { force: true });
execFileSync("zip", ["-r", "-q", drfx, "Edit"], { cwd: STAGE });
console.log("Paket:", drfx, Math.round(fs.statSync(drfx).size / 1024) + " KB");

// Test-Skript für DaVinci (läuft in der kostenlosen Version aus dem Menü Arbeitsbereich → Skripte)
const OUT = path.join(DIST, "test-render");
const test = `-- Mapanimator Test: legt im AKTUELLEN Projekt eine neue Timeline mit allen Mapanimator-Titeln an und rendert ein Prüfvideo.
-- Deine bestehenden Timelines bleiben unverändert. Die Test-Timeline kannst du danach löschen.
local resolve = Resolve()
local proj = resolve:GetProjectManager():GetCurrentProject()
if not proj then print("Kein Projekt geöffnet") return end
local mp = proj:GetMediaPool()
local tl = mp:CreateEmptyTimeline("Mapanimator Test " .. os.date("%H-%M-%S"))
if not tl then print("Timeline konnte nicht angelegt werden") return end
proj:SetCurrentTimeline(tl)
local names = { ${names.map(n => `"${n}"`).join(", ")} }
local log = {}
for _, n in ipairs(names) do
  local item = tl:InsertFusionTitleIntoTimeline(n)
  table.insert(log, n .. ": " .. (item and "ok" or "FEHLT"))
end
local f = io.open([[${OUT}/log.txt]], "w"); if f then f:write(table.concat(log, "\\n")) f:close() end
proj:SetCurrentRenderFormatAndCodec("mp4", "H264")
proj:SetRenderSettings({ SelectAllFrames = true, TargetDir = [[${OUT}]], CustomName = "mapanimator_test", FormatWidth = 1920, FormatHeight = 1080 })
proj:AddRenderJob()
proj:StartRendering()
print("Mapanimator Test: rendere nach ${OUT}")
`;
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(DIST, "Mapanimator Test.lua"), test);
if (process.argv.includes("--install-test")){ fs.mkdirSync(SCRIPTS, { recursive: true }); fs.copyFileSync(path.join(DIST, "Mapanimator Test.lua"), path.join(SCRIPTS, "Mapanimator Test.lua")); console.log("Test-Skript installiert:", path.join(SCRIPTS, "Mapanimator Test.lua")); }
