/*
 * Before / after: a full-screen wipe like the room visualisers of paint and flooring shops.
 * It takes two pictures of the room from where the visitor stands (rough apartment and the chosen
 * finish) and lets the visitor drag a divider between them.
 */
(function () {
  'use strict';
  var AVR = (window.AVR = window.AVR || {});
  function $(sel) { return document.querySelector(sel); }
  function cfg() { return AVR.cfg; }

  function snapshot() {
    var scene = $('a-scene');
    return scene.components.screenshot.getCanvas('perspective').toDataURL('image/jpeg', 0.85);
  }

  function open() {
    var c = cfg();
    if (!c || c.state.mode === 'intro') return;
    var scene = $('a-scene');
    var hide = ['#panel', '#caption', '#micstatus', '#gaze'].map($).filter(Boolean);
    var furniture = $('#furniture');
    var oldVis = hide.map(function (e) { return e.object3D.visible; });
    var oldFurn = furniture ? furniture.object3D.visible : false;
    var oldPreview = c.state.preview;
    var after, before;
    try {
      hide.forEach(function (e) { e.object3D.visible = false; });
      // after = the current variant
      c.state.preview = false; c.applyAll();
      after = snapshot();
      // before = rough apartment, without furniture
      c.state.preview = true; c.applyAll();
      if (furniture) furniture.object3D.visible = false;
      before = snapshot();
    } catch (e) {
      console.warn('compare failed', e);
    } finally {
      c.state.preview = oldPreview; c.applyAll();
      hide.forEach(function (e, i) { e.object3D.visible = oldVis[i]; });
      if (furniture) furniture.object3D.visible = oldFurn;
    }
    if (!after || !before) return;
    c.log('compare_open', 'topbar', '');
    $('#cmp-after').src = after;
    $('#cmp-before').src = before;
    $('#cmp').classList.add('on');
    setPos(50);
  }

  function setPos(pct) {
    pct = Math.max(0, Math.min(100, pct));
    $('#cmp-before-wrap').style.clipPath = 'inset(0 ' + (100 - pct) + '% 0 0)';
    $('#cmp-handle').style.left = pct + '%';
    $('#cmp-range').value = pct;
  }

  function close() { $('#cmp').classList.remove('on'); }

  function boot() {
    $('#tb-compare').addEventListener('click', open);
    $('#cmp-close').addEventListener('click', close);
    $('#cmp-range').addEventListener('input', function (e) { setPos(Number(e.target.value)); });
    var stage = $('#cmp-stage');
    var dragging = false;
    var move = function (ev) {
      var r = stage.getBoundingClientRect();
      var x = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
      setPos((x / r.width) * 100);
    };
    stage.addEventListener('mousedown', function (e) { dragging = true; move(e); });
    window.addEventListener('mousemove', function (e) { if (dragging) move(e); });
    window.addEventListener('mouseup', function () { dragging = false; });
    stage.addEventListener('touchstart', function (e) { dragging = true; move(e); }, { passive: true });
    stage.addEventListener('touchmove', function (e) { if (dragging) move(e); }, { passive: true });
    stage.addEventListener('touchend', function () { dragging = false; });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    AVR.compare = { open: open, close: close };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
