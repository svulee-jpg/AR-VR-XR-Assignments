/*
 * rooms.js
 * The furniture and decor of the kitchen, the bedroom, the hallway and the bathroom ("room-set" component).
 * The living room has its own file (livingset.js). The style follows a bright modern apartment: white
 * surfaces, light oak, black metal details, a few warm colours and green plants.
 *
 * Everything is built from simple shapes (boxes, cylinders, spheres, extruded rounded blocks) and
 * canvas textures drawn in code: no downloaded models, textures or pictures. Each piece is its own
 * removable item (see Kit.Furniture in kit.js); the shapes of one piece that share a material are
 * merged into one mesh, so the whole apartment stays cheap to draw.
 *
 * Coordinates are metres in the world of js/plan.js. The comments name the wall a piece stands at.
 */
(function () {
  'use strict';

  var T = AFRAME.THREE;
  var Kit = window.Kit;
  var F = Kit.Furniture;
  var mat = Kit.mat, tex = Kit.tex, rng = Kit.rng;
  var Item = Kit.Item;

  // ---------------------------------------------------------------------------
  // Shared materials and textures (made once, on first use)
  // ---------------------------------------------------------------------------
  var M = null;

  // soft grey veins on white: the quartz of the kitchen worktop and splashback
  function quartzTexture(w, h, rx) {
    var R = rng(31);
    return tex(w, h, function (ctx, cw, ch) {
      var g = ctx.createLinearGradient(0, 0, cw, ch);
      g.addColorStop(0, '#f6f5f2'); g.addColorStop(1, '#ecebe8');
      ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
      for (var v = 0; v < 14; v++) {
        ctx.strokeStyle = 'rgba(110,112,118,' + (0.06 + R() * 0.16) + ')';
        ctx.lineWidth = 0.6 + R() * 2.4;
        ctx.beginPath();
        var x = R() * cw, y = -10;
        ctx.moveTo(x, y);
        while (y < ch + 10) { x += (R() - 0.45) * ch * 0.5; y += ch * (0.12 + R() * 0.2); ctx.quadraticCurveTo(x + (R() - 0.5) * 30, y - 20, x, y); }
        ctx.stroke();
      }
    }, rx || 1, 1);
  }

  function mirrorTexture() {
    return tex(256, 256, function (ctx, w, h) {
      var g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#f4f7f8'); g.addColorStop(0.55, '#cdd7da'); g.addColorStop(1, '#e8eef0');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(w * 0.2, 0, w * 0.06, h);
      ctx.fillStyle = 'rgba(120,130,135,0.18)'; ctx.fillRect(w * 0.55, 0, w * 0.2, h);
    });
  }

  // round rug of the dining area: blue with cream rings
  function roundRugTexture() {
    return tex(512, 512, function (ctx, w, h) {
      var R = rng(8);
      ctx.fillStyle = '#3f6a99'; ctx.fillRect(0, 0, w, h);
      var cx = w / 2, cy = h / 2;
      [[250, '#3f6a99'], [236, '#e9e3d4'], [224, '#3f6a99'], [170, '#355d88'], [120, '#4a77a5'], [70, '#e9e3d4'], [58, '#3f6a99']].forEach(function (r) {
        ctx.fillStyle = r[1]; ctx.beginPath(); ctx.arc(cx, cy, r[0], 0, Math.PI * 2); ctx.fill();
      });
      for (var i = 0; i < 6000; i++) { ctx.fillStyle = 'rgba(255,255,255,' + (R() * 0.06) + ')'; ctx.fillRect(R() * w, R() * h, 2, 2); }
    });
  }

  // geometric rug of the bedroom: cream with a grey and rust diamond lattice
  function geoRugTexture() {
    return tex(512, 512, function (ctx, w, h) {
      var R = rng(15);
      ctx.fillStyle = '#e8e2d6'; ctx.fillRect(0, 0, w, h);
      var n = 6, s = w / n;
      for (var r = 0; r < n; r++) {
        for (var c = 0; c < n; c++) {
          var x = c * s + s / 2, y = r * s + s / 2;
          ctx.fillStyle = (r + c) % 2 ? '#8d8f92' : '#c9c4b8';
          ctx.beginPath(); ctx.moveTo(x, y - s / 2); ctx.lineTo(x + s / 2, y); ctx.lineTo(x, y + s / 2); ctx.lineTo(x - s / 2, y); ctx.closePath(); ctx.fill();
          ctx.fillStyle = (r + c) % 3 === 0 ? '#b4573a' : '#e8e2d6';
          ctx.beginPath(); ctx.moveTo(x, y - s / 5); ctx.lineTo(x + s / 5, y); ctx.lineTo(x, y + s / 5); ctx.lineTo(x - s / 5, y); ctx.closePath(); ctx.fill();
        }
      }
      for (var i = 0; i < 9000; i++) { ctx.fillStyle = 'rgba(0,0,0,' + (R() * 0.07) + ')'; ctx.fillRect(R() * w, R() * h, 2, 2); }
    });
  }

  // abstract pictures (drawn in code; invented compositions, not copies of any artwork)
  function artTexture(kind) {
    var R = rng(kind === 'arches' ? 41 : kind === 'waves' ? 42 : 43);
    return tex(256, 320, function (ctx, w, h) {
      if (kind === 'arches') {
        ctx.fillStyle = '#efe6d6'; ctx.fillRect(0, 0, w, h);
        var cols = ['#c9714b', '#e3b98a', '#7f9a7a', '#3f6a99'];
        for (var i = 0; i < 4; i++) {
          var rr = 100 - i * 22;
          ctx.fillStyle = cols[i];
          ctx.beginPath(); ctx.arc(w / 2, h * 0.62, rr, Math.PI, 0); ctx.lineTo(w / 2 + rr, h * 0.9); ctx.lineTo(w / 2 - rr, h * 0.9); ctx.closePath(); ctx.fill();
        }
      } else if (kind === 'waves') {
        ctx.fillStyle = '#e7ddcc'; ctx.fillRect(0, 0, w, h);
        for (var k = 0; k < 7; k++) {
          ctx.strokeStyle = ['#b4573a', '#7f9a7a', '#8d8f92', '#d9b27a', '#4d5d57', '#c9894a', '#a8b8a0'][k];
          ctx.lineWidth = 7 + R() * 9;
          ctx.beginPath(); ctx.moveTo(-10, 30 + k * 40);
          ctx.bezierCurveTo(w * 0.3, 0 + k * 40 + R() * 60, w * 0.6, 80 + k * 40 - R() * 60, w + 10, 20 + k * 40 + R() * 30);
          ctx.stroke();
        }
      } else {
        var bands = ['#2f3a4a', '#4f6a86', '#c9d6dc', '#e8d3a6', '#d99a63', '#b4573a'];
        var y = 0;
        bands.forEach(function (b, i) { var bh = i === 2 ? 70 : 46; ctx.fillStyle = b; ctx.fillRect(0, y, w, bh); y += bh; });
        ctx.fillStyle = '#f2e6c8'; ctx.beginPath(); ctx.arc(w * 0.62, h * 0.58, 30, 0, Math.PI * 2); ctx.fill();
      }
      for (var j = 0; j < 2500; j++) { ctx.fillStyle = 'rgba(0,0,0,' + (R() * 0.04) + ')'; ctx.fillRect(R() * w, R() * h, 2, 2); }
    });
  }

  function materials() {
    if (M) return M;
    var mirrorTex = mirrorTexture();
    M = {
      white: mat(0xf4f3ef, { rough: 0.55 }),
      white2: mat(0xeceae5, { rough: 0.6 }),
      gloss: mat(0xfafafa, { rough: 0.25 }),
      ceramic: mat(0xf8f8f6, { rough: 0.18 }),
      black: mat(0x1a1a1c, { rough: 0.4, metal: 0.35 }),
      brass: mat(0xc2a15a, { rough: 0.3, metal: 0.8 }),
      chrome: mat(0xe4e8ea, { rough: 0.2, metal: 0.55 }),
      steel: mat(0xc7cbce, { rough: 0.3, metal: 0.8 }),
      darkSteel: mat(0x7d8286, { rough: 0.35, metal: 0.8 }),
      glassBlack: mat(0x15171a, { rough: 0.12, metal: 0.3 }),
      oak: mat(0xc8a06a, { rough: 0.55 }),
      oakDark: mat(0x8a6240, { rough: 0.55 }),
      plinth: mat(0x2b2c2e, { rough: 0.6 }),
      cream: mat(0xe9dfcc, { rough: 0.9 }),
      greyFabric: mat(0x9a9b9a, { rough: 0.95 }),
      greyLight: mat(0xc9cac8, { rough: 0.95 }),
      greyVanity: mat(0x8d9093, { rough: 0.5 }),
      rust: mat(0xb4573a, { rough: 0.95 }),
      sage: mat(0x7f9a7a, { rough: 0.95 }),
      beige: mat(0xd8cdb8, { rough: 0.95 }),
      quartzTop: mat(0xffffff, { rough: 0.2, map: quartzTexture(512, 512, 3) }),
      quartzWall: mat(0xffffff, { rough: 0.25, map: quartzTexture(1536, 280, 1) }),
      glass: mat(0xcfe3e6, { rough: 0.05, metal: 0.1, opacity: 0.22 }),
      mirror: mat(0xffffff, { rough: 0.05, map: mirrorTex, emissive: 0xb8c4c8, emissiveIntensity: 0.5 }),
      lampShade: mat(0xf3ead6, { rough: 0.9, emissive: 0xffe2a8, emissiveIntensity: 0.35, side: T.DoubleSide }),
      globe: mat(0xfff3d6, { rough: 0.2, emissive: 0xffe2a8, emissiveIntensity: 0.9, opacity: 0.85 }),
      pot: mat(0xb8663c, { rough: 0.8 }),
      potWhite: mat(0xf0eee9, { rough: 0.6 }),
      soil: mat(0x3a2a1c, { rough: 1 }),
      stem: mat(0x6b5a3c, { rough: 0.8 }),
      leaf: mat(0x4f7d46, { rough: 0.6 }),
      leaf2: mat(0x3f6a3c, { rough: 0.6 }),
      towelSage: mat(0x8fa68b, { rough: 1 }),
      roundRug: mat(0xffffff, { rough: 1, map: roundRugTexture() }),
      geoRug: mat(0xffffff, { rough: 1, map: geoRugTexture() }),
      artArches: mat(0xffffff, { rough: 0.8, map: artTexture('arches') }),
      artWaves: mat(0xffffff, { rough: 0.8, map: artTexture('waves') }),
      artHorizon: mat(0xffffff, { rough: 0.8, map: artTexture('horizon') })
    };
    return M;
  }

  // ---------------------------------------------------------------------------
  // Small helpers
  // ---------------------------------------------------------------------------

  // A picture hanging on a wall. (cx, cz) = the point on the wall; ry = direction the picture faces
  // (0 = towards +z, PI = towards -z, PI/2 = towards +x, -PI/2 = towards -x).
  function picture(item, art, frame, cx, cy, cz, w, h, ry) {
    var nx = Math.sin(ry), nz = Math.cos(ry);
    item.box(w + 0.05, h + 0.05, 0.03, frame, cx + nx * 0.015, cy, cz + nz * 0.015, 0, ry, 0);
    item.plane(w, h, art, cx + nx * 0.032, cy, cz + nz * 0.032, 0, ry, 0);
  }

  // A rubber-plant style plant in a pot; s = scale.
  function plant(item, x, z, s, seed, potMat) {
    var m = materials(), R = rng(seed || 5);
    item.cyl(0.17 * s, 0.12 * s, 0.3 * s, potMat || m.pot, x, 0.15 * s, z, 0, 0, 0, 20);
    item.cyl(0.155 * s, 0.155 * s, 0.01, m.soil, x, 0.3 * s, z, 0, 0, 0, 16);
    item.cyl(0.012 * s, 0.02 * s, 0.95 * s, m.stem, x, 0.3 * s + 0.475 * s, z, 0, 0, 0, 6);
    for (var i = 0; i < 14; i++) {
      var a = i * 2.399 + R() * 0.5;
      var h = (0.55 + (i / 14) * 0.7 + R() * 0.08) * s;
      var r = (0.1 + R() * 0.13) * s;
      var dx = Math.sin(a), dz = Math.cos(a), tilt = 0.45 + R() * 0.25;
      item.add(new T.SphereGeometry(1, 8, 6), i % 3 ? m.leaf : m.leaf2,
        x + dx * r, h, z + dz * r, -dz * tilt, 0, dx * tilt, 0.1 * s, 0.014 * s, 0.15 * s);
    }
  }

  // A rectangle [x0, z0, x1, z1] around (cx, cz) with half sizes hx, hz.
  function around(cx, cz, hx, hz) { return [cx - hx, cz - hz, cx + hx, cz + hz]; }

  // ===========================================================================
  // KITCHEN  (x 2.6 .. 6.5, z -3.5 .. 0.5): units along the east wall, dining area in the middle
  // ===========================================================================
  function kitchen(el) {
    var m = materials();
    var X = 5.9; // front of the base units (the wall is at x = 6.5)

    // ---- fitted units: base cabinets, worktop, splashback, wall cabinets (the fridge, range and hood are separate pieces)
    var u = new Item('Kitchen units');
    u.box(0.52, 0.08, 3.4, m.plinth, 6.24, 0.04, -1.2);                       // plinth
    var BASE = [[-2.9, -2.3, 'drawers'], [-1.7, -1.1, 'door'], [-1.1, -0.2, 'sink'], [-0.2, 0.5, 'dish']];
    BASE.forEach(function (b) {
      var w = b[1] - b[0], zc = (b[0] + b[1]) / 2;
      u.box(0.56, 0.78, w, m.white2, 6.22, 0.47, zc);                         // carcass
      if (b[2] === 'drawers') {
        [0.25, 0.51, 0.77].forEach(function (y) {
          u.box(0.02, 0.245, w - 0.008, m.white, X + 0.01, y, zc);
          u.box(0.02, 0.012, w * 0.55, m.black, X - 0.012, y + 0.075, zc);
        });
      } else if (b[2] === 'door') {
        u.box(0.02, 0.77, w - 0.008, m.white, X + 0.01, 0.485, zc);
        u.box(0.02, 0.34, 0.014, m.black, X - 0.012, 0.66, zc + w / 2 - 0.06);
      } else if (b[2] === 'sink') {
        [-1, 1].forEach(function (s) {
          u.box(0.02, 0.77, w / 2 - 0.008, m.white, X + 0.01, 0.485, zc + s * w / 4);
          u.box(0.02, 0.34, 0.014, m.black, X - 0.012, 0.66, zc + s * w / 4 - s * (w / 4 - 0.06));
        });
      } else {                                                                // dishwasher (steel) and a filler strip
        u.box(0.02, 0.77, 0.592, m.steel, X + 0.01, 0.485, zc - 0.05);
        u.box(0.02, 0.07, 0.592, m.glassBlack, X + 0.012, 0.8, zc - 0.05);
        u.box(0.02, 0.014, 0.5, m.black, X - 0.012, 0.74, zc - 0.05);
        u.box(0.02, 0.77, 0.098, m.white, X + 0.01, 0.485, 0.45);
      }
    });
    // worktop (quartz) in two runs: the range sits between them
    u.box(0.64, 0.04, 0.6, m.quartzTop, 6.18, 0.9, -2.6);
    u.box(0.64, 0.04, 2.2, m.quartzTop, 6.18, 0.9, -0.6);
    u.plane(3.4, 0.63, m.quartzWall, 6.492, 1.235, -1.2, 0, -Math.PI / 2, 0); // splashback
    // sink: a stainless basin with a black gooseneck tap
    u.box(0.46, 0.012, 0.74, m.steel, 6.2, 0.924, -0.65);
    u.box(0.4, 0.014, 0.68, m.darkSteel, 6.2, 0.926, -0.65);
    u.cyl(0.02, 0.02, 0.03, m.black, 6.4, 0.945, -0.65, 0, 0, 0, 12);
    u.tube([[6.4, 0.94, -0.65], [6.4, 1.22, -0.65], [6.34, 1.32, -0.65], [6.22, 1.3, -0.65], [6.18, 1.2, -0.65]], 0.011, m.black, 24);
    // wall cabinets: white, flat, black bar handles
    var UP = [[-2.9, -2.3], [-1.7, -0.8], [-0.8, 0.1], [0.1, 0.5]];
    UP.forEach(function (b) {
      var w = b[1] - b[0], zc = (b[0] + b[1]) / 2;
      u.box(0.33, 0.85, w, m.white2, 6.335, 1.975, zc);
      u.box(0.018, 0.84, w - 0.008, m.white, 6.165, 1.975, zc);
      u.box(0.02, 0.26, 0.014, m.black, 6.145, 1.75, zc + w / 2 - 0.06);
    });
    u.box(0.6, 0.5, 0.6, m.white2, 6.2, 2.15, -3.2);                          // cabinet above the fridge
    u.box(0.018, 0.49, 0.592, m.white, 5.911, 2.15, -3.2);
    u.box(0.02, 0.22, 0.014, m.black, 5.89, 2.0, -3.02);
    // a bowl of lemons and a chopping board on the worktop
    u.box(0.3, 0.02, 0.4, m.oak, 6.2, 0.93, -2.55);
    u.cyl(0.11, 0.07, 0.07, m.potWhite, 6.2, 0.975, -0.05 - 1.35, 0, 0, 0, 20);
    [[-0.04, 0.02], [0.04, 0.0], [0, -0.04], [0.0, 0.05]].forEach(function (p, i) {
      u.ball(0.04, i % 2 ? m.cream : m.brass, 6.2 + p[0], 1.04, -1.4 + p[1], 1, 0.8, 1.2);
    });
    F.add(el, u, { room: 'kitchen', label: 'Kitchen units', words: 'cabinet cabinets cupboard cupboards counter worktop kitchen sink dishwasher',
      rects: [[5.88, -2.9, 6.5, -2.3], [5.88, -1.7, 6.5, 0.5]] });

    // ---- fridge (stainless, black bar handles) at the north end
    var f = new Item('Fridge');
    f.box(0.65, 1.82, 0.6, m.steel, 6.175, 0.93, -3.2);
    f.box(0.012, 0.014, 0.6, m.black, 5.848, 0.62, -3.2);
    f.box(0.026, 0.8, 0.02, m.black, 5.836, 1.25, -3.04);
    f.box(0.026, 0.02, 0.42, m.black, 5.836, 0.66, -3.2);
    F.add(el, f, { room: 'kitchen', label: 'Fridge', words: 'refrigerator freezer', rect: [5.85, -3.5, 6.5, -2.9] });

    // ---- range: black glass hob over a stainless oven
    var r = new Item('Range');
    r.box(0.6, 0.84, 0.6, m.steel, 6.2, 0.46, -2.0);
    r.box(0.02, 0.5, 0.52, m.glassBlack, 5.89, 0.4, -2.0);                    // oven window
    r.box(0.026, 0.02, 0.5, m.black, 5.875, 0.7, -2.0);                       // oven handle
    for (var k = 0; k < 4; k++) r.cyl(0.012, 0.012, 0.02, m.black, 5.89, 0.8, -2.2 + k * 0.133, 0, 0, Math.PI / 2, 10);
    r.box(0.58, 0.012, 0.58, m.glassBlack, 6.2, 0.926, -2.0);                 // hob
    [[-0.13, -0.13], [-0.13, 0.13], [0.13, -0.13], [0.13, 0.13]].forEach(function (p) {
      r.cyl(0.07, 0.07, 0.004, m.darkSteel, 6.2 + p[0], 0.934, -2.0 + p[1], 0, 0, 0, 20);
    });
    F.add(el, r, { room: 'kitchen', label: 'Range', words: 'stove oven cooker cooktop hob', rect: [5.88, -2.3, 6.5, -1.7] });

    // ---- extractor hood with a chimney to the ceiling
    var h = new Item('Hood');
    h.box(0.5, 0.1, 0.62, m.steel, 6.25, 1.62, -2.0);
    h.box(0.46, 0.012, 0.58, m.glassBlack, 6.25, 1.568, -2.0);
    h.box(0.3, 1.0, 0.34, m.steel, 6.34, 2.17, -2.0);
    F.add(el, h, { room: 'kitchen', label: 'Hood', words: 'extractor chimney' });

    // ---- dining table: round white top on a black pedestal
    var tx = 4.25, tz = -1.45;
    var t = new Item('Dining table');
    t.cyl(0.62, 0.62, 0.04, m.white, tx, 0.74, tz, 0, 0, 0, 36);
    t.cyl(0.07, 0.09, 0.7, m.black, tx, 0.37, tz, 0, 0, 0, 14);
    t.cyl(0.3, 0.32, 0.03, m.black, tx, 0.015, tz, 0, 0, 0, 28);
    t.cyl(0.07, 0.05, 0.12, m.potWhite, tx, 0.82, tz, 0, 0, 0, 14);          // small vase with green sprigs
    for (var i = 0; i < 5; i++) {
      var a = i * 1.25;
      t.cyl(0.004, 0.004, 0.28, m.stem, tx + Math.sin(a) * 0.02, 0.98, tz + Math.cos(a) * 0.02, Math.cos(a) * 0.25, 0, -Math.sin(a) * 0.25, 5);
      t.ball(0.035, m.leaf, tx + Math.sin(a) * 0.07, 1.1, tz + Math.cos(a) * 0.07, 1, 0.6, 1);
    }
    F.add(el, t, { room: 'kitchen', label: 'Dining table', words: 'table', rect: around(tx, tz, 0.62, 0.62) });

    // ---- four chairs with scalloped backs
    var c = new Item('Dining chairs');
    var rects = [];
    [0, 90, 180, 270].forEach(function (deg) {
      var phi = deg * Math.PI / 180;
      var cx = tx + 0.8 * Math.cos(phi), cz = tz + 0.8 * Math.sin(phi);
      var ang = Math.atan2(-Math.cos(phi), -Math.sin(phi));               // the chair faces the table
      var ca = Math.cos(ang), sa = Math.sin(ang);
      var P = function (lx, lz) { return [cx + lx * ca + lz * sa, cz - lx * sa + lz * ca]; };
      var p;
      p = P(0, 0.0); c.cyl(0.22, 0.22, 0.05, m.cream, p[0], 0.45, p[1], 0, 0, 0, 24);                   // seat
      [[-0.15, 0.15], [0.15, 0.15], [-0.15, -0.15], [0.15, -0.15]].forEach(function (l, i) {          // legs
        var q = P(l[0], l[1]);
        c.cyl(0.015, 0.012, i < 2 ? 0.43 : 0.43, m.oakDark, q[0], 0.215, q[1], 0, 0, 0, 8);
      });
      p = P(0, -0.2); c.box(0.4, 0.2, 0.035, m.cream, p[0], 0.7, p[1], 0, ang, 0);                      // back
      [-0.15, 0.15].forEach(function (lx) { var q = P(lx, -0.2); c.cyl(0.013, 0.013, 0.26, m.oakDark, q[0], 0.57, q[1], 0, 0, 0, 6); });
      [-0.15, -0.05, 0.05, 0.15].forEach(function (lx) { var q = P(lx, -0.2); c.ball(0.058, m.cream, q[0], 0.8, q[1], 1, 0.9, 0.4); });
      rects.push(around(cx, cz, 0.24, 0.24));
    });
    F.add(el, c, { room: 'kitchen', label: 'Dining chairs', words: 'chair seats', rects: rects });

    // ---- round blue rug under the table
    var rg = new Item('Round rug');
    rg.cyl(1.2, 1.2, 0.012, m.roundRug, tx, 0.006, tz, 0, 0, 0, 48);
    F.add(el, rg, { room: 'kitchen', label: 'Round rug', words: 'rug carpet' });

    // ---- glass pendant lamp over the table
    var l = new Item('Pendant lamp');
    l.ball(0.17, m.globe, tx, 1.92, tz);
    l.cyl(0.004, 0.004, 0.62, m.black, tx, 2.39, tz, 0, 0, 0, 5);
    l.cyl(0.05, 0.05, 0.02, m.brass, tx, 2.69, tz, 0, 0, 0, 12);
    F.add(el, l, { room: 'kitchen', label: 'Pendant lamp', words: 'lamp light globe' });

    // ---- wall air conditioner (west wall, north of the arch)
    var ac = new Item('Air conditioner');
    ac.box(0.2, 0.3, 0.9, m.white, 2.7, 2.25, -2.5);
    ac.box(0.02, 0.04, 0.78, m.darkSteel, 2.81, 2.15, -2.5);
    ac.box(0.012, 0.012, 0.03, m.glassBlack, 2.805, 2.33, -2.2);
    F.add(el, ac, { room: 'kitchen', label: 'Air conditioner', words: 'ac aircon conditioner' });

    // ---- picture (north wall, left of the window) and a plant in the corner
    var pc = new Item('Painting');
    picture(pc, m.artArches, m.black, 3.25, 1.5, -3.5, 0.62, 0.78, 0);
    F.add(el, pc, { room: 'kitchen', label: 'Painting', words: 'picture art' });
    var pl = new Item('Plant');
    plant(pl, 3.05, -3.2, 1.1, 7, m.pot);
    F.add(el, pl, { room: 'kitchen', label: 'Plant', words: 'tree flower pot', rect: around(3.05, -3.2, 0.2, 0.2) });
  }

  // ===========================================================================
  // BEDROOM  (x -2.5 .. 1.3, z 0.6 .. 4.5): bed with its head to the west (accent) wall
  // ===========================================================================
  function bedroom(el) {
    var m = materials();
    var bz = 2.55; // centre line of the bed

    // ---- bed: padded headboard with buttons, base, mattress, duvet, pillows and a throw
    var b = new Item('Bed');
    b.box(0.12, 1.1, 1.95, m.greyFabric, -2.44, 0.67, bz);                   // headboard
    for (var r = 0; r < 3; r++) {
      for (var c = 0; c < 5; c++) b.ball(0.02, m.darkSteel, -2.375, 0.5 + r * 0.25, bz - 0.7 + c * 0.35);
    }
    b.box(2.1, 0.18, 1.72, m.oakDark, -1.43, 0.15, bz);                       // base
    b.soft(2.0, 0.24, 1.64, 0.07, m.white, -1.42, 0.37, bz);                  // mattress
    b.soft(1.4, 0.07, 1.72, 0.06, m.greyLight, -1.0, 0.52, bz);               // duvet
    b.soft(0.56, 0.03, 1.74, 0.04, m.rust, -0.55, 0.57, bz);                  // throw across the foot
    [-0.45, 0.45].forEach(function (dz) {                                      // two pillows and two small cushions
      b.soft(0.42, 0.15, 0.7, 0.07, m.white, -2.15, 0.6, bz + dz);
      b.soft(0.3, 0.12, 0.45, 0.06, m.beige, -1.95, 0.66, bz + dz * 0.85, 0, 0, 0.35);
    });
    b.soft(0.3, 0.12, 0.45, 0.05, m.sage, -1.82, 0.7, bz, 0, 1.57, 0.4);
    F.add(el, b, { room: 'bedroom', label: 'Bed', words: 'mattress', rect: [-2.5, bz - 0.88, -0.38, bz + 0.88] });

    // ---- two bedside tables with lamps
    var n = new Item('Bedside tables');
    [1.47, 3.63].forEach(function (z) {
      n.box(0.38, 0.46, 0.42, m.oak, -2.29, 0.29, z);
      n.box(0.012, 0.2, 0.38, m.oakDark, -2.095, 0.36, z);
      n.box(0.02, 0.012, 0.16, m.black, -2.09, 0.4, z);
      [[-0.15, -0.17], [0.15, -0.17], [-0.15, 0.17], [0.15, 0.17]].forEach(function (p) { n.cyl(0.012, 0.01, 0.07, m.black, -2.29 + p[0], 0.035, z + p[1], 0, 0, 0, 6); });
      n.cyl(0.05, 0.06, 0.03, m.brass, -2.29, 0.535, z, 0, 0, 0, 16);
      n.cyl(0.012, 0.012, 0.28, m.brass, -2.29, 0.69, z, 0, 0, 0, 8);
      n.cyl(0.11, 0.17, 0.2, m.lampShade, -2.29, 0.92, z, 0, 0, 0, 24);
    });
    F.add(el, n, { room: 'bedroom', label: 'Bedside tables', words: 'nightstand nightstands table tables lamp lamps', rects: [[-2.5, 1.26, -2.1, 1.68], [-2.5, 3.42, -2.1, 3.84]] });

    // ---- sliding wardrobe on the north wall: three panels, the middle one a mirror
    var w = new Item('Wardrobe');
    w.box(2.0, 2.5, 0.6, m.white2, 0.3, 1.25, 0.9);
    [-0.66, 0, 0.66].forEach(function (dx, i) {
      w.box(0.66, 2.44, 0.025, i === 1 ? m.mirror : m.white, 0.3 + dx, 1.25, 1.21 + (i === 1 ? 0.0 : 0.012));
      w.box(0.02, 0.5, 0.02, m.black, 0.3 + dx + (i === 0 ? 0.28 : -0.28), 1.1, 1.24);
    });
    F.add(el, w, { room: 'bedroom', label: 'Wardrobe', words: 'closet cupboard', rect: [-0.7, 0.6, 1.3, 1.23] });

    // ---- upholstered bench at the foot of the bed
    var bn = new Item('Bench');
    bn.soft(0.42, 0.12, 1.2, 0.05, m.greyFabric, -0.1, 0.43, bz);
    [[-0.15, -0.5], [0.15, -0.5], [-0.15, 0.5], [0.15, 0.5]].forEach(function (p) { bn.cyl(0.02, 0.015, 0.37, m.oakDark, -0.1 + p[0], 0.185, bz + p[1], 0, 0, 0, 8); });
    F.add(el, bn, { room: 'bedroom', label: 'Bench', words: 'ottoman', rect: [-0.33, bz - 0.62, 0.13, bz + 0.62] });

    // ---- geometric rug under the foot of the bed
    var rg = new Item('Rug');
    rg.plane(2.5, 1.9, m.geoRug, -0.85, 0.006, bz, -Math.PI / 2, 0, 0);
    F.add(el, rg, { room: 'bedroom', label: 'Rug', words: 'carpet' });

    // ---- picture above the headboard, a small one by the door, a plant, an air conditioner
    var pc = new Item('Painting');
    picture(pc, m.artWaves, m.oakDark, -2.5, 1.85, bz, 1.2, 0.62, Math.PI / 2);
    picture(pc, m.artHorizon, m.black, 1.3, 1.55, 1.4, 0.5, 0.64, -Math.PI / 2);
    F.add(el, pc, { room: 'bedroom', label: 'Paintings', words: 'painting picture art' });
    var pl = new Item('Plant');
    plant(pl, 0.95, 4.1, 1.2, 11, m.potWhite);
    F.add(el, pl, { room: 'bedroom', label: 'Plant', words: 'tree flower pot', rect: around(0.95, 4.1, 0.2, 0.2) });
    var ac = new Item('Air conditioner');
    ac.box(0.2, 0.3, 0.9, m.white, 1.18, 2.25, 3.75);
    ac.box(0.02, 0.04, 0.78, m.darkSteel, 1.08, 2.15, 3.75);
    F.add(el, ac, { room: 'bedroom', label: 'Air conditioner', words: 'ac aircon conditioner' });

    // ---- paper pendant lamp (round, like a cloud)
    var lp = new Item('Pendant lamp');
    lp.ball(0.2, m.lampShade, -0.8, 2.12, bz);
    lp.cyl(0.004, 0.004, 0.45, m.black, -0.8, 2.5, bz, 0, 0, 0, 5);
    F.add(el, lp, { room: 'bedroom', label: 'Pendant lamp', words: 'lamp light' });
  }

  // ===========================================================================
  // HALLWAY  (x 1.4 .. 3.4, z 0.6 .. 4.5): console with a round mirror, a bench, a runner
  // ===========================================================================
  function hall(el) {
    var m = materials();

    var c = new Item('Console');
    c.box(0.36, 0.03, 0.92, m.oak, 1.58, 0.79, 3.7);                           // top
    c.box(0.32, 0.17, 0.88, m.white, 1.57, 0.685, 3.7);                        // drawers
    c.box(0.012, 0.012, 0.2, m.black, 1.405 + 0.18, 0.69, 3.7);
    [[-0.38, -0.14], [0.38, -0.14], [-0.38, 0.14], [0.38, 0.14]].forEach(function (p) { c.cyl(0.012, 0.012, 0.6, m.black, 1.58 + p[1], 0.3, 3.7 + p[0], 0, 0, 0, 6); });
    c.cyl(0.05, 0.04, 0.2, m.potWhite, 1.58, 0.915, 3.4, 0, 0, 0, 14);          // vase with dried grass
    for (var i = 0; i < 6; i++) { var a = i * 1.05; c.cyl(0.003, 0.003, 0.4, m.stem, 1.58 + Math.sin(a) * 0.02, 1.2, 3.4 + Math.cos(a) * 0.02, Math.cos(a) * 0.18, 0, -Math.sin(a) * 0.18, 5); }
    c.box(0.18, 0.05, 0.13, m.rust, 1.58, 0.835, 3.95);                         // two books
    c.box(0.16, 0.04, 0.12, m.sage, 1.58, 0.88, 3.95, 0, 0.2, 0);
    F.add(el, c, { room: 'hall', label: 'Console', words: 'table shelf', rect: [1.4, 3.24, 1.77, 4.16] });

    var mr = new Item('Mirror');
    var ring = new T.TorusGeometry(0.4, 0.014, 8, 40);
    mr.add(ring, m.black, 1.43, 1.55, 3.7, 0, Math.PI / 2, 0);
    mr.cyl(0.4, 0.4, 0.012, m.mirror, 1.425, 1.55, 3.7, 0, 0, Math.PI / 2, 36);
    F.add(el, mr, { room: 'hall', label: 'Mirror' });

    var b = new Item('Bench');
    b.soft(0.4, 0.1, 1.0, 0.05, m.greyFabric, 3.2, 0.44, 3.7);
    [[-0.4, -0.12], [0.4, -0.12], [-0.4, 0.12], [0.4, 0.12]].forEach(function (p) { b.cyl(0.018, 0.013, 0.39, m.oakDark, 3.2 + p[1], 0.195, 3.7 + p[0], 0, 0, 0, 8); });
    b.soft(0.3, 0.1, 0.4, 0.06, m.rust, 3.2, 0.54, 3.5, 0, 0, 0.1);
    F.add(el, b, { room: 'hall', label: 'Bench', words: 'seat ottoman', rect: [3.0, 3.18, 3.4, 4.22] });

    var rg = new Item('Runner');
    rg.plane(0.8, 2.6, m.geoRug, 2.4, 0.006, 2.4, -Math.PI / 2, 0, 0);
    F.add(el, rg, { room: 'hall', label: 'Runner', words: 'rug carpet' });

    var lp = new Item('Pendant lamp');
    lp.cyl(0.26, 0.26, 0.22, m.lampShade, 2.4, 2.2, 2.55, 0, 0, 0, 28);
    lp.cyl(0.004, 0.004, 0.4, m.black, 2.4, 2.52, 2.55, 0, 0, 0, 5);
    F.add(el, lp, { room: 'hall', label: 'Pendant lamp', words: 'lamp light' });

    var pc = new Item('Painting');
    picture(pc, m.artHorizon, m.oakDark, 3.4, 1.55, 1.35, 0.55, 0.72, -Math.PI / 2);
    F.add(el, pc, { room: 'hall', label: 'Painting', words: 'picture art' });

    var pl = new Item('Plant');
    plant(pl, 3.08, 0.95, 1.0, 17, m.pot);
    F.add(el, pl, { room: 'hall', label: 'Plant', words: 'tree flower pot', rect: around(3.08, 0.95, 0.2, 0.2) });
  }

  // ===========================================================================
  // BATHROOM  (x 3.5 .. 6.5, z 0.6 .. 4.5): shower in the north-east corner, vanity on the east wall
  // ===========================================================================
  function bath(el) {
    var m = materials();

    // ---- shower: low tray, two glass panels in a black frame, rain head and a hand shower rail
    var s = new Item('Shower');
    s.box(1.2, 0.05, 1.2, m.ceramic, 5.9, 0.025, 1.2);
    s.cyl(0.05, 0.05, 0.006, m.black, 5.9, 0.052, 1.2, 0, 0, 0, 16);
    s.box(0.012, 2.0, 1.2, m.glass, 5.3, 1.05, 1.2);                          // glass, west side
    s.box(1.2, 2.0, 0.012, m.glass, 5.9, 1.05, 1.8);                          // glass, south side
    [[5.3, 0.6], [5.3, 1.8], [6.5, 1.8]].forEach(function (p) { s.box(0.03, 2.06, 0.03, m.black, p[0], 1.03, p[1]); });
    s.box(0.03, 0.03, 1.2, m.black, 5.3, 2.05, 1.2); s.box(1.2, 0.03, 0.03, m.black, 5.9, 2.05, 1.8);
    s.box(0.02, 0.02, 1.2, m.black, 5.3, 0.1, 1.2); s.box(1.2, 0.02, 0.02, m.black, 5.9, 0.1, 1.8);
    s.box(0.03, 0.3, 0.03, m.black, 5.34, 1.0, 1.78);                         // door handle
    s.cyl(0.012, 0.012, 0.5, m.black, 5.95, 2.15, 0.85, Math.PI / 2, 0, 0, 8); // arm of the rain head
    s.cyl(0.14, 0.14, 0.015, m.black, 5.95, 2.1, 1.05, 0, 0, 0, 24);          // rain head
    s.cyl(0.01, 0.01, 1.0, m.black, 6.46, 1.4, 1.2, 0, 0, 0, 8);               // hand shower rail
    s.box(0.1, 0.1, 0.06, m.black, 6.46, 1.2, 0.9);                            // tap
    s.cyl(0.02, 0.02, 0.18, m.black, 6.44, 1.45, 1.2, 0, 0, 0, 8);            // hand shower
    F.add(el, s, { room: 'bath', label: 'Shower', words: 'shower cabin glass', rect: [5.28, 0.6, 6.5, 1.82] });

    // ---- toilet against the north wall
    var t = new Item('Toilet');
    t.box(0.4, 0.42, 0.2, m.ceramic, 4.6, 0.6, 0.72);                         // cistern
    t.cyl(0.04, 0.04, 0.012, m.chrome, 4.6, 0.815, 0.72, 0, 0, 0, 14);         // flush button
    t.ball(0.21, m.ceramic, 4.6, 0.37, 0.95, 0.92, 0.7, 1.45);                 // bowl
    t.ball(0.205, m.white, 4.6, 0.44, 0.97, 0.96, 0.22, 1.45);                 // seat
    t.cyl(0.14, 0.14, 0.03, m.ceramic, 4.6, 0.04, 0.9, 0, 0, 0, 16);           // base
    F.add(el, t, { room: 'bath', label: 'Toilet', words: 'wc loo', rect: [4.35, 0.6, 4.85, 1.28] });

    // ---- wall-hung vanity (east wall): grey drawers, white top, vessel basin, black tap
    var v = new Item('Vanity');
    v.box(0.5, 0.5, 1.2, m.greyVanity, 6.25, 0.58, 3.2);
    v.box(0.012, 0.22, 1.16, m.greyVanity, 5.995, 0.7, 3.2);
    v.box(0.012, 0.012, 1.16, m.black, 5.99, 0.585, 3.2);                     // gap between the drawers
    [2.9, 3.5].forEach(function (z) { v.box(0.02, 0.012, 0.3, m.black, 5.985, 0.62, z); v.box(0.02, 0.012, 0.3, m.black, 5.985, 0.42, z); });
    v.box(0.52, 0.04, 1.24, m.white, 6.24, 0.85, 3.2);                        // top
    v.box(0.4, 0.13, 0.5, m.ceramic, 6.2, 0.935, 3.2);                         // vessel basin
    v.box(0.34, 0.01, 0.44, m.darkSteel, 6.2, 1.0, 3.2);
    v.cyl(0.016, 0.016, 0.25, m.black, 6.38, 1.0, 3.2, 0, 0, 0, 10);
    v.cyl(0.011, 0.011, 0.14, m.black, 6.31, 1.12, 3.2, 0, 0, Math.PI / 2, 8);
    v.cyl(0.045, 0.045, 0.1, m.potWhite, 6.4, 0.92, 2.7, 0, 0, 0, 14);         // soap dispenser
    F.add(el, v, { room: 'bath', label: 'Vanity', words: 'sink basin tap faucet cabinet', rect: [5.95, 2.55, 6.5, 3.85] });

    // ---- mirror with a thin black frame above the vanity
    var mr = new Item('Mirror');
    mr.box(0.02, 0.86, 1.06, m.black, 6.49, 1.62, 3.2);
    mr.plane(1.0, 0.8, m.mirror, 6.478, 1.62, 3.2, 0, -Math.PI / 2, 0);
    mr.box(0.04, 0.03, 0.5, m.brass, 6.46, 2.18, 3.2);                         // light bar over the mirror
    F.add(el, mr, { room: 'bath', label: 'Mirror' });

    // ---- washing machine (south-west corner)
    var w = new Item('Washing machine');
    w.box(0.6, 0.85, 0.6, m.white, 3.9, 0.425, 4.2);
    w.cyl(0.2, 0.2, 0.02, m.glassBlack, 3.9, 0.45, 3.9, Math.PI / 2, 0, 0, 24);
    w.cyl(0.17, 0.17, 0.02, m.glass, 3.9, 0.45, 3.89, Math.PI / 2, 0, 0, 24);
    w.box(0.46, 0.06, 0.02, m.greyLight, 3.9, 0.78, 3.9);
    w.cyl(0.03, 0.03, 0.02, m.black, 4.08, 0.78, 3.89, Math.PI / 2, 0, 0, 12);
    w.cyl(0.17, 0.15, 0.3, m.cream, 3.9, 1.0, 4.2, 0, 0, 0, 16);               // laundry basket on top
    F.add(el, w, { room: 'bath', label: 'Washing machine', words: 'washer laundry basket', rect: [3.58, 3.88, 4.22, 4.5] });

    // ---- bath mat and towels
    var bm = new Item('Bath mat');
    bm.plane(0.55, 0.85, m.beige, 5.55, 0.007, 3.2, -Math.PI / 2, 0, 0);
    bm.plane(0.5, 0.8, m.sage, 5.55, 0.008, 3.2, -Math.PI / 2, 0, 0);
    F.add(el, bm, { room: 'bath', label: 'Bath mat', words: 'rug mat carpet' });
    var tw = new Item('Towels');
    tw.cyl(0.011, 0.011, 0.8, m.black, 5.2, 1.25, 4.46, 0, 0, Math.PI / 2, 8);
    tw.box(0.4, 0.75, 0.025, m.towelSage, 5.0, 0.85, 4.45);
    tw.box(0.4, 0.75, 0.025, m.white, 5.42, 0.85, 4.45);
    F.add(el, tw, { room: 'bath', label: 'Towels', words: 'towel' });
  }

  var BUILD = { kitchen: kitchen, bedroom: bedroom, hall: hall, bath: bath };

  AFRAME.registerComponent('room-set', {
    schema: { room: { type: 'string' } },
    init: function () {
      var build = BUILD[this.data.room];
      if (build) build(this.el);
      else console.warn('room-set: unknown room', this.data.room);
    }
  });
})();
