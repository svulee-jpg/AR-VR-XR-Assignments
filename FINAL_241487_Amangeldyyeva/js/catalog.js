/*
 * catalog.js
 * The finishing catalogue of the demo developer: surfaces, materials, colour palettes,
 * demo prices, ready-made designs, the variant code and the price calculation.
 *
 * Pure data and functions: no A-Frame, no browser. Node can load it (tests) and the
 * browser exposes it as the global `Catalog`.
 *
 * All prices are DEMO prices in tenge (₸) made up for this student project. They are not
 * the prices of any real company.
 */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------------------
  // 1. Colours
  // ---------------------------------------------------------------------------
  // Each colour has `words`: word patterns that the voice parser matches. A word matches a
  // spoken token exactly (a plural "s" or "ish" is allowed: "greys", "greyish"). A word that
  // ends in "*" matches any token that starts with it. Patterns are regular expressions, so
  // "gr[ae]y" accepts both spellings (Chrome's English recogniser returns "gray").
  var DB = {}; // key -> colour

  function add(key, label, hex, words) {
    DB[key] = { key: key, label: label, hex: hex, words: words };
    return DB[key];
  }

  // A colour family has three tones: light, normal, dark (light grey, grey, dark grey).
  function family(key, name, stem, light, mid, dark, tail) {
    var t = tail || [];
    add(key + '-l', 'Light ' + name.toLowerCase(), light, ['light(?:er)?'].concat(stem, t));
    add(key, name, mid, [].concat(stem, t));
    add(key + '-d', 'Dark ' + name.toLowerCase(), dark, ['dark(?:er)?'].concat(stem, t));
  }

  // Wall / ceiling / carpet colours
  add('white', 'White', '#f4f1ea', ['white']);
  add('milk', 'Milk', '#efe6d2', ['milk(?:y)?']);
  add('cream', 'Cream', '#eadcb8', ['cream(?:y)?']);
  family('beige', 'Beige', ['beige'], '#efe4cd', '#e0cfae', '#bfa57f');
  add('sand', 'Sand', '#d6c29a', ['sand(?:y)?']);
  family('grey', 'Grey', ['gr[ae]y'], '#d4d4d1', '#b0b0ad', '#6b6e73');
  add('graphite', 'Graphite', '#4b4f55', ['graphite', 'charcoal']);
  add('black', 'Black', '#2b2b2d', ['black']);
  family('skyblue', 'Sky blue', ['sky', 'blue'], '#cfe5f3', '#a9cde8', '#6ea0cc');
  family('blue', 'Blue', ['blue'], '#8fa8d1', '#4c6fa5', '#24385f');
  family('turq', 'Turquoise', ['turquoise', 'teal'], '#bfe6e3', '#7cc3c0', '#3e8f8d');
  add('mint', 'Mint', '#b7ddc8', ['mint', 'green']);
  family('green', 'Green', ['green'], '#cfe0c3', '#b4c9a6', '#6f8f5e');
  add('sage', 'Sage', '#a7b59e', ['sage', 'green']);
  add('olive', 'Olive', '#8d9462', ['olive', 'green']);
  add('emerald', 'Emerald', '#3f6b5c', ['emerald', 'green']);
  family('yellow', 'Yellow', ['yellow'], '#f5ecb8', '#ecd98a', '#cfa93f');
  add('mustard', 'Mustard', '#c9a227', ['mustard', 'yellow']);
  family('peach', 'Peach', ['peach'], '#f7dcc8', '#f0c7a8', '#d9996e');
  add('terracotta', 'Terracotta', '#c97b5a', ['terra(?:cotta)?', 'cotta']);
  family('red', 'Red', ['red'], '#e6a09a', '#c0504d', '#7d2a2d');
  add('burgundy', 'Burgundy', '#7d3b45', ['burgundy', 'maroon', 'wine', 'red']);
  family('pink', 'Pink', ['pink'], '#f4d9dc', '#e8c3c6', '#c98b95');
  family('lilac', 'Lilac', ['lilac', 'purple'], '#e0d6ec', '#c9bbdc', '#8f7bb3');
  add('lavender', 'Lavender', '#b8b0d8', ['lavender']);
  family('brown', 'Brown', ['brown'], '#b99a80', '#8a6a52', '#5a4033');

  // Wood tones (floors and wooden slats)
  add('oak', 'Natural oak', '#b58b55', ['natural', 'oak']);
  add('light-oak', 'Light oak', '#c9a46a', ['light(?:er)?', 'oak']);
  add('bleached-oak', 'Bleached oak', '#d9ccb4', ['bleached', 'oak']);
  add('golden-oak', 'Golden oak', '#b9894a', ['golden', 'oak']);
  add('light-ash', 'Light ash', '#cbbfa8', ['light(?:er)?', 'ash']);
  add('ash-grey', 'Grey ash', '#9a9690', ['gr[ae]y', 'ash']);
  add('smoked-oak', 'Smoked oak', '#6f655b', ['smoked', 'oak']);
  add('dark-oak', 'Dark oak', '#5b4030', ['dark(?:er)?', 'oak']);
  add('walnut', 'Walnut', '#7a5538', ['walnut']);
  add('dark-walnut', 'Dark walnut', '#4f3526', ['dark(?:er)?', 'walnut']);
  add('wenge', 'Wenge', '#3a2a24', ['wenge']);
  add('mahogany', 'Mahogany', '#7b3b2a', ['mahogany']);

  // Brick colours (own keys because the words differ from the paint colours)
  add('brk-red', 'Red', '#a5503b', ['red']);
  add('brk-dred', 'Dark red', '#7e3a2e', ['dark(?:er)?', 'red']);
  add('brk-terra', 'Terracotta', '#b9694a', ['terra(?:cotta)?', 'cotta']);
  add('brk-brown', 'Brown', '#6b4a3a', ['brown']);
  add('brk-sand', 'Sand', '#d3b48d', ['sand(?:y)?']);
  add('brk-beige', 'Beige', '#c9b394', ['beige']);
  add('brk-yellow', 'Yellow', '#d9b86a', ['yellow']);
  add('brk-white', 'White', '#e9e6df', ['white']);
  add('brk-aged', 'Aged white', '#cfc8bb', ['aged', 'white']);
  add('brk-grey', 'Grey', '#9a9a98', ['gr[ae]y']);
  add('brk-graphite', 'Graphite', '#4a4a4c', ['graphite', 'charcoal']);
  add('brk-black', 'Black', '#2a2a2b', ['black']);

  function pick(keys) {
    return keys.map(function (k) {
      if (!DB[k]) throw new Error('Unknown colour key: ' + k);
      return DB[k];
    });
  }

  var PALETTES = {
    paint: pick([
      'white', 'milk', 'cream', 'beige-l', 'beige', 'beige-d', 'sand',
      'grey-l', 'grey', 'grey-d', 'graphite', 'black',
      'skyblue-l', 'skyblue', 'skyblue-d', 'blue-l', 'blue', 'blue-d',
      'turq-l', 'turq', 'turq-d', 'mint', 'green-l', 'green', 'green-d',
      'sage', 'olive', 'emerald', 'yellow-l', 'yellow', 'yellow-d', 'mustard',
      'peach-l', 'peach', 'peach-d', 'terracotta', 'red-l', 'red', 'red-d', 'burgundy',
      'pink-l', 'pink', 'pink-d', 'lilac-l', 'lilac', 'lilac-d', 'lavender',
      'brown-l', 'brown', 'brown-d'
    ]),
    stripe: pick(['grey', 'beige', 'skyblue', 'blue', 'turq', 'green', 'yellow', 'peach', 'red', 'pink', 'lilac', 'brown']),
    plaster: pick([
      'white', 'milk', 'cream', 'beige-l', 'beige', 'sand', 'grey-l', 'grey', 'grey-d', 'graphite',
      'sage', 'olive', 'terracotta', 'skyblue-l', 'peach-l', 'pink-l', 'lilac-l', 'green-l', 'mustard', 'brown-l'
    ]),
    micro: pick(['white', 'milk', 'grey-l', 'grey', 'grey-d', 'graphite', 'beige', 'sand', 'terracotta', 'olive']),
    brick: pick([
      'brk-red', 'brk-dred', 'brk-terra', 'brk-brown', 'brk-sand', 'brk-beige',
      'brk-yellow', 'brk-white', 'brk-aged', 'brk-grey', 'brk-graphite', 'brk-black'
    ]),
    wood: pick([
      'oak', 'light-oak', 'bleached-oak', 'golden-oak', 'light-ash', 'ash-grey',
      'smoked-oak', 'dark-oak', 'walnut', 'dark-walnut', 'wenge', 'mahogany'
    ]),
    stone: pick(['white', 'milk', 'beige', 'sand', 'grey-l', 'grey', 'grey-d', 'graphite', 'black', 'terracotta', 'emerald', 'blue-d']),
    marble: pick(['white', 'cream', 'beige', 'grey-l', 'grey', 'grey-d', 'black', 'emerald', 'pink', 'brown']),
    concrete: pick(['milk', 'grey-l', 'grey', 'grey-d', 'graphite', 'beige']),
    carpet: pick(['grey-l', 'grey', 'grey-d', 'graphite', 'beige', 'sand', 'brown', 'blue', 'green', 'burgundy', 'terracotta', 'olive']),
    ceiling: pick(['white', 'milk', 'cream', 'grey-l', 'grey', 'graphite', 'skyblue-l', 'black']),
    skirting: pick(['white', 'milk', 'grey-l', 'grey', 'graphite', 'black', 'oak', 'wenge'])
  };

  // ---------------------------------------------------------------------------
  // 2. Surfaces and materials
  // ---------------------------------------------------------------------------
  var SURFACES = ['walls', 'accent', 'floor', 'ceiling', 'skirting'];
  var SURFACE_LABEL = {
    walls: 'Walls', accent: 'Accent wall', floor: 'Floor', ceiling: 'Ceiling', skirting: 'Skirting board'
  };
  var SURFACE_TAB = {
    walls: 'Walls', accent: 'Accent', floor: 'Floor', ceiling: 'Ceiling', skirting: 'Skirting'
  };

  // price = demo ₸ per m² (per metre for the skirting board); rough/metal = surface look.
  var WALL_MATERIALS = [
    { key: 'paint', label: 'Matt paint', price: 2800, palette: 'paint', rough: 0.95, metal: 0 },
    { key: 'textured', label: 'Textured paint', price: 4800, palette: 'paint', rough: 0.95, metal: 0 },
    { key: 'wp-plain', label: 'Wallpaper (non-woven)', price: 4200, palette: 'paint', rough: 0.9, metal: 0 },
    { key: 'wp-stripe', label: 'Striped wallpaper', price: 5600, palette: 'stripe', rough: 0.9, metal: 0 },
    { key: 'plaster', label: 'Decorative plaster', price: 8500, palette: 'plaster', rough: 0.8, metal: 0 },
    { key: 'brick', label: 'Brick (loft)', price: 10500, palette: 'brick', rough: 0.95, metal: 0 },
    { key: 'microcement', label: 'Microcement', price: 12500, palette: 'micro', rough: 0.55, metal: 0 },
    { key: 'slats', label: 'Wooden slats', price: 15000, palette: 'wood', rough: 0.6, metal: 0 }
  ];

  var MATERIALS = {
    walls: WALL_MATERIALS,
    accent: WALL_MATERIALS,
    floor: [
      { key: 'laminate', label: 'Laminate', price: 6500, palette: 'wood', rough: 0.55, metal: 0 },
      { key: 'parquet', label: 'Parquet board', price: 14000, palette: 'wood', rough: 0.5, metal: 0 },
      { key: 'herringbone', label: 'Herringbone parquet', price: 18500, palette: 'wood', rough: 0.5, metal: 0 },
      { key: 'engineered', label: 'Engineered board', price: 16000, palette: 'wood', rough: 0.5, metal: 0 },
      { key: 'spc', label: 'Vinyl (SPC)', price: 8500, palette: 'wood', rough: 0.6, metal: 0 },
      { key: 'tile', label: 'Porcelain tile', price: 11000, palette: 'stone', rough: 0.3, metal: 0 },
      { key: 'marble', label: 'Marble', price: 24000, palette: 'marble', rough: 0.2, metal: 0.05 },
      { key: 'concrete', label: 'Poured concrete', price: 7500, palette: 'concrete', rough: 0.45, metal: 0 },
      { key: 'carpet', label: 'Carpet', price: 5500, palette: 'carpet', rough: 1, metal: 0 }
    ],
    ceiling: [
      { key: 'paint', label: 'Painted', price: 1800, palette: 'ceiling', rough: 0.95, metal: 0 },
      { key: 'matt', label: 'Stretch matt', price: 4200, palette: 'ceiling', rough: 0.85, metal: 0 },
      { key: 'gloss', label: 'Stretch gloss', price: 5400, palette: 'ceiling', rough: 0.12, metal: 0.15 }
    ],
    skirting: [
      { key: 'pvc', label: 'PVC (6 cm)', price: 900, palette: 'skirting', rough: 0.6, metal: 0, height: 0.06 },
      { key: 'mdf', label: 'Painted MDF (10 cm)', price: 1800, palette: 'skirting', rough: 0.55, metal: 0, height: 0.1 },
      { key: 'wood', label: 'Wood (12 cm)', price: 2800, palette: 'skirting', rough: 0.5, metal: 0, height: 0.12 },
      { key: 'alu', label: 'Hidden aluminium (4 cm)', price: 3600, palette: 'skirting', rough: 0.35, metal: 0.4, height: 0.04 }
    ]
  };

  // Used when the user names only a colour for a surface that has no material yet.
  var DEFAULT_MATERIAL = { walls: 'paint', accent: 'paint', floor: 'laminate', ceiling: 'matt', skirting: 'mdf' };

  // What the apartment looks like before finishing (developer's rough state).
  var RAW = {
    walls: { label: 'Rough finish', hex: '#9b9a96', tex: 'microcement' },
    accent: { label: 'Rough finish', hex: '#9b9a96', tex: 'microcement' },
    floor: { label: 'Concrete screed', hex: '#77746f', tex: 'concrete' },
    ceiling: { label: 'Concrete slab', hex: '#c4c3bf', tex: null },
    skirting: { label: 'No skirting board', hex: '#cccccc', tex: null, hidden: true }
  };

  // Room geometry (metres) used for the price. Room 5 x 4 x 2.7 m, one window, one door.
  //   all walls   = 2*(5+4)*2.7 = 48.6;  window 1.2*1.1 = 1.32;  door 0.9*2.1 = 1.89
  //   accent wall = far wall 5*2.7 = 13.5 minus the window = 12.18
  //   walls       = all walls minus window, door and accent wall
  //   skirting    = perimeter 18 minus the door 0.9 = 17.1 m
  var AREAS = { walls: 33.21, accent: 12.18, floor: 20, ceiling: 20, skirting: 17.1 };
  var UNITS = { walls: 'm²', accent: 'm²', floor: 'm²', ceiling: 'm²', skirting: 'm' };

  // ---------------------------------------------------------------------------
  // 3. Ready-made designs ("choose a finished design, we do the rest")
  // ---------------------------------------------------------------------------
  var PRESETS = [
    { key: 'scandi', label: 'Scandinavian',
      walls: ['paint', 'white'], accent: ['slats', 'light-oak'], floor: ['laminate', 'bleached-oak'],
      ceiling: ['matt', 'white'], skirting: ['mdf', 'white'] },
    { key: 'loft', label: 'Loft',
      walls: ['microcement', 'grey-l'], accent: ['brick', 'brk-red'], floor: ['concrete', 'grey'],
      ceiling: ['matt', 'graphite'], skirting: ['pvc', 'black'] },
    { key: 'classic', label: 'Classic',
      walls: ['plaster', 'cream'], accent: ['wp-stripe', 'beige'], floor: ['herringbone', 'oak'],
      ceiling: ['matt', 'milk'], skirting: ['wood', 'white'] },
    { key: 'minimal', label: 'Minimal',
      walls: ['paint', 'grey-l'], accent: null, floor: ['spc', 'ash-grey'],
      ceiling: ['matt', 'white'], skirting: ['alu', 'white'] },
    { key: 'cosy', label: 'Cosy',
      walls: ['textured', 'sand'], accent: ['slats', 'walnut'], floor: ['engineered', 'golden-oak'],
      ceiling: ['matt', 'cream'], skirting: ['wood', 'oak'] },
    { key: 'luxe', label: 'Dark luxe',
      walls: ['paint', 'graphite'], accent: ['plaster', 'grey-d'], floor: ['marble', 'black'],
      ceiling: ['gloss', 'graphite'], skirting: ['mdf', 'black'] }
  ];

  // ---------------------------------------------------------------------------
  // 4. Lookup helpers
  // ---------------------------------------------------------------------------
  function materials(surface) { return MATERIALS[surface] || []; }

  function material(surface, key) {
    var list = materials(surface);
    for (var i = 0; i < list.length; i++) if (list[i].key === key) return list[i];
    return null;
  }

  function palette(surface, materialKey) {
    var m = material(surface, materialKey);
    return m ? PALETTES[m.palette] : [];
  }

  function colour(key) { return DB[key] || null; }

  function colourInPalette(surface, materialKey, colourKey) {
    return palette(surface, materialKey).some(function (c) { return c.key === colourKey; });
  }

  function preset(key) {
    for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].key === key) return PRESETS[i];
    return null;
  }

  /** A choice is { m: materialKey, c: colourKey } or null. Validates it for a surface. */
  function validChoice(surface, ch) {
    return !!(ch && material(surface, ch.m) && colourInPalette(surface, ch.m, ch.c));
  }

  function emptyChoice() {
    return { walls: null, accent: null, floor: null, ceiling: null, skirting: null };
  }

  /** Builds the choice object of a ready-made design. */
  function presetChoice(key) {
    var p = preset(key);
    if (!p) return null;
    var out = emptyChoice();
    SURFACES.forEach(function (s) { out[s] = p[s] ? { m: p[s][0], c: p[s][1] } : null; });
    return out;
  }

  // ---------------------------------------------------------------------------
  // 5. Number of variants, price, variant code
  // ---------------------------------------------------------------------------
  /** How many different looks one surface can have. The accent wall may also stay as the walls. */
  function surfaceOptions(surface) {
    var n = 0;
    materials(surface).forEach(function (m) { n += PALETTES[m.palette].length; });
    return n + (surface === 'accent' ? 1 : 0);
  }

  function countVariants() {
    var total = 1;
    SURFACES.forEach(function (s) { total *= surfaceOptions(s); });
    return total;
  }

  /** Price of every surface and the total. Unfinished surfaces cost 0. */
  function price(choice) {
    var rows = [];
    var total = 0;
    SURFACES.forEach(function (s) {
      var ch = choice[s];
      var priced = ch;
      // An accent wall that was not chosen separately gets the finish of the walls.
      if (s === 'accent' && !ch) priced = choice.walls;
      var m = priced && material(s, priced.m);
      var sum = m ? Math.round(m.price * AREAS[s]) : 0;
      total += sum;
      rows.push({ surface: s, label: SURFACE_LABEL[s], area: AREAS[s], unit: UNITS[s], material: m, sum: sum });
    });
    return { rows: rows, total: total };
  }

  /** Monthly payment if the finishing is added to a mortgage (demo terms, annuity). */
  var MORTGAGE = { years: 15, ratePercent: 10 };
  function monthlyPayment(amount) {
    var n = MORTGAGE.years * 12;
    var r = MORTGAGE.ratePercent / 100 / 12;
    if (!amount) return 0;
    return Math.round((amount * r) / (1 - Math.pow(1 + r, -n)));
  }

  /** 1234567 -> "1 234 567" (non-breaking spaces). */
  function fmt(n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  /**
   * Variant code, e.g. "5.3-x-2.4-1.0-0.2": for every surface "material index.colour index"
   * or "x" when nothing is chosen. It is stored in the page address so a variant can be shared.
   */
  function encode(choice) {
    return SURFACES.map(function (s) {
      var ch = choice[s];
      if (!validChoice(s, ch)) return 'x';
      var mi = materials(s).indexOf(material(s, ch.m));
      var pal = palette(s, ch.m);
      var ci = pal.indexOf(colour(ch.c));
      return mi + '.' + ci;
    }).join('-');
  }

  function decode(code) {
    var parts = String(code || '').split('-');
    if (parts.length !== SURFACES.length) return null;
    var out = emptyChoice();
    for (var i = 0; i < SURFACES.length; i++) {
      var s = SURFACES[i];
      if (parts[i] === 'x') continue;
      var m = /^(\d+)\.(\d+)$/.exec(parts[i]);
      if (!m) return null;
      var mat = materials(s)[+m[1]];
      if (!mat) return null;
      var col = PALETTES[mat.palette][+m[2]];
      if (!col) return null;
      out[s] = { m: mat.key, c: col.key };
    }
    return out;
  }

  /** Random variant (rnd is Math.random or a seeded function). */
  function randomChoice(rnd) {
    var out = emptyChoice();
    SURFACES.forEach(function (s) {
      if (s === 'accent' && rnd() < 0.35) return; // no separate accent wall
      var mats = materials(s);
      var m = mats[Math.floor(rnd() * mats.length)];
      var pal = PALETTES[m.palette];
      out[s] = { m: m.key, c: pal[Math.floor(rnd() * pal.length)].key };
    });
    return out;
  }

  var api = {
    DB: DB, PALETTES: PALETTES, SURFACES: SURFACES, SURFACE_LABEL: SURFACE_LABEL, SURFACE_TAB: SURFACE_TAB,
    MATERIALS: MATERIALS, DEFAULT_MATERIAL: DEFAULT_MATERIAL, RAW: RAW, AREAS: AREAS, UNITS: UNITS,
    PRESETS: PRESETS, MORTGAGE: MORTGAGE,
    materials: materials, material: material, palette: palette, colour: colour,
    colourInPalette: colourInPalette, preset: preset, validChoice: validChoice,
    emptyChoice: emptyChoice, presetChoice: presetChoice,
    surfaceOptions: surfaceOptions, countVariants: countVariants,
    price: price, monthlyPayment: monthlyPayment, fmt: fmt,
    encode: encode, decode: decode, randomChoice: randomChoice
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Catalog = api;
})(typeof window !== 'undefined' ? window : this);
