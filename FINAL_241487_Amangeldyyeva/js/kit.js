/*
 * kit.js
 * Small helpers for building furniture from simple shapes (A-Frame 1.8.0 / three.js).
 *
 * Why this file exists: a sofa made of 40 boxes would be 40 draw calls. The Item builder below collects all
 * the shapes of one piece of furniture and merges the ones that share a material into a single mesh,
 * so a whole room of furniture stays cheap to draw (the frame rate matters in VR). Every piece is
 * its own THREE.Group, which lets the visitor remove one piece at a time.
 *
 * Everything is the author's own code. No downloaded models or textures.
 */
(function () {
  'use strict';
  var T = AFRAME.THREE;

  // deterministic random numbers: the same picture every time
  function rng(seed) {
    var s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  // canvas texture; rx/ry = how often it repeats over a UV square
  function tex(w, h, draw, rx, ry) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    var t = new T.CanvasTexture(c);
    if (T.SRGBColorSpace) t.colorSpace = T.SRGBColorSpace;
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.repeat.set(rx || 1, ry || 1);
    t.anisotropy = 4;
    return t;
  }

  function mat(color, o) {
    o = o || {};
    return new T.MeshStandardMaterial({
      color: color, roughness: o.rough == null ? 0.7 : o.rough, metalness: o.metal || 0,
      map: o.map || null, bumpMap: o.bump || null, bumpScale: o.bumpScale || 1,
      transparent: !!o.opacity, opacity: o.opacity == null ? 1 : o.opacity,
      emissive: o.emissive || 0x000000, emissiveIntensity: o.emissiveIntensity || 0,
      side: o.side || T.FrontSide, envMapIntensity: o.env == null ? 1 : o.env
    });
  }

  function place(geo, x, y, z, rx, ry, rz, sx, sy, sz) {
    var m = new T.Matrix4();
    m.compose(
      new T.Vector3(x || 0, y || 0, z || 0),
      new T.Quaternion().setFromEuler(new T.Euler(rx || 0, ry || 0, rz || 0)),
      new T.Vector3(sx == null ? 1 : sx, sy == null ? 1 : sy, sz == null ? 1 : sz)
    );
    geo.applyMatrix4(m);
    return geo;
  }

  // Join several geometries (already placed) into one.
  function merge(list) {
    var pos = [], nor = [], uv = [], idx = [], off = 0;
    list.forEach(function (g) {
      var p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv, i;
      for (i = 0; i < p.count; i++) {
        pos.push(p.getX(i), p.getY(i), p.getZ(i));
        if (n) nor.push(n.getX(i), n.getY(i), n.getZ(i)); else nor.push(0, 1, 0);
        if (u) uv.push(u.getX(i), u.getY(i)); else uv.push(0, 0);
      }
      if (g.index) { for (i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + off); }
      else { for (i = 0; i < p.count; i++) idx.push(i + off); }
      off += p.count;
      g.dispose();
    });
    var out = new T.BufferGeometry();
    out.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    out.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    out.setIndex(idx);
    out.computeBoundingSphere();
    out.computeBoundingBox();
    return out;
  }

  // ---------------------------------------------------------------------------
  // Item: one piece of furniture
  // ---------------------------------------------------------------------------
  function Item(name) {
    this.name = name;
    this.parts = new Map(); // material -> [geometry]
  }

  Item.prototype.add = function (geo, m, x, y, z, rx, ry, rz, sx, sy, sz) {
    place(geo, x, y, z, rx, ry, rz, sx, sy, sz);
    var list = this.parts.get(m);
    if (!list) { list = []; this.parts.set(m, list); }
    list.push(geo);
    return this;
  };
  Item.prototype.box = function (w, h, d, m, x, y, z, rx, ry, rz) {
    return this.add(new T.BoxGeometry(w, h, d), m, x, y, z, rx, ry, rz);
  };
  Item.prototype.cyl = function (rt, rb, h, m, x, y, z, rx, ry, rz, seg) {
    return this.add(new T.CylinderGeometry(rt, rb, h, seg || 20), m, x, y, z, rx, ry, rz);
  };
  Item.prototype.ball = function (r, m, x, y, z, sx, sy, sz) {
    return this.add(new T.SphereGeometry(r, 14, 10), m, x, y, z, 0, 0, 0, sx, sy, sz);
  };
  Item.prototype.plane = function (w, h, m, x, y, z, rx, ry, rz) {
    return this.add(new T.PlaneGeometry(w, h), m, x, y, z, rx, ry, rz);
  };
  Item.prototype.tube = function (points, r, m, seg) {
    var curve = new T.CatmullRomCurve3(points.map(function (p) { return new T.Vector3(p[0], p[1], p[2]); }));
    return this.add(new T.TubeGeometry(curve, seg || 40, r, 8, false), m, 0, 0, 0);
  };
  // a flat shape (array of [x, y]) extruded by `depth` along z
  Item.prototype.shape = function (pts, depth, m, x, y, z, rx, ry, rz) {
    var s = new T.Shape();
    pts.forEach(function (p, i) { if (i === 0) s.moveTo(p[0], p[1]); else s.lineTo(p[0], p[1]); });
    var g = new T.ExtrudeGeometry(s, { depth: depth, bevelEnabled: false });
    g.translate(0, 0, -depth / 2);
    return this.add(g, m, x, y, z, rx, ry, rz);
  };
  // a box with rounded vertical edges (soft furniture), made from an extruded rounded rectangle
  Item.prototype.soft = function (w, h, d, r, m, x, y, z, rx, ry, rz) {
    r = Math.min(r, w / 2 - 0.001, d / 2 - 0.001);
    var s = new T.Shape();
    var hw = w / 2, hd = d / 2;
    s.moveTo(-hw + r, -hd);
    s.lineTo(hw - r, -hd); s.quadraticCurveTo(hw, -hd, hw, -hd + r);
    s.lineTo(hw, hd - r); s.quadraticCurveTo(hw, hd, hw - r, hd);
    s.lineTo(-hw + r, hd); s.quadraticCurveTo(-hw, hd, -hw, hd - r);
    s.lineTo(-hw, -hd + r); s.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
    var g = new T.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelSize: Math.min(0.02, r * 0.6), bevelThickness: Math.min(0.02, h * 0.3), bevelSegments: 2, curveSegments: 4 });
    g.rotateX(-Math.PI / 2); // extrusion axis becomes up
    g.translate(0, -h / 2, 0);
    return this.add(g, m, x, y, z, rx, ry, rz);
  };

  Item.prototype.build = function () {
    var g = new T.Group();
    g.name = this.name;
    g.userData.item = this.name;
    this.parts.forEach(function (list, m) {
      var mesh = new T.Mesh(merge(list), m);
      g.add(mesh);
    });
    this.parts.clear();
    return g;
  };

  // ---------------------------------------------------------------------------
  // Furniture: the list of pieces, which ones are removed, where they stand (for walking)
  //
  // Every piece is added with Furniture.add(parentEl, item, { room, label, words, rect }).
  //   rect  = [x0, z0, x1, z1] footprint in metres: the visitor cannot walk through it (Plan.obstacles);
//   rects = the same for a piece that has several footprints (four chairs)
  //   words = extra names, so "remove the couch" finds the sofa
  // The visitor can remove a piece by clicking it ("remove mode"), by voice, or all at once ("Furniture: off").
  // ---------------------------------------------------------------------------
  function singular(w) { return w.replace(/ies$/, 'y').replace(/([^s])s$/, '$1'); }
  var STOP = /^(the|a|an|my|this|that|all|of|please|one|some)$/;

  // A soft dark "contact shadow" under every piece that stands on the floor. It is a cheap fake of
  // ambient occlusion: one shared blurred-square texture on a flat plane just above the floor.
  var shadowMat = null;
  function contactShadow(rect) {
    if (!shadowMat) {
      var c = document.createElement('canvas');
      c.width = c.height = 128;
      var g = c.getContext('2d');
      g.shadowColor = 'rgba(0,0,0,1)';
      g.shadowBlur = 14;
      g.shadowOffsetX = 1000;
      g.fillStyle = '#000';
      g.fillRect(-1000 + 16, 16, 96, 96);   // drawn off-canvas, only its blurred shadow lands on the canvas
      var t = new T.CanvasTexture(c);
      t.colorSpace = T.SRGBColorSpace;
      shadowMat = new T.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    }
    var w = rect[2] - rect[0], d = rect[3] - rect[1], pad = 0.16;
    var m = new T.Mesh(new T.PlaneGeometry(w + pad * 2, d + pad * 2), shadowMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set((rect[0] + rect[2]) / 2, 0.02, (rect[1] + rect[3]) / 2);
    m.renderOrder = 1;
    return m;
  }

  var Furniture = {
    items: [],
    enabled: true,   // the "Furniture: on/off" switch
    hidden: false,   // true while the "before renovation" picture is shown
    removeMode: false,
    outline: null,

    scene: function () { return document.querySelector('a-scene'); },
    changed: function () {
      this.syncObstacles();
      var s = this.scene();
      if (s) s.emit('furniture-changed', { enabled: this.enabled, removeMode: this.removeMode, removed: this.removedCount() });
    },

    add: function (parentEl, item, o) {
      var group = item.build();
      // a piece can be built around its own origin and then put in place (pos = [x, y, z], rotY in radians)
      if (o.pos) group.position.set(o.pos[0], o.pos[1], o.pos[2]);
      if (o.rotY) group.rotation.y = o.rotY;
      var el = document.createElement('a-entity');
      parentEl.appendChild(el);
      el.setObject3D('item', group);
      var label = o.label || item.name;
      var words = (label + ' ' + (o.words || '')).toLowerCase().split(/\s+/).filter(Boolean).map(singular);
      var rec = { id: o.room + ':' + label.toLowerCase(), label: label, room: o.room, words: words, el: el, group: group, rects: o.rects || (o.rect ? [o.rect] : []), removed: false };
      var self = this;
      el.addEventListener('click', function () { if (self.removeMode && !rec.removed) self.remove(rec, 'click'); });
      el.addEventListener('mouseenter', function () { if (self.removeMode) self.showOutline(rec); });
      el.addEventListener('mouseleave', function () { self.hideOutline(); });
      // contact shadows (one plane per footprint rectangle) live on the same entity, so they hide with the piece
      rec.shadows = rec.rects.map(function (q) { var m = contactShadow(q); el.object3D.add(m); return m; });
      this.items.push(rec);
      this.syncObstacles();
      return rec;
    },

    removedCount: function () { return this.items.filter(function (r) { return r.removed; }).length; },

    // Walls of the plan: walking is blocked by every piece that is standing and visible.
    syncObstacles: function () {
      var P = window.Plan;
      if (!P) return;
      var active = this.enabled && !this.hidden;
      P.obstacles.length = 0;
      if (!active) return;
      this.items.forEach(function (r) {
        if (r.removed) return;
        r.rects.forEach(function (q) { P.obstacles.push({ x0: q[0], z0: q[1], x1: q[2], z1: q[3] }); });
      });
    },

    setEnabled: function (on) { this.enabled = !!on; this.changed(); },
    setHidden: function (on) { this.hidden = !!on; this.syncObstacles(); },

    remove: function (rec, source) {
      rec.removed = true;
      rec.group.visible = false;
      rec.shadows.forEach(function (m) { m.visible = false; });
      rec.el.classList.remove('interactive');
      this.hideOutline();
      this.changed();
      var s = this.scene();
      if (s) s.emit('furniture-removed', { label: rec.label, source: source || '' });
      this.refresh();
    },

    restore: function (rec) {
      rec.removed = false;
      rec.group.visible = true;
      rec.shadows.forEach(function (m) { m.visible = true; });
      if (this.removeMode) rec.el.classList.add('interactive');
      this.changed();
      this.refresh();
    },

    restoreAll: function () {
      var n = 0;
      this.items.forEach(function (r) { if (r.removed) { r.removed = false; r.group.visible = true; r.shadows.forEach(function (m) { m.visible = true; }); n++; } });
      this.setRemoveMode(this.removeMode); // re-marks the pieces as clickable
      this.changed();
      return n;
    },

    setRemoveMode: function (on) {
      this.removeMode = !!on;
      this.items.forEach(function (r) { r.el.classList.toggle('interactive', !!on && !r.removed); });
      if (!on) this.hideOutline();
      this.changed();
      this.refresh();
    },

    refresh: function () {
      if (window.AVR && window.AVR.cfg && window.AVR.cfg.refreshRaycasters) window.AVR.cfg.refreshRaycasters();
    },

    // Pieces that match spoken words ("sofa", "the lamps"); the visitor's own room first.
    find: function (text, roomId, removedOnly) {
      var toks = String(text || '').toLowerCase().split(/\s+/).filter(function (t) { return t && !STOP.test(t); }).map(singular);
      if (!toks.length) return [];
      var pool = this.items.filter(function (r) { return removedOnly ? r.removed : !r.removed; });
      var hit = function (r) { return toks.some(function (t) { return r.words.indexOf(t) >= 0; }); };
      var inRoom = pool.filter(function (r) { return r.room === roomId && hit(r); });
      return inRoom.length ? inRoom : pool.filter(hit);
    },

    // A red frame around the piece the pointer is over (remove mode).
    showOutline: function (rec) {
      var scene = this.scene();
      if (!scene || !scene.object3D) return;
      if (!this.outline) {
        var edges = new T.EdgesGeometry(new T.BoxGeometry(1, 1, 1));
        this.outline = new T.LineSegments(edges, new T.LineBasicMaterial({ color: 0xff4d4d, depthTest: false, transparent: true }));
        this.outline.renderOrder = 999;
        scene.object3D.add(this.outline);
      }
      var box = new T.Box3().setFromObject(rec.group);
      var size = box.getSize(new T.Vector3()), c = box.getCenter(new T.Vector3());
      this.outline.position.copy(c);
      this.outline.scale.set(Math.max(size.x, 0.05) + 0.04, Math.max(size.y, 0.05) + 0.04, Math.max(size.z, 0.05) + 0.04);
      this.outline.visible = true;
      var cfg = window.AVR && window.AVR.cfg;
      if (cfg) cfg.setCaption('Click to remove: ' + rec.label.toLowerCase(), 'info', 2500);
    },
    hideOutline: function () { if (this.outline) this.outline.visible = false; }
  };

  window.Kit = { rng: rng, tex: tex, mat: mat, Item: Item, merge: merge, place: place, Furniture: Furniture };
})();
