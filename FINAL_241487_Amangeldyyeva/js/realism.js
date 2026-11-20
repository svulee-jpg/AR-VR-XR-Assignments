/*
 * realism.js
 * Makes the apartment look like a photograph of a real flat instead of a video game.
 *
 *  1. Image-based lighting: a real HDR panorama of an empty apartment (Poly Haven "Lebombo", CC0,
 *     see ASSETS.md) lights every material and shows up in its reflections (floors, tiles, metal).
 *  2. Soft shadows: furniture and door leaves cast shadows on the floor and walls. There is one
 *     shadow-casting light, and its shadow map is redrawn only when something changes (a piece
 *     is removed, the furniture is switched off, the "before" picture is shown), so it costs
 *     nothing while the visitor just looks around (frame rate in VR).
 *  3. Corner shading: walls, floors and ceilings get gradually darker towards their edges, as in
 *     a real room where the light reaches the corners less (a cheap fake of ambient occlusion,
 *     computed in the shader from the size of each surface, no extra textures).
 *
 * Usage: <a-scene realism="env: img/env/apartment-512.hdr" shadow="type: pcf; autoUpdate: false">
 * Other code calls AVR.realism.shadowsDirty() after it changes what is visible, and
 * AVR.realism.setMode('day' | 'evening') when the light changes.
 */
(function () {
  'use strict';
  if (typeof AFRAME === 'undefined') return;
  var T = AFRAME.THREE;
  var AVR = (window.AVR = window.AVR || {});

  // ---------------------------------------------------------------- Radiance .hdr reader
  // Reads flat and run-length encoded RGBE scanlines and returns a half-float equirectangular texture.
  function parseHDR(buffer) {
    var d = new Uint8Array(buffer), i = 0;
    function readLine() {
      var s = '';
      while (i < d.length && d[i] !== 10) s += String.fromCharCode(d[i++]);
      i++;
      return s;
    }
    if (readLine().indexOf('#?') !== 0) throw new Error('realism: not a Radiance .hdr file');
    while (readLine() !== '') { /* header lines end with an empty line */ }
    var res = readLine().split(/\s+/);
    var H = parseInt(res[1], 10), W = parseInt(res[3], 10);
    var rgbe = new Uint8Array(W * H * 4);
    for (var y = 0; y < H; y++) {
      var row = (H - 1 - y) * W * 4; // the file starts at the top, a texture at the bottom
      if (d[i] === 2 && d[i + 1] === 2 && ((d[i + 2] << 8) | d[i + 3]) === W) {
        i += 4;
        for (var c = 0; c < 4; c++) {
          var x = 0;
          while (x < W) {
            var n = d[i++];
            if (n > 128) { n -= 128; var v = d[i++]; while (n-- > 0) rgbe[row + (x++) * 4 + c] = v; }
            else { while (n-- > 0) rgbe[row + (x++) * 4 + c] = d[i++]; }
          }
        }
      } else {
        rgbe.set(d.subarray(i, i + W * 4), row);
        i += W * 4;
      }
    }
    var half = new Uint16Array(W * H * 4), toHalf = T.DataUtils.toHalfFloat, one = toHalf(1);
    for (var p = 0; p < W * H; p++) {
      var e = rgbe[p * 4 + 3], s = e ? Math.pow(2, e - 136) : 0;
      half[p * 4] = toHalf(rgbe[p * 4] * s);
      half[p * 4 + 1] = toHalf(rgbe[p * 4 + 1] * s);
      half[p * 4 + 2] = toHalf(rgbe[p * 4 + 2] * s);
      half[p * 4 + 3] = one;
    }
    var tex = new T.DataTexture(half, W, H, T.RGBAFormat, T.HalfFloatType);
    tex.colorSpace = T.LinearSRGBColorSpace;
    tex.mapping = T.EquirectangularReflectionMapping;
    tex.minFilter = tex.magFilter = T.LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return tex;
  }

  // ---------------------------------------------------------------- corner shading (shader patch)
  // tile = metres per UV unit, size = width and height of the surface in metres.
  function addCornerShade(mat, tileX, tileY, w, h, strength) {
    if (!mat || mat.userData.cornerShade) return;
    var u = mat.userData.cornerShade = {
      csTile: { value: new T.Vector2(tileX, tileY) },
      csSize: { value: new T.Vector2(w, h) },
      csStrength: { value: strength }
    };
    mat.onBeforeCompile = function (sh) {
      sh.uniforms.csTile = u.csTile;
      sh.uniforms.csSize = u.csSize;
      sh.uniforms.csStrength = u.csStrength;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vCsM;\nuniform vec2 csTile;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\n  vCsM = uv * csTile;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vCsM;\nuniform vec2 csSize;\nuniform float csStrength;')
        .replace('#include <aomap_fragment>', [
          '#include <aomap_fragment>',
          '{',
          '  vec2 edge = max(min(vCsM, csSize - vCsM), 0.0);',      // distance to the nearest edges, metres
          '  vec2 occ = 1.0 - csStrength * exp(-edge / 0.42);',      // darker within ~40 cm of an edge
          '  float cs = occ.x * occ.y;',                             // corners: both edges at once
          '  reflectedLight.indirectDiffuse *= cs;',
          '  reflectedLight.indirectSpecular *= mix(1.0, cs, 0.6);',
          '  reflectedLight.directDiffuse *= mix(1.0, cs, 0.45);',
          '}'
        ].join('\n'));
    };
    mat.customProgramCacheKey = function () { return 'corner-shade-1'; };
    mat.needsUpdate = true;
  }

  // ---------------------------------------------------------------- fabrics
  // A fine woven relief (grey bump map, drawn once) and the "sheen" of cloth: the soft light that fabric
  // catches at grazing angles. Plastic-looking fabric is a typical sign of a game.
  var weaveTex = null;
  function weave() {
    if (weaveTex) return weaveTex;
    var c = document.createElement('canvas');
    c.width = c.height = 128;
    var g = c.getContext('2d');
    g.fillStyle = '#808080';
    g.fillRect(0, 0, 128, 128);
    for (var y = 0; y < 128; y += 4) {
      for (var x = 0; x < 128; x += 4) {
        var over = ((x + y) / 4) % 2 === 0;
        g.fillStyle = over ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)';
        g.fillRect(x, y + (over ? 0 : 1), 4, 3);
      }
    }
    for (var k = 0; k < 900; k++) { // fibres: a little irregularity
      g.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '0,0,0' : '255,255,255') + ',0.08)';
      g.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 3, 1);
    }
    weaveTex = new T.CanvasTexture(c);
    weaveTex.wrapS = weaveTex.wrapT = T.RepeatWrapping;
    weaveTex.repeat.set(10, 10);
    weaveTex.anisotropy = 4;
    return weaveTex;
  }
  var fabricOf = new Map(); // standard material -> its cloth version (materials are shared between pieces)
  function toFabric(m) {
    if (fabricOf.has(m)) return fabricOf.get(m);
    var f = new T.MeshPhysicalMaterial({
      color: m.color.clone(), map: m.map, roughness: Math.max(m.roughness, 0.9), metalness: 0,
      side: m.side, envMapIntensity: m.envMapIntensity,
      bumpMap: m.bumpMap || weave(), bumpScale: m.bumpMap ? m.bumpScale : 0.6,
      sheen: 1, sheenRoughness: 0.55, sheenColor: m.color.clone().lerp(new T.Color(0xffffff), 0.35)
    });
    f.name = (m.name || '') + ' (fabric)';
    fabricOf.set(m, f);
    return f;
  }
  function isFabric(m) {
    return m && m.isMeshStandardMaterial && !m.isMeshPhysicalMaterial && !m.transparent &&
      m.roughness >= 0.85 && m.metalness < 0.1 && m.emissiveIntensity < 0.05;
  }

  AFRAME.registerComponent('realism', {
    schema: {
      env: { default: 'img/env/apartment-512.hdr' },
      envDay: { default: 0.85 },
      envEvening: { default: 0.14 }
    },

    init: function () {
      var self = this;
      this.mode = 'day';
      this.sig = '';
      this.envTex = null;
      AVR.realism = {
        shadowsDirty: function () { self.shadowsDirty(); },
        setMode: function (m) { self.setMode(m); },
        info: function () { return { env: !!self.envTex, mode: self.mode }; }
      };
      var scene = this.el;
      var start = function () {
        self.loadEnv();
        self.markSurfaces();
        self.shadowsDirty();
      };
      if (scene.renderer) start(); else scene.addEventListener('renderstart', start, { once: true });
      // The apartment is built a moment after the scene starts: shade its surfaces when it is ready.
      this.retry = setInterval(function () {
        if (AVR.apartmentReady) { clearInterval(self.retry); self.markSurfaces(); self.shadowsDirty(); }
      }, 300);
    },

    remove: function () { clearInterval(this.retry); },

    loadEnv: function () {
      var self = this, scene = this.el;
      fetch(this.data.env).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.arrayBuffer();
      }).then(function (buf) {
        var eq = parseHDR(buf);
        var pmrem = new T.PMREMGenerator(scene.renderer);
        var rt = pmrem.fromEquirectangular(eq);
        pmrem.dispose();
        eq.dispose();
        self.envTex = rt.texture;
        scene.object3D.environment = self.envTex;
        self.setMode(self.mode);
      }).catch(function (e) {
        console.warn('realism: environment not loaded, the scene uses its lamps only', e);
      });
    },

    setMode: function (mode) {
      this.mode = mode === 'evening' ? 'evening' : 'day';
      var s = this.el.object3D;
      if ('environmentIntensity' in s) s.environmentIntensity = this.mode === 'evening' ? this.data.envEvening : this.data.envDay;
    },

    shadowsDirty: function () {
      var r = this.el.renderer;
      if (!r || !r.shadowMap) return;
      // A-Frame turns the shadow map on only when a light asks for it before the renderer exists; make sure.
      if (!r.shadowMap.enabled) { r.shadowMap.enabled = true; r.shadowMap.type = T.PCFShadowMap; }
      r.shadowMap.needsUpdate = true;
    },

    // Corner shading for every finishable plane (walls, floor, ceiling) and the bathroom tiles.
    markSurfaces: function () {
      var els = document.querySelectorAll('[surface]');
      for (var k = 0; k < els.length; k++) {
        var el = els[k], comp = el.components.surface;
        var g = el.getAttribute('geometry');
        var mesh = el.getObject3D('mesh');
        if (!comp || !g || g.primitive !== 'plane' || !mesh) continue;
        var name = comp.data.name;
        var strength = name === 'floor' ? 0.5 : name === 'ceiling' ? 0.45 : 0.42;
        addCornerShade(comp.mat, g.width, g.height, g.width, g.height, strength);
        mesh.receiveShadow = name !== 'ceiling';
      }
      var fixed = this.el.object3D.getObjectByName('apartment-fixed');
      if (fixed) {
        fixed.traverse(function (m) {
          if (!m.isMesh || !m.geometry || m.geometry.type !== 'PlaneGeometry' || m.userData.csDone) return;
          var p = m.geometry.parameters, uv = m.geometry.attributes.uv;
          var umax = 0, vmax = 0;
          for (var i = 0; i < uv.count; i++) { umax = Math.max(umax, uv.getX(i)); vmax = Math.max(vmax, uv.getY(i)); }
          m.material = m.material.clone(); // own uniforms per plane
          addCornerShade(m.material, p.width / (umax || 1), p.height / (vmax || 1), p.width, p.height, 0.3);
          m.receiveShadow = true;
          m.userData.csDone = true;
        });
      }
      // door leaves throw a shadow too
      var doors = document.querySelectorAll('[surface="name: door"]');
      for (var d = 0; d < doors.length; d++) {
        var dm = doors[d].getObject3D('mesh');
        if (dm) { dm.castShadow = true; dm.receiveShadow = true; }
      }
    },

    // Furniture casts and receives shadows; glass does not cast.
    markFurniture: function () {
      var F = window.Kit && window.Kit.Furniture;
      if (!F) return;
      var box = new T.Box3();
      F.items.forEach(function (rec) {
        if (rec.shadowMarked) return;
        rec.group.updateMatrixWorld(true);
        rec.group.traverse(function (m) {
          if (!m.isMesh) return;
          var mat = Array.isArray(m.material) ? m.material[0] : m.material;
          var see = mat && mat.transparent && mat.opacity < 0.6;
          // things hanging under the ceiling (pendant lamps) would throw odd blobs with a light from above
          box.setFromObject(m);
          var high = box.min.y > 1.8;
          m.castShadow = !see && !high;
          m.receiveShadow = true;
          if (isFabric(mat) && !Array.isArray(m.material)) m.material = toFabric(mat);
        });
        rec.shadowMarked = true;
      });
    },

    // Redraw the shadow map only when the visible furniture changes.
    tick: function () {
      var F = window.Kit && window.Kit.Furniture;
      if (!F) return;
      var root = document.getElementById('furniture');
      var sig = F.items.length + ':' + (root && root.object3D.visible ? 1 : 0) + ':';
      for (var i = 0; i < F.items.length; i++) sig += F.items[i].group.visible ? '1' : '0';
      if (sig !== this.sig) {
        this.sig = sig;
        this.markFurniture();
        this.shadowsDirty();
      }
    }
  });

  window.Realism = { parseHDR: parseHDR, addCornerShade: addCornerShade, isFabric: isFabric };
})();
