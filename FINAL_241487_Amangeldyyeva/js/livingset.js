/*
 * "living-set": the furniture and decor of the living room, built from simple shapes and procedural
 * textures (no downloaded models). It follows a reference photo of a real living room:
 *   leather sofa with striped cushions, tartan and leather armchair on castors, glass and chrome coffee
 *   table with a reed diffuser, grey striped rug, arc floor lamp with a drum shade, octagonal bevelled
 *   mirror and an abstract grid painting.
 * Every piece is its own removable item (see Kit.Furniture in kit.js). The white panel heater under the
 * mirror and the ceiling cornice belong to the apartment shell (apartment.js).
 * Everything is the author's own work. The finishes (walls, floor, ...) stay with the configurator.
 */
AFRAME.registerComponent('living-set', {
  init: function () {
    var T = AFRAME.THREE;
    var Kit = window.Kit;
    var F = Kit.Furniture;
    var el = this.el;
    var tex = Kit.tex, mat = Kit.mat, rng = Kit.rng;

    // ------------------------------------------------------------------ materials
    var leather = mat(0x6b3a26, { rough: 0.45, metal: 0.05 });
    var leatherDark = mat(0x4f2a1b, { rough: 0.5 });
    var wood = mat(0x7a4a2d, { rough: 0.5 });
    var brass = mat(0xc9a24a, { rough: 0.35, metal: 0.5 });
    var chrome = mat(0xe4e8ea, { rough: 0.2, metal: 0.55 });
    var black = mat(0x1b1b1d, { rough: 0.5 });

    // striped cushion (vertical stripes)
    var stripeTex = tex(128, 128, function (ctx, w, h) {
      var cols = ['#8a4b2f', '#c9894a', '#e5d3b0', '#6b3a26', '#b5683a', '#e5d3b0', '#a35a33'];
      var widths = [10, 6, 16, 12, 8, 6, 14, 10, 8, 14, 12, 10];
      var x = 0, i = 0;
      while (x < w) { ctx.fillStyle = cols[i % cols.length]; var ww = widths[i % widths.length]; ctx.fillRect(x, 0, ww, h); x += ww; i++; }
    });
    var cushion = mat(0xffffff, { rough: 0.9, map: stripeTex });

    // tartan (armchair back and arms)
    var plaidTex = tex(256, 256, function (ctx, w, h) {
      ctx.fillStyle = '#bba684'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(120,98,66,0.55)';
      ctx.fillRect(40, 0, 40, h); ctx.fillRect(168, 0, 40, h);
      ctx.fillRect(0, 40, w, 40); ctx.fillRect(0, 168, w, 40);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(100, 0, 8, h); ctx.fillRect(0, 100, w, 8);
      ctx.fillStyle = 'rgba(110,40,40,0.5)';
      ctx.fillRect(128, 0, 3, h); ctx.fillRect(0, 128, w, 3);
      var R = rng(5);
      for (var i = 0; i < 2500; i++) { ctx.fillStyle = 'rgba(0,0,0,' + (R() * 0.06) + ')'; ctx.fillRect(R() * w, R() * h, 2, 2); }
    }, 1.6, 1.6);
    var tartan = mat(0xffffff, { rough: 0.95, map: plaidTex });

    // rug (horizontal stripes: grey, taupe, cream)
    var rugTex = tex(256, 256, function (ctx, w, h) {
      var R = rng(21);
      var cols = ['#8e8a84', '#a69f94', '#cfc7b8', '#756e66', '#b9b2a4', '#8a8379', '#d8d1c3', '#9b9488'];
      var y = 0;
      while (y < h) {
        var hh = 6 + Math.floor(R() * 16);
        ctx.fillStyle = cols[Math.floor(R() * cols.length)];
        ctx.fillRect(0, y, w, hh);
        y += hh;
      }
      for (var i = 0; i < 6000; i++) { ctx.fillStyle = 'rgba(0,0,0,' + (R() * 0.08) + ')'; ctx.fillRect(R() * w, R() * h, 1, 2); }
    });
    var rugMat = mat(0xffffff, { rough: 1, map: rugTex });

    // painting (grid of coloured squares, each with a darker inner square)
    var paintTex = tex(512, 512, function (ctx, w, h) {
      var R = rng(77);
      var bright = ['#e8892b', '#f0c63a', '#2aa7a0', '#7bbf4a', '#e0457b', '#d93a2b', '#3d7fc2', '#f29a4b', '#8f5bb3', '#f6d45a'];
      var dark = ['#16224d', '#0d0d12', '#3b1f5c', '#5a1b1b', '#12384a'];
      var n = 8, cell = w / n;
      ctx.fillStyle = '#d9a24a'; ctx.fillRect(0, 0, w, h);
      for (var r = 0; r < n; r++) {
        for (var c = 0; c < n; c++) {
          var x = c * cell, y = r * cell;
          ctx.fillStyle = bright[Math.floor(R() * bright.length)];
          ctx.fillRect(x + 3, y + 3, cell - 6, cell - 6);
          var inset = cell * (0.2 + R() * 0.12);
          ctx.fillStyle = dark[Math.floor(R() * dark.length)];
          ctx.fillRect(x + inset + (R() - 0.5) * 6, y + inset + (R() - 0.5) * 6, cell - 2 * inset, cell - 2 * inset);
          if (R() < 0.5) { ctx.fillStyle = bright[Math.floor(R() * bright.length)]; ctx.fillRect(x + cell * 0.38, y + cell * 0.38, cell * 0.24, cell * 0.24); }
        }
      }
    });

    // mirror (cool gradient with a few soft reflections)
    var mirrorTex = tex(256, 256, function (ctx, w, h) {
      var g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#f2f5f6'); g.addColorStop(0.5, '#c9d3d6'); g.addColorStop(1, '#e6ecee');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(120,90,70,0.28)'; ctx.fillRect(150, 30, 70, 120); // reflected painting edge
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(40, 0, 18, h);
    });

    // The sofa, the rug and the coffee table share one centre line (x = SX): the picture is symmetric.
    var SX = -0.55;

    // ------------------------------------------------------------------ sofa (against the north wall)
    var s = new Kit.Item('Sofa');
    [[-0.95, -0.4], [0.95, -0.4], [-0.95, 0.4], [0.95, 0.4]].forEach(function (p) { s.box(0.07, 0.08, 0.07, wood, p[0], 0.04, p[1]); });
    s.box(2.1, 0.28, 0.92, leather, 0, 0.22, 0);                       // base
    s.box(0.98, 0.16, 0.64, leather, -0.5, 0.44, 0.1);                 // seat cushions
    s.box(0.98, 0.16, 0.64, leather, 0.5, 0.44, 0.1);
    s.box(2.1, 0.55, 0.22, leather, 0, 0.62, -0.35);                   // back
    s.box(0.98, 0.4, 0.2, leatherDark, -0.5, 0.7, -0.2, -0.14, 0, 0);  // back cushions
    s.box(0.98, 0.4, 0.2, leatherDark, 0.5, 0.7, -0.2, -0.14, 0, 0);
    s.box(0.2, 0.5, 0.92, leather, -1.0, 0.46, 0);                     // arms
    s.box(0.2, 0.5, 0.92, leather, 1.0, 0.46, 0);
    [[-1.15, 0.05], [-0.62, -0.06], [-0.1, 0.1]].forEach(function (c) { // three striped cushions
      s.box(0.46, 0.42, 0.13, cushion, c[0] * 0.78 + 0.05, 0.74, -0.1, -0.35, c[1], 0);
    });
    F.add(el, s, { room: 'living', label: 'Sofa', words: 'couch settee', pos: [SX, 0, -3.0], rect: [SX - 1.05, -3.5, SX + 1.05, -2.5] });

    // ------------------------------------------------------------------ armchair on castors (by the mirror, right wall)
    var a = new Kit.Item('Armchair');
    a.box(0.78, 0.26, 0.8, leather, 0, 0.34, 0.02);                    // seat base
    a.box(0.7, 0.12, 0.7, leatherDark, 0, 0.53, 0.05);                 // seat cushion
    a.box(0.8, 0.66, 0.16, tartan, 0, 0.78, -0.38, -0.1, 0, 0);        // tartan back
    a.box(0.14, 0.34, 0.7, leather, -0.4, 0.34, 0.05);                 // arms: leather below, tartan on top
    a.box(0.14, 0.34, 0.7, leather, 0.4, 0.34, 0.05);
    a.box(0.17, 0.09, 0.76, tartan, -0.4, 0.58, 0.04);
    a.box(0.17, 0.09, 0.76, tartan, 0.4, 0.58, 0.04);
    [-1, 1].forEach(function (sd) {                                     // brass studs along the arms
      for (var i = 0; i < 12; i++) a.ball(0.009, brass, sd * 0.485, 0.55, -0.3 + i * 0.062);
    });
    [-1, 1].forEach(function (sd) {                                     // turned front legs with castors, plain rear legs
      a.cyl(0.03, 0.04, 0.22, wood, sd * 0.33, 0.11, 0.38, 0, 0, 0, 12);
      [0.07, 0.17].forEach(function (yy) { a.ball(0.045, wood, sd * 0.33, yy, 0.38); });
      a.ball(0.025, brass, sd * 0.33, 0.025, 0.38);
      a.box(0.06, 0.2, 0.06, wood, sd * 0.33, 0.1, -0.36);
    });
    a.box(0.42, 0.4, 0.12, cushion, -0.14, 0.78, -0.2, -0.35, 0, 0.12); // striped pillow
    // It stands by the mirror, facing the room (west) and a little towards the sofa.
    F.add(el, a, { room: 'living', label: 'Armchair', words: 'chair seat', pos: [1.9, 0, -2.45], rotY: -1.7, rect: [1.45, -2.92, 2.4, -1.98] });

    // ------------------------------------------------------------------ rug and coffee table
    var r = new Kit.Item('Rug');
    r.plane(2.0, 1.35, rugMat, SX, 0.005, -2.1, -Math.PI / 2, 0, 0); // centred on the sofa
    F.add(el, r, { room: 'living', label: 'Rug', words: 'carpet' });

    var tx = SX, tz = -1.85; // centred on the sofa, 0.4 m in front of it
    var t = new Kit.Item('Coffee table');
    var glassTop = mat(0xcfe6e3, { rough: 0.05, metal: 0.1, opacity: 0.32 });
    var glassEdge = mat(0x9fd0c8, { rough: 0.1, opacity: 0.18 });
    t.box(1.12, 0.014, 0.56, glassTop, tx, 0.43, tz);                  // glass top
    t.box(1.12, 0.014, 0.56, glassEdge, tx, 0.4, tz);                  // glass edge tint
    [[-0.54, -0.25], [0.54, -0.25], [-0.54, 0.25], [0.54, 0.25]].forEach(function (p) { t.box(0.03, 0.42, 0.03, chrome, tx + p[0], 0.21, tz + p[1]); });
    t.box(1.1, 0.03, 0.03, chrome, tx, 0.39, tz - 0.25); t.box(1.1, 0.03, 0.03, chrome, tx, 0.39, tz + 0.25);
    t.box(0.03, 0.03, 0.5, chrome, tx - 0.54, 0.39, tz); t.box(0.03, 0.03, 0.5, chrome, tx + 0.54, 0.39, tz);
    // reed diffuser and remote control on the table
    t.cyl(0.04, 0.04, 0.09, mat(0x23282b, { rough: 0.1, metal: 0.2 }), tx + 0.2, 0.485, tz - 0.02, 0, 0, 0, 20);
    var reed = mat(0x3a2a1c);
    for (var i = 0; i < 7; i++) {
      var an = i * 0.9;
      t.cyl(0.0022, 0.0022, 0.24, reed, tx + 0.2 + Math.sin(an) * 0.008, 0.62, tz - 0.02 + Math.cos(an) * 0.008, Math.sin(an) * 0.12, 0, Math.cos(an) * 0.12, 5);
    }
    t.box(0.05, 0.016, 0.19, black, tx - 0.12, 0.447, tz + 0.08, 0, 0.35, 0);
    F.add(el, t, { room: 'living', label: 'Coffee table', words: 'table remote diffuser', rect: [tx - 0.56, tz - 0.28, tx + 0.56, tz + 0.28] });

    // ------------------------------------------------------------------ arc floor lamp (behind the sofa's right end)
    var l = new Kit.Item('Floor lamp');
    l.tube([[0.85, 0.03, -3.3], [0.85, 1.1, -3.3], [0.93, 1.9, -3.28], [1.35, 2.38, -3.2], [1.82, 2.28, -3.1], [2.0, 2.1, -3.08]], 0.011, chrome, 48);
    l.cyl(0.17, 0.18, 0.035, mat(0x2b2b2d, { rough: 0.3, metal: 0.3 }), 0.85, 0.018, -3.3, 0, 0, 0, 24);
    l.cyl(0.003, 0.003, 0.2, chrome, 2.0, 2.0, -3.08, 0, 0, 0, 6);
    l.cyl(0.3, 0.3, 0.26, mat(0xefe8d8, { rough: 0.9, emissive: 0xffe6b0, emissiveIntensity: 0.12, side: T.DoubleSide }), 2.0, 1.82, -3.08, 0, 0, 0, 28);
    F.add(el, l, { room: 'living', label: 'Floor lamp', words: 'lamp light', rect: [0.67, -3.5, 1.03, -3.12] });

    // ------------------------------------------------------------------ octagonal bevelled mirror (right wall, beside the armchair)
    var mz = -2.45;
    var mi = new Kit.Item('Mirror');
    var rim = new T.CylinderGeometry(0.52, 0.52, 0.04, 8); rim.rotateY(Math.PI / 8);
    mi.add(rim, chrome, 2.47, 1.55, mz, 0, 0, Math.PI / 2);
    var mid = new T.CylinderGeometry(0.44, 0.44, 0.05, 8); mid.rotateY(Math.PI / 8);
    mi.add(mid, mat(0xe9eff1, { rough: 0.15, metal: 0.1, emissive: 0x9aa6aa, emissiveIntensity: 0.3 }), 2.465, 1.55, mz, 0, 0, Math.PI / 2);
    var face = new T.CylinderGeometry(0.37, 0.37, 0.055, 8); face.rotateY(Math.PI / 8);
    mi.add(face, mat(0xffffff, { rough: 0.05, metal: 0, map: mirrorTex, emissive: 0xb8c4c8, emissiveIntensity: 0.55 }), 2.46, 1.55, mz, 0, 0, Math.PI / 2);
    F.add(el, mi, { room: 'living', label: 'Mirror' });

    // ------------------------------------------------------------------ painting (north wall, above the sofa)
    var pn = new Kit.Item('Painting');
    var frame = mat(0xc98a2e, { rough: 0.5 });
    pn.plane(1.4, 1.4, mat(0xffffff, { rough: 0.8, map: paintTex }), SX, 1.6, -3.455);
    pn.box(1.46, 0.03, 0.04, frame, SX, 2.315, -3.46); pn.box(1.46, 0.03, 0.04, frame, SX, 0.885, -3.46);
    pn.box(0.03, 1.4, 0.04, frame, SX - 0.715, 1.6, -3.46); pn.box(0.03, 1.4, 0.04, frame, SX + 0.715, 1.6, -3.46);
    F.add(el, pn, { room: 'living', label: 'Painting', words: 'picture art' });
  }
});
