// Fusion-Baukasten: erzeugt DaVinci-Resolve-Titel (.setting) aus einfachen Bausteinen.
// Koordinaten im Entwurf: Pixel eines 1920×1080-Bildes (y nach unten, wie im Browser).
// Fusion intern: Center normiert je Achse (y nach oben), Maskengrößen relativ zur Bildbreite.
// Animation über Lua-Ausdrücke abhängig von Zeit und Cliplänge (Ein-/Ausblenden passt sich der Länge in der Timeline an).
export const FW = 1920, FH = 1080;
const n = v => (Math.round(v * 100000) / 100000).toString();
export const cx = x => x / FW, cy = y => 1 - y / FH, sw = w => w / FW;          // Center x/y, Maskengröße
export const esc = s => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
export const rgb = hex => { const x = parseInt(String(hex).replace("#", ""), 16); return [(x >> 16 & 255) / 255, (x >> 8 & 255) / 255, (x & 255) / 255]; };

// Lua-Vorspann für Ausdrücke: t = Sekunden seit Clipstart, D = Cliplänge, Easing-Funktionen
export const PRE = `local fps=comp:GetPrefs("Comp.FrameFormat.Rate") local t=(time-comp.RenderStart)/fps local D=(comp.RenderEnd-comp.RenderStart+1)/fps ` +
  `local function cl(x) if x<0 then return 0 elseif x>1 then return 1 end return x end ` +
  `local function eo(x) x=cl(x) return 1-(1-x)^3 end local function ei(x) x=cl(x) return x*x*x end ` +
  `local function eio(x) x=cl(x) if x<0.5 then return 4*x*x*x end return 1-((-2*x+2)^3)/2 end ` +
  `local function bo(x) x=cl(x) local c1=1.70158 local c3=c1+1 return 1+c3*(x-1)^3+c1*(x-1)^2 end `;
export const ex = body => ":" + PRE + body;                                       // mehrzeiliger Ausdruck mit Rückgabe
export const val = (v, expr) => expr ? `Input { Value = ${typeof v === "string" ? `"${esc(v)}"` : n(v)}, Expression = "${esc(expr)}", }` : `Input { Value = ${typeof v === "string" ? `"${esc(v)}"` : n(v)}, }`;

export class Title {
  constructor(id, label){ this.id = id; this.label = label; this.tools = []; this.inputs = []; this.ctrls = []; this.last = null; this.k = 0; this.pos = 0; }
  P(){ return `ViewInfo = OperatorInfo { Pos = { ${(this.pos += 110)}, 0 } },`; }
  add(src){ this.tools.push(src); }

  /* ---------- Regler (erscheinen im Inspector unter „Controls“) ---------- */
  // type: "text" | "slider" | "check" | "color" (Farbe = Background-Werkzeug, dessen TopLeft-Farbe exponiert wird)
  ctrl(key, label, type, def, o = {}){ this.ctrls.push({ key, label, type, def, o }); return this; }
  colorCtl(key, label, hex){ const [r, g, b] = rgb(hex);
    this.add(`${key} = Background { NameSet = true, Inputs = { GlobalOut = Input { Value = 119, }, Width = Input { Value = 16, }, Height = Input { Value = 16, }, UseFrameFormatSettings = Input { Value = 0, }, TopLeftRed = Input { Value = ${n(r)}, }, TopLeftGreen = Input { Value = ${n(g)}, }, TopLeftBlue = Input { Value = ${n(b)}, }, }, ${this.P()} },`);
    this.inputs.push(`${key}R = InstanceInput { SourceOp = "${key}", Source = "TopLeftRed", Name = "${label}", ControlGroup = ${++this.k + 100}, Default = ${n(r)}, },`,
      `${key}G = InstanceInput { SourceOp = "${key}", Source = "TopLeftGreen", ControlGroup = ${this.k + 100}, Default = ${n(g)}, },`,
      `${key}B = InstanceInput { SourceOp = "${key}", Source = "TopLeftBlue", ControlGroup = ${this.k + 100}, Default = ${n(b)}, },`);
    return this;
  }
  colorExpr(key){ return [`${key}.TopLeftRed`, `${key}.TopLeftGreen`, `${key}.TopLeftBlue`]; }

  /* ---------- Bausteine ---------- */
  // Fläche (Rechteck mit Rundung) – w/h/x/y in Entwurfspixeln, optional Ausdrücke für Breite/Center/Alpha
  box(id, x, y, w, h, o = {}){
    const r = o.radius == null ? 0 : o.radius;
    this.add(`${id}M = RectangleMask { Inputs = { Filter = Input { Value = FuID { "Fast Gaussian" }, }, SoftEdge = Input { Value = ${n(o.soft || 0.0006)}, }, ${o.border ? `Solid = Input { Value = 0, }, BorderWidth = Input { Value = ${n(sw(o.border))}, },` : ""} MaskWidth = Input { Value = 1920, }, MaskHeight = Input { Value = 1080, }, PixelAspect = Input { Value = { 1, 1 }, }, UseFrameFormatSettings = Input { Value = 1, }, ClippingMode = Input { Value = FuID { "None" }, },
      Center = ${o.centerExpr ? `Input { Value = { ${n(cx(x))}, ${n(cy(y))} }, Expression = "${esc(o.centerExpr)}", }` : `Input { Value = { ${n(cx(x))}, ${n(cy(y))} }, }`},
      Width = ${val(sw(w), o.wExpr)}, Height = ${val(sw(h), o.hExpr)}, CornerRadius = Input { Value = ${n(r)}, }, }, ${this.P()} },`);
    return this.fill(id, id + "M", o);
  }
  ellipse(id, x, y, d, o = {}){
    this.add(`${id}M = EllipseMask { Inputs = { Filter = Input { Value = FuID { "Fast Gaussian" }, }, SoftEdge = Input { Value = 0.0006, }, ${o.border ? `Solid = Input { Value = 0, }, BorderWidth = Input { Value = ${n(sw(o.border))}, },` : ""} MaskWidth = Input { Value = 1920, }, MaskHeight = Input { Value = 1080, }, PixelAspect = Input { Value = { 1, 1 }, }, UseFrameFormatSettings = Input { Value = 1, }, ClippingMode = Input { Value = FuID { "None" }, },
      Center = Input { Value = { ${n(cx(x))}, ${n(cy(y))} }, }, Width = ${val(sw(d), o.dExpr)}, Height = Input { Value = ${n(sw(d))}, Expression = "Width", }, }, ${this.P()} },`);
    return this.fill(id, id + "M", o);
  }
  // Linie/Pfad: Punkte in Entwurfspixeln (absolut), Strichstärke px, write = Ausdruck 0…1 (zeichnet sich)
  line(id, pts, width, o = {}){
    const x0 = pts[0][0], y0 = pts[0][1], P = pts.map(([x, y]) => `{ ${o.linear === false ? "" : "Linear = true, "}X = ${n((x - x0) / FW)}, Y = ${n(-(y - y0) / FW)} }`).join(", ");
    this.add(`${id}M = PolylineMask { DrawMode = "ModifyOnly", DrawMode2 = "InsertAndModify", Inputs = { Filter = Input { Value = FuID { "Fast Gaussian" }, }, SoftEdge = Input { Value = 0.0005, },
      ${o.closed ? "" : `BorderWidth = Input { Value = ${n(sw(width))}, }, CapStyle = Input { Value = 1, }, JoinStyle = Input { Value = 1, },`}
      ${o.write ? `WriteLength = Input { Value = 1, Expression = "${esc(o.write)}", },` : ""}
      MaskWidth = Input { Value = 1920, }, MaskHeight = Input { Value = 1080, }, PixelAspect = Input { Value = { 1, 1 }, }, UseFrameFormatSettings = Input { Value = 1, }, ClippingMode = Input { Value = FuID { "None" }, },
      Center = Input { Value = { ${n(cx(x0))}, ${n(cy(y0))} }, },
      Polyline = Input { Value = Polyline { Closed = ${o.closed ? "true" : "false"}, Points = { ${P} } }, }, Polyline2 = Input { Value = Polyline { }, Disabled = true, }, }, ${this.P()} },`);
    return this.fill(id, id + "M", o);
  }
  // Farbfläche durch eine Maske; color = Hex oder Name eines colorCtl; alpha = Zahl oder Ausdruck
  fill(id, mask, o){
    let rr, gg, bb;
    if (o.ctl){ [rr, gg, bb] = this.colorExpr(o.ctl).map(e => `Input { Value = 1, Expression = "${e}", }`); }
    else { const [r, g, b] = rgb(o.color || "#ffffff"); [rr, gg, bb] = [r, g, b].map(v => `Input { Value = ${n(v)}, }`); }
    const a = o.alphaExpr ? `Input { Value = 1, Expression = "${esc(o.alphaExpr)}", }` : `Input { Value = ${n(o.alpha == null ? 1 : o.alpha)}, }`;
    this.add(`${id} = Background { Inputs = { GlobalOut = Input { Value = 119, }, Width = Input { Value = 1920, }, Height = Input { Value = 1080, }, UseFrameFormatSettings = Input { Value = 1, },
      TopLeftRed = ${rr}, TopLeftGreen = ${gg}, TopLeftBlue = ${bb}, TopLeftAlpha = ${a}, EffectMask = Input { SourceOp = "${mask}", Source = "Mask", }, }, ${this.P()} },`);
    return this.stack(id);
  }
  // Text+: text = fester Text oder Ausdruck (o.textExpr), align -1 links / 0 Mitte / 1 rechts, size in Entwurfspixeln (Schrifthöhe)
  text(id, txt, x, y, size, o = {}){
    let rr, gg, bb;
    if (o.ctl){ [rr, gg, bb] = this.colorExpr(o.ctl).map(e => `Input { Value = 1, Expression = "${e}", }`); }
    else { const [r, g, b] = rgb(o.color || "#ffffff"); [rr, gg, bb] = [r, g, b].map(v => `Input { Value = ${n(v)}, }`); }
    this.add(`${id} = TextPlus { Inputs = { GlobalOut = Input { Value = 119, }, Width = Input { Value = 1920, }, Height = Input { Value = 1080, }, UseFrameFormatSettings = Input { Value = 1, },
      StyledText = ${o.textExpr ? `Input { Value = "${esc(txt)}", Expression = "${esc(o.textExpr)}", }` : `Input { Value = "${esc(txt)}", }`},
      Font = Input { Value = "${o.font || "Avenir Next Condensed"}", }, Style = Input { Value = "${o.style || "Heavy"}", },
      Size = Input { Value = ${n(size / FH * (o.sizeK || 1.0))}, }, CharacterSpacing = Input { Value = ${n(o.spacing || 1)}, },
      VerticalJustificationNew = Input { Value = 3, }, HorizontalJustificationNew = Input { Value = 3, }, HorizontalLeftCenterRight = Input { Value = ${o.align == null ? 0 : o.align}, },
      Center = ${o.centerExpr ? `Input { Value = { ${n(cx(x))}, ${n(cy(y))} }, Expression = "${esc(o.centerExpr)}", }` : `Input { Value = { ${n(cx(x))}, ${n(cy(y))} }, }`},
      Red1 = ${rr}, Green1 = ${gg}, Blue1 = ${bb}, ${o.alphaExpr ? `Opacity1 = Input { Value = 1, Expression = "${esc(o.alphaExpr)}", },` : ""}
      ${o.shadow ? `Enabled3 = Input { Value = 1, }, ShadowDensity3 = Input { Value = 0.6, }, Softness3 = Input { Value = 6, }, Position3 = Input { Value = { 0.004, -0.006 }, }, Red3 = Input { Value = 0, }, Green3 = Input { Value = 0, }, Blue3 = Input { Value = 0, }, Opacity3 = Input { Value = 0.7, },` : ""} }, ${this.P()} },`);
    return this.stack(id);
  }
  // alles übereinander legen (Merge-Kette)
  stack(id){
    if (!this.last){ this.last = id; return this; }
    const m = "Mrg" + (++this.k);
    this.add(`${m} = Merge { Inputs = { Background = Input { SourceOp = "${this.last}", Source = "Output", }, Foreground = Input { SourceOp = "${id}", Source = "Output", }, PerformDepthMerge = Input { Value = 0, }, }, ${this.P()} },`);
    this.last = m; return this;
  }
  // Gruppe animieren: Transform um Pivot (Größe/Verschiebung/Drehung per Ausdruck) auf dem bisherigen Stapel
  transform(id, o){
    this.add(`${id} = Transform { Inputs = { Pivot = Input { Value = { ${n(cx(o.px || 960))}, ${n(cy(o.py || 540))} }, },
      ${o.size ? `Size = Input { Value = 1, Expression = "${esc(o.size)}", },` : ""} ${o.center ? `Center = Input { Value = { 0.5, 0.5 }, Expression = "${esc(o.center)}", },` : ""} ${o.angle ? `Angle = Input { Value = 0, Expression = "${esc(o.angle)}", },` : ""}
      Input = Input { SourceOp = "${this.last}", Source = "Output", }, }, ${this.P()} },`);
    this.last = id; return this;
  }

  /* ---------- Ausgabe ---------- */
  build({ inAnim = "pop", px = 960, py = 540, fadeOut = 0.35 } = {}){
    // Ein-/Ausblenden der ganzen Grafik + Position/Größe für dich
    const inSize = inAnim === "pop" ? "bo(t/0.45)" : "1", inShift = inAnim === "slideL" ? "-(1-eo(t/0.45))*0.15" : inAnim === "slideU" ? "0" : "0";
    const inShiftY = inAnim === "slideU" ? "-(1-eo(t/0.45))*0.12" : "0";
    this.transform("Anim", { px, py, size: ex(`return math.max(0.001, ${inSize})`), center: ex(`return Point(0.5+${inShift}, 0.5+${inShiftY}-(ei((t-(D-${fadeOut}))/${fadeOut}))*0.06)`) });
    this.add(`Empty = Background { Inputs = { GlobalOut = Input { Value = 119, }, Width = Input { Value = 1920, }, Height = Input { Value = 1080, }, UseFrameFormatSettings = Input { Value = 1, }, TopLeftAlpha = Input { Value = 0, }, }, ${this.P()} },`);
    this.add(`Fade = Merge { Inputs = { Background = Input { SourceOp = "Empty", Source = "Output", }, Foreground = Input { SourceOp = "Anim", Source = "Output", }, PerformDepthMerge = Input { Value = 0, },
      Blend = Input { Value = 1, Expression = "${esc(ex(`return cl(t/0.2)*(1-cl((t-(D-${fadeOut}))/${fadeOut}))`))}", }, }, ${this.P()} },`);
    this.add(`Position = Transform { NameSet = true, Inputs = { Input = Input { SourceOp = "Fade", Source = "Output", }, }, ${this.P()} },`);
    // Controller mit den Reglern
    const uc = [], ci = [];
    for (const c of this.ctrls){
      const common = `ICS_ControlPage = "Controls", LINKS_Name = "${esc(c.label)}",`;
      if (c.type === "text") uc.push(`${c.key} = { ${common} LINKID_DataType = "Text", INPID_InputControl = "TextEditControl", TEC_Lines = ${c.o.lines || 1}, TEC_Wrap = false, INP_External = false, }`);
      else if (c.type === "check") uc.push(`${c.key} = { ${common} LINKID_DataType = "Number", INPID_InputControl = "CheckboxControl", INP_Integer = true, INP_Default = ${c.def ? 1 : 0}, INP_External = false, }`);
      else uc.push(`${c.key} = { ${common} LINKID_DataType = "Number", INPID_InputControl = "SliderControl", INP_Integer = ${c.o.int ? "true" : "false"}, INP_MinScale = ${n(c.o.min ?? 0)}, INP_MaxScale = ${n(c.o.max ?? 100)}, INP_MinAllowed = -1000000000, INP_MaxAllowed = 1000000000, INP_Default = ${n(c.def)}, INP_External = false, }`);
      ci.push(`${c.key} = Input { Value = ${c.type === "text" ? `"${esc(c.def)}"` : n(c.type === "check" ? (c.def ? 1 : 0) : c.def)}, },`);
    }
    if (this.ctrls.length) this.add(`Ctrl = Custom { PassThrough = true, NameSet = true, Inputs = { ${ci.join(" ")} }, ${this.P()} UserControls = ordered() { ${uc.join(", ")} }, },`);
    const inputs = [...this.ctrls.map((c, i) => `In${i + 1} = InstanceInput { SourceOp = "Ctrl", Source = "${c.key}", Name = "${esc(c.label)}", Page = "Controls", },`), ...this.inputs,
      `PosC = InstanceInput { SourceOp = "Position", Source = "Center", Name = "Position", Page = "Controls", },`,
      `PosS = InstanceInput { SourceOp = "Position", Source = "Size", Name = "Größe", Page = "Controls", Default = 1, },`,
      `PosA = InstanceInput { SourceOp = "Position", Source = "Angle", Name = "Drehung", Page = "Controls", Default = 0, },`];
    return `{
	Tools = ordered() {
		${this.id} = MacroOperator {
			CtrlWZoom = false,
			NameSet = true,
			Inputs = ordered() {
				${inputs.join("\n\t\t\t\t")}
			},
			Outputs = { MainOutput1 = InstanceOutput { SourceOp = "Position", Source = "Output", }, },
			ViewInfo = GroupInfo { Pos = { 0, 0 } },
			Tools = ordered() {
				${this.tools.join("\n\t\t\t\t")}
			},
		},
	},
	ActiveTool = "${this.id}"
}
`;
  }
}
// Kurzformen für Ausdrücke auf Regler
export const C = k => `Ctrl.${k}`, CT = k => `Ctrl.${k}.Value`;
