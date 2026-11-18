/*
 * app.js
 * Small A-Frame components of the scene (A-Frame 1.8.0).
 *
 * Contents
 *   1. canvas-text : draws any text (Cyrillic, emoji) on a plane, so the app does not depend on
 *                    A-Frame's font files
 *   2. rig-move    : walking (keyboard, VR thumbstick) and turning; walls stop the visitor, doors let them through
 *      panel-follow: keeps the configurator panel in front of the user, inside the room where they stand
 *   3. radiator    : builds the radiator fins from primitives
 *   4. fps-meter   : measures the frame rate (shown with ?debug)
 *
 * The configurator itself (surfaces, panel, price, voice wiring) is in configurator.js.
 */
(function () {
  'use strict';

  var THREE = AFRAME.THREE;
  var AVR = (window.AVR = window.AVR || {});


  // ---------------------------------------------------------------------------
  // 1. canvas-text
  // ---------------------------------------------------------------------------
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, w, h, r);
    } else {
      ctx.rect(x, y, w, h);
    }
  }

  AFRAME.registerComponent('canvas-text', {
    schema: {
      text: { default: '' },
      width: { default: 1 }, // metres
      height: { default: 0.15 }, // metres
      color: { default: '#ffffff' },
      bg: { default: '' }, // CSS colour, empty = transparent
      swatch: { default: '' }, // CSS colour of a small square at the left, empty = none
      align: { default: 'center' }, // center | left
      fontSize: { default: 0 }, // font height in metres, 0 = fit to the height of the plate
      hover: { default: false }, // draws a white border
      overlay: { default: false }, // always drawn on top (used for the HUD)
      ppm: { default: 600 } // canvas pixels per metre
    },

    init: function () {
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d');
      this.texture = null;
      this.material = new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false });
      this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material);
      this.el.setObject3D('mesh', this.mesh);
    },

    update: function () {
      var d = this.data;
      var W = Math.max(16, Math.round(d.width * d.ppm));
      var H = Math.max(16, Math.round(d.height * d.ppm));
      // A texture cannot change size after its first upload, so make a new one.
      if (!this.texture || this.canvas.width !== W || this.canvas.height !== H) {
        this.canvas.width = W;
        this.canvas.height = H;
        if (this.texture) this.texture.dispose();
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.colorSpace = THREE.SRGBColorSpace;
        this.material.map = this.texture;
        this.material.needsUpdate = true;
      }
      this.mesh.scale.set(d.width, d.height, 1);
      this.material.depthTest = !d.overlay;
      this.mesh.renderOrder = d.overlay ? 1000 : 0;
      this.draw();
      this.texture.needsUpdate = true;
    },

    draw: function () {
      var d = this.data;
      var ctx = this.ctx;
      var w = this.canvas.width;
      var h = this.canvas.height;
      ctx.clearRect(0, 0, w, h);
      var radius = Math.min(h * 0.22, 36);

      if (d.bg) {
        ctx.fillStyle = d.bg;
        roundRect(ctx, 0, 0, w, h, radius);
        ctx.fill();
      }
      if (d.hover) {
        var lw = Math.max(4, h * 0.07);
        ctx.lineWidth = lw;
        ctx.strokeStyle = '#ffffff';
        roundRect(ctx, lw / 2, lw / 2, w - lw, h - lw, radius);
        ctx.stroke();
      }

      var padX = h * 0.25;
      var left = padX;
      var right = w - padX;
      if (d.swatch) {
        var size = h * 0.6;
        ctx.fillStyle = d.swatch;
        roundRect(ctx, padX, (h - size) / 2, size, size, size * 0.18);
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.stroke();
        left = padX + size + padX * 0.8;
      }

      var lines = String(d.text).split('\n');
      var available = right - left;
      var px = d.fontSize > 0 ? d.fontSize * d.ppm : h * 0.52;
      px = Math.min(px, (h * 0.86) / (lines.length * 1.2));
      var family = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
      // Shrink the font until the longest line fits.
      for (;;) {
        ctx.font = '600 ' + px + 'px ' + family;
        var widest = 0;
        for (var i = 0; i < lines.length; i++) widest = Math.max(widest, ctx.measureText(lines[i]).width);
        if (widest <= available || px <= 10) break;
        px -= 2;
      }
      ctx.fillStyle = d.color;
      ctx.textBaseline = 'middle';
      ctx.textAlign = d.align === 'left' ? 'left' : 'center';
      var x = d.align === 'left' ? left : (left + right) / 2;
      var lineHeight = px * 1.2;
      var y0 = h / 2 - ((lines.length - 1) * lineHeight) / 2;
      for (var j = 0; j < lines.length; j++) ctx.fillText(lines[j], x, y0 + j * lineHeight);
    },

    remove: function () {
      this.el.removeObject3D('mesh');
      if (this.texture) this.texture.dispose();
      this.material.dispose();
      this.mesh.geometry.dispose();
    }
  });

  // ---------------------------------------------------------------------------
  // 4. rig-move: walking through the apartment, 360 degree view, collision with walls and furniture
  // ---------------------------------------------------------------------------
  // The camera sits inside a "rig" entity. Looking around is done by look-controls (mouse drag,
  // headset), walking by this component:
  //   desktop : W A S D or the arrow keys UP / DOWN / LEFT / RIGHT-strafe; Q and E (or left and
  //             right arrow) turn the whole view, so the room can be seen from every side
  //   VR      : left thumbstick walks, right thumbstick turns in 30 degree steps
  // The camera is never moved by the app on its own (comfort); the rig only moves while the
  // user asks for it. Plan.walkable() (js/plan.js) says where a person can stand: inside the five rooms
  // and in the door openings. A step that would end inside a wall is cancelled; along a wall the visitor
  // slides. `goTo(room)` (room buttons, voice) is the only jump, and it is always asked for by the user.
  AFRAME.registerComponent('rig-move', {
    schema: {
      speed: { default: 1.6 }, // metres per second
      turnSpeed: { default: 80 }, // degrees per second (keyboard turn)
      radius: { default: 0.22 } // how close to a wall the camera may come (metres)
    },

    init: function () {
      var self = this;
      this.last = null; // last allowed camera position
      this.roomId = null;
      this.keys = {};
      this.stick = { x: 0, y: 0 };
      this.cam = this.el.querySelector('[camera]');
      this.dir = new THREE.Vector3();
      this.pos = new THREE.Vector3();
      this.onDown = function (e) {
        if (/input|textarea/i.test((e.target && e.target.tagName) || '')) return;
        self.keys[e.code] = true;
      };
      this.onUp = function (e) { self.keys[e.code] = false; };
      this.onBlur = function () { self.keys = {}; };
      window.addEventListener('keydown', this.onDown);
      window.addEventListener('keyup', this.onUp);
      window.addEventListener('blur', this.onBlur);
      this.lastSnap = 0;
      this.onStick = function (evt) {
        var id = evt.target && evt.target.id;
        var d = evt.detail || {};
        if (id === 'rightHand') {
          // snap turn: one 30 degree step per flick
          var now = performance.now();
          if (Math.abs(d.x) > 0.7 && now - self.lastSnap > 350) {
            self.el.object3D.rotation.y += (d.x > 0 ? -1 : 1) * Math.PI / 6;
            self.lastSnap = now;
          }
        } else {
          self.stick.x = d.x || 0;
          self.stick.y = d.y || 0;
        }
      };
      this.el.addEventListener('thumbstickmoved', this.onStick);
    },

    remove: function () {
      window.removeEventListener('keydown', this.onDown);
      window.removeEventListener('keyup', this.onUp);
      window.removeEventListener('blur', this.onBlur);
      this.el.removeEventListener('thumbstickmoved', this.onStick);
    },

    tick: function (time, delta) {
      if (!delta || !this.cam) return;
      var dt = Math.min(delta, 100) / 1000;
      var k = this.keys;
      var d = this.data;
      var rig = this.el.object3D;

      // turning (keyboard)
      var turn = (k.KeyQ || k.ArrowLeft ? 1 : 0) - (k.KeyE || k.ArrowRight ? 1 : 0);
      if (turn) rig.rotation.y += turn * d.turnSpeed * dt * Math.PI / 180;

      // walking: forward is where the camera looks, flattened to the floor
      var fwd = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) - (Math.abs(this.stick.y) > 0.15 ? this.stick.y : 0);
      var side = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0) + (Math.abs(this.stick.x) > 0.15 ? this.stick.x : 0);
      if (fwd || side) {
        this.cam.object3D.getWorldDirection(this.dir); // the direction the camera faces
        this.dir.y = 0;
        if (this.dir.lengthSq() < 1e-6) return;
        this.dir.normalize();
        var step = d.speed * dt;
        // camera looks along its local -Z; getWorldDirection returns +Z of the object, so negate
        var fx = -this.dir.x, fz = -this.dir.z;
        rig.position.x += (fx * fwd + (-fz) * side) * step;
        rig.position.z += (fz * fwd + fx * side) * step;
      }

      // collision: the CAMERA (not the rig) must stay on walkable ground
      this.cam.object3D.getWorldPosition(this.pos);
      var Plan = window.Plan;
      if (!Plan) return;
      var r = d.radius;
      var nx = this.pos.x, nz = this.pos.z;
      if (!this.last) this.last = { x: nx, z: nz };
      if (!Plan.walkable(nx, nz, r, true)) {
        // slide along the wall: try to keep one of the two coordinates
        if (Plan.walkable(nx, this.last.z, r, true)) nz = this.last.z;
        else if (Plan.walkable(this.last.x, nz, r, true)) nx = this.last.x;
        else { nx = this.last.x; nz = this.last.z; }
        rig.position.x += nx - this.pos.x;
        rig.position.z += nz - this.pos.z;
      }
      this.last.x = nx; this.last.z = nz;

      // which room are we in? (the room label, the panel and the room buttons follow this)
      var room = Plan.roomAt(nx, nz);
      if (room && room.id !== this.roomId) {
        this.roomId = room.id;
        AVR.room = room.id;
        this.el.sceneEl.emit('room-changed', { room: room.id });
      }
    },

    // Put the visitor at the arrival point of a room (used by the room buttons and the voice command).
    goTo: function (roomId) {
      var Plan = window.Plan;
      var room = Plan && Plan.room(roomId);
      if (!room || !this.cam) return false;
      var rig = this.el.object3D;
      var s = room.spawn;
      // turn the whole view so that the camera looks in the direction of the arrival point
      this.cam.object3D.getWorldDirection(this.dir);
      var current = Math.atan2(this.dir.x, this.dir.z); // 0 = looking towards -Z, positive = to the left
      rig.rotation.y += s.yaw * Math.PI / 180 - current;
      rig.updateMatrixWorld(true);
      this.cam.object3D.getWorldPosition(this.pos);
      rig.position.x += s.x - this.pos.x;
      rig.position.z += s.z - this.pos.z;
      this.last = null;
      if (this.roomId !== room.id) {
        this.roomId = room.id;
        AVR.room = room.id;
        this.el.sceneEl.emit('room-changed', { room: room.id });
      }
      return true;
    }
  });

  // ---------------------------------------------------------------------------
  // 4b. panel-follow: the configurator panel stays within reach from every side of the room
  // ---------------------------------------------------------------------------
  // The panel stands still while it is in front of the user. When the user turns away (more than
  // 70 degrees) or walks away, the panel glides to a spot in front of them and faces them.
  AFRAME.registerComponent('panel-follow', {
    schema: {
      distance: { default: 1.9 },
      side: { default: 22 }, // degrees to the left of the view direction, so the middle stays clear
      height: { default: 1.35 },
      turnLimit: { default: 70 }, // degrees
      maxDistance: { default: 2.8 },
      margin: { default: 0.25 } // how close to a wall the panel may come
    },

    init: function () {
      this.cam = document.querySelector('[camera]');
      this.cp = new THREE.Vector3();
      this.cd = new THREE.Vector3();
      this.target = new THREE.Vector3();
      this.gliding = false;
      this.snap = false;
      // area where the panel may stand: the room of the user (updated every frame)
      this.b = { minX: -2.3, maxX: 2.3, minZ: -3.4, maxZ: 0.4 };
    },

    // Distance from (ox, oz) along the unit direction (dx, dz) to the edge of the allowed panel area.
    rayLength: function (ox, oz, dx, dz) {
      var d = this.b, t = 99;
      if (dx > 1e-6) t = Math.min(t, (d.maxX - ox) / dx);
      else if (dx < -1e-6) t = Math.min(t, (d.minX - ox) / dx);
      if (dz > 1e-6) t = Math.min(t, (d.maxZ - oz) / dz);
      else if (dz < -1e-6) t = Math.min(t, (d.minZ - oz) / dz);
      return Math.max(0, t);
    },

    tick: function (time, delta) {
      if (!this.cam || !delta) return;
      var d = this.data;
      var panel = this.el.object3D;
      this.cam.object3D.getWorldPosition(this.cp);
      this.cam.object3D.getWorldDirection(this.cd);
      // getWorldDirection of a plain Object3D returns its +Z axis, i.e. BEHIND the user, so the view heading
      // (0 = looking towards -Z, positive = turned to the left) is atan2(x, z) of that vector
      var yaw = Math.atan2(this.cd.x, this.cd.z);

      // the panel lives in the room where the user stands: when they walk into another room it moves there at once
      var Plan = window.Plan;
      var room = Plan && Plan.roomAt(this.cp.x, this.cp.z);
      if (room) {
        this.b = { minX: room.x0 + d.margin, maxX: room.x1 - d.margin, minZ: room.z0 + d.margin, maxZ: room.z1 - d.margin };
        var panelRoom = Plan.roomAt(panel.position.x, panel.position.z);
        if (!panelRoom || panelRoom.id !== room.id) { this.gliding = true; this.snap = true; }
      }

      // where the panel is relative to the view direction
      var dx = panel.position.x - this.cp.x;
      var dz = panel.position.z - this.cp.z;
      var dist = Math.sqrt(dx * dx + dz * dz);
      var panelHeading = Math.atan2(-dx, -dz);
      var diff = Math.abs(Math.atan2(Math.sin(panelHeading - yaw), Math.cos(panelHeading - yaw))) * 180 / Math.PI;

      if (!this.gliding && (diff > d.turnLimit || dist > d.maxDistance || dist < 0.9)) this.gliding = true;
      if (this.gliding) {
        // Try spots in front of the user (slightly to the left first, then right, then wider angles) and
        // take the first one with enough free room before the wall; near a wall the panel moves to the side.
        var offsets = [d.side, -d.side, 55, -55, 90, -90, 135, -135, 180];
        var bestLen = -1, bestH = yaw;
        for (var i = 0; i < offsets.length; i++) {
          var hh = yaw + offsets[i] * Math.PI / 180;
          var len = this.rayLength(this.cp.x, this.cp.z, -Math.sin(hh), -Math.cos(hh));
          if (len > bestLen) { bestLen = len; bestH = hh; }
          if (len >= d.distance * 0.75) { bestLen = len; bestH = hh; break; }
        }
        var dd = Math.min(d.distance, bestLen);
        this.target.set(this.cp.x - Math.sin(bestH) * dd, d.height, this.cp.z - Math.cos(bestH) * dd);
        if (this.snap) { panel.position.copy(this.target); this.snap = false; }
        else panel.position.lerp(this.target, Math.min(1, delta / 250));
        if (panel.position.distanceTo(this.target) < 0.04) this.gliding = false;
      }
      // always face the user (rotate around the vertical axis only)
      panel.rotation.set(0, Math.atan2(this.cp.x - panel.position.x, this.cp.z - panel.position.z), 0);
    }
  });

  // ---------------------------------------------------------------------------
  // 5. radiator: N thin boxes
  // ---------------------------------------------------------------------------
  AFRAME.registerComponent('radiator', {
    schema: { fins: { default: 10 }, width: { default: 1 }, height: { default: 0.55 }, color: { default: '#f4f4f2' } },
    init: function () {
      var d = this.data;
      var step = d.width / d.fins;
      for (var i = 0; i < d.fins; i++) {
        var fin = document.createElement('a-box');
        fin.setAttribute('width', step * 0.72);
        fin.setAttribute('height', d.height);
        fin.setAttribute('depth', 0.07);
        fin.setAttribute('color', d.color);
        fin.setAttribute('position', { x: -d.width / 2 + step * (i + 0.5), y: 0, z: 0 });
        this.el.appendChild(fin);
      }
      var pipe = document.createElement('a-box');
      pipe.setAttribute('width', d.width);
      pipe.setAttribute('height', 0.03);
      pipe.setAttribute('depth', 0.05);
      pipe.setAttribute('color', '#d9d9d6');
      pipe.setAttribute('position', { x: 0, y: d.height / 2 - 0.05, z: 0.01 });
      this.el.appendChild(pipe);
    }
  });

  // ---------------------------------------------------------------------------
  // 7. fps-meter (runs inside the A-Frame loop, so it also works in VR)
  // ---------------------------------------------------------------------------
  AFRAME.registerComponent('fps-meter', {
    init: function () {
      this.frames = 0;
      this.elapsed = 0;
      this.samples = [];
      this.output = document.querySelector('#fps-value');
      AVR.fps = { now: 0, mean: 0, max: 0, min: 0, samples: this.samples };
    },
    tick: function (time, delta) {
      this.frames++;
      this.elapsed += delta;
      if (this.elapsed >= 1000) {
        var fps = (this.frames * 1000) / this.elapsed;
        this.samples.push(fps);
        if (this.samples.length > 300) this.samples.shift();
        var sum = 0;
        for (var i = 0; i < this.samples.length; i++) sum += this.samples[i];
        AVR.fps.now = fps;
        AVR.fps.mean = sum / this.samples.length;
        AVR.fps.min = Math.min.apply(null, this.samples);
        AVR.fps.max = Math.max.apply(null, this.samples);
        if (this.output) {
          this.output.textContent = fps.toFixed(0) + ' (mean ' + AVR.fps.mean.toFixed(0) + ', min ' + AVR.fps.min.toFixed(0) + ')';
        }
        this.frames = 0;
        this.elapsed = 0;
      }
    }
  });

})();
