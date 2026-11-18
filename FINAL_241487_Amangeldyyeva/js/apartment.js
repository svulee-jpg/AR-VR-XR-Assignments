/*
 * apartment.js
 * Builds the shell of the apartment from the floor plan in js/plan.js: walls with openings, floors,
 * ceilings, skirting boards, door leaves, door frames, the front door, the tiled bathroom, ceiling
 * spot lights and one ceiling light per room.
 *
 * The parts that the visitor can finish (walls, accent wall, floor, ceiling, skirting, door) are
 * <a-plane>/<a-box> entities with the `surface` component from configurator.js, so clicking them,
 * the panel, the voice commands and the price work exactly as before. Everything else is fixed.
 *
 * Because walls, floors and prices all come from the same plan, the picture and the quote agree.
 */
(function () {
  'use strict';

  var T = AFRAME.THREE;
  var P = window.Plan;
  var Kit = window.Kit;
  var AVR = (window.AVR = window.AVR || {});
  var H = P.H;
  var THETA = 100 * Math.PI / 180; // how far an open door leaf is swung

  function ent(tag, attrs, parent) {
    var el = document.createElement(tag);
    Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    parent.appendChild(el);
    return el;
  }

  // ---- fixed materials (not part of the configurator) ----
  function tileTexture(kind) {
    var R = Kit.rng(kind === 'wall' ? 11 : 12);
    return Kit.tex(512, 512, function (ctx, w, h) {
      if (kind === 'wall') {
        // large white tiles, 0.6 x 0.3 m, with faint grey veins running along the tile
        ctx.fillStyle = '#eceae6'; ctx.fillRect(0, 0, w, h);
        for (var row = 0; row < 2; row++) {
          var y0 = row * (h / 2);
          var g = ctx.createLinearGradient(0, y0, 0, y0 + h / 2);
          g.addColorStop(0, '#f3f2ef'); g.addColorStop(1, '#e6e4df');
          ctx.fillStyle = g; ctx.fillRect(2, y0 + 2, w - 4, h / 2 - 4);
          for (var v = 0; v < 9; v++) {
            ctx.strokeStyle = 'rgba(120,120,125,' + (0.05 + R() * 0.12) + ')';
            ctx.lineWidth = 1 + R() * 2;
            ctx.beginPath();
            var yy = y0 + R() * (h / 2), xx = 0;
            ctx.moveTo(xx, yy);
            while (xx < w) { xx += 30 + R() * 60; yy += (R() - 0.5) * 14; ctx.lineTo(xx, yy); }
            ctx.stroke();
          }
          ctx.fillStyle = 'rgba(150,150,150,0.55)'; ctx.fillRect(0, y0, w, 2);
        }
        ctx.fillStyle = 'rgba(150,150,150,0.55)'; ctx.fillRect(0, 0, 2, h);
      } else {
        // grey marble floor tiles, 0.3 x 0.3 m, two by two per texture
        ctx.fillStyle = '#7c7d80'; ctx.fillRect(0, 0, w, h);
        for (var i = 0; i < 4; i++) {
          var x0 = (i % 2) * (w / 2), yy0 = Math.floor(i / 2) * (h / 2);
          var shade = 150 + Math.floor(R() * 24);
          ctx.fillStyle = 'rgb(' + shade + ',' + shade + ',' + (shade + 3) + ')';
          ctx.fillRect(x0 + 3, yy0 + 3, w / 2 - 6, h / 2 - 6);
          for (var k = 0; k < 7; k++) {
            ctx.strokeStyle = 'rgba(255,255,255,' + (0.12 + R() * 0.25) + ')';
            ctx.lineWidth = 1 + R() * 3;
            ctx.beginPath();
            var px = x0 + R() * w / 2, py = yy0 + R() * h / 2;
            ctx.moveTo(px, py);
            for (var s = 0; s < 4; s++) { px += (R() - 0.3) * 70; py += (R() - 0.2) * 40; ctx.lineTo(Math.min(x0 + w / 2 - 4, Math.max(x0 + 4, px)), Math.min(yy0 + h / 2 - 4, Math.max(yy0 + 4, py))); }
            ctx.stroke();
          }
        }
      }
    });
  }

  // a flat rectangle whose UVs are scaled so that one texture tile = tile metres
  function tiledPlane(w, h, material, tile) {
    var g = new T.PlaneGeometry(w, h);
    var uv = g.attributes.uv;
    for (var i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tile, uv.getY(i) * h / tile);
    return new T.Mesh(g, material);
  }

  AFRAME.registerComponent('apartment', {
    init: function () {
      var el = this.el;
      var fixed = new T.Group();
      fixed.name = 'apartment-fixed';

      var white = Kit.mat(0xf2f1ed, { rough: 0.55 });
      var threshold = Kit.mat(0xb5b0a4, { rough: 0.35, metal: 0.55 });
      var graphite = Kit.mat(0x2a2c2f, { rough: 0.45, metal: 0.4 });
      var brass = Kit.mat(0xc2a15a, { rough: 0.3, metal: 0.8 });
      var black = Kit.mat(0x1a1a1b, { rough: 0.45, metal: 0.3 });
      var wallTile = Kit.mat(0xffffff, { rough: 0.25, metal: 0.05, map: tileTexture('wall') });
      var floorTile = Kit.mat(0xffffff, { rough: 0.3, metal: 0.05, map: tileTexture('floor') });
      var spot = new T.MeshBasicMaterial({ color: 0xfffbe8 });
      var spotRing = Kit.mat(0xe9e8e4, { rough: 0.5 });

      // ---------------------------------------------------------------- walls and skirting boards
      P.FACES.forEach(function (face) {
        var n = { x: face.nx, z: face.nz };
        face.pieces.forEach(function (p) {
          var len = p.a1 - p.a0, hgt = p.y1 - p.y0;
          var mid = (p.a0 + p.a1) / 2, cy = (p.y0 + p.y1) / 2;
          var x = face.axis === 'x' ? mid : face.fixed;
          var z = face.axis === 'x' ? face.fixed : mid;
          if (face.surface) {
            ent('a-plane', {
              class: 'interactive', surface: 'name: ' + face.surface,
              width: len, height: hgt, position: x + ' ' + cy + ' ' + z, rotation: '0 ' + face.rot + ' 0'
            }, el);
            if (p.base) {
              ent('a-box', {
                surface: 'name: skirting', visible: 'false',
                width: len, height: 0.1, depth: 0.02,
                position: (x + n.x * 0.01) + ' 0.05 ' + (z + n.z * 0.01),
                rotation: '0 ' + face.rot + ' 0'
              }, el);
            }
          } else {
            // fixed bathroom tiles
            var m = tiledPlane(len, hgt, wallTile, 0.6);
            m.position.set(x, cy, z);
            m.rotation.y = face.rot * Math.PI / 180;
            fixed.add(m);
          }
        });
      });

      // ---------------------------------------------------------------- floors and ceilings
      P.ROOMS.forEach(function (r) {
        var w = r.x1 - r.x0, d = r.z1 - r.z0, cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
        if (r.id === 'bath') {
          var f = tiledPlane(w, d, floorTile, 0.6);
          f.rotation.x = -Math.PI / 2; f.position.set(cx, 0, cz);
          fixed.add(f);
        } else {
          ent('a-plane', {
            class: 'interactive', surface: 'name: floor',
            width: w, height: d, position: cx + ' 0 ' + cz, rotation: '-90 0 0'
          }, el);
        }
        ent('a-plane', {
          class: 'interactive', surface: 'name: ceiling',
          width: w, height: d, position: cx + ' ' + H + ' ' + cz, rotation: '90 0 0'
        }, el);

        // one ceiling light per room (its position is in the plan); the evening/day switch changes it
        ent('a-entity', {
          id: 'l-' + r.id, class: 'room-light',
          light: 'type: point; color: #fff2cf; intensity: 0.9; distance: 6; decay: 1',
          position: r.lamp[0] + ' ' + r.lamp[1] + ' ' + r.lamp[2]
        }, el);
      });

      // ---------------------------------------------------------------- door frames, reveals, thresholds
      var trim = new Kit.Item('frames');
      var CW = 0.07; // width of the door casing
      // a box of the trim: `axis` = direction of the wall, along/across = position along and across it,
      // sa/sc = size along and across the wall, sy = height
      function box(m, axis, along, y, across, sa, sy, sc) {
        var bw = axis === 'x' ? sa : sc, bd = axis === 'x' ? sc : sa;
        trim.box(bw, sy, bd, m, axis === 'x' ? along : across, y, axis === 'x' ? across : along);
      }
      P.OPENINGS.forEach(function (o) {
        var ax = o.axis, b0 = o.band[0], b1 = o.band[1], bt = b1 - b0, bm = (b0 + b1) / 2;
        var lo = o.c - o.w / 2, hi = o.c + o.w / 2;
        // reveal: the sides and the top of the opening, inside the thickness of the wall
        box(white, ax, lo + 0.005, o.h / 2, bm, 0.01, o.h, bt);
        box(white, ax, hi - 0.005, o.h / 2, bm, 0.01, o.h, bt);
        box(white, ax, o.c, o.h - 0.005, bm, o.w, 0.01, bt);
        // threshold strip in the floor
        box(threshold, ax, o.c, 0.006, bm, o.w, 0.012, bt);
        // casing on both faces of the wall
        [[b0 - 0.006, 0], [b1 + 0.006, 1]].forEach(function (s) {
          box(white, ax, lo - CW / 2, o.h / 2, s[0], CW, o.h, 0.012);
          box(white, ax, hi + CW / 2, o.h / 2, s[0], CW, o.h, 0.012);
          box(white, ax, o.c, o.h + CW / 2, s[0], o.w + 2 * CW, CW, 0.012);
        });
      });

      // the front door: closed, in the south wall of the hall
      var E = P.ENTRANCE, hall = P.room(E.room);
      trim.box(E.w, E.h, 0.05, graphite, E.c, E.h / 2, hall.z1 - 0.035);
      trim.box(0.025, 0.3, 0.025, brass, E.c + 0.32, 1.0, hall.z1 - 0.075);                 // pull handle
      trim.box(0.025, 0.025, 0.07, brass, E.c + 0.32, 1.15, hall.z1 - 0.06);
      trim.box(0.025, 0.025, 0.07, brass, E.c + 0.32, 0.85, hall.z1 - 0.06);
      trim.cyl(0.012, 0.012, 0.01, black, E.c, 1.55, hall.z1 - 0.062, Math.PI / 2, 0, 0, 12);   // peephole
      trim.box(E.w + 2 * CW, CW, 0.012, white, E.c, E.h + CW / 2, hall.z1 - 0.006);
      trim.box(CW, E.h, 0.012, white, E.c - E.w / 2 - CW / 2, E.h / 2, hall.z1 - 0.006);
      trim.box(CW, E.h, 0.012, white, E.c + E.w / 2 + CW / 2, E.h / 2, hall.z1 - 0.006);
      fixed.add(trim.build());

      // ---------------------------------------------------------------- ceiling cornice (white coving all round, every room)
      var cov = new Kit.Item('cornice');
      var cornice = Kit.mat(0xf3f1ec, { rough: 0.8 });
      P.ROOMS.forEach(function (r) {
        var w = r.x1 - r.x0, d = r.z1 - r.z0, cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
        cov.box(w, 0.1, 0.1, cornice, cx, H - 0.05, r.z0 + 0.05); cov.box(w, 0.1, 0.1, cornice, cx, H - 0.05, r.z1 - 0.05);
        cov.box(0.1, 0.1, d, cornice, r.x0 + 0.05, H - 0.05, cz); cov.box(0.1, 0.1, d, cornice, r.x1 - 0.05, H - 0.05, cz);
      });
      fixed.add(cov.build());

      // ---------------------------------------------------------------- white panel heater (living room, under the mirror)
      var heat = new Kit.Item('heater');
      var panelWhite = Kit.mat(0xf4f2ee, { rough: 0.6 });
      var ribs = Kit.mat(0xd9d7d2, { rough: 0.6 });
      heat.box(0.08, 0.5, 1.2, panelWhite, 2.455, 0.5, -2.45);
      for (var k = 0; k < 8; k++) heat.box(0.012, 0.012, 1.05, ribs, 2.41, 0.66 + k * 0.012, -2.45);
      heat.box(0.02, 0.04, 0.04, Kit.mat(0x8a8884), 2.41, 0.32, -1.95);
      fixed.add(heat.build());

      // ---------------------------------------------------------------- ceiling spot lights
      var spots = new Kit.Item('spots');
      var SPOTS = {
        hall: [[2.4, 1.4], [2.4, 3.4]],
        living: [[-1.6, -2.7], [0.2, -2.7], [-1.6, -0.8], [0.2, -0.8], [1.9, -2.7]],
        kitchen: [[3.7, -2.6], [5.4, -2.6], [3.7, -0.9], [5.4, -0.9]],
        bedroom: [[-1.6, 1.4], [-0.1, 1.4], [-1.6, 3.5], [-0.1, 3.5]],
        bath: [[4.3, 1.5], [4.3, 3.4], [5.8, 1.5], [5.8, 3.4]]
      };
      Object.keys(SPOTS).forEach(function (id) {
        SPOTS[id].forEach(function (s) {
          spots.cyl(0.052, 0.052, 0.012, spot, s[0], H - 0.006, s[1], 0, 0, 0, 20);
          spots.cyl(0.07, 0.07, 0.006, spotRing, s[0], H - 0.003, s[1], 0, 0, 0, 20);
        });
      });
      fixed.add(spots.build());

      el.setObject3D('fixed', fixed);

      // ---------------------------------------------------------------- door leaves (finish = configurator "door")
      P.OPENINGS.filter(function (o) { return o.kind === 'door'; }).forEach(function (o) {
        var ax = o.axis, bm = (o.band[0] + o.band[1]) / 2;
        var room = P.room(o.swing.room);
        var rc = ax === 'z' ? (room.x0 + room.x1) / 2 : (room.z0 + room.z1) / 2;
        var into = rc > bm ? 1 : -1; // towards the room the door opens into
        var leafW = o.w - 0.04;
        var along = o.c + o.swing.hinge * o.w / 2;
        var across = into > 0 ? o.band[1] - 0.025 : o.band[0] + 0.025;
        var dirAlong = o.swing.hinge === -1 ? 1 : -1;
        var da = dirAlong * Math.cos(THETA), dc = into * Math.sin(THETA); // direction of the leaf (along, across)
        var dx = ax === 'z' ? dc : da, dz = ax === 'z' ? da : dc;
        var phi = Math.atan2(-dz, dx) * 180 / Math.PI;
        var hx = ax === 'z' ? across : along, hz = ax === 'z' ? along : across;
        var group = ent('a-entity', { position: hx + ' 0 ' + hz, rotation: '0 ' + phi + ' 0' }, el);
        ent('a-box', {
          class: 'interactive', surface: 'name: door',
          width: leafW, height: o.h - 0.02, depth: 0.04, position: (leafW / 2) + ' ' + ((o.h - 0.02) / 2 + 0.01) + ' 0'
        }, group);
        // black lever handles and hinges
        var hw = new Kit.Item('door hardware');
        [1, -1].forEach(function (s) {
          hw.box(0.14, 0.022, 0.022, black, leafW - 0.1, 1.02, s * 0.045);
          hw.box(0.05, 0.05, 0.01, black, leafW - 0.065, 1.02, s * 0.027);
        });
        [0.2, 1.05, 1.9].forEach(function (y) { hw.box(0.02, 0.1, 0.05, black, 0.012, y, 0); });
        group.object3D.add(hw.build());
      });

      // ---------------------------------------------------------------- finishes, raycaster
      var all = Array.prototype.slice.call(el.querySelectorAll('[surface]'));
      var ready = all.map(function (e) {
        return new Promise(function (resolve) {
          if (e.hasLoaded) resolve(); else e.addEventListener('loaded', resolve, { once: true });
        });
      });
      var scene = el.sceneEl;
      Promise.all(ready).then(function () {
        var cfg = scene.components && scene.components.configurator;
        if (cfg) {
          cfg.applyAll();
          cfg.updateHighlights();
          if (cfg.refreshRaycasters) cfg.refreshRaycasters();
        }
        AVR.apartmentReady = true;
        scene.emit('apartment-ready');
      });
    },

    remove: function () {
      this.el.removeObject3D('fixed');
    }
  });
})();
