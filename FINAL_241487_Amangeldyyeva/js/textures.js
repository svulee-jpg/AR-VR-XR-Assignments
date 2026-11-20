/*
 * textures.js
 * Procedural finishing textures drawn with the Canvas 2D API (own work, no image files, so no
 * licences and no downloads). Every texture is seamless: it can be repeated across a wall or floor.
 *
 *   Textures.info(materialKey)       -> { tileW, tileH, bumpScale } in metres, or null (flat colour)
 *   Textures.colourCanvas(key, hex)  -> canvas with the pattern in the chosen colour
 *   Textures.bumpCanvas(key)         -> grey canvas used as a bump (relief) map
 *
 * The tile size is the real-world size of one texture image, so bricks, planks and tiles have the
 * right size in the room (a laminate plank is 19 cm wide, a brick 25 x 6.5 cm, a tile 60 cm).
 */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------------------
  // Random numbers and periodic noise (periodic = the image tiles without seams)
  // ---------------------------------------------------------------------------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Deterministic random number for an integer cell.
  function hash2(x, y, seed) {
    var h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967296;
  }

  // Value noise on an n x n lattice that wraps around: u, v in [0, 1).
  function vnoise(u, v, n, seed) {
    var x = u * n, y = v * n;
    var x0 = Math.floor(x), y0 = Math.floor(y);
    var fx = x - x0, fy = y - y0;
    var sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    var xa = ((x0 % n) + n) % n, xb = (xa + 1) % n;
    var ya = ((y0 % n) + n) % n, yb = (ya + 1) % n;
    var a = hash2(xa, ya, seed), b = hash2(xb, ya, seed), c = hash2(xa, yb, seed), d = hash2(xb, yb, seed);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }

  // Several noise layers added together (fractal noise), result about 0..1.
  function fbm(u, v, n0, octaves, seed) {
    var sum = 0, amp = 0.5, total = 0, n = n0;
    for (var i = 0; i < octaves; i++) {
      sum += amp * vnoise(u, v, n, seed + i * 17);
      total += amp;
      amp *= 0.5;
      n *= 2;
    }
    return sum / total;
  }

  // ---------------------------------------------------------------------------
  // Colour helpers
  // ---------------------------------------------------------------------------
  function toRgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function clamp(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }
  function css(c, f) {
    f = f === undefined ? 1 : f;
    return 'rgb(' + Math.round(clamp(c[0] * f)) + ',' + Math.round(clamp(c[1] * f)) + ',' + Math.round(clamp(c[2] * f)) + ')';
  }
  function mix(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }

  function makeCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  // Fill an image pixel by pixel: fn(u, v, x, y) returns [r, g, b].
  function pixels(ctx, W, H, fn) {
    var img = ctx.createImageData(W, H);
    var d = img.data;
    var i = 0;
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var c = fn(x / W, y / H, x, y);
        d[i++] = clamp(c[0]); d[i++] = clamp(c[1]); d[i++] = clamp(c[2]); d[i++] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  // Draw something at the three wrap positions so shapes that cross the border continue on the other side.
  function wrap(W, H, draw) {
    for (var dx = -W; dx <= W; dx += W) {
      for (var dy = -H; dy <= H; dy += H) draw(dx, dy);
    }
  }

  // Thin wavy lines imitating wood grain. horizontal: lines run along x.
  function woodGrain(ctx, x, y, w, h, R, horizontal, count, alpha) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    for (var i = 0; i < count; i++) {
      var dark = R() < 0.7;
      ctx.strokeStyle = dark ? 'rgba(40,20,5,' + (R() * alpha).toFixed(3) + ')' : 'rgba(255,240,210,' + (R() * alpha * 0.8).toFixed(3) + ')';
      ctx.lineWidth = 0.6 + R() * 1.4;
      ctx.beginPath();
      if (horizontal) {
        var yy = y + R() * h;
        var wob = (R() - 0.5) * h * 0.25;
        ctx.moveTo(x, yy);
        ctx.bezierCurveTo(x + w * 0.3, yy + wob, x + w * 0.6, yy - wob, x + w, yy + (R() - 0.5) * 3);
      } else {
        var xx = x + R() * w;
        var wob2 = (R() - 0.5) * w * 0.25;
        ctx.moveTo(xx, y);
        ctx.bezierCurveTo(xx + wob2, y + h * 0.3, xx - wob2, y + h * 0.6, xx + (R() - 0.5) * 3, y + h);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // Wall textures
  // ---------------------------------------------------------------------------
  // Textured paint (structure paint): fine relief, mottled.
  function drawTextured(ctx, W, H, hex) {
    var b = toRgb(hex);
    pixels(ctx, W, H, function (u, v, x, y) {
      var n = fbm(u, v, 24, 3, 3);
      var grit = hash2(x, y, 9);
      var f = 0.86 + 0.26 * n + 0.07 * (grit - 0.5);
      return [b[0] * f, b[1] * f, b[2] * f];
    });
  }

  // Plain wallpaper: a fine woven pattern.
  function drawWpPlain(ctx, W, H, hex) {
    var b = toRgb(hex);
    pixels(ctx, W, H, function (u, v, x, y) {
      var weave = ((x >> 1) + (y >> 1)) & 1;
      var f = 0.975 - 0.035 * weave + 0.03 * (hash2(x, y, 5) - 0.5);
      return [b[0] * f, b[1] * f, b[2] * f];
    });
  }

  // Wide horizontal stripe wallpaper: dark base colour with lighter bands, about 17 cm each.
  function drawWpHStripe(ctx, W, H, hex) {
    var b = toRgb(hex);
    var dark = mix(b, [0, 0, 0], 0.35);
    var light = mix(b, [235, 215, 175], 0.55);
    var half = H / 2; // tile 34 cm high: one dark and one light band
    ctx.fillStyle = css(dark); ctx.fillRect(0, 0, W, half + 1);
    ctx.fillStyle = css(light); ctx.fillRect(0, half, W, half);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(0, half - 1, W, 2); ctx.fillRect(0, 0, W, 2);
    var img = ctx.getImageData(0, 0, W, H);
    var d = img.data;
    for (var p = 0; p < d.length; p += 4) {
      var n = (hash2(p >> 2, 3, 13) - 0.5) * 12;
      d[p] = clamp(d[p] + n); d[p + 1] = clamp(d[p + 1] + n); d[p + 2] = clamp(d[p + 2] + n);
    }
    ctx.putImageData(img, 0, 0);
  }

  // Striped wallpaper: 10 cm stripes, one lighter, with a thin line between them.
  function drawWpStripe(ctx, W, H, hex) {
    var b = toRgb(hex);
    var light = mix(b, [255, 255, 255], 0.42);
    var sw = W / 4; // four stripes of 10 cm in a 40 cm tile
    for (var i = 0; i < 4; i++) {
      ctx.fillStyle = css(i % 2 ? light : b);
      ctx.fillRect(i * sw, 0, sw + 1, H);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    for (var j = 0; j < 4; j++) ctx.fillRect(j * sw, 0, 2, H);
    // linen noise
    var img = ctx.getImageData(0, 0, W, H);
    var d = img.data;
    for (var p = 0; p < d.length; p += 4) {
      var n = (hash2(p >> 2, 7, 11) - 0.5) * 10;
      d[p] = clamp(d[p] + n); d[p + 1] = clamp(d[p + 1] + n); d[p + 2] = clamp(d[p + 2] + n);
    }
    ctx.putImageData(img, 0, 0);
  }

  // Decorative (Venetian) plaster: soft clouds and trowel marks.
  function drawPlaster(ctx, W, H, hex) {
    var b = toRgb(hex);
    pixels(ctx, W, H, function (u, v) {
      var cloud = fbm(u, v, 4, 4, 21);
      var marks = fbm(u * 1, v * 1, 14, 2, 33);
      var f = 0.8 + 0.3 * cloud + 0.1 * (marks - 0.5);
      return [b[0] * f, b[1] * f, b[2] * f * 0.995];
    });
  }

  // Micro-cement and poured concrete: soft grey clouds with fine grain and rare pores.
  function drawCloudy(ctx, W, H, hex, strength) {
    var b = toRgb(hex);
    pixels(ctx, W, H, function (u, v, x, y) {
      var cloud = fbm(u, v, 3, 4, 5);
      var fine = hash2(x, y, 2) - 0.5;
      var pore = hash2(x, y, 44) > 0.9985 ? 0.55 : 1;
      var f = (0.9 + strength * (cloud - 0.5)) + 0.035 * fine;
      return [b[0] * f * pore, b[1] * f * pore, b[2] * f * pore];
    });
  }

  // Brick wall: 25 x 6.5 cm bricks, 1 cm joints, laid in a running bond.
  // Tile: 4 bricks wide (1.04 m), 12 courses high (0.9 m).
  function drawBrick(ctx, W, H, hex) {
    var R = mulberry32(1234);
    var b = toRgb(hex);
    var mortar = mix(toRgb('#b9b4aa'), b, 0.12);
    ctx.fillStyle = css(mortar);
    ctx.fillRect(0, 0, W, H);
    var bw = W / 4;           // brick + joint
    var bh = H / 12;
    var joint = bw * (0.01 / 0.26);
    for (var row = 0; row < 12; row++) {
      var off = row % 2 ? bw / 2 : 0;
      for (var col = -1; col < 5; col++) {
        var shade = 0.84 + R() * 0.28;
        var tint = (R() - 0.5) * 14;
        var c = [b[0] * shade + tint, b[1] * shade, b[2] * shade - tint * 0.5];
        var x = col * bw + off + joint / 2;
        var y = row * bh + joint / 2;
        var w = bw - joint, h = bh - joint;
        ctx.fillStyle = css(c);
        ctx.fillRect(x, y, w, h);
        // dark speckles on the face
        for (var s = 0; s < 14; s++) {
          ctx.fillStyle = 'rgba(0,0,0,' + (0.05 + R() * 0.12).toFixed(3) + ')';
          ctx.fillRect(x + R() * w, y + R() * h, 1 + R() * 2, 1 + R() * 2);
        }
        // light top edge
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        ctx.fillRect(x, y, w, 1.5);
      }
    }
  }

  // Wooden slats: 3 cm slats with 1.5 cm dark gaps (acoustic felt behind).
  // Tile: 9 slats = 0.405 m wide, 0.5 m high.
  function drawSlats(ctx, W, H, hex) {
    var R = mulberry32(77);
    var b = toRgb(hex);
    ctx.fillStyle = '#1b1512';
    ctx.fillRect(0, 0, W, H);
    var step = W / 9;
    var gap = step / 3;
    for (var i = 0; i < 9; i++) {
      var f = 0.93 + R() * 0.14;
      var x = i * step + gap / 2;
      var w = step - gap;
      ctx.fillStyle = css(b, f);
      ctx.fillRect(x, 0, w, H);
      woodGrain(ctx, x, 0, w, H, R, false, 14, 0.22);
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(x, 0, 1.5, H);
    }
  }

  // ---------------------------------------------------------------------------
  // Floor textures
  // ---------------------------------------------------------------------------
  /**
   * Planks laid in rows, every row shifted. The tile holds two planks per row so that
   * the pattern repeats without seams.
   *   o.w plank width (m), o.l plank length (m), o.rows number of rows, o.lanes strips per plank
   *   o.gap joint darkness (0..1), o.grain amount of grain lines, o.jitter shade variation
   */
  function drawPlanks(ctx, W, H, hex, o) {
    var R = mulberry32(o.seed || 5);
    var b = toRgb(hex);
    var rowH = H / o.rows;
    var plankW = W / 2;
    ctx.fillStyle = css(b, 0.5);
    ctx.fillRect(0, 0, W, H);
    for (var r = 0; r < o.rows; r++) {
      var offset = ((r * 0.37 + 0.11) % 1) * plankW;
      for (var k = 0; k < 2; k++) {
        var shade = 1 - o.jitter / 2 + R() * o.jitter;
        var warm = (R() - 0.5) * 10;
        var c = [b[0] * shade + warm, b[1] * shade, b[2] * shade - warm];
        var seed = R() * 1000;
        var grainR = mulberry32(seed | 0);
        for (var dx = -W; dx <= W; dx += W) {
          var x = offset + k * plankW + dx;
          if (x > W || x + plankW < 0) continue;
          var y = r * rowH;
          ctx.fillStyle = css(c);
          ctx.fillRect(x, y, plankW, rowH);
          var lanes = o.lanes || 1;
          for (var ln = 0; ln < lanes; ln++) {
            var ly = y + (ln * rowH) / lanes;
            var lh = rowH / lanes;
            var lshade = lanes > 1 ? 0.94 + grainR() * 0.12 : 1;
            if (lanes > 1) { ctx.fillStyle = css(c, lshade); ctx.fillRect(x, ly, plankW, lh); }
            // soft lengthwise colour bands (real boards are never one flat colour), then fine grain
            for (var bnd = 0; bnd < 4; bnd++) {
              var bh = lh * (0.15 + grainR() * 0.3), by = ly + grainR() * (lh - bh);
              ctx.fillStyle = grainR() < 0.5 ? 'rgba(60,35,15,' + (0.03 + grainR() * 0.05).toFixed(3) + ')'
                                             : 'rgba(255,245,225,' + (0.03 + grainR() * 0.05).toFixed(3) + ')';
              ctx.fillRect(x, by, plankW, bh);
            }
            woodGrain(ctx, x, ly, plankW, lh, grainR, true, o.grain, 0.12);
            if (ln > 0) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x, ly, plankW, 1); }
          }
          // joints (darker lines) and a light bevel edge
          ctx.fillStyle = 'rgba(0,0,0,' + (0.25 + o.gap * 0.5).toFixed(2) + ')';
          ctx.fillRect(x, y, plankW, 1.4);
          ctx.fillRect(x, y, 1.4, rowH);
          ctx.fillStyle = 'rgba(255,255,255,0.09)';
          ctx.fillRect(x, y + 1.4, plankW, 1);
        }
      }
    }
  }

  // Herringbone parquet: 7 x 28 cm blocks. 8 x 8 cells of 7 cm = 0.56 m tile.
  // Block positions come from two lattice vectors (-1,1) and (5,3) (in cells), area 8 cells = one H + one V block.
  function drawHerringbone(ctx, W, H, hex) {
    var b = toRgb(hex);
    var cell = W / 8;
    ctx.fillStyle = css(b, 0.35);
    ctx.fillRect(0, 0, W, H);
    for (var m = -12; m <= 12; m++) {
      for (var n = -12; n <= 12; n++) {
        for (var kind = 0; kind < 2; kind++) {
          var cx = 5 * n - m + (kind ? 4 : 0);
          var cy = 3 * n + m;
          var bw = kind ? 1 : 4, bh = kind ? 4 : 1;
          // skip blocks that cannot touch the tile (one period = 8 cells)
          if (cx > 8 || cy > 8 || cx + bw < 0 || cy + bh < 0) continue;
          // shade depends only on the position inside the period, so copies match at the seams
          var px = ((cx % 8) + 8) % 8, py = ((cy % 8) + 8) % 8;
          var shade = 0.88 + hash2(px, py, kind + 3) * 0.24;
          var tint = (hash2(px, py, kind + 9) - 0.5) * 10;
          var c = [b[0] * shade + tint, b[1] * shade, b[2] * shade - tint];
          var x = cx * cell, y = cy * cell, w = bw * cell, h = bh * cell;
          ctx.fillStyle = css(c);
          ctx.fillRect(x + 0.7, y + 0.7, w - 1.4, h - 1.4);
          var gr = mulberry32((px * 31 + py * 17 + kind) | 0);
          woodGrain(ctx, x + 1, y + 1, w - 2, h - 2, gr, !kind, 7, 0.2);
          ctx.fillStyle = 'rgba(255,255,255,0.10)';
          ctx.fillRect(x + 0.7, y + 0.7, w - 1.4, 1);
        }
      }
    }
  }

  // Ceramic tiles 60 x 60 cm (2 x 2 in the tile) with grout lines.
  function drawTile(ctx, W, H, hex) {
    var R = mulberry32(99);
    var b = toRgb(hex);
    var tw = W / 2, th = H / 2;
    var grout = mix(b, [120, 120, 118], 0.55);
    ctx.fillStyle = css(grout);
    ctx.fillRect(0, 0, W, H);
    for (var i = 0; i < 2; i++) {
      for (var j = 0; j < 2; j++) {
        var f = 0.95 + R() * 0.1;
        var x = i * tw, y = j * th;
        var g = 2.2;
        ctx.fillStyle = css(b, f);
        ctx.fillRect(x + g, y + g, tw - 2 * g, th - 2 * g);
        // soft speckle like porcelain stoneware
        for (var s = 0; s < 260; s++) {
          ctx.fillStyle = 'rgba(' + (R() < 0.5 ? '0,0,0' : '255,255,255') + ',' + (R() * 0.07).toFixed(3) + ')';
          ctx.fillRect(x + g + R() * (tw - 2 * g), y + g + R() * (th - 2 * g), 1 + R() * 2.5, 1 + R() * 2.5);
        }
        // a light reflection on every tile
        var grad = ctx.createLinearGradient(x, y, x + tw, y + th);
        grad.addColorStop(0, 'rgba(255,255,255,0.10)');
        grad.addColorStop(0.5, 'rgba(255,255,255,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.06)');
        ctx.fillStyle = grad;
        ctx.fillRect(x + g, y + g, tw - 2 * g, th - 2 * g);
      }
    }
  }

  // Marble slabs 80 x 80 cm (2 x 2 in the tile) with veins.
  function drawMarble(ctx, W, H, hex) {
    var b = toRgb(hex);
    var vein = mix(b, hex === '#2b2b2d' ? [200, 200, 200] : [60, 60, 70], 0.6);
    var hw = W / 2, hh = H / 2;
    pixels(ctx, W, H, function (u, v, x, y) {
      var tx = Math.min(1, Math.floor(u * 2)), ty = Math.min(1, Math.floor(v * 2));
      var lu = (u * 2) % 1, lv = (v * 2) % 1; // position inside the slab
      var seed = 10 + tx * 7 + ty * 13;
      var warp = fbm(lu, lv, 3, 4, seed);
      var line = Math.abs(Math.sin(Math.PI * (2 * lu + 1 * lv + 2.2 * warp)));
      var thin = Math.pow(1 - line, 14);          // sharp veins
      var thick = Math.pow(1 - Math.abs(Math.sin(Math.PI * (1 * lu + 2 * lv + 3.1 * warp))), 40);
      var cloud = fbm(lu, lv, 6, 3, seed + 5);
      var base = mix(b, [255, 255, 255], 0.06 * cloud);
      var t = Math.min(1, thin * 0.7 + thick * 0.5);
      var c = mix(base, vein, t * 0.85);
      var f = 0.96 + 0.08 * cloud;
      // grout
      var ex = Math.min(x % hw, hw - (x % hw)), ey = Math.min(y % hh, hh - (y % hh));
      if (Math.min(ex, ey) < 1.3) return mix(b, [110, 110, 108], 0.6);
      return [c[0] * f, c[1] * f, c[2] * f];
    });
  }

  // Carpet: short pile, a lot of fine grain.
  function drawCarpet(ctx, W, H, hex) {
    var b = toRgb(hex);
    pixels(ctx, W, H, function (u, v, x, y) {
      var pile = hash2(x, y, 1);
      var tuft = fbm(u, v, 40, 2, 8);
      var f = 0.78 + 0.3 * pile + 0.18 * (tuft - 0.5);
      return [b[0] * f, b[1] * f, b[2] * f];
    });
  }

  // ---------------------------------------------------------------------------
  // Catalogue of textures: tile size in metres, canvas resolution, draw function
  // ---------------------------------------------------------------------------
  // Door textures (one tile = one door leaf, 0.9 x 2.1 m)
  // ---------------------------------------------------------------------------
  // Panelled door: two columns x three rows of recessed panels, optionally with wood grain.
  function drawDoorPanels(ctx, W, H, hex, o) {
    var R = mulberry32(o.seed || 3);
    var b = toRgb(hex);
    ctx.fillStyle = css(b);
    ctx.fillRect(0, 0, W, H);
    if (o.grain) woodGrain(ctx, 0, 0, W, H, R, false, o.grain, 0.22);
    var stile = W * 0.13, gap = W * 0.06, rail = H * 0.05;
    var cols = 2, rows = 3;
    var pw = (W - 2 * stile - gap * (cols - 1)) / cols;
    var ph = (H - 2 * rail - gap * (rows - 1)) / rows;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var x = stile + c * (pw + gap);
        var y = rail + r * (ph + gap);
        ctx.fillStyle = 'rgba(0,0,0,0.07)';
        ctx.fillRect(x, y, pw, ph);
        if (o.grain) woodGrain(ctx, x, y, pw, ph, R, false, Math.round(o.grain / 5), 0.18);
        // shadow on the top-left edges, light on the bottom-right: the panel looks recessed
        ctx.fillStyle = 'rgba(0,0,0,0.38)';
        ctx.fillRect(x, y, pw, 3); ctx.fillRect(x, y, 3, ph);
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fillRect(x, y + ph - 3, pw, 3); ctx.fillRect(x + pw - 3, y, 3, ph);
      }
    }
  }

  // Flush veneered door: long vertical grain, no panels.
  function drawDoorFlush(ctx, W, H, hex) {
    var R = mulberry32(17);
    var b = toRgb(hex);
    ctx.fillStyle = css(b);
    ctx.fillRect(0, 0, W, H);
    var strips = 4;
    for (var i = 0; i < strips; i++) {
      var shade = 0.93 + R() * 0.14;
      ctx.fillStyle = css(b, shade);
      ctx.fillRect((W / strips) * i, 0, W / strips, H);
      woodGrain(ctx, (W / strips) * i, 0, W / strips, H, R, false, 26, 0.24);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect((W / strips) * i, 0, 1.5, H);
    }
  }

  // Steel entrance door: brushed metal with a few stamped ribs.
  function drawDoorSteel(ctx, W, H, hex) {
    drawCloudy(ctx, W, H, hex, 0.1);
    var R = mulberry32(9);
    for (var i = 0; i < 260; i++) {
      ctx.strokeStyle = R() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
      ctx.lineWidth = 1;
      var y = R() * H;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y + (R() - 0.5) * 3); ctx.stroke();
    }
    var m = W * 0.1;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 3;
    ctx.strokeRect(m, H * 0.05, W - 2 * m, H * 0.9);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.strokeRect(m + 3, H * 0.05 + 3, W - 2 * m, H * 0.9);
  }

  // ---------------------------------------------------------------------------
  var DEFS = {
    textured: { tileW: 0.5, tileH: 0.5, px: [256, 256], bump: 1.0, draw: drawTextured },
    'wp-plain': { tileW: 0.25, tileH: 0.25, px: [256, 256], bump: 0.15, draw: drawWpPlain },
    'wp-hstripe': { tileW: 0.34, tileH: 0.34, px: [256, 256], bump: 0.1, draw: drawWpHStripe },
    'wp-stripe': { tileW: 0.4, tileH: 0.4, px: [320, 320], bump: 0.1, draw: drawWpStripe },
    plaster: { tileW: 1.0, tileH: 1.0, px: [512, 512], bump: 1.2, draw: drawPlaster },
    brick: { tileW: 1.04, tileH: 0.9, px: [520, 450], bump: -1.6, draw: drawBrick },
    microcement: { tileW: 1.2, tileH: 1.2, px: [512, 512], bump: 0.6, draw: function (c, W, H, hex) { drawCloudy(c, W, H, hex, 0.28); } },
    slats: { tileW: 0.405, tileH: 0.5, px: [405, 500], bump: 1.6, draw: drawSlats },

    laminate: { tileW: 2.4, tileH: 1.14, px: [1200, 570], bump: 0.7,
      draw: function (c, W, H, hex) { drawPlanks(c, W, H, hex, { rows: 6, grain: 70, gap: 0.45, jitter: 0.1, seed: 5 }); } },
    parquet: { tileW: 3.6, tileH: 1.14, px: [1440, 456], bump: 0.7,
      draw: function (c, W, H, hex) { drawPlanks(c, W, H, hex, { rows: 6, lanes: 3, grain: 22, gap: 0.3, jitter: 0.1, seed: 21 }); } },
    engineered: { tileW: 3.8, tileH: 1.44, px: [1520, 576], bump: 0.5,
      draw: function (c, W, H, hex) { drawPlanks(c, W, H, hex, { rows: 6, grain: 84, gap: 0.2, jitter: 0.14, seed: 8 }); } },
    spc: { tileW: 2.44, tileH: 1.08, px: [1220, 540], bump: 0.4,
      draw: function (c, W, H, hex) { drawPlanks(c, W, H, hex, { rows: 6, grain: 40, gap: 0.55, jitter: 0.08, seed: 14 }); } },
    herringbone: { tileW: 0.56, tileH: 0.56, px: [448, 448], bump: 0.7, draw: drawHerringbone },
    tile: { tileW: 1.2, tileH: 1.2, px: [480, 480], bump: 0.6, draw: drawTile },
    marble: { tileW: 1.6, tileH: 1.6, px: [512, 512], bump: 0.1, draw: drawMarble },
    concrete: { tileW: 1.2, tileH: 1.2, px: [512, 512], bump: 0.4, draw: function (c, W, H, hex) { drawCloudy(c, W, H, hex, 0.35); } },
    carpet: { tileW: 0.3, tileH: 0.3, px: [256, 256], bump: 1.2, draw: drawCarpet },

    // doors: one tile covers the whole leaf
    'door-paint': { tileW: 0.9, tileH: 2.1, px: [360, 840], bump: 1.4, draw: function (c, W, H, hex) { drawDoorPanels(c, W, H, hex, { seed: 3 }); } },
    'door-veneer': { tileW: 0.9, tileH: 2.1, px: [360, 840], bump: 0.5, draw: drawDoorFlush },
    'door-solid': { tileW: 0.9, tileH: 2.1, px: [360, 840], bump: 1.4, draw: function (c, W, H, hex) { drawDoorPanels(c, W, H, hex, { seed: 11, grain: 60 }); } },
    'door-steel': { tileW: 0.9, tileH: 2.1, px: [360, 840], bump: 0.8, draw: drawDoorSteel }
  };

  // ---------------------------------------------------------------------------
  // Cache: the last colour canvases and one bump canvas per material
  // ---------------------------------------------------------------------------
  var colourCache = [];
  var bumpCache = {};
  var MAX_CACHE = 40;

  function info(key) {
    var d = DEFS[key];
    return d ? { tileW: d.tileW, tileH: d.tileH, bumpScale: d.bump } : null;
  }

  function colourCanvas(key, hex) {
    var d = DEFS[key];
    if (!d) return null;
    var id = key + hex;
    for (var i = 0; i < colourCache.length; i++) if (colourCache[i].id === id) return colourCache[i].canvas;
    var canvas = makeCanvas(d.px[0], d.px[1]);
    d.draw(canvas.getContext('2d', { willReadFrequently: true }), canvas.width, canvas.height, hex);
    colourCache.push({ id: id, canvas: canvas });
    if (colourCache.length > MAX_CACHE) colourCache.shift();
    return canvas;
  }

  // The relief is the brightness of the pattern drawn in a neutral grey, so it does not depend on the colour.
  function bumpCanvas(key) {
    var d = DEFS[key];
    if (!d) return null;
    if (bumpCache[key]) return bumpCache[key];
    var canvas = makeCanvas(d.px[0], d.px[1]);
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    d.draw(ctx, canvas.width, canvas.height, '#9a9a9a');
    var img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    var px = img.data;
    for (var i = 0; i < px.length; i += 4) {
      var g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      px[i] = px[i + 1] = px[i + 2] = g;
    }
    ctx.putImageData(img, 0, 0);
    bumpCache[key] = canvas;
    return canvas;
  }

  root.Textures = { info: info, colourCanvas: colourCanvas, bumpCanvas: bumpCanvas, keys: Object.keys(DEFS) };
})(typeof window !== 'undefined' ? window : this);
