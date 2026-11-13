/*
 * "living-set": the furniture and decor of the living room, built from simple shapes and procedural
 * textures (no downloaded models). It follows a reference photo of a real living room:
 *   leather sofa with striped cushions, tartan and leather armchair on castors, glass and chrome coffee
 *   table with a reed diffuser, grey striped rug, arc floor lamp with a drum shade, octagonal bevelled
 *   mirror, abstract grid painting, white panel heater, ceiling cornice and a drum pendant lamp.
 * Everything is the author's own work. The finishes (walls, floor, ...) stay with the configurator.
 */
AFRAME.registerComponent('living-set', {
  init: function () {
    var T = AFRAME.THREE;
    var group = new T.Group();
    this.group = group;

    // ------------------------------------------------------------------ helpers
    function rng(seed) { // small deterministic random generator
      var s = seed >>> 0;
      return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    }
    function tex(w, h, draw, rx, ry) {
      var c = document.createElement('canvas');
      c.width = w; c.height = h;
      draw(c.getContext('2d'), w, h);
      var t = new T.CanvasTexture(c);
      if (T.SRGBColorSpace) t.colorSpace = T.SRGBColorSpace; else t.encoding = T.sRGBEncoding;
      t.wrapS = t.wrapT = T.RepeatWrapping;
      t.repeat.set(rx || 1, ry || 1);
      t.anisotropy = 4;
      return t;
    }
    function mat(color, o) {
      o = o || {};
      return new T.MeshStandardMaterial({
        color: color, roughness: o.rough == null ? 0.7 : o.rough, metalness: o.metal || 0,
        map: o.map || null, transparent: !!o.opacity, opacity: o.opacity == null ? 1 : o.opacity,
        emissive: o.emissive || 0x000000, emissiveIntensity: o.emissiveIntensity || 0,
        side: o.side || T.FrontSide
      });
    }
    function put(mesh, x, y, z, rx, ry, rz) {
      mesh.position.set(x, y, z);
      mesh.rotation.set(rx || 0, ry || 0, rz || 0);
      group.add(mesh);
      return mesh;
    }
    function box(w, h, d, m, x, y, z, rx, ry, rz) { return put(new T.Mesh(new T.BoxGeometry(w, h, d), m), x, y, z, rx, ry, rz); }
    function cyl(rt, rb, h, m, x, y, z, rx, ry, rz, seg) { return put(new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg || 20), m), x, y, z, rx, ry, rz); }
    function ball(r, m, x, y, z) { return put(new T.Mesh(new T.SphereGeometry(r, 14, 10), m), x, y, z); }

    // ------------------------------------------------------------------ materials
    var leather = mat(0x6b3a26, { rough: 0.45, metal: 0.05 });
    var leatherDark = mat(0x4f2a1b, { rough: 0.5 });
    var wood = mat(0x7a4a2d, { rough: 0.5 });
    var brass = mat(0xc9a24a, { rough: 0.35, metal: 0.5 });
    var chrome = mat(0xe4e8ea, { rough: 0.2, metal: 0.55 });
    var white = mat(0xf4f2ee, { rough: 0.6 });
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

    // ------------------------------------------------------------------ sofa (against the far wall)
    var sx = -0.55, sz = -3.0;
    [[-0.95, -0.4], [0.95, -0.4], [-0.95, 0.4], [0.95, 0.4]].forEach(function (p) { box(0.07, 0.08, 0.07, wood, sx + p[0], 0.04, sz + p[1]); });
    box(2.1, 0.28, 0.92, leather, sx, 0.22, sz);                       // base
    box(0.98, 0.16, 0.64, leather, sx - 0.5, 0.44, sz + 0.1);          // seat cushions
    box(0.98, 0.16, 0.64, leather, sx + 0.5, 0.44, sz + 0.1);
    box(2.1, 0.55, 0.22, leather, sx, 0.62, sz - 0.35);                // back
    box(0.98, 0.4, 0.2, leatherDark, sx - 0.5, 0.7, sz - 0.2, -0.14, 0, 0); // back cushions
    box(0.98, 0.4, 0.2, leatherDark, sx + 0.5, 0.7, sz - 0.2, -0.14, 0, 0);
    box(0.2, 0.5, 0.92, leather, sx - 1.0, 0.46, sz);                  // arms
    box(0.2, 0.5, 0.92, leather, sx + 1.0, 0.46, sz);
    [[-1.15, 0.05], [-0.62, -0.06], [-0.1, 0.1]].forEach(function (c) {  // three striped cushions
      box(0.46, 0.42, 0.13, cushion, sx + 0.0 + c[0] * 0.78 + 0.05, 0.74, sz - 0.1, -0.35, c[1], 0);
    });

    // ------------------------------------------------------------------ armchair (foreground, on castors)
    var ac = new T.Group();
    ac.position.set(-1.85, 0, -1.5);
    ac.rotation.y = 1.75;
    group.add(ac);
    function acBox(w, h, d, m, x, y, z, rx) { var b = new T.Mesh(new T.BoxGeometry(w, h, d), m); b.position.set(x, y, z); if (rx) b.rotation.x = rx; ac.add(b); return b; }
    acBox(0.78, 0.26, 0.8, leather, 0, 0.34, 0.02);                    // seat base
    acBox(0.7, 0.12, 0.7, leatherDark, 0, 0.53, 0.05);                 // seat cushion
    acBox(0.8, 0.66, 0.16, tartan, 0, 0.78, -0.38, -0.1);              // tartan back
    acBox(0.14, 0.34, 0.7, leather, -0.4, 0.34, 0.05);                 // arms: leather below, tartan on top
    acBox(0.14, 0.34, 0.7, leather, 0.4, 0.34, 0.05);
    acBox(0.17, 0.09, 0.76, tartan, -0.4, 0.58, 0.04);
    acBox(0.17, 0.09, 0.76, tartan, 0.4, 0.58, 0.04);
    [-1, 1].forEach(function (s) {                                      // brass studs along the arms
      for (var i = 0; i < 12; i++) { var st = new T.Mesh(new T.SphereGeometry(0.009, 8, 6), brass); st.position.set(s * 0.485, 0.55, -0.3 + i * 0.062); ac.add(st); }
    });
    [-1, 1].forEach(function (s) {                                      // turned front legs with castors
      var leg = new T.Mesh(new T.CylinderGeometry(0.03, 0.04, 0.22, 12), wood); leg.position.set(s * 0.33, 0.11, 0.38); ac.add(leg);
      [0.07, 0.17].forEach(function (yy) { var bb = new T.Mesh(new T.SphereGeometry(0.045, 12, 8), wood); bb.position.set(s * 0.33, yy, 0.38); ac.add(bb); });
      var cs = new T.Mesh(new T.SphereGeometry(0.025, 10, 8), brass); cs.position.set(s * 0.33, 0.025, 0.38); ac.add(cs);
      var rl = new T.Mesh(new T.BoxGeometry(0.06, 0.2, 0.06), wood); rl.position.set(s * 0.33, 0.1, -0.36); ac.add(rl);
    });
    acBox(0.42, 0.4, 0.12, cushion, -0.14, 0.78, -0.2, -0.35).rotation.z = 0.12; // striped pillow

    // ------------------------------------------------------------------ rug and coffee table
    var rug = new T.Mesh(new T.PlaneGeometry(2.0, 1.35), rugMat);
    put(rug, 0.55, 0.005, -2.05, -Math.PI / 2, 0, 0);
    var tx = 0.6, tz = -2.05;
    box(1.12, 0.014, 0.56, mat(0xcfe6e3, { rough: 0.05, metal: 0.1, opacity: 0.32 }), tx, 0.43, tz);   // glass top
    box(1.12, 0.014, 0.56, mat(0x9fd0c8, { rough: 0.1, opacity: 0.18 }), tx, 0.4, tz);                  // glass edge tint
    [[-0.54, -0.25], [0.54, -0.25], [-0.54, 0.25], [0.54, 0.25]].forEach(function (p) { box(0.03, 0.42, 0.03, chrome, tx + p[0], 0.21, tz + p[1]); });
    box(1.1, 0.03, 0.03, chrome, tx, 0.39, tz - 0.25); box(1.1, 0.03, 0.03, chrome, tx, 0.39, tz + 0.25);
    box(0.03, 0.03, 0.5, chrome, tx - 0.54, 0.39, tz); box(0.03, 0.03, 0.5, chrome, tx + 0.54, 0.39, tz);
    // reed diffuser and remote control on the table
    cyl(0.04, 0.04, 0.09, mat(0x23282b, { rough: 0.1, metal: 0.2 }), tx + 0.2, 0.485, tz - 0.02);
    for (var i = 0; i < 7; i++) {
      var a = i * 0.9;
      cyl(0.0022, 0.0022, 0.24, mat(0x3a2a1c), tx + 0.2 + Math.sin(a) * 0.008, 0.62, tz - 0.02 + Math.cos(a) * 0.008, Math.sin(a) * 0.12, 0, Math.cos(a) * 0.12, 5);
    }
    box(0.05, 0.016, 0.19, black, tx - 0.12, 0.447, tz + 0.08, 0, 0.35, 0);

    // ------------------------------------------------------------------ arc floor lamp (behind the sofa's right end)
    var pts = [[0.85, 0.03, -3.3], [0.85, 1.1, -3.3], [0.93, 1.9, -3.28], [1.35, 2.38, -3.2], [1.82, 2.28, -3.1], [2.0, 2.1, -3.08]]
      .map(function (p) { return new T.Vector3(p[0], p[1], p[2]); });
    var tube = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 48, 0.011, 8, false), chrome);
    group.add(tube);
    cyl(0.17, 0.18, 0.035, mat(0x2b2b2d, { rough: 0.3, metal: 0.3 }), 0.85, 0.018, -3.3);
    cyl(0.003, 0.003, 0.2, chrome, 2.0, 2.0, -3.08);
    cyl(0.3, 0.3, 0.26, mat(0xefe8d8, { rough: 0.9, emissive: 0xffe6b0, emissiveIntensity: 0.12, side: T.DoubleSide }), 2.0, 1.82, -3.08, 0, 0, 0, 28);

    // ------------------------------------------------------------------ octagonal bevelled mirror (right wall)
    var rim = new T.CylinderGeometry(0.52, 0.52, 0.04, 8); rim.rotateY(Math.PI / 8);
    put(new T.Mesh(rim, chrome), 2.47, 1.55, -2.1, 0, 0, Math.PI / 2);
    var mid = new T.CylinderGeometry(0.44, 0.44, 0.05, 8); mid.rotateY(Math.PI / 8);
    put(new T.Mesh(mid, mat(0xe9eff1, { rough: 0.15, metal: 0.1, emissive: 0x9aa6aa, emissiveIntensity: 0.3 })), 2.465, 1.55, -2.1, 0, 0, Math.PI / 2);
    var face = new T.CylinderGeometry(0.37, 0.37, 0.055, 8); face.rotateY(Math.PI / 8);
    put(new T.Mesh(face, mat(0xffffff, { rough: 0.05, metal: 0, map: mirrorTex, emissive: 0xb8c4c8, emissiveIntensity: 0.55 })), 2.46, 1.55, -2.1, 0, 0, Math.PI / 2);

    // ------------------------------------------------------------------ painting (far wall, above the sofa)
    var paint = new T.Mesh(new T.PlaneGeometry(1.4, 1.4), mat(0xffffff, { rough: 0.8, map: paintTex }));
    put(paint, -0.95, 1.6, -3.455);
    box(1.46, 0.03, 0.04, mat(0xc98a2e, { rough: 0.5 }), -0.95, 2.315, -3.46); box(1.46, 0.03, 0.04, mat(0xc98a2e, { rough: 0.5 }), -0.95, 0.885, -3.46);
    box(0.03, 1.4, 0.04, mat(0xc98a2e, { rough: 0.5 }), -1.665, 1.6, -3.46); box(0.03, 1.4, 0.04, mat(0xc98a2e, { rough: 0.5 }), -0.235, 1.6, -3.46);

    // ------------------------------------------------------------------ white panel heater (right wall)
    box(0.08, 0.5, 0.85, white, 2.455, 0.5, -1.0);
    for (var k = 0; k < 8; k++) box(0.012, 0.012, 0.7, mat(0xd9d7d2), 2.41, 0.66 + k * 0.012, -1.0);
    box(0.02, 0.04, 0.04, mat(0x8a8884), 2.41, 0.32, -0.7);

    // ------------------------------------------------------------------ ceiling cornice (white coving all round)
    var cornice = mat(0xf3f1ec, { rough: 0.8 });
    box(5, 0.1, 0.1, cornice, 0, 2.65, -3.45); box(5, 0.1, 0.1, cornice, 0, 2.65, 0.45);
    box(0.1, 0.1, 4, cornice, -2.45, 2.65, -1.5); box(0.1, 0.1, 4, cornice, 2.45, 2.65, -1.5);

    this.el.setObject3D('living', group);
  },
  remove: function () { this.el.removeObject3D('living'); }
});
