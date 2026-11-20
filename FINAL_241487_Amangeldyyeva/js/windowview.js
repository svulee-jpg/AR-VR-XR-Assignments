/*
 * "window-view": a tall arched steel window with a view behind the glass.
 *
 * Everything here is the author's own work, drawn in code (no photos, no downloaded images):
 *   - the frame is an arch shape cut out of a thin extrusion (dark steel, grid bars and a fan in the arch),
 *   - the view is a canvas picture drawn with shapes and gradients: city with a park, the sea, a garden,
 *     each one for daytime and for the evening,
 *   - a small parallax: when the visitor moves or tilts the head, the picture slides a little, so the view
 *     feels like it is behind the glass and not painted on the wall,
 *   - linen curtains on a brass rail and a black marble sill.
 *
 * Usage:  <a-entity id="window-group" window-view="view: city; light: day"> ...</a-entity>
 *         el.setAttribute('window-view', { view: 'sea', light: 'evening' })
 * The entity is placed on the wall; its local +Z points into the room (the glass is almost on the wall).
 */
(function () {
  'use strict';
  if (typeof AFRAME === 'undefined') return;
  var T = AFRAME.THREE;

  var VIEWS = ['city', 'sea', 'garden'];
  var SIZE = 1024; // canvas size of one picture
  var HZ = 610; // the horizon line in the picture (eye height of a standing person)

  // Window geometry (metres, in the local space of the entity). The wall behind is flat.
  var GW = 1.3; // glass width
  var HALF = GW / 2;
  var BOTTOM = 1.03; // lower edge of the glass above the floor
  var SPRING = 1.9; // where the arch starts
  var APEX = SPRING + HALF; // top of the glass: 2.55 m (the ceiling is at 2.7 m)
  var FRAME = 0.05; // width of the steel frame

  // ---------------------------------------------------------------- small helpers
  function rng(seed) { // deterministic random numbers: the same picture every time
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function srgb(tex) {
    if (T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace; else tex.encoding = T.sRGBEncoding;
    return tex;
  }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function grad(ctx, y0, y1, stops) {
    var g = ctx.createLinearGradient(0, y0, 0, y1);
    stops.forEach(function (s) { g.addColorStop(s[0], s[1]); });
    return g;
  }
  function glow(ctx, x, y, r, inner, outer) {
    var g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  function disc(ctx, x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  function cloud(ctx, R, x, y, w, rgb, alpha) { // a soft cloud made from a few blurry blobs
    for (var i = 0; i < 9; i++) {
      var bx = x + (R() - 0.5) * w;
      var by = y + (R() - 0.5) * w * 0.14;
      var br = w * (0.1 + R() * 0.12);
      var g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
      g.addColorStop(0, 'rgba(' + rgb + ',' + alpha + ')');
      g.addColorStop(1, 'rgba(' + rgb + ',0)');
      ctx.fillStyle = g;
      ctx.fillRect(bx - br, by - br, br * 2, br * 2);
    }
  }
  function stars(ctx, R, n, yMax) {
    for (var i = 0; i < n; i++) {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.35 + R() * 0.55) + ')';
      var s = R() < 0.15 ? 2 : 1;
      ctx.fillRect(R() * SIZE, R() * yMax, s, s);
    }
  }
  // A row of buildings. o = { base, x0, x1, minW, maxW, minH, maxH, color, win, winProb }
  function skyline(ctx, R, o) {
    var x = o.x0;
    while (x < o.x1) {
      var w = o.minW + R() * (o.maxW - o.minW);
      var h = o.minH + R() * (o.maxH - o.minH);
      ctx.fillStyle = o.color;
      ctx.fillRect(x, o.base - h, w, h);
      if (o.win) {
        for (var wy = o.base - h + 8; wy < o.base - 8; wy += 11) {
          for (var wx = x + 4; wx < x + w - 5; wx += 8) {
            if (R() < o.winProb) {
              ctx.fillStyle = o.win;
              ctx.fillRect(wx, wy, 3, 5);
            }
          }
        }
      }
      x += w + (R() < 0.3 ? 3 + R() * 9 : 0);
    }
  }
  // A tree crown seen from far away: three discs of different greens.
  function crown(ctx, x, y, r, cDark, cMid, cLight) {
    disc(ctx, x, y, r, cDark);
    disc(ctx, x - r * 0.12, y - r * 0.2, r * 0.82, cMid);
    disc(ctx, x - r * 0.3, y - r * 0.42, r * 0.44, cLight);
  }
  // A row of tree crowns across the picture.
  function treeRow(ctx, R, y, r, n, pal) {
    for (var i = 0; i < n; i++) {
      var x = (i + 0.2 + R() * 0.6) * (SIZE / n);
      var rr = r * (0.75 + R() * 0.5);
      crown(ctx, x, y + (R() - 0.5) * r * 0.5, rr, pal[0], pal[1], pal[2]);
    }
  }
  // Slim tower with an antenna.
  function tower(ctx, x, top, base, w, color, lit) {
    ctx.fillStyle = color;
    ctx.fillRect(x - w / 2, top, w, base - top);
    ctx.fillRect(x - 1.5, top - 46, 3, 46);
    if (lit) { disc(ctx, x, top - 46, 3, 'rgba(255,70,60,0.95)'); }
  }
  // Shimmering waves on the sea: short strokes that are longer and thicker towards the viewer.
  function waves(ctx, R, n, tint) {
    for (var i = 0; i < n; i++) {
      var t = Math.pow(R(), 1.8);
      var y = HZ + t * (SIZE - HZ);
      var len = 6 + t * 70;
      ctx.fillStyle = tint[R() < 0.5 ? 0 : 1].replace('A', (0.06 + R() * 0.2).toFixed(2));
      ctx.fillRect(R() * SIZE, y, len, 1 + t * 2.4);
    }
  }

  // ---------------------------------------------------------------- the pictures
  function drawCity(ctx, night) {
    var R = rng(11);
    ctx.fillStyle = night
      ? grad(ctx, 0, HZ + 40, [[0, '#161a3b'], [0.38, '#40356a'], [0.64, '#a94f5e'], [0.86, '#ee8a4e'], [1, '#ffd08c']])
      : grad(ctx, 0, HZ + 40, [[0, '#5a9ad6'], [0.55, '#a8d3f0'], [1, '#edf1e8']]);
    ctx.fillRect(0, 0, SIZE, SIZE);
    if (night) {
      stars(ctx, R, 130, 330);
      glow(ctx, 690, HZ - 6, 340, 'rgba(255,170,90,0.75)', 'rgba(255,170,90,0)');
      cloud(ctx, R, 300, 300, 420, '110,60,110', 0.35);
      cloud(ctx, R, 760, 400, 360, '240,140,90', 0.25);
    } else {
      glow(ctx, 730, 190, 320, 'rgba(255,250,225,0.95)', 'rgba(255,250,225,0)');
      disc(ctx, 730, 190, 26, '#fffbea');
      [[220, 170, 330], [520, 300, 380], [820, 430, 300], [120, 420, 260], [640, 120, 260]].forEach(function (c) {
        cloud(ctx, R, c[0], c[1], c[2], '255,255,255', 0.5);
      });
    }
    // far, hazy skyline and a nearer one
    skyline(ctx, R, { base: HZ + 12, x0: -10, x1: SIZE + 10, minW: 24, maxW: 60, minH: 36, maxH: 140, color: night ? '#5b4469' : '#b0c1d4' });
    skyline(ctx, R, {
      base: HZ + 30, x0: -10, x1: SIZE + 10, minW: 30, maxW: 74, minH: 70, maxH: 230,
      color: night ? '#2a2238' : '#8798b0',
      win: night ? 'rgba(255,214,140,0.85)' : 'rgba(255,255,255,0.22)', winProb: night ? 0.3 : 0.45
    });
    tower(ctx, 300, HZ - 205, HZ + 30, 26, night ? '#241c32' : '#6f819b', night);
    tower(ctx, 650, HZ - 150, HZ + 30, 20, night ? '#241c32' : '#7a8ba4', night);
    // park: ground, a river and rows of trees
    ctx.fillStyle = night
      ? grad(ctx, HZ + 28, SIZE, [[0, '#18281f'], [1, '#08100c']])
      : grad(ctx, HZ + 28, SIZE, [[0, '#7bab63'], [1, '#3c7438']]);
    ctx.fillRect(0, HZ + 28, SIZE, SIZE);
    var pal = night
      ? [['#0b1612', '#12241c', '#1b382b'], ['#0a130f', '#10201a', '#18322a'], ['#070e0b', '#0d1a14', '#142a20']]
      : [['#2f6b34', '#4e8f45', '#8fc060'], ['#2a6030', '#468a40', '#7cb455'], ['#235a2b', '#3c7f38', '#6aa84c']];
    treeRow(ctx, R, HZ + 66, 17, 26, pal[0]);
    ctx.beginPath();
    ctx.moveTo(0, HZ + 96); ctx.bezierCurveTo(250, HZ + 70, 520, HZ + 120, SIZE, HZ + 84);
    ctx.lineTo(SIZE, HZ + 122); ctx.bezierCurveTo(520, HZ + 160, 250, HZ + 110, 0, HZ + 138);
    ctx.closePath();
    ctx.fillStyle = night
      ? grad(ctx, HZ + 70, HZ + 160, [[0, '#4a4a7c'], [1, '#232b55']])
      : grad(ctx, HZ + 70, HZ + 160, [[0, '#bcdcec'], [1, '#86b4cf']]);
    ctx.fill();
    if (night) { ctx.fillStyle = 'rgba(255,170,90,0.35)'; ctx.fillRect(560, HZ + 112, 180, 3); }
    treeRow(ctx, R, HZ + 200, 36, 13, pal[1]);
    treeRow(ctx, R, HZ + 312, 56, 9, pal[2]);
    treeRow(ctx, R, HZ + 450, 84, 6, pal[2]);
    if (night) { // city lights and path lamps
      for (var i = 0; i < 70; i++) {
        ctx.fillStyle = R() < 0.7 ? 'rgba(255,214,150,0.9)' : 'rgba(255,90,70,0.8)';
        ctx.fillRect(R() * SIZE, HZ + 42 + R() * 12, 2, 2);
      }
      for (var l = 0; l < 7; l++) glow(ctx, 60 + l * 150 + R() * 40, HZ + 232 + R() * 8, 26, 'rgba(255,205,130,0.95)', 'rgba(255,205,130,0)');
    }
  }

  function drawSea(ctx, night) {
    var R = rng(23);
    ctx.fillStyle = night
      ? grad(ctx, 0, HZ, [[0, '#1b2147'], [0.4, '#5a3f78'], [0.7, '#c85f5a'], [0.9, '#f59a52'], [1, '#ffd59a']])
      : grad(ctx, 0, HZ, [[0, '#4f95d4'], [0.6, '#9ccdf0'], [1, '#e6f2f6']]);
    ctx.fillRect(0, 0, SIZE, HZ + 1);
    if (night) {
      stars(ctx, R, 140, 330);
      glow(ctx, 700, HZ, 360, 'rgba(255,180,100,0.8)', 'rgba(255,180,100,0)');
      cloud(ctx, R, 280, 340, 460, '70,36,84', 0.4);
      cloud(ctx, R, 650, 460, 400, '255,150,80', 0.3);
    } else {
      glow(ctx, 720, 210, 320, 'rgba(255,250,225,0.95)', 'rgba(255,250,225,0)');
      disc(ctx, 720, 210, 26, '#fffbea');
      [[240, 180, 340], [560, 330, 380], [860, 140, 280], [130, 430, 260]].forEach(function (c) {
        cloud(ctx, R, c[0], c[1], c[2], '255,255,255', 0.5);
      });
    }
    // a dry headland on the left, like the Caspian coast
    ctx.fillStyle = night ? '#3a2f4a' : '#cdb994';
    ctx.beginPath();
    ctx.moveTo(0, HZ + 2); ctx.lineTo(0, HZ - 26); ctx.lineTo(110, HZ - 34); ctx.lineTo(240, HZ - 40);
    ctx.lineTo(330, HZ - 28); ctx.lineTo(430, HZ - 12); ctx.lineTo(520, HZ + 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = night ? 'rgba(20,14,30,0.35)' : 'rgba(140,110,70,0.25)';
    for (var s = 0; s < 6; s++) ctx.fillRect(20 + s * 70 + R() * 20, HZ - 20 - R() * 14, 40 + R() * 30, 2);
    // the sea
    ctx.fillStyle = night
      ? grad(ctx, HZ, SIZE, [[0, '#e89a6a'], [0.08, '#9b5a7a'], [0.35, '#3a3a6a'], [1, '#141a3a']])
      : grad(ctx, HZ, SIZE, [[0, '#a6d3e6'], [0.15, '#55a3c6'], [0.6, '#237aa5'], [1, '#165f8a']]);
    ctx.fillRect(0, HZ, SIZE, SIZE - HZ);
    waves(ctx, R, 1100, night ? ['rgba(255,190,130,A)', 'rgba(10,14,40,A)'] : ['rgba(255,255,255,A)', 'rgba(10,60,100,A)']);
    // light on the water under the sun
    for (var g = 0; g < 260; g++) {
      var t = Math.pow(R(), 1.5);
      var y = HZ + 3 + t * (SIZE - HZ - 120);
      var spread = 18 + t * 150;
      ctx.fillStyle = (night ? 'rgba(255,208,140,' : 'rgba(255,250,214,') + (0.25 + R() * 0.45).toFixed(2) + ')';
      ctx.fillRect(700 + (R() - 0.5) * spread * 2, y, 4 + R() * 12 * (1 + t * 3), 1 + t * 2);
    }
    if (night) { // the sun, half under the horizon
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, SIZE, HZ); ctx.clip();
      disc(ctx, 700, HZ, 52, '#ffe2a8');
      ctx.restore();
    }
    // two sailing boats
    [[330, HZ + 46, 1], [560, HZ + 16, 0.55]].forEach(function (b) {
      var k = b[2];
      ctx.fillStyle = night ? '#1a1630' : '#26323f';
      ctx.fillRect(b[0] - 20 * k, b[1], 40 * k, 5 * k);
      ctx.fillStyle = night ? '#f2c18c' : '#ffffff';
      ctx.beginPath(); ctx.moveTo(b[0], b[1] - 56 * k); ctx.lineTo(b[0] + 22 * k, b[1] - 3 * k); ctx.lineTo(b[0] - 2 * k, b[1] - 3 * k); ctx.closePath(); ctx.fill();
      ctx.fillStyle = night ? '#d58a6a' : '#e9eef2';
      ctx.beginPath(); ctx.moveTo(b[0] - 3 * k, b[1] - 46 * k); ctx.lineTo(b[0] - 3 * k, b[1] - 3 * k); ctx.lineTo(b[0] - 20 * k, b[1] - 3 * k); ctx.closePath(); ctx.fill();
    });
    // sand and a line of foam in front
    ctx.beginPath();
    ctx.moveTo(0, 840); ctx.bezierCurveTo(220, 800, 420, 880, 640, 830); ctx.bezierCurveTo(800, 796, 920, 820, SIZE, 804);
    ctx.lineTo(SIZE, SIZE); ctx.lineTo(0, SIZE); ctx.closePath();
    ctx.fillStyle = night ? grad(ctx, 800, SIZE, [[0, '#3c2f43'], [1, '#1d1626']]) : grad(ctx, 800, SIZE, [[0, '#eadcb8'], [1, '#cdb98f']]);
    ctx.fill();
    ctx.strokeStyle = night ? 'rgba(255,200,150,0.45)' : 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 838); ctx.bezierCurveTo(220, 798, 420, 878, 640, 828); ctx.bezierCurveTo(800, 794, 920, 818, SIZE, 802);
    ctx.stroke();
    if (night) { // lamps along the promenade
      ctx.fillStyle = '#120d1a';
      ctx.fillRect(148, 880, 4, 120);
      ctx.fillRect(878, 860, 4, 120);
      glow(ctx, 150, 876, 34, 'rgba(255,205,130,0.95)', 'rgba(255,205,130,0)');
      glow(ctx, 880, 856, 34, 'rgba(255,205,130,0.95)', 'rgba(255,205,130,0)');
    }
  }

  function drawGarden(ctx, night) {
    var R = rng(37);
    ctx.fillStyle = night
      ? grad(ctx, 0, 460, [[0, '#232a55'], [0.55, '#7a5a82'], [1, '#f0a56a']])
      : grad(ctx, 0, 460, [[0, '#7db8ea'], [1, '#e3f1f4']]);
    ctx.fillRect(0, 0, SIZE, 520);
    if (night) stars(ctx, R, 60, 220);
    else [[260, 120, 300], [700, 210, 340], [920, 80, 220]].forEach(function (c) { cloud(ctx, R, c[0], c[1], c[2], '255,255,255', 0.55); });
    var far = night ? ['#17231f', '#22362f', '#2f4a40'] : ['#4c7d54', '#6f9a6e', '#9bbf90'];
    var mid = night ? ['#0f1b16', '#182a22', '#233d31'] : ['#2f6b34', '#4e8f45', '#8fc060'];
    treeRow(ctx, R, 400, 70, 12, far);
    // a distant house
    ctx.fillStyle = night ? '#2b2833' : '#cfc9bb';
    ctx.fillRect(130, 400, 210, 100);
    ctx.fillStyle = night ? '#1c1822' : '#7d5b4b';
    ctx.beginPath(); ctx.moveTo(116, 402); ctx.lineTo(235, 340); ctx.lineTo(354, 402); ctx.closePath(); ctx.fill();
    for (var w = 0; w < 4; w++) {
      ctx.fillStyle = night ? 'rgba(255,205,130,0.9)' : 'rgba(60,80,110,0.55)';
      ctx.fillRect(152 + w * 48, 424, 22, 30);
    }
    treeRow(ctx, R, 500, 84, 10, mid);
    treeRow(ctx, R, 640, 70, 11, mid);
    // two blossom trees
    [[250, 575, 125], [800, 560, 135]].forEach(function (b) {
      crown(ctx, b[0], b[1], b[2], night ? '#2a2234' : '#4b7a45', night ? '#3b2d46' : '#6a9a56', night ? '#5a4560' : '#98c57a');
      var cols = night ? ['#8f6178', '#a8788c', '#7a5068'] : ['#f4b6c8', '#f8d0dc', '#ee9bb4'];
      for (var i = 0; i < 170; i++) {
        var a = R() * Math.PI * 2, d = Math.sqrt(R()) * b[2] * 0.95;
        disc(ctx, b[0] + Math.cos(a) * d, b[1] + Math.sin(a) * d * 0.9, 4 + R() * 7, cols[Math.floor(R() * 3)]);
      }
    });
    // hedge, lawn and a stone path
    ctx.fillStyle = night ? '#0c1a13' : '#2f6b34';
    ctx.fillRect(0, 660, SIZE, 70);
    for (var h = 0; h < 120; h++) disc(ctx, R() * SIZE, 662 + R() * 6, 6 + R() * 8, night ? '#142a20' : '#4f8f48');
    ctx.fillStyle = night ? grad(ctx, 720, SIZE, [[0, '#1a3326'], [1, '#09130d']]) : grad(ctx, 720, SIZE, [[0, '#82b960'], [1, '#4a8a3c']]);
    ctx.fillRect(0, 720, SIZE, SIZE - 720);
    ctx.fillStyle = night ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.08)';
    for (var m = 0; m < 14; m++) ctx.fillRect(0, 724 + m * 22, SIZE, 11);
    ctx.fillStyle = night ? '#4a4650' : '#ddd6c6';
    ctx.beginPath();
    ctx.moveTo(430, 722); ctx.lineTo(560, 722); ctx.lineTo(760, SIZE); ctx.lineTo(300, SIZE); ctx.closePath();
    ctx.fill();
    if (night) {
      for (var f = 0; f < 46; f++) glow(ctx, 20 + f * 22 + R() * 8, 664 + R() * 12, 9, 'rgba(255,214,150,0.95)', 'rgba(255,214,150,0)');
    } else {
      for (var s = 0; s < 8; s++) {
        ctx.fillStyle = 'rgba(255,255,226,0.12)';
        ctx.beginPath(); ctx.ellipse(80 + R() * 860, 760 + R() * 230, 50 + R() * 70, 14 + R() * 18, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    var fl = night ? ['#9a6a82', '#b68aa0'] : ['#f4b6c8', '#ffffff', '#f7d46a'];
    for (var q = 0; q < 140; q++) disc(ctx, R() * SIZE, 900 + R() * 120, 3 + R() * 4, fl[Math.floor(R() * fl.length)]);
  }

  var DRAW = { city: drawCity, sea: drawSea, garden: drawGarden };
  var WINDOW_LIGHT = 7; // intensity of the daylight through one window (candela, physical light units)
  var PHOTOS = {}; // key -> texture (loaded), null (loading) or false (failed)

  function makeCanvas(view, light) {
    var c = document.createElement('canvas');
    c.width = c.height = SIZE;
    (DRAW[view] || drawCity)(c.getContext('2d'), light === 'evening');
    return c;
  }

  // ---------------------------------------------------------------- geometry
  // The outline of the arched window: straight sides, a half circle at the top.
  function archShape(halfW, bottom, spring) {
    var s = new T.Shape();
    s.moveTo(-halfW, bottom);
    s.lineTo(halfW, bottom);
    s.lineTo(halfW, spring);
    s.absarc(0, spring, halfW, 0, Math.PI, false);
    s.lineTo(-halfW, bottom);
    return s;
  }
  // Flat arch with texture coordinates that use the middle 80 % of the picture (room to slide).
  function archPlane() {
    var g = new T.ShapeGeometry(archShape(HALF, BOTTOM, SPRING), 28);
    var p = g.attributes.position;
    var uv = new Float32Array(p.count * 2);
    for (var i = 0; i < p.count; i++) {
      uv[i * 2] = 0.1 + 0.8 * (p.getX(i) + HALF) / GW;
      uv[i * 2 + 1] = 0.1 + 0.8 * (p.getY(i) - BOTTOM) / (APEX - BOTTOM);
    }
    g.setAttribute('uv', new T.BufferAttribute(uv, 2));
    return g;
  }
  function sheenTexture() { // two faint diagonal reflections on the glass
    var c = document.createElement('canvas');
    c.width = c.height = 256;
    var ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(255,255,255,0.09)';
    ctx.beginPath(); ctx.moveTo(30, 256); ctx.lineTo(80, 256); ctx.lineTo(210, 0); ctx.lineTo(160, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath(); ctx.moveTo(110, 256); ctx.lineTo(125, 256); ctx.lineTo(255, 20); ctx.lineTo(240, 0); ctx.lineTo(225, 0); ctx.closePath(); ctx.fill();
    return srgb(new T.CanvasTexture(c));
  }
  function marbleTexture() { // black marble with thin white veins
    var c = document.createElement('canvas');
    c.width = c.height = 256;
    var ctx = c.getContext('2d');
    var R = rng(5);
    ctx.fillStyle = '#121017';
    ctx.fillRect(0, 0, 256, 256);
    for (var i = 0; i < 7; i++) {
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.1 + R() * 0.2).toFixed(2) + ')';
      ctx.lineWidth = 0.6 + R() * 1.2;
      ctx.beginPath();
      var x = R() * 256, y = 0;
      ctx.moveTo(x, y);
      for (var k = 0; k < 4; k++) { x += (R() - 0.5) * 120; y += 64; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    return srgb(new T.CanvasTexture(c));
  }

  // ---------------------------------------------------------------- the component
  AFRAME.registerComponent('window-view', {
    schema: {
      view: { default: 'city' }, // city | sea | garden
      light: { default: 'day' } // day | evening
    },

    init: function () {
      this.cache = {}; // one canvas texture per view and light, created when first needed
      this.tex = null;
      this.cam = new T.Vector3();
      var group = new T.Group();
      this.group = group;

      // The view, behind everything else. It is slightly smaller than the frame opening.
      this.viewMat = new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
      var view = new T.Mesh(archPlane(), this.viewMat);
      view.position.z = 0.02;
      group.add(view);

      // Faint reflections on the glass.
      var sheen = new T.Mesh(archPlane(), new T.MeshBasicMaterial({
        map: sheenTexture(), transparent: true, depthWrite: false, toneMapped: false
      }));
      sheen.position.z = 0.03;
      group.add(sheen);

      // Steel frame: arch outline with the opening cut out.
      var steel = new T.MeshStandardMaterial({ color: 0x1b1a19, roughness: 0.45, metalness: 0.45 });
      var outer = archShape(HALF + FRAME, BOTTOM - FRAME, SPRING);
      outer.holes.push(archShape(HALF, BOTTOM, SPRING));
      var frame = new T.Mesh(new T.ExtrudeGeometry(outer, { depth: 0.07, bevelEnabled: false, curveSegments: 28 }), steel);
      group.add(frame);

      function bar(w, h, d, x, y, z) {
        var m = new T.Mesh(new T.BoxGeometry(w, h, d), steel);
        m.position.set(x, y, z);
        group.add(m);
        return m;
      }
      var Z = 0.045;
      // Grid below the arch: three vertical and three horizontal bars.
      bar(0.03, APEX - BOTTOM, 0.04, 0, (APEX + BOTTOM) / 2, Z); // the middle bar goes to the top
      bar(0.026, SPRING - BOTTOM, 0.04, -HALF / 2, (SPRING + BOTTOM) / 2, Z);
      bar(0.026, SPRING - BOTTOM, 0.04, HALF / 2, (SPRING + BOTTOM) / 2, Z);
      var step = (SPRING - BOTTOM) / 3;
      bar(GW, 0.026, 0.04, 0, BOTTOM + step, Z);
      bar(GW, 0.026, 0.04, 0, BOTTOM + 2 * step, Z);
      bar(GW, 0.03, 0.04, 0, SPRING, Z);
      // Fan in the arch: two slanted ribs and a smaller arch ring.
      [Math.PI / 4, 3 * Math.PI / 4].forEach(function (a) {
        var g = new T.BoxGeometry(HALF, 0.024, 0.04);
        g.translate(HALF / 2, 0, 0);
        var m = new T.Mesh(g, steel);
        m.position.set(0, SPRING, Z);
        m.rotation.z = a;
        group.add(m);
      });
      var ring = new T.Mesh(new T.TorusGeometry(HALF * 0.62, 0.012, 8, 40, Math.PI), steel);
      ring.position.set(0, SPRING, Z);
      group.add(ring);

      // Black marble sill on an ivory apron.
      var marble = new T.MeshStandardMaterial({ color: 0xffffff, map: marbleTexture(), roughness: 0.14, metalness: 0.15 });
      var sill = new T.Mesh(new T.BoxGeometry(1.46, 0.04, 0.24), marble);
      sill.position.set(0, 0.97, 0.12);
      group.add(sill);
      var apron = new T.Mesh(new T.BoxGeometry(1.38, 0.07, 0.2), new T.MeshStandardMaterial({ color: 0xece6d8, roughness: 0.85 }));
      apron.position.set(0, 0.915, 0.1);
      group.add(apron);

      // Linen curtains on a brass rail, drawn to the sides.
      var brass = new T.MeshStandardMaterial({ color: 0xb08d57, roughness: 0.35, metalness: 0.8 });
      var rail = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 2.3, 12), brass);
      rail.rotation.z = Math.PI / 2;
      rail.position.set(0, 2.58, 0.15);
      group.add(rail);
      [-1.15, 1.15].forEach(function (x) {
        var f = new T.Mesh(new T.SphereGeometry(0.025, 12, 8), brass);
        f.position.set(x, 2.58, 0.15);
        group.add(f);
      });
      var linen = new T.MeshStandardMaterial({ color: 0xe6dfd0, roughness: 1, side: T.DoubleSide });
      [-0.9, 0.9].forEach(function (x) {
        var g = new T.PlaneGeometry(0.28, 2.5, 28, 1);
        var p = g.attributes.position;
        for (var i = 0; i < p.count; i++) p.setZ(i, 0.028 * Math.sin((p.getX(i) / 0.28) * Math.PI * 2 * 4.5));
        g.computeVertexNormals();
        var m = new T.Mesh(g, linen);
        m.position.set(x, 1.3, 0.15);
        group.add(m);
      });

      // Daylight that comes in through the window: a wide, soft spot light aimed into the room and slightly down,
      // so the room is brighter near the window and darker further away, as in a real flat. Off in the evening.
      this.sun = new T.SpotLight(0xfff3e3, 0, 8, Math.PI * 0.42, 1, 2);
      this.sun.position.set(0, 2.0, 0.25);
      this.sun.target.position.set(0, 0.2, 3.2);
      group.add(this.sun);
      group.add(this.sun.target);

      this.el.setObject3D('window-view', group);
      this.apply();
    },

    update: function () {
      this.apply();
    },

    // Choose the texture for the current view and light (drawn once, then reused).
    // The pictures are photographs (img/views/<view>-<light>.jpg, cut from CC0 Poly Haven panoramas, see
    // ASSETS.md). They are loaded once and shared by all windows; the drawn picture is shown until the photo
    // has arrived, and stays if the photo cannot be loaded.
    apply: function () {
      var view = VIEWS.indexOf(this.data.view) >= 0 ? this.data.view : 'city';
      var light = this.data.light === 'evening' ? 'evening' : 'day';
      var key = view + '-' + light;
      var self = this;
      var photo = PHOTOS[key];
      if (photo === undefined) {
        PHOTOS[key] = null; // loading
        new T.TextureLoader().load('img/views/' + key + '.jpg', function (t) {
          srgb(t);
          t.anisotropy = 4;
          PHOTOS[key] = t;
          var all = document.querySelectorAll('[window-view]');
          for (var i = 0; i < all.length; i++) if (all[i].components['window-view']) all[i].components['window-view'].apply();
        }, undefined, function () { PHOTOS[key] = false; });
      }
      if (photo) { // own copy per window: the parallax offset differs (the picture itself is shared)
        if (!this.cache['photo-' + key]) this.cache['photo-' + key] = photo.clone();
        this.tex = this.cache['photo-' + key];
      }
      else {
        if (!this.cache[key]) this.cache[key] = srgb(new T.CanvasTexture(makeCanvas(view, light)));
        this.tex = this.cache[key];
      }
      if (this.sun) this.sun.intensity = light === 'evening' ? 0 : WINDOW_LIGHT;
      if (this.viewMat.map !== this.tex) {
        this.viewMat.map = this.tex;
        this.viewMat.needsUpdate = true;
      }
    },

    // Parallax: the picture slides against the frame when the head moves, as a real view would.
    tick: function () {
      if (!this.tex) return;
      var cam = this.el.sceneEl && this.el.sceneEl.camera;
      if (!cam) return;
      cam.getWorldPosition(this.cam);
      this.el.object3D.worldToLocal(this.cam);
      var k = 0.11;
      this.tex.offset.set(clamp(this.cam.x * k, -0.09, 0.09), clamp((this.cam.y - 1.6) * k, -0.09, 0.09));
    },

    remove: function () {
      this.el.removeObject3D('window-view');
    }
  });

  // For checks and screenshots: draw a picture without the 3D scene.
  window.WindowView = {
    VIEWS: VIEWS,
    drawCanvas: makeCanvas
  };
})();
