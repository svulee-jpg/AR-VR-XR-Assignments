/*
 * components.js - PA4: A-Frame VR scene with custom components
 * Student ID: 241487  ->  prefix x1487-
 * Variant:    Winter steppe | pulse | gaze (fuse 1.5 s) | corridor
 *
 * Contents (A-Frame 1.8.0, core features only):
 *   1. x1487-gallery  (system)    - registry of exhibits, one selection at a time, keys M and X, status panel
 *   2. x1487-motion   (component) - Task B: pulse / bob / orbit motion computed from a stored base pose
 *   3. x1487-texture  (component) - Task C: configurable texture loader (rewrite of the Ch. 8 component)
 *   4. x1487-exhibit  (component) - Task D: hover / select behaviour, info panel above the exhibit
 *
 * Debugging aid for experiment E1: open index.html?log (or set window.x1487Log = true in the
 * console) and every life-cycle method of x1487-motion is printed with a timestamp.
 */

/* ------------------------------------------------------------------------------------------
 * Helpers
 * ---------------------------------------------------------------------------------------- */
(function () {
  'use strict';

  var LOG_FROM_URL = new URLSearchParams(window.location.search).has('log');

  function lifecycleLog(name, extra) {
    if (!LOG_FROM_URL && window.x1487Log !== true) { return; }
    console.log('[x1487-motion] ' + name + '  t=' + performance.now().toFixed(1) + ' ms' +
      (extra ? '  ' + extra : ''));
  }

  var EASE_SECONDS = 0.25;     // time constant used to ease amplitude / phase changes (no jumps)
  var HOVER_COLOR = '#ffe08a'; // emissive colour while the gaze cursor is on an exhibit
  var SELECT_COLOR = '#4fc3f7';// emissive colour while an exhibit is selected
  var camWorldPos = new THREE.Vector3();

  /* ----------------------------------------------------------------------------------------
   * 1. System: x1487-gallery   (Task E)
   * -------------------------------------------------------------------------------------- */
  AFRAME.registerSystem('x1487-gallery', {
    init: function () {
      this.exhibits = [];        // every registered exhibit entity
      this.selected = null;      // the single selected exhibit (or null)
      this.motionPaused = false; // toggled by key M

      this.onKeyDown = this.onKeyDown.bind(this);
      window.addEventListener('keydown', this.onKeyDown);

      // The status text entity does not exist yet while systems start, so refresh when the scene is ready.
      this.sceneEl.addEventListener('loaded', this.updatePanel.bind(this));
    },

    remove: function () {
      window.removeEventListener('keydown', this.onKeyDown);
    },

    /* Called by x1487-exhibit.init */
    register: function (el) {
      var self = this;
      if (this.exhibits.indexOf(el) === -1) { this.exhibits.push(el); }

      // An exhibit that appears while motion is paused must start paused too.
      if (this.motionPaused) {
        if (el.hasLoaded) { this.setMotionPaused(el, true); }
        else { el.addEventListener('loaded', function () { self.setMotionPaused(el, true); }, {once: true}); }
      }
      this.updatePanel();
    },

    /* Called by x1487-exhibit.remove */
    unregister: function (el) {
      var index = this.exhibits.indexOf(el);
      if (index !== -1) { this.exhibits.splice(index, 1); }
      if (this.selected === el) { this.selected = null; }
      this.updatePanel();
    },

    /* Select one exhibit; the previously selected one is deselected first (single selection). */
    select: function (el) {
      if (this.selected === el) { return; }
      if (this.selected) { this.exhibitOf(this.selected).setSelected(false); }
      this.selected = el;
      this.exhibitOf(el).setSelected(true);
      this.updatePanel();
    },

    deselect: function (el) {
      if (this.selected !== el) { return; }
      this.selected = null;
      this.exhibitOf(el).setSelected(false);
      this.updatePanel();
    },

    exhibitOf: function (el) {
      return el.components['x1487-exhibit'];
    },

    /* Key M: pause / resume the motion of all exhibits.
       Only the motion component is paused, so hover and click keep working while motion is stopped. */
    toggleMotion: function () {
      var self = this;
      this.motionPaused = !this.motionPaused;
      this.exhibits.forEach(function (el) { self.setMotionPaused(el, self.motionPaused); });
    },

    setMotionPaused: function (el, paused) {
      var motion = el.components['x1487-motion'];
      if (!motion) { return; }
      if (paused) { motion.pause(); } else { motion.play(); }
    },

    /* Key X: remove the selected exhibit from the DOM. Its remove() handler unregisters it. */
    removeSelected: function () {
      var el = this.selected;
      if (el && el.parentNode) { el.parentNode.removeChild(el); }
    },

    onKeyDown: function (evt) {
      if (evt.repeat) { return; }
      var key = evt.key ? evt.key.toLowerCase() : '';
      if (key === 'm') { this.toggleMotion(); }
      else if (key === 'x') { this.removeSelected(); }
    },

    /* Live text: "Selected: <name> (<n> of <total>)" */
    updatePanel: function () {
      var statusEl = this.sceneEl.querySelector('#gallery-status');
      if (!statusEl) { return; }
      var total = this.exhibits.length;
      var text;
      if (this.selected) {
        var name = this.exhibitOf(this.selected).data.name;
        text = 'Selected: ' + name + ' (' + (this.exhibits.indexOf(this.selected) + 1) + ' of ' + total + ')';
      } else {
        text = 'Selected: none (0 of ' + total + ')';
      }
      statusEl.setAttribute('text', 'value', text);
    }
  });

  /* ----------------------------------------------------------------------------------------
   * 2. Component: x1487-motion   (Task B)
   *    pulse = scale up and down (my variant). bob and orbit are implemented too.
   * -------------------------------------------------------------------------------------- */
  AFRAME.registerComponent('x1487-motion', {
    schema: {
      type: {type: 'string', default: 'pulse', oneOf: ['bob', 'orbit', 'pulse']},
      // bob / orbit: metres.  pulse: fraction of the base scale (0.2 = +-20 %).
      amplitude: {type: 'number', default: 0.2},
      period: {type: 'number', default: 3},   // seconds for one full cycle
      phase: {type: 'number', default: 0}     // radians; different per exhibit so they do not move in step
    },

    // Make sure position and scale are applied before init() stores the base pose.
    dependencies: ['position', 'scale'],

    init: function () {
      lifecycleLog('init');
      // Base pose: stored once. Every frame is computed from it, so the motion can never drift.
      this.basePosition = this.el.object3D.position.clone();
      this.baseScale = this.el.object3D.scale.clone();

      this.angle = 0;                                 // accumulated oscillation angle (radians)
      this.currentAmplitude = this.data.amplitude;    // eased towards data.amplitude
      this.currentPhase = this.data.phase;            // eased towards data.phase
    },

    update: function (oldData) {
      lifecycleLog('update', 'oldData=' + JSON.stringify(oldData) + '  data=' + JSON.stringify(this.data));
      // Switching motion type: put the exhibit back on its base pose before the new type takes over.
      if (oldData.type !== undefined && oldData.type !== this.data.type) {
        this.resetPose();
      }
      // amplitude / period / phase need no work here: tick() reads this.data every frame and eases
      // towards the new values, so changing them with setAttribute never makes the exhibit jump.
    },

    tick: function (time, timeDelta) {
      var data = this.data;
      // Own clock: only advances while this component is playing, so pause -> play resumes smoothly.
      var dt = Math.min(timeDelta, 100) / 1000;
      if (dt <= 0) { return; }

      // Period changes only change how fast the angle grows, so the pose is continuous.
      this.angle += (2 * Math.PI * dt) / Math.max(data.period, 0.05);

      // Ease amplitude and phase towards the requested values (exponential smoothing).
      var k = 1 - Math.exp(-dt / EASE_SECONDS);
      this.currentAmplitude += (data.amplitude - this.currentAmplitude) * k;
      this.currentPhase += (data.phase - this.currentPhase) * k;

      var a = this.angle + this.currentPhase;
      var amp = this.currentAmplitude;
      var base = this.basePosition;
      var obj = this.el.object3D;

      if (data.type === 'pulse') {
        var s = Math.max(0.05, 1 + amp * Math.sin(a));
        obj.scale.set(this.baseScale.x * s, this.baseScale.y * s, this.baseScale.z * s);
      } else if (data.type === 'bob') {
        obj.position.set(base.x, base.y + amp * Math.sin(a), base.z);
      } else if (data.type === 'orbit') {
        obj.position.set(base.x + amp * Math.cos(a), base.y, base.z + amp * Math.sin(a));
      }
    },

    pause: function () { lifecycleLog('pause'); },
    play: function () { lifecycleLog('play'); },

    remove: function () {
      lifecycleLog('remove');
      this.resetPose();
    },

    resetPose: function () {
      this.el.object3D.position.copy(this.basePosition);
      this.el.object3D.scale.copy(this.baseScale);
    }
  });

  /* ----------------------------------------------------------------------------------------
   * 3. Component: x1487-texture   (Task C)
   *    Rewrite of the Ch. 8 "texture-loader". Differences:
   *    - schema = configuration only; texture / material / mesh live on `this`
   *    - mesh obtained safely (now, or on the object3dset event)
   *    - only real three.js properties are used (magFilter, minFilter, anisotropy, wrapS/T, repeat)
   *    - update() reloads only when src changed
   *    - remove() disposes everything and restores the original material
   * -------------------------------------------------------------------------------------- */
  AFRAME.registerComponent('x1487-texture', {
    schema: {
      src: {type: 'map'},                                   // '#assetId' or a URL
      repeat: {type: 'vec2', default: {x: 1, y: 1}},
      normalSrc: {type: 'map'},                             // optional normal map
      anisotropy: {type: 'int', default: 0}                 // 0 = use the maximum the GPU supports
    },

    init: function () {
      // Runtime objects (NOT in this.data):
      this.mesh = null;
      this.originalMaterial = null;
      this.material = null;
      this.map = null;
      this.normalMap = null;

      this.onObject3DSet = this.onObject3DSet.bind(this);
      var mesh = this.el.getObject3D('mesh');
      if (mesh) {
        this.attachToMesh(mesh);          // update() runs right after init and will load the textures
      } else {
        this.el.addEventListener('object3dset', this.onObject3DSet);   // wait for the geometry component
      }
    },

    update: function (oldData) {
      if (!this.mesh) { return; }         // mesh not ready yet: onObject3DSet will call sync()
      this.sync(oldData);
    },

    onObject3DSet: function (evt) {
      // object3dset bubbles up from child entities too, so check that it is our own mesh.
      if (evt.target !== this.el || evt.detail.type !== 'mesh') { return; }
      this.el.removeEventListener('object3dset', this.onObject3DSet);
      this.attachToMesh(evt.detail.object);
      this.sync({});
    },

    attachToMesh: function (mesh) {
      this.mesh = mesh;
      this.originalMaterial = mesh.material;   // kept so remove() can restore it
      this.material = new THREE.MeshStandardMaterial({color: 0xffffff, roughness: 1, metalness: 0});
      mesh.material = this.material;
    },

    /* Apply the configuration. Textures are reloaded only when their source really changed. */
    sync: function (oldData) {
      var data = this.data;

      if (!this.map || oldData.src !== data.src) {
        this.disposeTexture('map');
        this.map = this.createTexture(data.src, true);
        this.material.map = this.map;
        this.material.needsUpdate = true;
      }
      if ((data.normalSrc && !this.normalMap) || oldData.normalSrc !== data.normalSrc) {
        this.disposeTexture('normalMap');
        this.normalMap = this.createTexture(data.normalSrc, false);
        this.material.normalMap = this.normalMap;
        this.material.needsUpdate = true;
      }

      // Cheap settings: apply to whichever textures exist.
      var maxAniso = this.el.sceneEl.renderer.capabilities.getMaxAnisotropy();
      var aniso = data.anisotropy > 0 ? Math.min(data.anisotropy, maxAniso) : maxAniso;
      [this.map, this.normalMap].forEach(function (texture) {
        if (!texture) { return; }
        texture.repeat.set(data.repeat.x, data.repeat.y);
        texture.anisotropy = aniso;
        if (texture.image && texture.image.complete) { texture.needsUpdate = true; }
      });
    },

    /* src is either a URL string or a preloaded <img> element (when it was given as '#id'). */
    createTexture: function (source, isColor) {
      if (!source) { return null; }
      var texture;
      if (typeof source === 'string') {
        texture = new THREE.TextureLoader().load(source);
      } else {
        texture = new THREE.Texture(source);
        texture.needsUpdate = true;
      }
      texture.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      texture.wrapS = THREE.RepeatWrapping;                 // needed for repeat > 1
      texture.wrapT = THREE.RepeatWrapping;
      texture.magFilter = THREE.LinearFilter;               // magnification: smooth, not blocky
      texture.minFilter = THREE.LinearMipmapLinearFilter;   // minification: trilinear mipmaps, no shimmer
      texture.generateMipmaps = true;
      return texture;
    },

    disposeTexture: function (key) {
      if (this[key]) { this[key].dispose(); this[key] = null; }
    },

    remove: function () {
      this.el.removeEventListener('object3dset', this.onObject3DSet);
      if (this.mesh && this.originalMaterial) { this.mesh.material = this.originalMaterial; }
      this.disposeTexture('map');
      this.disposeTexture('normalMap');
      if (this.material) { this.material.dispose(); }
      this.material = null;
      this.mesh = null;
      this.originalMaterial = null;
    }
  });

  /* ----------------------------------------------------------------------------------------
   * 4. Component: x1487-exhibit   (Task D)
   * -------------------------------------------------------------------------------------- */
  AFRAME.registerComponent('x1487-exhibit', {
    schema: {
      name: {type: 'string', default: 'Exhibit'},
      info: {type: 'string', default: ''}
    },

    init: function () {
      this.gallery = this.el.sceneEl.systems['x1487-gallery'];
      this.hovered = false;
      this.selected = false;
      this.panelEl = null;          // text panel above the exhibit (only while selected)
      this.baseLook = null;         // original emissive settings, captured on first highlight
      this.savedAmplitude = null;   // motion amplitude before the selection boost
      this.gallery.register(this.el);
    },

    update: function () {
      if (this.panelEl) { this.fillPanel(); }   // keep an open panel in sync with name / info changes
    },

    /* Events map: A-Frame attaches these handlers to the entity while it is playing. */
    events: {
      mouseenter: function () { this.hovered = true; this.refreshLook(); },
      mouseleave: function () { this.hovered = false; this.refreshLook(); },
      click: function () {
        // Click toggles the selection. The system keeps it to one exhibit at a time.
        if (this.selected) { this.gallery.deselect(this.el); }
        else { this.gallery.select(this.el); }
      }
    },

    /* Called by the gallery system. */
    setSelected: function (flag) {
      this.selected = flag;
      this.refreshLook();
      if (flag) {
        this.showPanel();
        this.boostMotion();
      } else {
        this.hidePanel();
        this.restoreMotion();
      }
    },

    refreshLook: function () {
      var el = this.el;
      if (!this.baseLook) {
        var m = el.getAttribute('material') || {};
        this.baseLook = {
          emissive: m.emissive || '#000000',
          intensity: m.emissiveIntensity !== undefined ? m.emissiveIntensity : 1
        };
      }
      var look = this.baseLook;
      if (this.selected) { look = {emissive: SELECT_COLOR, intensity: 0.55}; }
      else if (this.hovered) { look = {emissive: HOVER_COLOR, intensity: 0.35}; }
      el.setAttribute('material', {emissive: look.emissive, emissiveIntensity: look.intensity});
    },

    /* Motion change through setAttribute: double the amplitude while selected. */
    boostMotion: function () {
      var motion = this.el.components['x1487-motion'];
      if (!motion) { return; }
      this.savedAmplitude = motion.data.amplitude;
      this.el.setAttribute('x1487-motion', 'amplitude', this.savedAmplitude * 2);
    },

    restoreMotion: function () {
      if (this.savedAmplitude === null) { return; }
      if (this.el.components['x1487-motion']) {
        this.el.setAttribute('x1487-motion', 'amplitude', this.savedAmplitude);
      }
      this.savedAmplitude = null;
    },

    showPanel: function () {
      if (this.panelEl) { return; }
      var box = new THREE.Box3().setFromObject(this.el.object3D);
      var center = box.getCenter(new THREE.Vector3());

      // The panel is a separate entity in the scene (not a child), so the exhibit's pulsing does not scale it.
      var panel = document.createElement('a-entity');
      panel.setAttribute('position', {x: center.x, y: box.max.y + 0.8, z: center.z});

      var background = document.createElement('a-entity');
      background.setAttribute('geometry', {primitive: 'plane', width: 2.4, height: 0.95});
      background.setAttribute('material', {color: '#0b1a2b', opacity: 0.9, transparent: true, shader: 'flat'});

      var title = document.createElement('a-entity');
      title.setAttribute('position', {x: 0, y: 0.22, z: 0.01});
      var info = document.createElement('a-entity');
      info.setAttribute('position', {x: 0, y: -0.14, z: 0.01});

      panel.appendChild(background);
      panel.appendChild(title);
      panel.appendChild(info);
      this.el.sceneEl.appendChild(panel);
      this.panelEl = panel;
      this.titleEl = title;
      this.infoEl = info;
      this.fillPanel();
    },

    fillPanel: function () {
      this.titleEl.setAttribute('text', {
        value: this.data.name, align: 'center', anchor: 'center', width: 2.2, wrapCount: 18, color: '#ffd54f'
      });
      this.infoEl.setAttribute('text', {
        value: this.data.info, align: 'center', anchor: 'center', width: 2.2, wrapCount: 34, color: '#ffffff'
      });
    },

    hidePanel: function () {
      if (this.panelEl && this.panelEl.parentNode) { this.panelEl.parentNode.removeChild(this.panelEl); }
      this.panelEl = null;
      this.titleEl = null;
      this.infoEl = null;
    },

    /* Make the open panel face the viewer. */
    tick: function () {
      if (!this.panelEl) { return; }
      var camera = this.el.sceneEl.camera;
      if (!camera) { return; }
      camera.getWorldPosition(camWorldPos);
      this.panelEl.object3D.lookAt(camWorldPos);
    },

    remove: function () {
      this.hidePanel();
      if (this.el.parentNode) {
        // Component removed but entity stays: undo the visual / motion changes.
        this.restoreMotion();
        this.hovered = false;
        this.selected = false;
        if (this.baseLook) {
          this.el.setAttribute('material', {emissive: this.baseLook.emissive, emissiveIntensity: this.baseLook.intensity});
        }
      }
      this.gallery.unregister(this.el);
    }
  });
})();
