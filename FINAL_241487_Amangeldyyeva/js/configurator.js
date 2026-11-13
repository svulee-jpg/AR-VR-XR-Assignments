/*
 * configurator.js
 * The finishing configurator of the demo developer (A-Frame 1.8.0).
 *
 * Contents
 *   1. surface       : a wall, the floor, the ceiling, the skirting board or the door (selectable, shows its finish)
 *   2. ui-button     : makes a panel button react to hover and click
 *   3. configurator  : the state machine (intro -> room -> summary), the panel, price, captions, log
 *   4. boot          : intro page, voice wiring, debug bar
 *
 * Text, fps meter and room helpers are in app.js, the finishing catalogue in catalog.js, the textures
 * in textures.js and the voice parser in commands.js.
 */
(function () {
  'use strict';

  var THREE = AFRAME.THREE;
  var C = window.Commands;
  var K = window.Catalog;
  var AVR = (window.AVR = window.AVR || {});

  // Which input caused a click? (used in the log)
  function sourceOf(evt) {
    var cursor = evt && evt.detail && evt.detail.cursorEl;
    if (!cursor) return 'unknown';
    if (cursor.id === 'gaze') return 'gaze';
    if (cursor.hasAttribute('laser-controls')) return 'controller';
    return 'mouse';
  }

  function configurator() {
    var scene = document.querySelector('a-scene');
    return scene && scene.components && scene.components.configurator;
  }

  // ---------------------------------------------------------------------------
  // 1. surface: a part of the room that can be selected and finished
  // ---------------------------------------------------------------------------
  AFRAME.registerComponent('surface', {
    schema: { name: { type: 'string' } }, // walls | accent | floor | ceiling | skirting | door

    init: function () {
      var self = this;
      this.hover = false;
      this.selected = false;
      this.look = null;
      this.textures = [];
      // Our own material: it is attached after the entity has loaded, so A-Frame's material
      // component does not overwrite it later.
      this.mat = new THREE.MeshStandardMaterial({ color: '#9b9a96', roughness: 1, metalness: 0 });
      this.attached = false;

      this.onEnter = function () { self.hover = true; self.refresh(); };
      this.onLeave = function () { self.hover = false; self.refresh(); };
      this.onClick = function (evt) {
        var cfg = configurator();
        if (cfg) cfg.select(self.data.name, sourceOf(evt));
      };
      this.el.addEventListener('mouseenter', this.onEnter);
      this.el.addEventListener('mouseleave', this.onLeave);
      this.el.addEventListener('click', this.onClick);

      var attach = function () {
        var mesh = self.el.getObject3D('mesh');
        if (!mesh) return;
        mesh.material = self.mat;
        self.attached = true;
        if (self.look) self.setLook(self.look);
      };
      if (this.el.hasLoaded) attach();
      else this.el.addEventListener('loaded', attach, { once: true });
    },

    setSelected: function (value) {
      this.selected = value;
      this.refresh();
    },

    // A glow in the surface's own colour shows hover (stronger) and selection (soft). It uses the
    // colour or the texture itself, so the finish is never washed out by a white haze.
    refresh: function () {
      var mat = this.mat;
      if (mat.map) mat.emissive.set('#ffffff');
      else mat.emissive.copy(mat.color);
      mat.emissiveMap = mat.map || null;
      mat.emissiveIntensity = this.hover ? 0.22 : this.selected ? 0.08 : 0;
    },

    disposeTextures: function () {
      this.textures.forEach(function (t) { t.dispose(); });
      this.textures = [];
    },

    /**
     * look = { hex, rough, metal, tex: { canvas, bump, tileW, tileH, bumpScale } | null,
     *          hidden, height }
     */
    setLook: function (look) {
      this.look = look;
      if (!this.attached) return;
      var el = this.el;
      var mat = this.mat;
      var hadMap = !!mat.map;
      this.disposeTextures();
      mat.map = null;
      mat.bumpMap = null;

      mat.roughness = look.rough;
      mat.metalness = look.metal;

      if (look.tex) {
        var geo = el.getAttribute('geometry') || {};
        var sx = geo.width || 1;
        var sy = geo.height || 1;
        var map = new THREE.CanvasTexture(look.tex.canvas);
        var bump = new THREE.CanvasTexture(look.tex.bump);
        map.colorSpace = THREE.SRGBColorSpace;
        [map, bump].forEach(function (t) {
          t.wrapS = t.wrapT = THREE.RepeatWrapping;
          t.repeat.set(sx / look.tex.tileW, sy / look.tex.tileH);
          t.anisotropy = 8;
          t.needsUpdate = true;
        });
        mat.map = map;
        mat.bumpMap = bump;
        mat.bumpScale = look.tex.bumpScale;
        mat.color.set('#ffffff');
        this.textures = [map, bump];
      } else {
        mat.color.set(look.hex);
      }
      mat.needsUpdate = true; // the map and emissiveMap slots may have changed

      // Skirting board: height depends on the material, and it is hidden before finishing.
      if (this.data.name === 'skirting') {
        var cfg = configurator();
        var visible = !look.hidden;
        el.setAttribute('visible', visible);
        el.classList.toggle('interactive', visible);
        if (look.height) {
          var pos = el.object3D.position;
          el.setAttribute('height', look.height);
          el.setAttribute('position', { x: pos.x, y: look.height / 2, z: pos.z });
        }
        if (cfg) cfg.refreshRaycasters();
      }
      this.refresh();
    },

    remove: function () {
      this.disposeTextures();
      this.el.removeEventListener('mouseenter', this.onEnter);
      this.el.removeEventListener('mouseleave', this.onLeave);
      this.el.removeEventListener('click', this.onClick);
    }
  });

  // ---------------------------------------------------------------------------
  // 2. ui-button
  // ---------------------------------------------------------------------------
  AFRAME.registerComponent('ui-button', {
    schema: { action: { type: 'string' }, arg: { type: 'string', default: '' }, hint: { type: 'string', default: '' } },

    init: function () {
      var self = this;
      this.onEnter = function () {
        self.el.setAttribute('canvas-text', 'hover', true);
        var cfg = configurator();
        if (cfg && self.data.hint) cfg.setHint(self.data.hint);
      };
      this.onLeave = function () {
        self.el.setAttribute('canvas-text', 'hover', false);
        var cfg = configurator();
        if (cfg && self.data.hint) cfg.setHint('');
      };
      this.onClick = function (evt) {
        var cfg = configurator();
        if (cfg) cfg.onUi(self.data.action, self.data.arg, sourceOf(evt));
      };
      this.el.addEventListener('mouseenter', this.onEnter);
      this.el.addEventListener('mouseleave', this.onLeave);
      this.el.addEventListener('click', this.onClick);
    },

    remove: function () {
      this.el.removeEventListener('mouseenter', this.onEnter);
      this.el.removeEventListener('mouseleave', this.onLeave);
      this.el.removeEventListener('click', this.onClick);
    }
  });

  // ---------------------------------------------------------------------------
  // 3. configurator: state machine, panel, price, captions, log
  // ---------------------------------------------------------------------------
  // Text colour that stays readable on a given background colour.
  function contrastText(hex) {
    var n = parseInt(hex.slice(1), 16);
    var lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    return lum > 0.6 ? '#1b1d22' : '#ffffff';
  }

  AFRAME.registerComponent('configurator', {
    init: function () {
      this.state = {
        mode: 'intro', // intro | room | summary
        selected: null, // walls | accent | floor | ceiling | skirting | door
        choice: K.emptyChoice(),
        preview: false, // true = show the unfinished apartment ("before renovation")
        light: 'day' // day | evening
      };
      this.panel = document.querySelector('#panel');
      this.caption = document.querySelector('#caption');
      this.mic = document.querySelector('#micstatus');
      this.hintEl = null;
      this.captionTimer = null;
      this.micState = { text: '', kind: 'info' };
      this.voiceAvailable = true;
      this.t0 = performance.now();
      this.logRows = [];
      AVR.cfg = this;

      // A shared variant code in the page address (#v=...) restores a choice.
      var m = /[#&]v=([0-9x.\-]+)/.exec(location.hash);
      var shared = m && K.decode(m[1]);
      if (shared) this.state.choice = shared;

      var self = this;
      var start = function () { self.applyAll(); };
      if (this.el.hasLoaded) start();
      else this.el.addEventListener('loaded', start, { once: true });

      this.renderPanel();
      this.setCaption('', 'info');
      this.setMic('', 'info');
    },

    // ---- log (used for the user test: time per task, voice vs buttons) ----
    log: function (type, source, detail) {
      this.logRows.push({
        t: ((performance.now() - this.t0) / 1000).toFixed(2),
        type: type,
        source: source || '',
        detail: detail || ''
      });
    },

    logCsv: function () {
      var q = function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; };
      var rows = ['time_s,type,source,detail'];
      this.logRows.forEach(function (r) {
        rows.push([r.t, r.type, r.source, q(r.detail)].join(','));
      });
      return rows.join('\n');
    },

    // ---- session ----
    startSession: function (useVoice) {
      if (this.state.mode !== 'intro') return;
      this.log('session_start', useVoice ? 'voice' : 'buttons', '');
      this.setMode('room');
      this.setCaption('Pick a design or build your own. Drag the mouse to look around, W A S D to walk. The panel follows you.', 'info', 9000);
    },

    setMode: function (mode) {
      this.state.mode = mode;
      this.log('mode', '', mode);
      this.renderPanel();
    },

    // ---- helpers ----
    describe: function (surface) {
      var ch = this.state.choice[surface];
      if (!ch) return K.SURFACE_LABEL[surface] + ': not chosen';
      return K.SURFACE_LABEL[surface] + ': ' + K.material(surface, ch.m).label + ', ' + K.colour(ch.c).label;
    },

    parseCtx: function () {
      return { selected: this.state.selected, current: this.state.choice };
    },

    // The choice that a surface really shows (the accent wall follows the walls until it is set).
    effective: function (surface) {
      var ch = this.state.choice[surface];
      if (!ch && surface === 'accent') return this.state.choice.walls;
      return ch;
    },

    afterChange: function () {
      this.applyAll();
      this.updateHighlights();
      this.renderPanel();
      try { history.replaceState(null, '', '#v=' + K.encode(this.state.choice)); } catch (e) { /* file:// */ }
    },

    // ---- actions ----
    select: function (surface, source) {
      if (this.state.mode === 'intro' || K.SURFACES.indexOf(surface) < 0) return null;
      if (this.state.mode === 'summary') this.setMode('room');
      this.state.selected = surface;
      this.log('select_surface', source, surface);
      this.updateHighlights();
      this.renderPanel();
      var msg = 'Selected: ' + K.SURFACE_LABEL[surface].toLowerCase();
      if (source !== 'voice') this.setCaption(msg, 'info');
      return msg;
    },

    // Set material and colour of one surface.
    setFinish: function (surface, materialKey, colourKey, source) {
      var ch = { m: materialKey, c: colourKey };
      if (this.state.mode === 'intro' || !K.validChoice(surface, ch)) return null;
      if (this.state.mode === 'summary') this.setMode('room');
      this.state.choice[surface] = ch;
      this.state.selected = surface;
      this.state.preview = false;
      this.log('set_finish', source, surface + ':' + materialKey + ':' + colourKey);
      this.afterChange();
      var msg = this.describe(surface);
      if (source !== 'voice') this.setCaption(msg, 'ok');
      return msg;
    },

    clearAccent: function (source) {
      if (this.state.mode === 'intro') return null;
      this.state.choice.accent = null;
      this.state.selected = 'accent';
      this.log('clear_accent', source, '');
      this.afterChange();
      var msg = 'Accent wall: same as the other walls';
      if (source !== 'voice') this.setCaption(msg, 'ok');
      return msg;
    },

    applyPreset: function (key, source) {
      var p = K.preset(key);
      if (this.state.mode === 'intro' || !p) return null;
      if (this.state.mode === 'summary') this.setMode('room');
      this.state.choice = K.presetChoice(key);
      this.state.preview = false;
      this.log('preset', source, key);
      this.afterChange();
      var msg = 'Design: ' + p.label;
      if (source !== 'voice') this.setCaption(msg, 'ok');
      return msg;
    },

    random: function (source) {
      if (this.state.mode === 'intro') return null;
      if (this.state.mode === 'summary') this.setMode('room');
      this.state.choice = K.randomChoice(Math.random);
      this.state.preview = false;
      this.log('random', source, K.encode(this.state.choice));
      this.afterChange();
      var msg = 'Random variant';
      if (source !== 'voice') this.setCaption(msg, 'ok');
      return msg;
    },

    setPreview: function (value, source) {
      if (this.state.mode === 'intro') return null;
      this.state.preview = value;
      this.log('preview', source, value ? 'before' : 'after');
      this.afterChange();
      var msg = value ? 'Before renovation: rough finish' : 'After renovation: your variant';
      if (source !== 'voice') this.setCaption(msg, 'info');
      return msg;
    },

    setLight: function (mode, source) {
      if (this.state.mode === 'intro') return null;
      this.state.light = mode;
      this.log('light', source, mode);
      var set = function (id, attr, value) {
        var el = document.querySelector(id);
        if (el) el.setAttribute(attr, value);
      };
      if (mode === 'evening') {
        set('#l-ambient', 'light', { color: '#ffd9b8', intensity: 0.5 });
        set('#l-sun', 'light', { color: '#ffb877', intensity: 0.08 });
        set('#l-bulb', 'light', { color: '#ffc880', intensity: 1.7 });
        set('#window-glass', 'material', { color: '#1b2745' });
      } else {
        set('#l-ambient', 'light', { color: '#ffffff', intensity: 1.1 });
        set('#l-sun', 'light', { color: '#fff6e0', intensity: 0.8 });
        set('#l-bulb', 'light', { color: '#fff2cf', intensity: 0.9 });
        set('#window-glass', 'material', { color: '#dff1ff' });
      }
      this.renderPanel();
      var msg = mode === 'evening' ? 'Evening lighting' : 'Daytime lighting';
      if (source !== 'voice') this.setCaption(msg, 'info');
      return msg;
    },

    showSummary: function (source) {
      if (this.state.mode === 'intro') return null;
      this.log('summary', source, K.encode(this.state.choice));
      this.setMode('summary');
      return 'Summary of your choice';
    },

    showRoom: function (source) {
      if (this.state.mode === 'intro') return null;
      this.log('back_to_room', source, '');
      this.setMode('room');
      return 'Room';
    },

    reset: function (source) {
      if (this.state.mode === 'intro') return null;
      this.log('reset', source, '');
      this.state.choice = K.emptyChoice();
      this.state.selected = null;
      this.state.preview = false;
      this.afterChange();
      this.setMode('room');
      return 'Finishes reset';
    },

    toggleVoice: function (source) {
      this.log('toggle_voice', source, VoiceModule.isWanted() ? 'off' : 'on');
      if (VoiceModule.isWanted()) VoiceModule.stop();
      else VoiceModule.start();
    },

    copyLink: function (source) {
      var url = location.href.split('#')[0] + '#v=' + K.encode(this.state.choice);
      this.log('copy_link', source, url);
      var done = function (cfg, ok) {
        cfg.setCaption(ok ? 'Link to your variant copied' : 'Copy the variant code: ' + K.encode(cfg.state.choice), ok ? 'ok' : 'info', 8000);
      };
      var self = this;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { done(self, true); }, function () { done(self, false); });
      } else {
        done(this, false);
      }
    },

    // Panel buttons
    onUi: function (action, arg, source) {
      var msg = null;
      var p = arg.split(':');
      if (action === 'surface') msg = this.select(arg, source);
      else if (action === 'material') {
        if (p[1] === 'none') msg = this.clearAccent(source);
        else {
          var cur = this.state.choice[p[0]];
          var pal = K.palette(p[0], p[1]);
          var colourKey = cur && K.colourInPalette(p[0], p[1], cur.c) ? cur.c : pal[0].key;
          msg = this.setFinish(p[0], p[1], colourKey, source);
        }
      } else if (action === 'colour') msg = this.setFinish(p[0], p[1], p[2], source);
      else if (action === 'preset') msg = this.applyPreset(arg, source);
      else if (action === 'random') msg = this.random(source);
      else if (action === 'preview') msg = this.setPreview(!this.state.preview, source);
      else if (action === 'light') msg = this.setLight(this.state.light === 'day' ? 'evening' : 'day', source);
      else if (action === 'summary') msg = this.showSummary(source);
      else if (action === 'room') msg = this.showRoom(source);
      else if (action === 'reset') msg = this.reset(source);
      else if (action === 'voice') this.toggleVoice(source);
      else if (action === 'copy') this.copyLink(source);
      if (msg && (action === 'summary' || action === 'room' || action === 'reset')) {
        this.setCaption(msg, 'info');
      }
    },

    // Run the actions that the parser produced from a spoken phrase.
    // Returns { applied: [...], problems: [...] }.
    runVoice: function (parsed) {
      var applied = [];
      var problems = parsed.problems.slice();
      var self = this;
      parsed.actions.forEach(function (a) {
        var msg = null;
        if (a.type === 'select') msg = self.select(a.surface, 'voice');
        else if (a.type === 'set') msg = self.setFinish(a.surface, a.material, a.colour, 'voice');
        else if (a.type === 'clear') msg = self.clearAccent('voice');
        else if (a.type === 'preset') msg = self.applyPreset(a.key, 'voice');
        else if (a.type === 'random') msg = self.random('voice');
        else if (a.type === 'before') msg = self.setPreview(true, 'voice');
        else if (a.type === 'after') msg = self.setPreview(false, 'voice');
        else if (a.type === 'light-day') msg = self.setLight('day', 'voice');
        else if (a.type === 'light-evening') msg = self.setLight('evening', 'voice');
        else if (a.type === 'summary') msg = self.showSummary('voice');
        else if (a.type === 'room') msg = self.showRoom('voice');
        else if (a.type === 'reset') msg = self.reset('voice');
        if (msg) applied.push(msg);
      });
      return { applied: applied, problems: problems };
    },

    // ---- visuals ----
    // What a surface looks like now: its finish, or the raw state (before the renovation).
    lookFor: function (surface) {
      var raw = K.RAW[surface];
      var ch = this.state.preview ? null : this.effective(surface);
      if (!ch || !K.validChoice(surface === 'accent' ? 'walls' : surface, ch)) {
        var rawTex = null;
        if (raw.tex && window.Textures) rawTex = this.textureFor(raw.tex, raw.hex);
        return { hex: raw.hex, rough: 0.95, metal: 0, tex: rawTex, hidden: !!raw.hidden, height: 0.1 };
      }
      var group = surface === 'accent' ? 'walls' : surface;
      var mat = K.material(group, ch.m);
      var col = K.colour(ch.c);
      return {
        hex: col.hex, rough: mat.rough, metal: mat.metal,
        tex: window.Textures ? this.textureFor(ch.m, col.hex) : null,
        hidden: false, height: mat.height || 0.1
      };
    },

    textureFor: function (key, hex) {
      var info = Textures.info(key);
      if (!info) return null;
      try {
        return {
          canvas: Textures.colourCanvas(key, hex), bump: Textures.bumpCanvas(key),
          tileW: info.tileW, tileH: info.tileH, bumpScale: info.bumpScale
        };
      } catch (e) {
        console.warn('texture failed', key, e);
        return null;
      }
    },

    applyAll: function () {
      var items = this.el.querySelectorAll('[surface]');
      for (var i = 0; i < items.length; i++) {
        var comp = items[i].components.surface;
        if (comp) comp.setLook(this.lookFor(items[i].getAttribute('surface').name));
      }
    },

    updateHighlights: function () {
      var items = this.el.querySelectorAll('[surface]');
      for (var i = 0; i < items.length; i++) {
        var comp = items[i].components.surface;
        if (comp) comp.setSelected(items[i].getAttribute('surface').name === this.state.selected);
      }
    },

    // ---- price ----
    priceInfo: function () {
      return K.price(this.state.choice);
    },

    // ---- the panel ----
    setHint: function (text) {
      if (!this.hintEl) return;
      this.hintEl.setAttribute('canvas-text', 'text', text || this.defaultHint());
    },

    defaultHint: function () {
      var s = this.state.selected;
      if (!s) return 'What to change? Look at a wall, the floor or the door, or press a tab.';
      var ch = this.state.choice[s];
      if (!ch) {
        return s === 'accent'
          ? 'The accent wall is the same as the other walls. Choose a material.'
          : K.SURFACE_LABEL[s] + ': ' + K.RAW[s].label.toLowerCase() + '. Choose a material and a colour.';
      }
      var m = K.material(s, ch.m);
      return K.SURFACE_LABEL[s] + ': ' + m.label + ' · ' + K.colour(ch.c).label + ' · ' + K.fmt(m.price) + ' ₸/' + K.UNITS[s];
    },

    // Text panel in the room: its content depends on the mode.
    renderPanel: function () {
      var st = this.state;
      var panel = this.panel;
      while (panel.firstChild) panel.removeChild(panel.firstChild);
      this.hintEl = null;
      if (st.mode === 'intro') return;

      var W = 1.56;
      var PAD = 0.04;
      var GAP = 0.014;
      var IW = W - 2 * PAD;
      var DARK = '#2a2e37';
      var BLUE = '#2b6cb0';
      var GREEN = '#2f855a';
      var rows = [];
      var info = this.priceInfo();
      var self = this;

      function full(text, extra) {
        var it = { text: text, w: IW };
        Object.keys(extra || {}).forEach(function (k) { it[k] = extra[k]; });
        return it;
      }
      function equal(n, build) {
        var w = (IW - GAP * (n - 1)) / n;
        var items = [];
        for (var i = 0; i < n; i++) { var it = build(i); it.w = w; items.push(it); }
        return items;
      }

      // ---------------- room mode ----------------
      if (st.mode === 'room') {
        rows.push({ h: 0.09, items: [full('Finishing configurator', { color: '#ffffff', fs: 0.045 })] });
        rows.push({
          h: 0.085,
          items: [full(info.total ? 'Finishing cost: ' + K.fmt(info.total) + ' ₸  (demo prices)' : 'Finishing cost: choose materials',
            { bg: '#1f3a2f', color: '#c6f6d5', fs: 0.036 })]
        });

        // Ready-made designs
        rows.push({ h: 0.05, items: [full('Ready-made designs (or build your own below):', { color: '#cfd6e0', align: 'left', fs: 0.026 })] });
        var currentCode = K.encode(st.choice);
        for (var pr = 0; pr < 2; pr++) {
          rows.push({
            h: 0.085,
            items: equal(3, function (i) {
              var p = K.PRESETS[pr * 3 + i];
              var on = K.encode(K.presetChoice(p.key)) === currentCode;
              return {
                text: (on ? '✓ ' : '') + p.label, bg: on ? BLUE : DARK,
                ui: { action: 'preset', arg: p.key, hint: 'Apply the ' + p.label + ' design to the whole room' }
              };
            })
          });
        }

        // Tabs: surfaces
        rows.push({
          h: 0.095,
          items: equal(K.SURFACES.length, function (i) {
            var s = K.SURFACES[i];
            var on = st.selected === s;
            return {
              text: K.SURFACE_TAB[s], bg: on ? BLUE : DARK,
              ui: { action: 'surface', arg: s, hint: K.SURFACE_LABEL[s] }
            };
          })
        });

        if (st.selected) {
          var s = st.selected;
          var cur = st.choice[s];
          // Materials: two columns
          var mats = K.materials(s).map(function (m) {
            var on = !!cur && cur.m === m.key;
            return {
              text: (on ? '✓ ' : '') + m.label, bg: on ? BLUE : DARK,
              ui: { action: 'material', arg: s + ':' + m.key, hint: m.label + ' — ' + K.fmt(m.price) + ' ₸/' + K.UNITS[s] }
            };
          });
          if (s === 'accent') {
            mats.unshift({
              text: (!cur ? '✓ ' : '') + 'Same as walls (no accent)', bg: !cur ? BLUE : DARK,
              ui: { action: 'material', arg: 'accent:none', hint: 'The far wall is finished like the other walls' }
            });
          }
          for (var r = 0; r < mats.length; r += 2) {
            var pair = [mats[r]];
            if (mats[r + 1]) pair.push(mats[r + 1]);
            var w2 = (IW - GAP) / 2;
            pair.forEach(function (it) { it.w = w2; });
            rows.push({ h: 0.08, items: pair, left: true });
          }

          // Colours: grid of swatches of the shown material (current, or the default one)
          var viewMat = cur ? cur.m : K.DEFAULT_MATERIAL[s];
          var palette = K.palette(s, viewMat);
          var cols = 14;
          var sw = (IW - GAP * (cols - 1)) / cols;
          for (var c0 = 0; c0 < palette.length; c0 += cols) {
            var items = [];
            palette.slice(c0, c0 + cols).forEach(function (c) {
              var on = !!cur && cur.c === c.key;
              items.push({
                text: on ? '✓' : '', w: sw, bg: c.hex, color: contrastText(c.hex),
                ui: { action: 'colour', arg: s + ':' + viewMat + ':' + c.key, hint: c.label }
              });
            });
            rows.push({ h: sw, items: items, left: true });
          }
        } else {
          rows.push({ h: 0.2, items: [full('Choose a tab: walls, accent, floor, ceiling,\nskirting or door. Or say, for example:\n"red brick walls", "walnut veneer door".', { color: '#cfd6e0' })] });
        }

        // Hint line (changes when the pointer is over a colour or material)
        rows.push({ h: 0.075, hint: true, items: [full(this.defaultHint(), { color: '#e2e8f0', align: 'left', fs: 0.028 })] });

        // Tools
        rows.push({
          h: 0.085,
          items: equal(3, function (i) {
            if (i === 0) return { text: 'Random variant', bg: DARK, ui: { action: 'random', hint: 'A random combination of all finishes' } };
            if (i === 1) {
              return {
                text: st.preview ? 'Show: your variant' : 'Show: before renovation', bg: st.preview ? '#975a16' : DARK,
                ui: { action: 'preview', hint: 'Compare with the rough finish of the apartment' }
              };
            }
            return {
              text: st.light === 'day' ? 'Light: day → evening' : 'Light: evening → day', bg: DARK,
              ui: { action: 'light', hint: 'How the room looks in the evening' }
            };
          })
        });

        // Summary and voice
        var voiceOn = VoiceModule.supported() && this.voiceAvailable;
        rows.push({
          h: 0.09,
          items: voiceOn
            ? equal(2, function (i) {
              return i === 0
                ? { text: 'Done: show summary', bg: GREEN, ui: { action: 'summary', hint: 'Chosen finishes, price and variant code' } }
                : { text: VoiceModule.isWanted() ? 'Voice: on (turn off)' : 'Voice: off (turn on)', bg: DARK, ui: { action: 'voice' } };
            })
            : [full('Done: show summary', { bg: GREEN, ui: { action: 'summary' } })]
        });
        if (!voiceOn) rows.push({ h: 0.06, items: [full('Voice is not available: the buttons still work', { color: '#cfd6e0' })] });
      } else {
        // ---------------- summary mode ----------------
        rows.push({ h: 0.09, items: [full('Your choice', { color: '#ffffff', fs: 0.045 })] });
        info.rows.forEach(function (row) {
          var ch = self.state.choice[row.surface];
          var follows = row.surface === 'accent' && !ch;
          var look = self.lookFor(row.surface);
          var label;
          if (!self.effective(row.surface)) label = K.SURFACE_LABEL[row.surface] + ': rough finish';
          else if (follows) label = 'Accent wall: same as the other walls';
          else {
            label = self.describe(row.surface) + '  ·  ' + K.fmt(row.sum) + ' ₸';
          }
          rows.push({
            h: 0.095,
            items: [full(label, { align: 'left', swatch: self.state.choice[row.surface] || follows ? look.hex : '', bg: DARK })]
          });
        });
        rows.push({ h: 0.1, items: [full('Total: ' + K.fmt(info.total) + ' ₸', { bg: GREEN, fs: 0.048 })] });
        if (info.total) {
          rows.push({
            h: 0.07,
            items: [full('With a mortgage: about ' + K.fmt(K.monthlyPayment(info.total)) + ' ₸ per month (demo: ' + K.MORTGAGE.years + ' years, ' + K.MORTGAGE.ratePercent + '%)', { color: '#cfd6e0' })]
          });
        }
        rows.push({ h: 0.065, items: [full('Variant code: ' + K.encode(st.choice), { color: '#e2e8f0' })] });
        rows.push({ h: 0.06, items: [full('Variants in the catalogue: ' + K.fmt(K.countVariants()), { color: '#9aa7bb' })] });
        rows.push({
          h: 0.09,
          items: equal(3, function (i) {
            if (i === 0) return { text: '← Back to the room', bg: BLUE, ui: { action: 'room' } };
            if (i === 1) return { text: 'Copy link', bg: DARK, ui: { action: 'copy' } };
            return { text: 'Start over', bg: '#975a16', ui: { action: 'reset' } };
          })
        });
      }

      // ---- build the entities ----
      var total = 2 * PAD + GAP * (rows.length - 1);
      rows.forEach(function (r) { total += r.h; });

      var bg = document.createElement('a-entity');
      bg.setAttribute('canvas-text', { width: W, height: total, bg: 'rgba(17,19,25,0.92)', text: '', ppm: 300 });
      panel.appendChild(bg);

      var y = total / 2 - PAD;
      rows.forEach(function (r) {
        var cy = y - r.h / 2;
        var rowWidth = -GAP;
        r.items.forEach(function (it) { rowWidth += it.w + GAP; });
        var x = r.left ? -IW / 2 : -rowWidth / 2;
        r.items.forEach(function (it) {
          var e = document.createElement('a-entity');
          e.setAttribute('canvas-text', {
            text: it.text,
            width: it.w,
            height: r.h,
            bg: it.bg || '',
            swatch: it.swatch || '',
            color: it.color || '#ffffff',
            align: it.align || 'center',
            fontSize: it.fs || 0.032,
            ppm: it.w < 0.2 ? 300 : 500
          });
          e.setAttribute('position', { x: x + it.w / 2, y: cy, z: 0.004 });
          if (it.ui) {
            e.classList.add('interactive');
            e.setAttribute('ui-button', { action: it.ui.action, arg: it.ui.arg || '', hint: it.ui.hint || '' });
          }
          if (r.hint) self.hintEl = e;
          panel.appendChild(e);
          x += it.w + GAP;
        });
        y -= r.h + GAP;
      });

      this.refreshRaycasters();
    },

    // New interactive entities: tell every raycaster to look again.
    refreshRaycasters: function () {
      setTimeout(function () {
        var els = document.querySelectorAll('[raycaster], a-scene');
        for (var i = 0; i < els.length; i++) {
          var rc = els[i].components && els[i].components.raycaster;
          if (rc) rc.refreshObjects();
        }
      }, 0);
    },

    // ---- HUD texts ----
    setCaption: function (text, kind, ms) {
      var cap = this.caption;
      clearTimeout(this.captionTimer);
      if (!text) {
        cap.setAttribute('visible', false);
        return;
      }
      var colour = kind === 'warn' ? '#ffd479' : kind === 'ok' ? '#9ae6b4' : '#ffffff';
      cap.setAttribute('canvas-text', { text: text, color: colour });
      cap.setAttribute('visible', true);
      this.captionTimer = setTimeout(function () { cap.setAttribute('visible', false); }, ms || 6000);
    },

    setMic: function (text, kind) {
      this.micState = { text: text, kind: kind };
      if (!text) {
        this.mic.setAttribute('visible', false);
        return;
      }
      var colour = kind === 'ok' ? '#9ae6b4' : kind === 'warn' ? '#ffd479' : '#cfd6e0';
      this.mic.setAttribute('canvas-text', { text: text, color: colour });
      this.mic.setAttribute('visible', true);
    }
  });

  // ---------------------------------------------------------------------------
  // 4. boot: intro page, voice wiring, debug bar
  // ---------------------------------------------------------------------------
  var MIC_MESSAGES = {
    listening: ['Microphone: listening. Say, for example: "red brick walls" or "loft design"', 'ok'],
    stopped: ['Microphone is off. Everything can be chosen with the buttons.', 'info'],
    unsupported: ['This browser cannot recognise speech. Please use the buttons.', 'warn'],
    denied: ['Microphone access was denied. Please use the buttons.', 'warn'],
    'no-mic': ['No microphone found. Please use the buttons.', 'warn'],
    network: ['Cannot reach the speech service. Please use the buttons.', 'warn'],
    error: ['Speech recognition error. Please use the buttons.', 'warn']
  };

  function wireVoice() {
    VoiceModule.onStatus(function (status, detail) {
      var cfg = AVR.cfg;
      if (!cfg) return;
      var m = MIC_MESSAGES[status] || MIC_MESSAGES.error;
      // Without a speech engine or a microphone the voice switch is hidden.
      if (status === 'unsupported' || status === 'no-mic') cfg.voiceAvailable = false;
      cfg.log('voice_status', '', status + (detail ? ':' + detail : ''));
      cfg.setMic(cfg.state.mode === 'intro' ? '' : m[0], m[1]);
      cfg.renderPanel();
    });

    VoiceModule.onInterim(function (text) {
      var cfg = AVR.cfg;
      if (cfg && cfg.state.mode !== 'intro') cfg.setCaption('Heard: "' + text + '" …', 'info', 4000);
    });

    VoiceModule.onFinal(function (text) {
      var cfg = AVR.cfg;
      if (!cfg || cfg.state.mode === 'intro') return;
      var parsed = C.parse(text, cfg.parseCtx());
      var result = cfg.runVoice(parsed);
      var recognised = result.applied.length > 0;
      cfg.log('voice_result', 'voice', JSON.stringify({ heard: text, recognised: recognised }));
      if (recognised) {
        cfg.setCaption('Heard: "' + text + '" → ' + result.applied.join('; '), 'ok');
      } else if (result.problems.length) {
        cfg.setCaption('Heard: "' + text + '". ' + result.problems[0], 'warn');
      } else {
        cfg.setCaption('Did not understand: "' + text + '". Say, for example: "red brick walls".', 'warn', 8000);
      }
    });
  }

  function begin(useVoice) {
    var intro = document.querySelector('#intro');
    intro.classList.add('hidden');
    var scene = document.querySelector('a-scene');
    var go = function () {
      var cfg = AVR.cfg;
      cfg.startSession(useVoice);
      if (useVoice && !VoiceModule.supported()) {
        cfg.setMic(MIC_MESSAGES.unsupported[0], 'warn');
        cfg.voiceAvailable = false;
        cfg.renderPanel();
      } else if (!useVoice) {
        cfg.setMic(MIC_MESSAGES.stopped[0], 'info');
      }
    };
    // The microphone permission must be requested inside the click handler.
    if (useVoice) VoiceModule.start();
    if (scene.hasLoaded && AVR.cfg) go();
    else scene.addEventListener('loaded', go, { once: true });
  }

  function boot() {
    wireVoice();

    document.querySelector('#btn-voice').addEventListener('click', function () { begin(true); });
    document.querySelector('#btn-novoice').addEventListener('click', function () { begin(false); });

    var count = document.querySelector('#variant-count');
    if (count) count.textContent = K.fmt(K.countVariants());

    // Entering VR from the headset button also starts the session (without voice).
    var scene = document.querySelector('a-scene');
    scene.addEventListener('enter-vr', function () {
      if (AVR.cfg && AVR.cfg.state.mode === 'intro') begin(false);
    });

    // Debug bar: ?debug shows the frame rate and a button that downloads the event log.
    if (/[?&]debug/.test(location.search)) {
      var bar = document.querySelector('#debugbar');
      bar.hidden = false;
      document.querySelector('#btn-log').addEventListener('click', function () {
        var csv = AVR.cfg ? AVR.cfg.logCsv() : '';
        var blob = new Blob([csv], { type: 'text/csv' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'session-log.csv';
        a.click();
        URL.revokeObjectURL(a.href);
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
