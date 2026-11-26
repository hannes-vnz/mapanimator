"use strict";
/* =========================================================
   3D-Modelle an der Linienspitze
   Eigene MapLibre-Custom-Layer (WebGL), ohne externe Bibliothek.
   Modelle sind prozedurale Low-Poly-Meshes: Länge ≈ 1, +x = vorne, z = oben.
   API: model3dAddLayer(), model3dUpdate(items, t)
     items: [{ lngLat:[lng,lat], heading:rad (Mercator, 0 = Osten), mode, color, prog }]
   ========================================================= */
const M3D = (() => {
  /* ---------- Mesh-Bausteine ---------- */
  const hex = c => { c = (c || "#888").replace("#", ""); if (c.length === 3) c = c.replace(/./g, x => x + x);
    return [parseInt(c.slice(0, 2), 16) / 255, parseInt(c.slice(2, 4), 16) / 255, parseInt(c.slice(4, 6), 16) / 255]; };
  const mix = (a, b, f) => a.map((v, i) => v + (b[i] - v) * f);

  function Mesh(){ this.p = []; this.n = []; this.c = []; this.tag = []; }
  Mesh.prototype.tri = function (a, b, c, col, tag){
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const l = Math.hypot(...n) || 1; n = n.map(x => x / l);
    for (const p of [a, b, c]){ this.p.push(...p); this.n.push(...n); this.c.push(...col); this.tag.push(tag || 0); }
  };
  Mesh.prototype.quad = function (a, b, c, d, col, tag){ this.tri(a, b, c, col, tag); this.tri(a, c, d, col, tag); };
  // achsparalleler Quader: Mittelpunkt + Größe; taper verkleinert die Oberseite (0..1)
  Mesh.prototype.box = function (cx, cy, cz, sx, sy, sz, col, opt = {}){
    const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2;
    const tx = (opt.taperX || 0) * sx / 2, ty = (opt.taperY || 0) * sy / 2, sh = opt.shiftX || 0;
    const B = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]];
    const T = [[x0 + tx + sh, y0 + ty, z1], [x1 - tx + sh, y0 + ty, z1], [x1 - tx + sh, y1 - ty, z1], [x0 + tx + sh, y1 - ty, z1]];
    const top = opt.top || col, tag = opt.tag || 0;
    this.quad(B[3], B[2], B[1], B[0], mix(col, [0, 0, 0], 0.3), tag);
    this.quad(T[0], T[1], T[2], T[3], top, tag);
    for (let i = 0; i < 4; i++){ const j = (i + 1) % 4; this.quad(B[i], B[j], T[j], T[i], col, tag); }
    return this;
  };
  // Zylinder entlang Achse ('x' | 'y' | 'z')
  Mesh.prototype.cyl = function (cx, cy, cz, r, len, axis, col, seg = 12, tag = 0, r2){
    r2 = r2 == null ? r : r2;
    const P = (a, d, rr) => { const s = Math.sin(a) * rr, c = Math.cos(a) * rr;
      return axis === "x" ? [cx + d, cy + s, cz + c] : axis === "y" ? [cx + s, cy + d, cz + c] : [cx + s, cy + c, cz + d]; };
    const h = len / 2, capA = axis === "y" ? [cx, cy - h, cz] : axis === "x" ? [cx - h, cy, cz] : [cx, cy, cz - h];
    const capB = axis === "y" ? [cx, cy + h, cz] : axis === "x" ? [cx + h, cy, cz] : [cx, cy, cz + h];
    for (let i = 0; i < seg; i++){
      const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2;
      this.quad(P(a0, -h, r), P(a1, -h, r), P(a1, h, r2), P(a0, h, r2), col, tag);
      this.tri(capA, P(a1, -h, r), P(a0, -h, r), mix(col, [0, 0, 0], 0.15), tag);
      if (r2 > 0) this.tri(capB, P(a0, h, r2), P(a1, h, r2), mix(col, [1, 1, 1], 0.1), tag);
    }
    return this;
  };
  Mesh.prototype.wheel = function (x, y, r, w){ return this.cyl(x, y, r, r, w || 0.07, "y", hex("#1c1d20"), 10, 2).cyl(x, y, r, r * 0.5, (w || 0.07) + 0.01, "y", hex("#9aa0a8"), 8, 2); };

  const DARK = hex("#232a33"), GLASS = hex("#3b5068"), WHITE = hex("#f4f4f2"), SKIN = hex("#e9b48f"), GREY = hex("#8b9098"), BLACK = hex("#18191c");

  /* ---------- Modelle (Farbe C = Routenfarbe) ---------- */
  const BUILD = {
    car(C){ const m = new Mesh(), L = mix(C, [1, 1, 1], 0.12);
      m.box(0, 0, 0.16, 1, 0.46, 0.18, C, { top: L });
      m.box(-0.06, 0, 0.32, 0.52, 0.42, 0.15, GLASS, { taperX: 0.25 });
      m.box(-0.07, 0, 0.405, 0.38, 0.38, 0.025, C, { top: L });
      m.box(0.505, 0.15, 0.17, 0.02, 0.09, 0.05, hex("#fff3c4")).box(0.505, -0.15, 0.17, 0.02, 0.09, 0.05, hex("#fff3c4"));
      m.box(-0.505, 0.16, 0.18, 0.02, 0.08, 0.04, hex("#d22")).box(-0.505, -0.16, 0.18, 0.02, 0.08, 0.04, hex("#d22"));
      [[0.31, 0.22], [0.31, -0.22], [-0.31, 0.22], [-0.31, -0.22]].forEach(([x, y]) => m.wheel(x, y, 0.1));
      return { m, size: 1 }; },
    camper(C){ const m = new Mesh();
      m.box(0, 0, 0.32, 1.2, 0.48, 0.48, WHITE);
      m.box(0, 0, 0.28, 1.21, 0.49, 0.07, C);
      m.box(0.5, 0, 0.42, 0.18, 0.44, 0.16, GLASS, { taperX: 0.3 });
      m.box(-0.1, 0.245, 0.42, 0.5, 0.01, 0.1, GLASS).box(-0.1, -0.245, 0.42, 0.5, 0.01, 0.1, GLASS);
      [[0.38, 0.22], [0.38, -0.22], [-0.38, 0.22], [-0.38, -0.22]].forEach(([x, y]) => m.wheel(x, y, 0.1));
      return { m, size: 1.15 }; },
    bus(C){ const m = new Mesh(), L = mix(C, [1, 1, 1], 0.15);
      m.box(0, 0, 0.33, 1.5, 0.44, 0.5, C, { top: L });
      m.box(0, 0, 0.43, 1.51, 0.45, 0.15, GLASS);
      m.box(0.752, 0, 0.36, 0.01, 0.4, 0.26, GLASS);
      [[0.5, 0.21], [0.5, -0.21], [-0.45, 0.21], [-0.45, -0.21]].forEach(([x, y]) => m.wheel(x, y, 0.1));
      return { m, size: 1.25 }; },
    moto(C){ const m = new Mesh();
      m.wheel(0.32, 0, 0.12, 0.06); m.wheel(-0.32, 0, 0.12, 0.06);
      m.box(0, 0, 0.24, 0.5, 0.14, 0.14, C, { taperX: 0.2 });
      m.box(0.24, 0, 0.36, 0.08, 0.3, 0.03, GREY);
      m.box(-0.06, 0, 0.42, 0.18, 0.2, 0.24, DARK);        // Fahrer
      m.box(-0.02, 0, 0.6, 0.13, 0.13, 0.13, C);           // Helm
      return { m, size: 0.8 }; },
    bike(C){ const m = new Mesh();
      m.cyl(0.3, 0, 0.16, 0.16, 0.03, "y", BLACK, 14, 2).cyl(-0.3, 0, 0.16, 0.16, 0.03, "y", BLACK, 14, 2);
      m.box(0, 0, 0.26, 0.6, 0.03, 0.03, GREY).box(0.02, 0, 0.3, 0.03, 0.03, 0.2, GREY);
      m.box(-0.04, 0, 0.5, 0.2, 0.18, 0.26, C, { shiftX: 0.06 });   // Oberkörper
      m.box(0.06, 0, 0.7, 0.12, 0.12, 0.12, SKIN);                   // Kopf
      m.box(0.07, 0, 0.775, 0.14, 0.13, 0.04, hex("#f5f5f5"));      // Helm
      m.box(-0.04, 0.06, 0.32, 0.08, 0.05, 0.22, DARK, { tag: 3 }).box(-0.04, -0.06, 0.32, 0.08, 0.05, 0.22, DARK, { tag: 4 });
      return { m, size: 0.8 }; },
    foot(C){ const m = new Mesh();
      m.box(0, 0.07, 0.2, 0.09, 0.08, 0.4, DARK, { tag: 3 }).box(0, -0.07, 0.2, 0.09, 0.08, 0.4, DARK, { tag: 4 });
      m.box(0, 0, 0.56, 0.16, 0.26, 0.34, C);                         // Jacke
      m.box(-0.13, 0, 0.58, 0.12, 0.22, 0.3, hex("#6b4a2c"));         // Rucksack
      m.box(0, 0, 0.82, 0.14, 0.14, 0.15, SKIN);
      m.box(0, 0, 0.91, 0.16, 0.16, 0.04, C);
      return { m, size: 0.75 }; },
    train(C){ const m = new Mesh(), L = mix(C, [1, 1, 1], 0.2);
      m.box(0.1, 0, 0.3, 1.5, 0.4, 0.44, WHITE, { top: hex("#d9dbde") });
      m.box(0.1, 0, 0.22, 1.51, 0.41, 0.08, C);
      m.box(0.1, 0, 0.4, 1.51, 0.41, 0.1, GLASS);
      m.box(0.95, 0, 0.27, 0.22, 0.4, 0.38, C, { taperX: 0.7, top: L });   // Nase
      m.box(0.1, 0, 0.04, 1.3, 0.3, 0.08, BLACK);
      return { m, size: 1.4 }; },
    ferry(C){ const m = new Mesh();
      m.box(0, 0, 0.1, 1.3, 0.5, 0.2, WHITE, { taperY: 0.05 });
      m.box(0.72, 0, 0.1, 0.16, 0.5, 0.2, WHITE, { taperY: 0.9 });
      m.box(0, 0, 0.06, 1.31, 0.51, 0.06, C);
      m.box(-0.1, 0, 0.27, 0.8, 0.4, 0.14, WHITE).box(-0.15, 0, 0.38, 0.55, 0.34, 0.1, WHITE);
      m.box(-0.1, 0, 0.3, 0.81, 0.41, 0.04, GLASS).box(-0.15, 0, 0.4, 0.56, 0.35, 0.03, GLASS);
      m.cyl(-0.3, 0, 0.5, 0.07, 0.16, "z", C, 10);
      return { m, size: 1.3, water: true }; },
    boat(C){ const m = new Mesh();
      m.box(0, 0, 0.07, 0.9, 0.3, 0.14, WHITE, { taperY: 0.2 });
      m.box(0.5, 0, 0.07, 0.12, 0.3, 0.14, WHITE, { taperY: 0.95 });
      m.box(0, 0, 0.04, 0.91, 0.31, 0.03, C);
      m.box(0.05, 0, 0.5, 0.03, 0.03, 0.8, GREY);
      m.tri([0.06, 0, 0.14], [0.06, 0, 0.88], [-0.42, 0, 0.16], WHITE);
      m.tri([0.04, 0, 0.14], [-0.42, 0, 0.16], [0.04, 0, 0.88], hex("#e8e8e4"));
      m.tri([0.08, 0, 0.82], [0.45, 0, 0.12], [0.08, 0, 0.14], C);
      m.tri([0.08, 0, 0.82], [0.08, 0, 0.14], [0.45, 0, 0.12], C);
      return { m, size: 1.1, water: true }; },
    fly(C){ const m = new Mesh();
      m.cyl(0, 0, 0.2, 0.09, 1.0, "x", WHITE, 12);
      m.cyl(0.58, 0, 0.2, 0.09, 0.16, "x", WHITE, 12, 0, 0.01);
      m.cyl(-0.6, 0, 0.22, 0.09, 0.2, "x", WHITE, 12, 0, 0.03);
      m.box(0.52, 0, 0.24, 0.06, 0.12, 0.04, GLASS);
      m.box(0.02, 0, 0.17, 0.26, 1.1, 0.025, WHITE, { taperX: 0.3 });
      m.cyl(0.08, 0.26, 0.12, 0.045, 0.2, "x", C, 10).cyl(0.08, -0.26, 0.12, 0.045, 0.2, "x", C, 10);
      m.box(-0.62, 0, 0.23, 0.14, 0.38, 0.02, WHITE);
      m.box(-0.6, 0, 0.36, 0.2, 0.02, 0.26, C, { taperX: 0.5, shiftX: -0.05 });
      m.box(0, 0, 0.2, 1.01, 0.181, 0.03, C);
      return { m, size: 1.45, air: true }; },
    heli(C){ const m = new Mesh(), L = mix(C, [1, 1, 1], 0.2);
      m.box(0.1, 0, 0.26, 0.5, 0.32, 0.3, C, { top: L, taperX: 0.25 });
      m.box(0.3, 0, 0.27, 0.12, 0.3, 0.22, GLASS, { taperX: 0.4 });
      m.box(-0.38, 0, 0.3, 0.6, 0.06, 0.06, C);
      m.box(-0.66, 0, 0.38, 0.1, 0.02, 0.16, C);
      m.box(0.1, 0.14, 0.06, 0.6, 0.03, 0.03, GREY).box(0.1, -0.14, 0.06, 0.6, 0.03, 0.03, GREY);
      m.box(0.1, 0, 0.44, 0.05, 0.05, 0.06, GREY);
      m.box(0.1, 0, 0.48, 1.3, 0.06, 0.012, DARK, { tag: 1 }).box(0.1, 0, 0.48, 0.06, 1.3, 0.012, DARK, { tag: 1 });
      return { m, size: 1.05, air: true }; }
  };

  const BROWN = hex("#6b4a2c"), WOOD = hex("#8a6a45"), CABLE = hex("#2b2d31");
  Object.assign(BUILD, {
    truck(C){ const m = new Mesh(), L = mix(C, [1, 1, 1], 0.15);
      m.box(0.62, 0, 0.3, 0.36, 0.46, 0.44, C, { top: L });
      m.box(0.75, 0, 0.4, 0.11, 0.44, 0.16, GLASS, { taperX: 0.3 });
      m.box(-0.2, 0, 0.36, 1.2, 0.5, 0.52, WHITE, { top: hex("#e6e6e6") });
      m.box(-0.2, 0, 0.36, 1.21, 0.51, 0.06, C);
      [[0.62, 0.22], [0.62, -0.22], [-0.05, 0.23], [-0.05, -0.23], [-0.55, 0.23], [-0.55, -0.23]].forEach(([x, y]) => m.wheel(x, y, 0.11));
      return { m, size: 1.5 }; },
    caravan(C){ const { m } = BUILD.car(C);
      m.box(-0.6, 0, 0.2, 0.2, 0.04, 0.03, GREY);
      m.box(-1.1, 0, 0.34, 0.8, 0.46, 0.4, WHITE, { top: hex("#ececec") });
      m.box(-1.1, 0, 0.3, 0.81, 0.47, 0.05, C);
      m.box(-1.0, 0.235, 0.4, 0.3, 0.01, 0.1, GLASS).box(-1.0, -0.235, 0.4, 0.3, 0.01, 0.1, GLASS);
      m.wheel(-1.1, 0.23, 0.1).wheel(-1.1, -0.23, 0.1);
      return { m, size: 1.25 }; },
    horse(C){ const m = new Mesh(), HB = hex("#7a4b2a"), DK = hex("#3b2414");
      m.box(0, 0, 0.42, 0.62, 0.2, 0.22, HB);
      m.box(0.33, 0, 0.56, 0.14, 0.12, 0.26, HB, { shiftX: 0.08 });
      m.box(0.46, 0, 0.66, 0.22, 0.1, 0.1, HB);
      m.box(-0.34, 0, 0.42, 0.08, 0.05, 0.22, DK, { shiftX: -0.06 });
      [[0.22, 0.07, 3], [0.22, -0.07, 4], [-0.22, 0.07, 4], [-0.22, -0.07, 3]].forEach(([x, y, tg]) => m.box(x, y, 0.16, 0.06, 0.06, 0.32, DK, { tag: tg }));
      m.box(-0.02, 0, 0.7, 0.14, 0.2, 0.26, C);
      m.box(0, 0, 0.9, 0.12, 0.12, 0.12, SKIN).box(0, 0, 0.97, 0.15, 0.15, 0.04, DK);
      return { m, size: 0.95 }; },
    ski(C){ const m = new Mesh();
      m.box(0.05, 0.07, 0.02, 0.8, 0.05, 0.02, C).box(0.05, -0.07, 0.02, 0.8, 0.05, 0.02, C);
      m.box(0, 0.07, 0.16, 0.08, 0.07, 0.26, DARK, { shiftX: 0.06 }).box(0, -0.07, 0.16, 0.08, 0.07, 0.26, DARK, { shiftX: 0.06 });
      m.box(0.08, 0, 0.42, 0.18, 0.24, 0.28, C, { shiftX: 0.08 });
      m.box(0.16, 0, 0.64, 0.12, 0.12, 0.12, SKIN).box(0.16, 0, 0.71, 0.14, 0.14, 0.05, hex("#f2f2f2"));
      m.box(-0.08, 0.17, 0.25, 0.02, 0.02, 0.5, GREY, { shiftX: -0.12 }).box(-0.08, -0.17, 0.25, 0.02, 0.02, 0.5, GREY, { shiftX: -0.12 });
      return { m, size: 0.8 }; },
    chairlift(C){ const m = new Mesh();
      m.box(0, 0, 1.0, 1.6, 0.025, 0.025, CABLE);
      m.box(0, 0, 0.98, 0.12, 0.08, 0.06, GREY);
      m.box(0, 0, 0.72, 0.03, 0.03, 0.5, GREY);
      m.box(0, 0, 0.42, 0.12, 0.62, 0.04, GREY);
      m.box(-0.07, 0, 0.56, 0.03, 0.62, 0.28, GREY);
      m.box(-0.0, 0.15, 0.58, 0.14, 0.17, 0.24, C).box(-0.0, -0.15, 0.58, 0.14, 0.17, 0.24, mix(C, [0, 0, 1], 0.4));
      m.box(0, 0.15, 0.76, 0.1, 0.1, 0.1, SKIN).box(0, -0.15, 0.76, 0.1, 0.1, 0.1, SKIN);
      m.box(0.12, 0.15, 0.34, 0.5, 0.05, 0.02, hex("#e33")).box(0.12, -0.15, 0.34, 0.5, 0.05, 0.02, hex("#e33"));
      return { m, size: 0.95, hang: true }; },
    cablecar(C){ const m = new Mesh(), L = mix(C, [1, 1, 1], 0.2);
      m.box(0, 0.06, 1.05, 1.8, 0.02, 0.02, CABLE).box(0, -0.06, 1.05, 1.8, 0.02, 0.02, CABLE);
      m.box(0, 0, 1.0, 0.36, 0.14, 0.08, GREY);
      m.box(0, 0, 0.8, 0.04, 0.04, 0.34, GREY);
      m.box(0, 0, 0.42, 0.7, 0.5, 0.42, C, { top: L });
      m.box(0, 0, 0.47, 0.71, 0.51, 0.16, GLASS);
      m.box(0, 0, 0.66, 0.66, 0.46, 0.04, L);
      return { m, size: 1.0, hang: true }; },
    kayak(C){ const m = new Mesh();
      m.box(0, 0, 0.05, 0.8, 0.16, 0.08, C, { taperY: 0.3 });
      m.box(0.48, 0, 0.05, 0.16, 0.16, 0.08, C, { taperY: 0.95 }).box(-0.48, 0, 0.05, 0.16, 0.16, 0.08, C, { taperY: 0.95 });
      m.box(0, 0, 0.2, 0.12, 0.18, 0.22, hex("#f4c430"));
      m.box(0, 0, 0.37, 0.1, 0.1, 0.1, SKIN);
      m.box(0.04, 0, 0.26, 0.03, 0.9, 0.02, DARK, { tag: 1 });
      return { m, size: 0.75, water: true }; },
    cruise(C){ const m = new Mesh();
      m.box(0, 0, 0.12, 1.6, 0.42, 0.24, WHITE, { taperY: 0.05 });
      m.box(0.9, 0, 0.12, 0.2, 0.42, 0.24, WHITE, { taperY: 0.9 });
      m.box(0, 0, 0.04, 1.61, 0.43, 0.06, hex("#1d2f52"));
      for (let k = 0; k < 4; k++) m.box(-0.05 - k * 0.04, 0, 0.3 + k * 0.08, 1.2 - k * 0.22, 0.36, 0.08, WHITE).box(-0.05 - k * 0.04, 0, 0.3 + k * 0.08, 1.21 - k * 0.22, 0.37, 0.025, GLASS);
      m.cyl(-0.35, 0, 0.7, 0.07, 0.2, "z", C, 10);
      return { m, size: 1.6, water: true }; },
    balloon(C){ const m = new Mesh(), W2 = mix(C, [1, 1, 1], 0.7);
      const prof = [[0.12, 0.62], [0.26, 0.72], [0.36, 0.84], [0.4, 0.98], [0.38, 1.1], [0.3, 1.2], [0.16, 1.27], [0.0, 1.3]];
      for (let i = 0; i < prof.length - 1; i++){
        const [r0, z0] = prof[i], [r1, z1] = prof[i + 1];
        m.cyl(0, 0, (z0 + z1) / 2, r0, z1 - z0, "z", i % 2 ? C : W2, 14, 0, r1);
      }
      m.box(0, 0, 0.1, 0.18, 0.18, 0.16, WOOD);
      [[0.08, 0.08], [0.08, -0.08], [-0.08, 0.08], [-0.08, -0.08]].forEach(([x, y]) => m.box(x, y, 0.38, 0.012, 0.012, 0.5, CABLE));
      return { m, size: 1.0, air: true, high: 0.35 }; },
    paraglider(C){ const m = new Mesh(), N = 9;
      for (let i = 0; i < N; i++){
        const a0 = -0.9 + 1.8 * i / N, a1 = -0.9 + 1.8 * (i + 1) / N;
        const P = (a, x) => [x, Math.sin(a) * 0.6, 0.85 + Math.cos(a) * 0.25];
        m.quad(P(a0, 0.12), P(a1, 0.12), P(a1, -0.12), P(a0, -0.12), i % 2 ? C : mix(C, [1, 1, 1], 0.45));
        m.quad(P(a0, -0.12), P(a1, -0.12), P(a1, 0.12), P(a0, 0.12), mix(C, [0, 0, 0], 0.2));
      }
      [-0.45, 0.45].forEach(y => m.tri([0, y, 0.95], [0.02, 0, 0.32], [-0.02, 0, 0.32], CABLE));
      m.box(0, 0, 0.22, 0.2, 0.16, 0.2, DARK).box(0.02, 0, 0.38, 0.1, 0.1, 0.1, SKIN);
      return { m, size: 1.0, air: true, high: 0.3 }; }
  });
  const ALIAS = { car: "car", camper: "camper", bus: "bus", moto: "moto", bike: "bike", foot: "foot", run: "foot",
                  train: "train", ferry: "ferry", boat: "boat", fly: "fly", heli: "heli", truck: "truck", caravan: "caravan",
                  horse: "horse", ski: "ski", chairlift: "chairlift", cablecar: "cablecar", kayak: "kayak", cruise: "cruise",
                  balloon: "balloon", paraglider: "paraglider" };

  /* ---------- WebGL ---------- */
  const VS = `
    attribute vec3 a_pos; attribute vec3 a_nor; attribute vec3 a_col; attribute float a_tag;
    uniform mat4 u_matrix; uniform mat3 u_rot; uniform float u_scale; uniform float u_alt;
    uniform float u_shadow; uniform float u_spin; uniform float u_step; uniform vec2 u_sun;
    varying vec3 v_col; varying float v_light;
    void main(){
      vec3 p = a_pos;
      if (a_tag == 1.0){ float c = cos(u_spin), s = sin(u_spin); vec2 q = p.xy - vec2(0.1, 0.0); p.xy = vec2(c*q.x - s*q.y, s*q.x + c*q.y) + vec2(0.1, 0.0); }
      if (a_tag == 3.0) p.x += u_step * (1.0 - p.z * 2.0) * 0.12;
      if (a_tag == 4.0) p.x -= u_step * (1.0 - p.z * 2.0) * 0.12;
      vec3 w = u_rot * p * u_scale;
      vec3 n = normalize(u_rot * a_nor);
      if (u_shadow > 0.5){
        float h = w.z + u_alt;
        w = vec3(w.x + h * u_sun.x, w.y + h * u_sun.y, 0.0);
        v_col = vec3(0.0); v_light = 1.0;
      } else {
        w.z += u_alt;
        vec3 L = normalize(vec3(-0.45, -0.55, 0.75));
        v_light = 0.58 + 0.42 * max(dot(n, L), 0.0) + 0.12 * max(n.z, 0.0);
        v_col = a_col;
      }
      gl_Position = u_matrix * vec4(w, 1.0);
    }`;
  const FS = `precision mediump float; varying vec3 v_col; varying float v_light; uniform float u_alpha;
    void main(){ gl_FragColor = vec4(v_col * v_light, u_alpha); }`;

  let gl = null, prog = null, loc = {}, cache = new Map(), items = [], time = 0, mapRef = null;

  function compile(g){
    const sh = (type, src) => { const s = g.createShader(type); g.shaderSource(s, src); g.compileShader(s);
      if (!g.getShaderParameter(s, g.COMPILE_STATUS)) throw new Error("3D-Shader: " + g.getShaderInfoLog(s)); return s; };
    const p = g.createProgram();
    g.attachShader(p, sh(g.VERTEX_SHADER, VS)); g.attachShader(p, sh(g.FRAGMENT_SHADER, FS)); g.linkProgram(p);
    ["a_pos", "a_nor", "a_col", "a_tag"].forEach(k => loc[k] = g.getAttribLocation(p, k));
    ["u_matrix", "u_rot", "u_scale", "u_alt", "u_shadow", "u_alpha", "u_spin", "u_step", "u_sun"].forEach(k => loc[k] = g.getUniformLocation(p, k));
    return p;
  }
  function meshFor(mode, color){
    const key = mode + color;
    if (cache.has(key)) return cache.get(key);
    const b = (BUILD[ALIAS[mode]] || BUILD.car)(hex(color));
    const mk = arr => { const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW); return buf; };
    const o = { pos: mk(b.m.p), nor: mk(b.m.n), col: mk(b.m.c), tag: mk(b.m.tag), count: b.m.p.length / 3, size: b.size, air: b.air, water: b.water, high: b.high };
    cache.set(key, o);
    return o;
  }
  function bind(buf, a, n){ gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, n, gl.FLOAT, false, 0, 0); }
  function mul(a, b){ // 4x4, Spaltenmajor
    const o = new Float64Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++){
      let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; }
    return o;
  }

  const layer = {
    id: "tip-3d", type: "custom", renderingMode: "3d",
    onAdd(map, g){ mapRef = map; gl = g; prog = compile(g); cache = new Map(); },
    onRemove(){ cache = new Map(); prog = null; },
    render(g, args){
      if (!items.length || !prog) return;
      const main = (args && args.defaultProjectionData && args.defaultProjectionData.mainMatrix) || (args && args.modelViewProjectionMatrix) || args;
      const zoom = mapRef.getZoom();
      const mercPerPx = 1 / (512 * Math.pow(2, zoom));
      g.useProgram(prog);
      g.disable(g.CULL_FACE);
      for (const it of items){
        const mesh = meshFor(it.mode, it.color);
        const mc = maplibregl.MercatorCoordinate.fromLngLat(it.lngLat, 0);
        let ground = 0;
        try {
          if (it.groundM != null) ground = it.groundM * mc.meterInMercatorCoordinateUnits();
          else if (mapRef.getTerrain && mapRef.getTerrain()) ground = (mapRef.queryTerrainElevation(it.lngLat) || 0) * mc.meterInMercatorCoordinateUnits();
        } catch {}
        const T = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, mc.x, mc.y, ground, 1];
        g.uniformMatrix4fv(loc.u_matrix, false, new Float32Array(mul(main, T)));
        const h = it.heading || 0, c = Math.cos(h), s = Math.sin(h);
        const roll = mesh.water ? Math.sin(time * 2.2) * 0.06 : 0, cr = Math.cos(roll), sr = Math.sin(roll);
        // Spalten = Bilder der Modellachsen: x → Fahrtrichtung, y → links davon (Mercator-y zeigt nach Süden), z → oben; plus Rollen um x
        g.uniformMatrix3fv(loc.u_rot, false, new Float32Array([c, s, 0, s * cr, -c * cr, sr, -s * sr, c * sr, cr]));
        const scale = (it.px || 54) * mesh.size * mercPerPx;
        let alt = 0;
        if (mesh.air && mesh.high){ alt = mesh.high * scale; }
        else if (mesh.air){ const k = Math.sin(Math.PI * Math.min(Math.max(it.prog || 0, 0), 1)); alt = (mesh.size * 0.4 * Math.pow(k, 0.6)) * scale / mesh.size; }
        g.uniform1f(loc.u_scale, scale);
        g.uniform1f(loc.u_alt, alt);
        g.uniform1f(loc.u_spin, time * 28);
        g.uniform1f(loc.u_step, Math.sin(time * 9));
        g.uniform2f(loc.u_sun, 0.45, 0.35);
        bind(mesh.pos, loc.a_pos, 3); bind(mesh.nor, loc.a_nor, 3); bind(mesh.col, loc.a_col, 3); bind(mesh.tag, loc.a_tag, 1);
        // Schatten
        g.enable(g.BLEND); g.blendFunc(g.SRC_ALPHA, g.ONE_MINUS_SRC_ALPHA);
        g.disable(g.DEPTH_TEST);
        g.uniform1f(loc.u_shadow, 1); g.uniform1f(loc.u_alpha, mesh.air && alt > 0 ? 0.16 : 0.28);
        g.drawArrays(g.TRIANGLES, 0, mesh.count);
        // Modell
        g.enable(g.DEPTH_TEST); g.depthFunc(g.LEQUAL); g.depthMask(true);
        g.disable(g.BLEND);
        g.uniform1f(loc.u_shadow, 0); g.uniform1f(loc.u_alpha, 1);
        g.drawArrays(g.TRIANGLES, 0, mesh.count);
      }
      g.disable(g.DEPTH_TEST);
    }
  };

  return {
    addLayer(map){ if (!map.getLayer("tip-3d")) map.addLayer(layer); },
    update(list, t){ items = list || []; time = t || 0; if (mapRef) mapRef.triggerRepaint(); },
    modes: Object.keys(BUILD),
    isAir(mode){ return ["fly", "heli", "balloon", "paraglider"].includes(ALIAS[mode] || mode); }
  };
})();
