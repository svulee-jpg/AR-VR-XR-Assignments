/*
 * Company layer of the demo: it makes the configurator look like a real developer's sales tool.
 *   1. Landing page: brand, how it works, ready-made design packages with prices.
 *   2. Top bar: brand, apartment, live total price, "Get quote" and "Book consultation".
 *   3. Quote: printable commercial offer with a picture of the room and an item table (browser print = PDF).
 *   4. Booking: consultation request form. Demo only: nothing is sent anywhere or stored.
 * Brand "Aurora Homes" and "Aurora Residence" are fictional. Prices are made up.
 */
(function () {
  'use strict';
  var K = window.Catalog;
  var AVR = (window.AVR = window.AVR || {});
  if (!K) return;

  var BRAND = {
    name: 'Aurora Homes',
    project: 'Aurora Residence, Block B',
    apartment: 'Apartment 128 · 5 rooms, 70 m²',
    refPrefix: 'AH'
  };

  var PACKAGE_TEXT = {
    living: 'White walls, brown striped feature wall, light oak floor. The showroom living room.',
    scandi: 'Light, calm, natural wood. Good for small rooms.',
    loft: 'Raw brick, microcement and black accents.',
    classic: 'Warm plaster, herringbone floor, wallpaper stripe.',
    minimal: 'Quiet greys and a clean line. Easy to live with.',
    cosy: 'Sand walls, walnut slats and warm oak.',
    luxe: 'Graphite walls, black marble floor, glossy ceiling.'
  };

  function $(sel) { return document.querySelector(sel); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function money(n) { return K.fmt(n) + ' ₸'; }
  function cfg() { return AVR.cfg; }

  // ---------------------------------------------------------------- 1. landing: packages
  var pendingPreset = null;

  function buildPackages() {
    var box = $('#packages');
    if (!box) return;
    var dc = $('#design-count');
    if (dc) dc.textContent = K.PRESETS.length;
    K.PRESETS.forEach(function (p) {
      var choice = K.presetChoice(p.key);
      var total = K.price(choice).total;
      var b = el('button', 'pkg');
      b.type = 'button';
      b.setAttribute('aria-pressed', 'false');
      var pic = document.createElement('img');
      pic.className = 'pic';
      pic.src = 'img/room-' + p.key + '.jpg';
      pic.alt = p.label + ' design, rendered in the apartment';
      pic.loading = 'lazy';
      var pw = el('span', 'pw');
      pw.appendChild(pic);
      b.appendChild(pw);
      var body = el('div', 'body');
      var sw = el('div', 'sw');
      ['walls', 'accent', 'floor', 'door', 'ceiling'].forEach(function (s) {
        var ch = choice[s] || choice.walls;
        var i = document.createElement('i');
        i.style.background = ch ? K.colour(ch.c).hex : '#888';
        sw.appendChild(i);
      });
      body.appendChild(sw);
      body.appendChild(el('div', 'nm', p.label));
      body.appendChild(el('div', 'pr', 'from ' + money(total)));
      body.appendChild(el('div', 'ds', PACKAGE_TEXT[p.key] || ''));
      body.appendChild(el('div', 'sel', 'Selected'));
      b.appendChild(body);
      b.addEventListener('click', function () {
        var on = pendingPreset !== p.key;
        pendingPreset = on ? p.key : null;
        Array.prototype.forEach.call(box.children, function (c) { c.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        var hint = $('#pkg-hint');
        if (hint) hint.textContent = on ? 'Selected: ' + p.label + '. It will be applied when you enter the apartment; you can change everything afterwards.' : 'Begin with a composed interior, or start from the raw apartment.';
      });
      box.appendChild(b);
    });
  }

  // ---------------------------------------------------------------- 2. top bar
  function updateTotal() {
    var c = cfg();
    if (!c) return;
    var info = c.priceInfo();
    var t = $('#tb-total');
    if (t) t.textContent = info.total ? money(info.total) : 'not chosen yet';
  }

  function showTopbar() {
    var bar = $('#topbar');
    if (bar) bar.classList.add('on');
    var rb = $('#roombar');
    if (rb) rb.classList.add('on');
    updateTotal();
    updateRoomBar();
  }

  // ---------------------------------------------------------------- furniture toggle
  // The state lives in Kit.Furniture (js/kit.js): on/off, removed pieces, remove mode.
  function applyFurniture() {
    var c = cfg();
    var F = window.Kit && window.Kit.Furniture;
    if (!F) return;
    var hide = !!(c && c.state.preview);       // the "before renovation" view shows an empty apartment
    F.setHidden(hide);
    var f = $('#furniture');
    if (f) f.setAttribute('visible', F.enabled && !hide);
    var b = $('#tb-furniture');
    if (b) {
      b.textContent = 'Furniture: ' + (F.enabled ? 'on' : 'off');
      b.setAttribute('aria-pressed', F.enabled ? 'true' : 'false');
    }
    var rm = $('#rb-remove');
    if (rm) {
      rm.textContent = F.removeMode ? 'Click a piece to remove it' : 'Remove furniture';
      rm.classList.toggle('on', F.removeMode);
    }
  }

  // ---------------------------------------------------------------- room bar (walk between the five rooms)
  function buildRoomBar() {
    var bar = $('#roombar');
    var P = window.Plan;
    if (!bar || !P) return;
    P.ROOMS.forEach(function (r) {
      var b = el('button', 'chip', r.name);
      b.type = 'button';
      b.dataset.room = r.id;
      b.addEventListener('click', function () { if (cfg()) cfg().goTo(r.id, 'roombar'); });
      bar.appendChild(b);
    });
    var sep = el('span', 'sep');
    bar.appendChild(sep);
    var rm = el('button', 'chip tool', 'Remove furniture');
    rm.type = 'button';
    rm.id = 'rb-remove';
    rm.addEventListener('click', function () { if (cfg()) cfg().setRemoveMode(!window.Kit.Furniture.removeMode, 'roombar'); });
    bar.appendChild(rm);
    var back = el('button', 'chip tool', 'Restore all');
    back.type = 'button';
    back.addEventListener('click', function () { if (cfg()) cfg().restoreAllFurniture('roombar'); });
    bar.appendChild(back);
  }

  function updateRoomBar() {
    var P = window.Plan;
    var room = P && AVR.room ? P.room(AVR.room) : null;
    Array.prototype.forEach.call(document.querySelectorAll('#roombar .chip[data-room]'), function (b) {
      b.classList.toggle('on', !!room && b.dataset.room === room.id);
    });
    var w = $('#topbar .where');
    if (w) w.textContent = 'Aurora Residence · Apartment 128' + (room ? ' · ' + room.name : '');
  }

  // ---------------------------------------------------------------- window view button
  function applyViewLabel() {
    var c = cfg();
    var b = $('#tb-view');
    if (b && c) b.textContent = 'View: ' + c.state.view;
  }

  // ---------------------------------------------------------------- 3. quote
  function hash6(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return ('000000' + h.toString(36).toUpperCase()).slice(-6);
  }

  function quoteRef() {
    return BRAND.refPrefix + '-241487-' + hash6(K.encode(cfg().state.choice));
  }

  // Picture of the room without the floating panel and captions.
  function roomPicture() {
    try {
      var scene = $('a-scene');
      var hide = ['#panel', '#caption', '#micstatus', '#gaze'].map(function (s) { return $(s); }).filter(Boolean);
      var old = hide.map(function (e) { return e.object3D.visible; });
      hide.forEach(function (e) { e.object3D.visible = false; });
      var canvas = scene.components.screenshot.getCanvas('perspective');
      var url = canvas.toDataURL('image/jpeg', 0.85);
      hide.forEach(function (e, i) { e.object3D.visible = old[i]; });
      return url;
    } catch (e) {
      return '';
    }
  }

  function openQuote() {
    var c = cfg();
    if (!c || c.state.mode === 'intro') return;
    c.log('quote_open', 'topbar', K.encode(c.state.choice));
    var info = c.priceInfo();
    var ref = quoteRef();
    $('#q-ref').textContent = ref;
    $('#q-date').textContent = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    $('#q-apt').textContent = BRAND.project + ' · ' + BRAND.apartment;
    var shot = roomPicture();
    var img = $('#q-shot');
    if (shot) { img.src = shot; img.classList.remove('hidden'); } else { img.classList.add('hidden'); }

    var body = $('#q-rows');
    body.textContent = '';
    info.rows.forEach(function (r) {
      var tr = document.createElement('tr');
      var ch = c.effective(r.surface);
      var name = el('td', null, r.label);
      var fin = el('td');
      if (ch && r.material) {
        var colour = K.colour(ch.c);
        var chip = el('span', 'chip');
        chip.style.background = colour.hex;
        fin.appendChild(chip);
        fin.appendChild(document.createTextNode(r.material.label + ', ' + colour.label));
      } else {
        fin.textContent = 'Not chosen (rough finish)';
      }
      tr.appendChild(name);
      tr.appendChild(fin);
      tr.appendChild(el('td', 'num', r.sum ? (r.area + ' ' + r.unit) : '–'));
      tr.appendChild(el('td', 'num', r.sum ? money(r.sum) : '–'));
      body.appendChild(tr);
    });
    $('#q-total').textContent = money(info.total);
    var pay = $('#q-mortgage');
    pay.textContent = info.total
      ? 'With a mortgage: about ' + money(K.monthlyPayment(info.total)) + ' per month (demo terms: ' + K.MORTGAGE.years + ' years, ' + K.MORTGAGE.ratePercent + '% a year).'
      : 'Choose at least one finish to see the price.';
    $('#q-code').textContent = K.encode(c.state.choice);
    $('#quote').classList.add('on');
  }

  function closeModals() {
    $('#quote').classList.remove('on');
    $('#booking').classList.remove('on');
  }

  // ---------------------------------------------------------------- 4. booking (demo: nothing leaves the page)
  function nextWorkdays(n) {
    var out = [];
    var d = new Date();
    while (out.length < n) {
      d.setDate(d.getDate() + 1);
      var wd = d.getDay();
      if (wd !== 0 && wd !== 6) out.push(new Date(d.getTime()));
    }
    return out;
  }

  function buildBookingForm() {
    var sel = $('#b-date');
    nextWorkdays(7).forEach(function (d) {
      var o = document.createElement('option');
      o.value = d.toISOString().slice(0, 10);
      o.textContent = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
      sel.appendChild(o);
    });
  }

  function openBooking() {
    var c = cfg();
    if (!c || c.state.mode === 'intro') return;
    c.log('booking_open', 'topbar', '');
    $('#quote').classList.remove('on');
    $('#b-form').classList.remove('hidden');
    $('#b-done').classList.add('hidden');
    $('#b-err').textContent = '';
    $('#b-total').textContent = c.priceInfo().total ? money(c.priceInfo().total) : 'not chosen yet';
    $('#booking').classList.add('on');
  }

  function submitBooking(ev) {
    ev.preventDefault();
    var c = cfg();
    var name = $('#b-name').value.trim();
    var contact = $('#b-contact').value.trim();
    var ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) || /^\+?[0-9][0-9\s\-()]{6,}$/.test(contact);
    var err = $('#b-err');
    if (!name) { err.textContent = 'Please enter your name.'; return; }
    if (!ok) { err.textContent = 'Enter a phone number or an e-mail address.'; return; }
    if (!$('#b-consent').checked) { err.textContent = 'Please confirm that you understand this is a demo.'; return; }
    var ref = quoteRef() + '-B';
    // Only the reference goes to the event log (no name, no contact): privacy by design.
    c.log('booking_request', 'form', ref + ' ' + $('#b-date').value + ' ' + $('#b-time').value);
    $('#b-ref').textContent = ref;
    $('#b-when').textContent = $('#b-date').options[$('#b-date').selectedIndex].textContent + ', ' + $('#b-time').value;
    $('#b-who').textContent = name;
    $('#b-form').classList.add('hidden');
    $('#b-done').classList.remove('hidden');
    $('#b-name').value = ''; $('#b-contact').value = ''; $('#b-note').value = '';
  }

  // ---------------------------------------------------------------- wiring
  function boot() {
    buildPackages();
    // Nothing is pre-selected: the apartment stays as it is until the visitor chooses a design.
    buildRoomBar();
    applyFurniture();
    buildBookingForm();

    var scene = $('a-scene');
    scene.addEventListener('choice-changed', function () { updateTotal(); applyFurniture(); });
    scene.addEventListener('furniture-changed', applyFurniture);
    scene.addEventListener('room-changed', updateRoomBar);
    scene.addEventListener('mode-changed', function () {
      if (cfg() && cfg().state.mode !== 'intro') showTopbar();
    });

    // A package picked on the landing page is applied as soon as the session starts.
    scene.addEventListener('session-started', function () {
      showTopbar();
      if (pendingPreset) cfg().applyPreset(pendingPreset, 'landing');
      updateTotal();
    });

    $('#tb-furniture').addEventListener('click', function () {
      if (cfg()) cfg().setFurniture(!window.Kit.Furniture.enabled, 'topbar');
    });
    $('#tb-view').addEventListener('click', function () {
      if (cfg()) { cfg().setView(cfg().nextView(), 'topbar'); applyViewLabel(); }
    });
    scene.addEventListener('view-changed', applyViewLabel);
    $('#tb-quote').addEventListener('click', openQuote);
    $('#tb-book').addEventListener('click', openBooking);
    $('#q-print').addEventListener('click', function () { cfg().log('quote_print', 'quote', quoteRef()); window.print(); });
    $('#q-book').addEventListener('click', openBooking);
    $('#q-copy').addEventListener('click', function () { cfg().copyLink('quote'); var b = $('#q-copy'); b.textContent = 'Link copied'; setTimeout(function () { b.textContent = 'Copy link'; }, 2500); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (b) { b.addEventListener('click', closeModals); });
    $('#b-form').addEventListener('submit', submitBooking);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModals(); });

    AVR.shop = { openQuote: openQuote, openBooking: openBooking, closeModals: closeModals, quoteRef: quoteRef, BRAND: BRAND };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
