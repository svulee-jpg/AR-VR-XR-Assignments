/*
 * Finishes drawer: a normal HTML panel next to the 3D view (desktop), like the product pickers of
 * online shops. It does the same job as the 3D panel (choose surface, material, colour) and always
 * shows material samples with the price per square metre. Both panels change the same state.
 */
(function () {
  'use strict';
  var K = window.Catalog;
  var AVR = (window.AVR = window.AVR || {});
  if (!K) return;

  var shownSurface = 'walls';
  var built = false;

  function $(sel) { return document.querySelector(sel); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function cfg() { return AVR.cfg; }

  // Small picture of a material in a given colour (cropped part of its texture).
  var thumbCache = {};
  function thumb(materialKey, hex) {
    var id = materialKey + hex;
    if (thumbCache[id]) return thumbCache[id];
    var out = '';
    try {
      var src = window.Textures && Textures.colourCanvas(materialKey, hex);
      var c = document.createElement('canvas');
      c.width = 132; c.height = 84;
      var ctx = c.getContext('2d');
      if (src) {
        var sw = Math.min(src.width, src.height * 132 / 84);
        var sh = sw * 84 / 132;
        ctx.drawImage(src, 0, 0, sw, sh, 0, 0, 132, 84);
      } else {
        ctx.fillStyle = hex; ctx.fillRect(0, 0, 132, 84);
      }
      out = c.toDataURL('image/jpeg', 0.8);
    } catch (e) { out = ''; }
    thumbCache[id] = out;
    return out;
  }

  function currentFor(surface) {
    var c = cfg();
    return c ? c.effective(surface) : null;
  }

  function render() {
    var c = cfg();
    var box = $('#drawer-body');
    if (!c || !box) return;
    box.textContent = '';
    var surface = shownSurface;
    var cur = c.state.choice[surface];
    var curShown = currentFor(surface);

    // tabs
    var tabs = el('div', 'dr-tabs');
    K.SURFACES.forEach(function (s) {
      var b = el('button', 'dr-tab', K.SURFACE_TAB[s]);
      b.type = 'button';
      b.setAttribute('aria-pressed', s === surface ? 'true' : 'false');
      b.addEventListener('click', function () {
        shownSurface = s;
        if (c.state.mode !== 'intro') c.select(s, 'drawer');
        render();
      });
      tabs.appendChild(b);
    });
    box.appendChild(tabs);

    // raw state / current
    var info = el('div', 'dr-now');
    if (curShown && K.validChoice(surface, curShown)) {
      info.textContent = 'Now: ' + K.material(surface, curShown.m).label + ', ' + K.colour(curShown.c).label;
    } else {
      info.textContent = 'Now: ' + K.RAW[surface].label + ' (not chosen yet)';
    }
    box.appendChild(info);

    if (surface === 'accent') {
      var same = el('button', 'dr-same', 'Same as the other walls (no accent)');
      same.type = 'button';
      same.setAttribute('aria-pressed', cur ? 'false' : 'true');
      same.addEventListener('click', function () { c.clearAccent('drawer'); render(); });
      box.appendChild(same);
    }

    // material cards
    var list = el('div', 'dr-cards');
    K.materials(surface).forEach(function (m) {
      var pal = K.palette(surface, m.key);
      var colKey = cur && K.colourInPalette(surface, m.key, cur.c) ? cur.c : pal[0].key;
      var hex = K.colour(colKey).hex;
      var card = el('button', 'dr-card');
      card.type = 'button';
      var selected = !!(cur && cur.m === m.key);
      card.setAttribute('aria-pressed', selected ? 'true' : 'false');
      var img = document.createElement('img');
      img.alt = '';
      img.src = thumb(m.key, hex);
      card.appendChild(img);
      var txt = el('div', 'dr-txt');
      txt.appendChild(el('div', 'dr-name', (selected ? '✓ ' : '') + m.label));
      txt.appendChild(el('div', 'dr-price', K.fmt(m.price) + ' ₸ / ' + K.UNITS[surface]));
      card.appendChild(txt);
      card.addEventListener('click', function () {
        c.setFinish(surface, m.key, colKey, 'drawer');
        render();
      });
      list.appendChild(card);
    });
    box.appendChild(list);

    // colours of the chosen material
    if (cur && K.material(surface, cur.m)) {
      box.appendChild(el('div', 'dr-sub', 'Colour: ' + K.colour(cur.c).label));
      var sw = el('div', 'dr-swatches');
      K.palette(surface, cur.m).forEach(function (col) {
        var b = el('button', 'dr-sw');
        b.type = 'button';
        b.style.background = col.hex;
        b.title = col.label;
        b.setAttribute('aria-label', col.label);
        b.setAttribute('aria-pressed', col.key === cur.c ? 'true' : 'false');
        if (col.key === cur.c) b.textContent = '✓';
        b.addEventListener('click', function () { c.setFinish(surface, cur.m, col.key, 'drawer'); render(); });
        sw.appendChild(b);
      });
      box.appendChild(sw);
    } else {
      box.appendChild(el('div', 'dr-sub', 'Choose a material to see its colours.'));
    }
  }

  function boot() {
    var scene = $('a-scene');
    if (!scene) return;
    $('#dr-toggle').addEventListener('click', function () {
      var d = $('#drawer');
      var closed = d.classList.toggle('closed');
      $('#dr-toggle').textContent = closed ? 'Finishes ▸' : '◂ Hide';
    });
    var refresh = function () {
      var c = cfg();
      if (c && c.state.selected && c.state.selected !== shownSurface) shownSurface = c.state.selected;
      if (c && c.state.mode !== 'intro') { $('#drawer').classList.add('on'); render(); syncPanel(); }
    };
    // On a desktop screen the HTML drawer replaces the floating 3D panel; in a headset (or when the
    // drawer is hidden) the 3D panel is shown, so every function is still reachable in VR.
    var syncPanel = function () {
      var panel = $('#panel');
      var c = cfg();
      if (!panel || !c) return;
      var drawerOpen = $('#drawer').classList.contains('on') && !$('#drawer').classList.contains('closed') && window.innerWidth > 900;
      panel.setAttribute('visible', !drawerOpen || scene.is('vr-mode'));
    };
    scene.addEventListener('enter-vr', syncPanel);
    scene.addEventListener('exit-vr', syncPanel);
    window.addEventListener('resize', syncPanel);
    $('#dr-toggle').addEventListener('click', syncPanel);
    scene.addEventListener('choice-changed', refresh);
    scene.addEventListener('session-started', refresh);
    scene.addEventListener('surface-selected', refresh);
    AVR.drawer = { render: render };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
