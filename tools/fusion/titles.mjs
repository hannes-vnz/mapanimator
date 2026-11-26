// Native DaVinci-Titel (Fusion) – jede Funktion liefert [Dateiname, .setting-Text].
import { Title, ex, cx, cy, sw, esc } from "./lib.mjs";

// UTF-8-sicher die ersten n Zeichen (Lua 5.1 kennt kein utf8)
const SUB = `local function chars(s) local ch={} for c in s:gmatch("[%z\\1-\\127\\194-\\244][\\128-\\191]*") do ch[#ch+1]=c end return ch end `;
const THOUSANDS = `local function th(v) local s=tostring(math.floor(v+0.5)):reverse():gsub("(%d%d%d)","%1."):reverse() if s:sub(1,1)=="." then s=s:sub(2) end return s end `;

/* ---------- Kalibrierung (nur zum Testen der Maße) ---------- */
export function calib(){
  const T = new Title("MA_Kalibrierung", "MA Kalibrierung");
  T.box("Sq", 500, 540, 400, 400, { color: "#ff5a36" });               // muss quadratisch sein
  T.ellipse("Ci", 1300, 540, 400, { color: "#14b8a6" });               // muss rund sein
  T.box("V", 100, 540, 6, 1080, { color: "#ffffff" });                 // x = 100 px
  T.box("Hz", 960, 100, 1920, 6, { color: "#ffffff" });                // y = 100 px
  T.text("Tx", "H 200px", 960, 900, 200, { color: "#ffffff", style: "Heavy" });
  T.line("Ln", [[1100, 760], [1400, 760], [1400, 1000], [1100, 1000]], 12, { color: "#ffd54a" });
  return ["MA Kalibrierung", T.build({ inAnim: "none", fadeOut: 0.01 })];
}

/* ---------- Kilometer-Intro ---------- */
export function kmIntro(){
  const T = new Title("MA_KilometerIntro", "MA Kilometer-Intro");
  T.ctrl("From", "Zählt von", "slider", 0, { min: 0, max: 20000, int: true })
   .ctrl("To", "bis (Kilometer)", "slider", 1840, { min: 0, max: 50000, int: true })
   .ctrl("Count", "Zähldauer (s)", "slider", 2, { min: 0.5, max: 6 })
   .ctrl("Unit", "Einheit", "text", "KM").ctrl("Sub", "Unterzeile", "text", "TAG 23 · LAOS").ctrl("Chip", "Chip oben (leer = aus)", "text", "↗ 12.340 HM");
  T.colorCtl("Accent", "Akzentfarbe", "#ff5a36");
  const k = "local k=eo((t-0.15)/math.max(0.3,Ctrl.Count-0.15)) ";
  T.text("Num", "1.840", 1180, 520, 270, { align: 1, shadow: true, textExpr: ex(THOUSANDS + k + "local e=1-(1-cl((t-0.15)/math.max(0.3,Ctrl.Count-0.15)))^4 return th(Ctrl.From+(Ctrl.To-Ctrl.From)*e)") });
  T.text("Unit", "KM", 1200, 585, 92, { align: -1, ctl: "Accent", shadow: true, textExpr: ex("return Ctrl.Unit.Value") });
  T.box("Line", 480, 690, 870, 12, { ctl: "Accent", radius: 1,
    wExpr: ex(`return math.max(0.0001,${sw(870)}*eo((t-Ctrl.Count)/0.35))`),
    centerExpr: ex(`local w=${sw(870)}*eo((t-Ctrl.Count)/0.35) return Point(${cx(480)}+w/2, ${cy(690)})`) });
  T.text("Sub", "TAG 23 · LAOS", 480, 760, 64, { align: -1, shadow: true,
    textExpr: ex(SUB + "local ch=chars(Ctrl.Sub.Value) local k=cl((t-Ctrl.Count+0.2)/math.max(0.3,#ch*0.035)) local n=math.floor(#ch*k+0.5) return table.concat(ch,'',1,n)") });
  const chipA = ex("if #Ctrl.Chip.Value==0 then return 0 end return cl((t-Ctrl.Count-0.25)/0.25)");
  T.box("ChipBg", 1215, 330, 300, 62, { color: "#0e0f12", alphaExpr: chipA.replace("return cl(", "return 0.75*cl("), radius: 1 });
  T.text("ChipTx", "↗ 12.340 HM", 1215, 330, 40, { alphaExpr: chipA, textExpr: ex("return Ctrl.Chip.Value") });
  return ["MA Kilometer-Intro", T.build({ inAnim: "slideU", px: 900, py: 560 })];
}

/* ---------- Daily Quests (Abhak-Animation) ---------- */
export function quests(id = "MA_DailyQuests", label = "MA Daily Quests", head = "DAILY QUESTS", rows = ["100 km fahren", "Kokosnuss trinken", "Einen Mönch grüßen", "Vor Sonnenuntergang zelten", ""], xp = [50, 20, 30, 40, 10], done = [1, 1, 1, 0, 0], unit = "XP"){
  const T = new Title(id, label);
  T.ctrl("Title", "Titel", "text", head);
  rows.forEach((r, i) => T.ctrl("T" + (i + 1), "Aufgabe " + (i + 1) + " (leer = aus)", "text", r).ctrl("D" + (i + 1), "Aufgabe " + (i + 1) + " abhaken", "check", done[i]).ctrl("X" + (i + 1), "Aufgabe " + (i + 1) + " Punkte", "slider", xp[i], { min: 0, max: 500, int: true }));
  T.ctrl("Unit", "Punkte-Einheit (leer = keine)", "text", unit).ctrl("Step", "Sekunden zwischen den Haken", "slider", 0.8, { min: 0.2, max: 3 }).ctrl("DoneText", "Text am Ende", "text", "QUEST ABGESCHLOSSEN");
  T.colorCtl("Accent", "Akzentfarbe", "#ff5a36");
  const N = rows.length, X0 = 60, W = 720, RH = 74, HH = 100, top = 70, H = HH + N * RH + 24;
  // Lua: aktive Zeilen, Haken-Zeitpunkt je Zeile
  const L = `local T={Ctrl.T1.Value,Ctrl.T2.Value,Ctrl.T3.Value,Ctrl.T4.Value,Ctrl.T5.Value} local Dn={Ctrl.D1,Ctrl.D2,Ctrl.D3,Ctrl.D4,Ctrl.D5} ` +
    `local function act(i) return #T[i]>0 end local function tc(i) if not act(i) or Dn[i]~=1 then return 1e9 end local o=0 for j=1,i-1 do if act(j) and Dn[j]==1 then o=o+1 end end return 0.9+o*Ctrl.Step end ` +
    `local na=0 for j=1,5 do if act(j) then na=na+1 end end `;
  T.box("Card", X0 + W / 2, top + H / 2, W, H, { color: "#26272c", alpha: 0.96, radius: 0.12 });
  T.text("Head", head, X0 + 40, top + 48, 44, { align: -1, textExpr: ex("return Ctrl.Title.Value") });
  T.text("Cnt", "3/4", X0 + W - 36, top + 48, 34, { align: 1, color: "#d0d0d6", textExpr: ex(L + "local d=0 for i=1,5 do if t>=tc(i) then d=d+1 end end return d..'/'..na") });
  T.box("BarBg", X0 + W / 2, top + 90, W - 72, 8, { color: "#ffffff", alpha: 0.15, radius: 1 });
  T.box("Bar", X0 + 36, top + 90, W - 72, 8, { ctl: "Accent", radius: 1,
    wExpr: ex(L + `local s=0 for i=1,5 do s=s+cl((t-tc(i)-0.1)/0.3) end return math.max(0.0001,${sw(W - 72)}*s/math.max(1,na))`),
    centerExpr: ex(L + `local s=0 for i=1,5 do s=s+cl((t-tc(i)-0.1)/0.3) end local w=${sw(W - 72)}*s/math.max(1,na) return Point(${cx(X0 + 36)}+w/2, ${cy(top + 90)})`) });
  for (let i = 1; i <= N; i++){
    const y = top + HH + 20 + (i - 1) * RH + RH / 2, bx = X0 + 56, s = 36, c = `local c=t-tc(${i}) `;
    const vis = `if not act(${i}) then return 0 end `, rowIn = `cl((t-0.3-${i - 1}*0.08)/0.3)`;
    // Aufblitzen der Zeile
    T.box("Fl" + i, X0 + W / 2, y, W - 30, RH - 10, { ctl: "Accent", radius: 0.3, alphaExpr: ex(L + vis + c + "if c<0 or c>0.6 then return 0 end return 0.3*(1-c/0.6)") });
    // Ring + Kasten (offen), Füllung, Häkchen
    T.ellipse("Rg" + i, bx, y, s, { ctl: "Accent", border: 4, dExpr: ex(L + c + `local q=cl((c-0.08)/0.5) return ${sw(s)}*(1.2+2.4*q)`), alphaExpr: ex(L + vis + c + "if c<0.08 or c>0.6 then return 0 end return 1-cl((c-0.08)/0.5)") });
    T.box("Bo" + i, bx, y, s, s, { color: "#ffffff", border: 4, radius: 0.35, alphaExpr: ex(L + vis + c + `return 0.75*${rowIn}*(1-cl(c/0.12))`) });
    const scale = `local sc=1 if c>=0 and c<0.08 then sc=1-0.18*c/0.08 elseif c>=0.08 and c<0.3 then sc=0.82+0.38*bo((c-0.08)/0.22) end `;
    T.box("Fi" + i, bx, y, s, s, { ctl: "Accent", radius: 0.35, wExpr: ex(L + c + scale + `return ${sw(s)}*sc`), hExpr: ex(L + c + scale + `return ${sw(s)}*sc`), alphaExpr: ex(L + vis + c + "return cl(c/0.12)") });
    T.line("Tk" + i, [[bx - 10, y + 1], [bx - 3, y + 9], [bx + 11, y - 9]], 6, { color: "#ffffff", write: ex(L + c + "return cl((c-0.06)/0.22)"), alphaExpr: ex(L + vis + c + "if c<0.06 then return 0 end return 1") });
    // Text, Durchstreichen, Punkte
    T.text("Tt" + i, rows[i - 1] || "Aufgabe", X0 + 96, y, 32, { align: -1, textExpr: ex(`return Ctrl.T${i}.Value`), alphaExpr: ex(L + vis + c + `local st=0 if c>=0 then st=eo((c-0.18)/0.3) end return ${rowIn}*(1-0.45*st)`) });
    T.box("St" + i, X0 + 96, y, 1, 4, { color: "#ffffff", alpha: 0.85,
      wExpr: ex(L + c + `local st=0 if c>=0 then st=eo((c-0.18)/0.3) end return math.max(0.0001,${sw(1)}*#Ctrl.T${i}.Value*16*st)`),
      centerExpr: ex(L + c + `local st=0 if c>=0 then st=eo((c-0.18)/0.3) end local w=${sw(1)}*#Ctrl.T${i}.Value*16*st return Point(${cx(X0 + 96)}+w/2, ${cy(y)})`),
      alphaExpr: ex(L + vis + "return 0.85") });
    T.text("Xp" + i, "50 XP", X0 + W - 36, y, 26, { align: 1, color: "#bfbfc7", textExpr: ex(`if #Ctrl.Unit.Value==0 then return '' end return math.floor(Ctrl.X${i})..' '..Ctrl.Unit.Value`), alphaExpr: ex(L + vis + `return ${rowIn}`) });
    T.text("Fx" + i, "+50 XP", X0 + W - 36, y, 34, { align: 1, ctl: "Accent", textExpr: ex(`if #Ctrl.Unit.Value==0 then return '' end return '+'..math.floor(Ctrl.X${i})..' '..Ctrl.Unit.Value`),
      centerExpr: ex(L + c + `local q=cl((c-0.12)/1.08) return Point(${cx(X0 + W - 36)}, ${cy(y)}+q*${RH * 0.9 / 1080})`), alphaExpr: ex(L + vis + c + "if c<0.12 or c>1.2 then return 0 end return math.sin(cl((c-0.12)/1.08)*math.pi)") });
  }
  // Abschluss-Banner
  const all = ex(L + "local last=-1 for i=1,5 do if act(i) then if Dn[i]~=1 then return 0 end last=math.max(last,tc(i)) end end if last<0 then return 0 end return cl((t-last-0.45)/0.3)");
  T.box("Ban", X0 + W / 2, top + H + 46, 460, 64, { ctl: "Accent", radius: 1, alphaExpr: all });
  T.text("BanT", "QUEST ABGESCHLOSSEN", X0 + W / 2, top + H + 46, 34, { textExpr: ex("return '✓  '..Ctrl.DoneText.Value"), alphaExpr: all });
  return [label, T.build({ inAnim: "slideL", px: X0 + W / 2, py: top + H / 2 })];
}
export const gearlist = () => quests("MA_Packliste", "MA Packliste", "PACKLISTE", ["Zelt", "Schlafsack", "Kocher", "Flickzeug", "Kamera"], [1200, 800, 350, 120, 900], [1, 1, 1, 1, 1], "g");

/* ---------- Steigungsschild ---------- */
export function gradeSign(){
  const T = new Title("MA_Steigungsschild", "MA Steigungsschild");
  T.ctrl("Pct", "Steigung", "text", "12%").ctrl("Down", "Bergab", "check", 0).ctrl("Txt", "Text darunter", "text", "DIE NÄCHSTEN 8 KM");
  T.line("Out", [[300, 140], [500, 490], [100, 490]], 0, { closed: true, color: "#d8262c" });
  T.line("Inn", [[300, 205], [445, 458], [155, 458]], 0, { closed: true, color: "#ffffff" });
  T.line("WUp", [[180, 440], [420, 330], [420, 440]], 0, { closed: true, color: "#111111", alphaExpr: ex("return 1-Ctrl.Down") });
  T.line("WDn", [[180, 330], [420, 440], [180, 440]], 0, { closed: true, color: "#111111", alphaExpr: ex("return Ctrl.Down") });
  T.text("Pct", "12%", 265, 360, 64, { color: "#111111", textExpr: ex("return Ctrl.Pct.Value"), centerExpr: ex(`return Point(${cx(265)}+Ctrl.Down*${sw(70)}, ${cy(360)})`) });
  T.text("Txt", "DIE NÄCHSTEN 8 KM", 300, 540, 40, { shadow: true, textExpr: ex("return Ctrl.Txt.Value"), alphaExpr: ex("return cl((t-0.4)/0.3)") });
  T.transform("Wob", { px: 300, py: 490, angle: ex("return math.sin(t*10)*3*cl(1.2-t)") });
  return ["MA Steigungsschild", T.build({ inAnim: "pop", px: 300, py: 400 })];
}

/* ---------- Reise-Fortschritt ---------- */
export function progress(){
  const T = new Title("MA_ReiseFortschritt", "MA Reise-Fortschritt");
  T.ctrl("From", "Start", "text", "BERLIN").ctrl("To", "Ziel", "text", "SINGAPUR").ctrl("Done", "Geschafft", "slider", 1840, { min: 0, max: 50000, int: true })
   .ctrl("Total", "Gesamt", "slider", 12000, { min: 1, max: 50000, int: true }).ctrl("Unit", "Einheit", "text", "km");
  T.colorCtl("Accent", "Akzentfarbe", "#ff5a36");
  const X0 = 300, W = 1320, Y = 930, F = `local f=cl(Ctrl.Done/math.max(1,Ctrl.Total))*eio((t-0.35)/1.4) `;
  T.text("A", "BERLIN", X0, Y - 50, 50, { align: -1, shadow: true, textExpr: ex("return Ctrl.From.Value") });
  T.text("B", "SINGAPUR", X0 + W, Y - 50, 50, { align: 1, shadow: true, textExpr: ex("return Ctrl.To.Value") });
  T.box("Bg", X0 + W / 2, Y, W, 18, { color: "#ffffff", alpha: 0.28, radius: 1 });
  T.box("Fill", X0, Y, W, 18, { ctl: "Accent", radius: 1, wExpr: ex(F + `return math.max(${sw(18)},${sw(W)}*f)`), centerExpr: ex(F + `local w=math.max(${sw(18)},${sw(W)}*f) return Point(${cx(X0)}+w/2, ${cy(Y)})`) });
  T.ellipse("End", X0 + W, Y, 28, { color: "#ffffff" });
  T.ellipse("Dot", X0, Y, 40, { color: "#ffffff" });
  T.ellipse("DotI", X0, Y, 24, { ctl: "Accent" });
  T.text("Km", "1.840 / 12.000 km", X0, Y + 55, 42, { align: -1, shadow: true, textExpr: ex(THOUSANDS + F + "local k=eio((t-0.35)/1.4) return th(Ctrl.Done*k)..' / '..th(Ctrl.Total)..' '..Ctrl.Unit.Value") });
  T.text("Pc", "15 %", X0 + W, Y + 55, 42, { align: 1, ctl: "Accent", shadow: true, textExpr: ex(F + "return math.floor(f*100+0.5)..' %'") });
  // Punkt fährt mit
  const tools = T.tools; const fixDot = id => { const i = tools.findIndex(s => s.startsWith(id + "M = EllipseMask")); tools[i] = tools[i].replace(/Center = Input \{ Value = \{ [^}]+\}, \},/, `Center = Input { Value = { ${cx(X0)}, ${cy(Y)} }, Expression = "${esc(ex(F + `return Point(${cx(X0)}+${sw(W)}*f, ${cy(Y)})`))}", },`); };
  fixDot("Dot"); fixDot("DotI");
  return ["MA Reise-Fortschritt", T.build({ inAnim: "slideU", px: 960, py: 930 })];
}

/* ---------- Kapitel-Chip ---------- */
export function chapter(){
  const T = new Title("MA_KapitelChip", "MA Kapitel-Chip");
  T.ctrl("Txt", "Text", "text", "Was bisher geschah").ctrl("W", "Chipbreite (px)", "slider", 420, { min: 150, max: 1200, int: true });
  T.colorCtl("Accent", "Punktfarbe", "#f5c542");
  const X0 = 50, Y = 80, H = 70;
  T.box("Bg", X0 + 210, Y, 420, H, { color: "#0e0f12", alpha: 0.78, radius: 1,
    wExpr: ex(`return ${sw(1)}*Ctrl.W`), centerExpr: ex(`return Point(${cx(X0)}+${sw(1)}*Ctrl.W/2, ${cy(Y)})`) });
  T.ellipse("Dot", X0 + 36, Y, 44, { ctl: "Accent" });
  T.line("Ff1", [[X0 + 26, Y - 11], [X0 + 37, Y], [X0 + 26, Y + 11]], 0, { closed: true, color: "#15171c" });
  T.line("Ff2", [[X0 + 36, Y - 11], [X0 + 47, Y], [X0 + 36, Y + 11]], 0, { closed: true, color: "#15171c" });
  T.text("Tx", "Was bisher geschah", X0 + 72, Y, 40, { align: -1, textExpr: ex("return Ctrl.Txt.Value") });
  return ["MA Kapitel-Chip", T.build({ inAnim: "slideL", px: X0 + 200, py: Y })];
}

export const ALL = [calib, kmIntro, quests, gearlist, gradeSign, progress, chapter];
