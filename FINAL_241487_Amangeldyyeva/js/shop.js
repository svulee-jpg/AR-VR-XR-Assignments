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
    apartment: 'Apartment 128 · demo room 5 × 4 m',
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
    K.PRESETS.forEach(function (p) {
      var choice = K.presetChoice(p.key);
      var total = K.price(choice).total;
      var b = el('button', 'pkg');
      b.type = 'button';
      b.setAttribute('aria-pressed', 'false');
      var sw = el('div', 'sw');
      ['walls', 'accent', 'floor', 'door', 'ceiling'].forEach(function (s) {
        var ch = choice[s] || choice.walls;
        var i = document.createElement('i');
        i.style.background = ch ? K.colour(ch.c).hex : '#888';
        sw.appendChild(i);
      });
      b.appendChild(sw);
      b.appendChild(el('div', 'nm', p.label));
      b.appendChild(el('div', 'pr', 'from ' + money(total)));
      b.appendChild(el('div', 'ds', PACKAGE_TEXT[p.key] || ''));
      b.addEventListener('click', function () {
        var on = pendingPreset !== p.key;
        pendingPreset = on ? p.key : null;
        Array.prototype.forEach.call(box.children, function (c) { c.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        var hint = $('#pkg-hint');
        if (hint) hint.textContent = on ? 'Selected: ' + p.label + '. It will be applied when you enter the apartment; you can change everything afterwards.' : 'Or skip this and start from the raw apartment.';
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
    updateTotal();
  }

  // ---------------------------------------------------------------- furniture toggle
  var furnitureOn = true;
  function applyFurniture() {
    var c = cfg();
    var f = $('#furniture');
    var show = furnitureOn && !(c && c.state.preview);
    if (f) f.setAttribute('visible', show);
    var b = $('#tb-furniture');
    if (b) {
      b.textContent = 'Furniture: ' + (furnitureOn ? 'on' : 'off');
      b.setAttribute('aria-pressed', furnitureOn ? 'true' : 'false');
    }
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
    // The showroom living room is pre-selected, so the first visit starts with it.
    var first = $('#packages') && $('#packages').querySelector('.pkg');
    var livingIdx = K.PRESETS.map(function (p) { return p.key; }).indexOf('living');
    if (livingIdx >= 0 && $('#packages').children[livingIdx]) $('#packages').children[livingIdx].click();
    applyFurniture();
    buildBookingForm();

    var scene = $('a-scene');
    scene.addEventListener('choice-changed', function () { updateTotal(); applyFurniture(); });
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
      furnitureOn = !furnitureOn;
      if (cfg()) cfg().log('furniture', 'topbar', furnitureOn ? 'on' : 'off');
      applyFurniture();
    });
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
