"use strict";
/* =========================================================
   DaVinci-Resolve-Titelpaket (.drfx): Fusion-Titel im Asset-Look, die in DaVinci
   direkt bearbeitbar sind (Text, Schrift, Farben, Position, Größe im Inspector).
   Installation: .drfx doppelklicken oder ins Resolve-Fenster ziehen →
   Edit-Seite → Effects → Titles → „Mapanimator“.
   Aufbau je Titel: Background+Maske (Karte/Pille) + Text+ → Merge → Transform (Einblend-
   Animation, Keyframes ab Bild 0) → Transform (Position/Größe für dich) → Ausgang.
   ========================================================= */
const DAVINCI = (() => {
  const $ = id => document.getElementById(id);
  const n = v => (Math.round(v * 10000) / 10000).toString();
  const rgb = hex => { const x = parseInt(String(hex).replace("#", ""), 16); return [(x >> 16 & 255) / 255, (x >> 8 & 255) / 255, (x & 255) / 255]; };
  const esc = s => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
  let pos = 0; const P = () => "ViewInfo = OperatorInfo { Pos = { " + (pos += 110) + ", 0 } },";

  function rectMask(id, cx, cy, w, h, radius){
    return `${id} = RectangleMask {
				Inputs = {
					Filter = Input { Value = FuID { "Fast Gaussian" }, },
					SoftEdge = Input { Value = 0.0008, },
					MaskWidth = Input { Value = 1920, }, MaskHeight = Input { Value = 1080, },
					PixelAspect = Input { Value = { 1, 1 }, },
					UseFrameFormatSettings = Input { Value = 1, },
					ClippingMode = Input { Value = FuID { "None" }, },
					Center = Input { Value = { ${n(cx)}, ${n(cy)} }, },
					Width = Input { Value = ${n(w)}, }, Height = Input { Value = ${n(h)}, },
					CornerRadius = Input { Value = ${n(radius)}, },
				},
				${P()}
			},`;
  }
  function ellipseMask(id, cx, cy, w, h){
    return `${id} = EllipseMask {
				Inputs = {
					Filter = Input { Value = FuID { "Fast Gaussian" }, },
					SoftEdge = Input { Value = 0.0008, },
					MaskWidth = Input { Value = 1920, }, MaskHeight = Input { Value = 1080, },
					PixelAspect = Input { Value = { 1, 1 }, },
					UseFrameFormatSettings = Input { Value = 1, },
					ClippingMode = Input { Value = FuID { "None" }, },
					Center = Input { Value = { ${n(cx)}, ${n(cy)} }, },
					Width = Input { Value = ${n(w)}, }, Height = Input { Value = ${n(h)}, },
				},
				${P()}
			},`;
  }
  function bg(id, hex, alpha, mask){
    const [r, g, b] = rgb(hex);
    return `${id} = Background {
				Inputs = {
					GlobalOut = Input { Value = 119, },
					Width = Input { Value = 1920, }, Height = Input { Value = 1080, },
					UseFrameFormatSettings = Input { Value = 1, },
					TopLeftRed = Input { Value = ${n(r)}, }, TopLeftGreen = Input { Value = ${n(g)}, }, TopLeftBlue = Input { Value = ${n(b)}, }, TopLeftAlpha = Input { Value = ${n(alpha)}, },
					EffectMask = Input { SourceOp = "${mask}", Source = "Mask", },
				},
				${P()}
			},`;
  }
  function text(id, txt, cx, cy, size, hex, opt = {}){
    const [r, g, b] = rgb(hex);
    return `${id} = TextPlus {
				Inputs = {
					GlobalOut = Input { Value = 119, },
					Width = Input { Value = 1920, }, Height = Input { Value = 1080, },
					UseFrameFormatSettings = Input { Value = 1, },
					StyledText = Input { Value = "${esc(txt)}", },
					Font = Input { Value = "${opt.font || "Avenir Next Condensed"}", },
					Style = Input { Value = "${opt.style || "Heavy"}", },
					Size = Input { Value = ${n(size)}, },
					CharacterSpacing = Input { Value = ${n(opt.spacing || 1)}, },
					Center = Input { Value = { ${n(cx)}, ${n(cy)} }, },
					VerticalJustificationNew = Input { Value = 3, },
					HorizontalJustificationNew = Input { Value = 3, },
					Red1 = Input { Value = ${n(r)}, }, Green1 = Input { Value = ${n(g)}, }, Blue1 = Input { Value = ${n(b)}, },
				},
				${P()}
			},`;
  }
  function merge(id, back, fore){
    return `${id} = Merge {
				Inputs = {
					Background = Input { SourceOp = "${back}", Source = "${back.startsWith("Text") ? "Output" : "Output"}", },
					Foreground = Input { SourceOp = "${fore}", Source = "Output", },
					PerformDepthMerge = Input { Value = 0, },
				},
				${P()}
			},`;
  }
  // Keyframe-Kurve: [[Bild, Wert], …] mit weichen Tangenten
  function spline(id, keys){
    const kf = keys.map(([f, v], i) => {
      const prev = keys[i - 1], next = keys[i + 1], parts = [n(v)];
      if (prev) parts.push(`LH = { ${n(f - (f - prev[0]) / 3)}, ${n(v)} }`);
      if (next) parts.push(`RH = { ${n(f + (next[0] - f) / 3)}, ${n(v)} }`);
      return `[${f}] = { ${parts.join(", ")} }`;
    }).join(",\n\t\t\t\t\t");
    return `${id} = BezierSpline {
				SplineColor = { Red = 225, Green = 0, Blue = 225 },
				NameSet = true,
				KeyFrames = {
					${kf}
				}
			},`;
  }
  function xyPath(id, from, to, frames){
    return `${id} = XYPath {
				ShowKeyPoints = false,
				DrawMode = "ModifyOnly",
				Inputs = {
					X = Input { SourceOp = "${id}X", Source = "Value", },
					Y = Input { SourceOp = "${id}Y", Source = "Value", },
				},
			},
			${spline(id + "X", [[0, from[0]], [frames, to[0]]])}
			${spline(id + "Y", [[0, from[1]], [frames, to[1]]])}`;
  }
  // Animation: "pop" (Größe 0 → 1,08 → 1 um pivot) oder "slide" (von links rein)
  function animTransform(id, input, kind, pivot){
    if (kind === "slide") return `${id} = Transform {
				Inputs = {
					Center = Input { SourceOp = "${id}Path", Source = "Position", },
					Input = Input { SourceOp = "${input}", Source = "Output", },
				},
				${P()}
			},
			${xyPath(id + "Path", [0.3, 0.5], [0.5, 0.5], 9)}`;
    return `${id} = Transform {
				Inputs = {
					Pivot = Input { Value = { ${n(pivot[0])}, ${n(pivot[1])} }, },
					Size = Input { SourceOp = "${id}Size", Source = "Value", },
					Input = Input { SourceOp = "${input}", Source = "Output", },
				},
				${P()}
			},
			${spline(id + "Size", [[0, 0], [8, 1.08], [13, 1]])}`;
  }
  function userTransform(id, input){
    return `${id} = Transform {
				NameSet = true,
				Inputs = {
					Input = Input { SourceOp = "${input}", Source = "Output", },
				},
				${P()}
			},`;
  }
  // Exponierte Regler (InstanceInput)
  const ii = (key, op, src, name, extra = "") => `${key} = InstanceInput { SourceOp = "${op}", Source = "${src}", Name = "${name}",${extra} },`;
  const colorInputs = (k, op, prefix, name, g) => [ii(k + "R", op, prefix === "TopLeft" ? "TopLeftRed" : "Red" + prefix, name, ` ControlGroup = ${g},`),
    ii(k + "G", op, prefix === "TopLeft" ? "TopLeftGreen" : "Green" + prefix, name, ` ControlGroup = ${g},`), ii(k + "B", op, prefix === "TopLeft" ? "TopLeftBlue" : "Blue" + prefix, name, ` ControlGroup = ${g},`)];

  function macro(name, tools, inputs, out){
    return `{
	Tools = ordered() {
		${name} = MacroOperator {
			CtrlWZoom = false,
			NameSet = true,
			Inputs = ordered() {
				${inputs.join("\n\t\t\t\t")}
			},
			Outputs = {
				MainOutput1 = InstanceOutput { SourceOp = "${out}", Source = "Output", },
			},
			ViewInfo = GroupInfo { Pos = { 0, 0 } },
			Tools = ordered() {
			${tools.join("\n\t\t\t")}
			},
		},
	},
	ActiveTool = "${name}"
}
`;
  }

  /* ---------- Titel ---------- */
  function chip(name, label, txt, accent){                     // Kapitel-/Uhrzeit-Chip oben links
    pos = 0;
    const cx = 0.16, cy = 0.9, w = 0.25, h = 0.07;
    const tools = [rectMask("BoxMask", cx, cy, w, h, 0.5), bg("Box", "#0e0f12", 0.78, "BoxMask"),
      ellipseMask("DotMask", cx - w / 2 + 0.028, cy, 0.036, 0.064), bg("Dot", accent, 1, "DotMask"),
      merge("Merge1", "Box", "Dot"), text("Text1", txt, cx + 0.015, cy, 0.042, "#ffffff"), merge("Merge2", "Merge1", "Text1"),
      animTransform("Anim", "Merge2", "slide"), userTransform("Position", "Anim")];
    const inputs = [ii("Input1", "Text1", "StyledText", "Text"), ii("Input2", "Text1", "Font", "Schrift", " ControlGroup = 2,"), ii("Input3", "Text1", "Style", "Schrift", " ControlGroup = 2,"),
      ii("Input4", "Text1", "Size", "Textgröße"), ...colorInputs("Input5", "Dot", "TopLeft", "Punktfarbe", 5), ...colorInputs("Input6", "Box", "TopLeft", "Chipfarbe", 6),
      ii("Input7", "BoxMask", "Width", "Chipbreite"), ii("Input8", "Position", "Center", "Position"), ii("Input9", "Position", "Size", "Größe")];
    return [label, macro(name, tools, inputs, "Position")];
  }
  function info(){
    pos = 0;
    const cx = 0.28, cy = 0.13, w = 0.48, h = 0.13;
    const tools = [rectMask("BoxMask", cx, cy, w, h, 0.12), bg("Box", "#0e0f12", 0.75, "BoxMask"),
      ellipseMask("DotMask", cx - w / 2 + 0.03, cy + 0.025, 0.026, 0.046), bg("Dot", "#ffffff", 1, "DotMask"), merge("Merge1", "Box", "Dot"),
      text("Text1", "Thuốc lào ist eine traditionelle vietnamesische\nArt, Tabak durch eine Wasserpfeife zu rauchen.", cx + 0.02, cy, 0.03, "#ffffff", { font: "Helvetica Neue", style: "Medium" }),
      merge("Merge2", "Merge1", "Text1"), animTransform("Anim", "Merge2", "slide"), userTransform("Position", "Anim")];
    const inputs = [ii("Input1", "Text1", "StyledText", "Text (Enter = neue Zeile)"), ii("Input2", "Text1", "Size", "Textgröße"), ii("Input3", "BoxMask", "Width", "Boxbreite"), ii("Input4", "BoxMask", "Height", "Boxhöhe"),
      ...colorInputs("Input5", "Box", "TopLeft", "Boxfarbe", 5), ii("Input6", "Position", "Center", "Position"), ii("Input7", "Position", "Size", "Größe")];
    return ["MA Info-Box", macro("MA_InfoBox", tools, inputs, "Position")];
  }
  function pill(){                                                // Geld-/Wert-Pille oben Mitte
    pos = 0;
    const cx = 0.5, cy = 0.9, w = 0.2, h = 0.085;
    const tools = [rectMask("BoxMask", cx, cy, w, h, 0.5), bg("Box", "#26272c", 0.95, "BoxMask"), text("Text1", "25,80 €", cx, cy, 0.06, "#ffffff"),
      merge("Merge1", "Box", "Text1"), text("Delta", "+25,80 €", cx + 0.15, cy, 0.035, "#5be37d"), merge("Merge2", "Merge1", "Delta"),
      animTransform("Anim", "Merge2", "pop", [cx, cy]), userTransform("Position", "Anim")];
    const inputs = [ii("Input1", "Text1", "StyledText", "Wert"), ii("Input2", "Delta", "StyledText", "Änderung"), ...colorInputs("Input3", "Delta", "1", "Farbe Änderung", 3),
      ii("Input4", "BoxMask", "Width", "Pillenbreite"), ...colorInputs("Input5", "Box", "TopLeft", "Pillenfarbe", 5), ii("Input6", "Position", "Center", "Position"), ii("Input7", "Position", "Size", "Größe")];
    return ["MA Geld-Pille", macro("MA_GeldPille", tools, inputs, "Position")];
  }
  function challenge(){
    pos = 0;
    const cx = 0.5, cy = 0.5, w = 0.52, h = 0.3;
    const tools = [rectMask("CardMask", cx, cy, w, h, 0.08), bg("Card", "#25262b", 0.97, "CardMask"),
      rectMask("PillMask", cx - w / 2 + 0.085, cy + h / 2 - 0.055, 0.13, 0.055, 0.5), bg("Pill", "#ff3b45", 1, "PillMask"), merge("Merge1", "Card", "Pill"),
      text("Label", "CHALLENGE", cx - w / 2 + 0.085, cy + h / 2 - 0.055, 0.032, "#ffffff"), merge("Merge2", "Merge1", "Label"),
      text("Task", "MIT 100 € IN 3 TAGEN\nNACH BANGKOK", cx, cy - 0.01, 0.06, "#ffffff"), merge("Merge3", "Merge2", "Task"),
      text("Chips", "💶 100 €     ⏱ 3 TAGE", cx, cy - h / 2 + 0.05, 0.03, "#d8d8dc"), merge("Merge4", "Merge3", "Chips"),
      animTransform("Anim", "Merge4", "pop", [cx, cy]), userTransform("Position", "Anim")];
    const inputs = [ii("Input1", "Label", "StyledText", "Kopf"), ii("Input2", "Task", "StyledText", "Aufgabe"), ii("Input3", "Chips", "StyledText", "Zeile unten"),
      ...colorInputs("Input4", "Pill", "TopLeft", "Akzentfarbe", 4), ...colorInputs("Input5", "Card", "TopLeft", "Kartenfarbe", 5), ii("Input6", "Task", "Size", "Textgröße"),
      ii("Input7", "CardMask", "Width", "Kartenbreite"), ii("Input8", "CardMask", "Height", "Kartenhöhe"), ii("Input9", "Position", "Center", "Position"), ii("Input10", "Position", "Size", "Größe")];
    return ["MA Challenge-Karte", macro("MA_Challenge", tools, inputs, "Position")];
  }
  function newCountry(){
    pos = 0;
    const tools = [text("Head", "NEUES LAND ERREICHT", 0.5, 0.62, 0.05, "#ffffff", { spacing: 1.08 }), text("Name", "THAILAND", 0.5, 0.5, 0.14, "#ffffff"),
      merge("Merge1", "Head", "Name"), rectMask("LineMask", 0.5, 0.42, 0.3, 0.008, 0.5), bg("Line", "#b06ae8", 1, "LineMask"), merge("Merge2", "Merge1", "Line"),
      animTransform("Anim", "Merge2", "pop", [0.5, 0.52]), userTransform("Position", "Anim")];
    const inputs = [ii("Input1", "Head", "StyledText", "Zeile oben"), ii("Input2", "Name", "StyledText", "Land"), ii("Input3", "Name", "Font", "Schrift", " ControlGroup = 3,"), ii("Input4", "Name", "Style", "Schrift", " ControlGroup = 3,"),
      ...colorInputs("Input5", "Line", "TopLeft", "Akzentfarbe", 5), ...colorInputs("Input6", "Name", "1", "Textfarbe", 6), ii("Input7", "Position", "Center", "Position"), ii("Input8", "Position", "Size", "Größe")];
    return ["MA Neues Land", macro("MA_NeuesLand", tools, inputs, "Position")];
  }

  // Grafik-Asset als Titel: Loader (PNG-Sequenz mit Alpha) → Transform (Position/Größe)
  function loaderTitle(base, frames, W, H){
    pos = 0;
    const last = frames - 1;
    const tools = [`Clip = Loader {
				Clips = {
					Clip {
						ID = "Clip1",
						Filename = "Templates:Edit/Titles/Mapanimator/${base}/${base}_0000.png",
						FormatID = "PNGFormat",
						StartFrame = 0,
						Length = ${frames},
						LengthSetManually = true,
						TrimIn = 0,
						TrimOut = ${last},
						ExtendFirst = 0,
						ExtendLast = 0,
						Loop = 0,
						AspectMode = 0,
						Depth = 0,
						TimeCode = 0,
						GlobalStart = 0,
						GlobalEnd = ${last}
					}
				},
				Inputs = {
					["Gamut.SLogVersion"] = Input { Value = FuID { "SLog2" }, },
					["Clip1.PNGFormat.PostMultiply"] = Input { Value = 1, },
				},
				${P()}
			},`, userTransform("Position", "Clip")];
    const inputs = [ii("Input1", "Position", "Center", "Position"), ii("Input2", "Position", "Size", "Größe"), ii("Input3", "Position", "Angle", "Drehung")];
    return macro("MA_" + base.replace(/[^A-Za-z0-9_]/g, "_"), tools, inputs, "Position");
  }

  /* ---------- Schreiben: direkt in den Templates-Ordner (Chrome) oder als ZIP ---------- */
  let dir = null;
  async function templatesDir(){
    if (dir) return dir;
    if (!window.showDirectoryPicker) return null;
    dir = await window.showDirectoryPicker({ id: "davinci-templates", mode: "readwrite" });
    if (!/templates/i.test(dir.name)) setStatus(tr("Hinweis: Erwartet wird der Ordner „Templates“ in Fusion – gewählt: ") + dir.name);
    return dir;
  }
  async function write(root, path, data){
    const parts = path.split("/"); let d = root;
    for (const p of parts.slice(0, -1)) d = await d.getDirectoryHandle(p, { create: true });
    const fh = await d.getFileHandle(parts[parts.length - 1], { create: true }), w = await fh.createWritable();
    await w.write(data); await w.close();
  }
  async function install(files, zipName){
    const root = await templatesDir().catch(() => null);
    if (root){
      let i = 0; for (const f of files){ await write(root, f.name, f.data); if (++i % 20 === 0) setStatus(tr("DaVinci") + " " + Math.round(i / files.length * 100) + " %"); }
      setStatus(tr("In DaVinci installiert") + " (" + files.length + " " + tr("Dateien") + ") – " + tr("DaVinci neu starten, dann Effects → Titles → Mapanimator."));
      return "installed";
    }
    ASSETS.download(ASSETS.zip(files), zipName);
    setStatus(tr("ZIP in den Fusion-Ordner „Templates“ entpacken, dann DaVinci neu starten."));
    return "zip";
  }
  async function exportAsset(a, opt = {}){
    const r = await ASSETS.exportAsset(a, "png", Object.assign({ noDownload: true }, opt));
    const files = [], enc = new TextEncoder();
    for (const v of r.variants){
      const base = r.nameOf(v), own = r.files.filter(f => f.name.startsWith(base + "/")), n = own.length;
      own.forEach(f => files.push({ name: "Edit/Titles/Mapanimator/" + f.name, data: f.data }));
      files.push({ name: "Edit/Titles/Mapanimator/" + base + ".setting", data: enc.encode(loaderTitle(base, n, r.W, r.H)) });
    }
    if (opt.collect) return files;
    return install(files, "Mapanimator-DaVinci-" + r.nameOf(r.variants[0]) + ".zip");
  }
  function textFiles(){
    const enc = new TextEncoder();
    return [chip("MA_Kapitel", "MA Kapitel-Chip", "Was bisher geschah", "#f5c542"), chip("MA_Uhrzeit", "MA Uhrzeit-Chip", "14:00", "#3ddc6f"), info(), pill(), challenge(), newCountry()]
      .map(([label, txt]) => ({ name: "Edit/Titles/Mapanimator/" + label + ".setting", data: enc.encode(txt) }));
  }

  function build(){
    const enc = new TextEncoder(), list = [chip("MA_Kapitel", "MA Kapitel-Chip", "Was bisher geschah", "#f5c542"), chip("MA_Uhrzeit", "MA Uhrzeit-Chip", "14:00", "#3ddc6f"),
      info(), pill(), challenge(), newCountry()];
    return ASSETS.zip(list.map(([label, txt]) => ({ name: "Edit/Titles/Mapanimator/" + label + ".setting", data: enc.encode(txt) })));
  }
  const btn = $("asDavinci");
  if (btn) btn.addEventListener("click", async () => {
    try { const r = await install(textFiles(), "Mapanimator-Titel.zip"); if (r === "zip"){ ASSETS.download(build(), "Mapanimator-Titel.drfx"); setStatus(tr("DaVinci-Titelpaket erstellt – .drfx doppelklicken oder in Resolve ziehen.")); } }
    catch (e){ setStatus("DaVinci: " + e.message); }
  });
  const all = $("asDavinciAll");
  if (all) all.addEventListener("click", async () => {
    try {
      const list = ASSETS.list(); if (!list.length){ setStatus(tr("Erst Assets anlegen.")); return; }
      let files = textFiles();
      for (const a of list){ setStatus(tr("Rendere") + " " + a.type + " …"); files = files.concat(await exportAsset(a, { collect: true })); }
      await install(files, "Mapanimator-DaVinci-alle.zip");
    } catch (e){ setStatus("DaVinci: " + e.message); }
  });
  Object.assign(EN, { "DaVinci-Titelpaket erstellt – .drfx doppelklicken oder in Resolve ziehen.": "DaVinci title pack created – double-click the .drfx or drag it into Resolve." });
  return { build, textFiles, loaderTitle, exportAsset };
})();
