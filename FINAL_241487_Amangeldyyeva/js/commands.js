/*
 * commands.js
 * The voice-command parser: English text -> actions for the configurator.
 *
 * No dependency on A-Frame or the browser (it needs only catalog.js), so the parser can be
 * tested in Node (tests/commands.test.js) and used in the browser (global `Commands`).
 *
 * The "AI" part of the app is the speech recogniser (Web Speech API, see voice.js). This file
 * turns the recognised text into actions. Examples it understands:
 *   "walls red brick"                 "dark walnut herringbone floor"
 *   "ceiling glossy white"            "accent wall wooden slats"
 *   "light grey walls"                "loft design"      "random"
 *   "show summary"  "before"  "after"  "evening"  "back"  "reset"
 *   "sea view"  "city view"  "garden view"      (what is behind the window)
 *   "go to the kitchen"  "bedroom"  "bathroom"  "hallway"  "go to the living room"   (walk to a room)
 *   "remove the sofa"  "restore the sofa"  "remove furniture"  "show furniture"      (furniture)
 */
(function (root) {
  'use strict';

  var Catalog = typeof require === 'function' && typeof module !== 'undefined' ? require('./catalog.js') : root.Catalog;

  // ---- Words that name a surface ---------------------------------------------
  var SURFACE_WORDS = [
    { key: 'accent', re: /^accent/ },
    { key: 'walls', re: /^(?:walls?|wallpapers?)$/ },
    { key: 'floor', re: /^(?:floors?|flooring)$/ },
    { key: 'ceiling', re: /^ceilings?$/ },
    { key: 'skirting', re: /^(?:skirting|baseboards?|plinth)$/ },
    { key: 'door', re: /^(?:doors?|doorway)$/ }
  ];

  // ---- Words that name a material ---------------------------------------------
  // map: for the wall group ("wall": walls and accent wall), the floor, the ceiling and the skirting
  // board, which material the word means. def: the surface used when the phrase names none.
  // prio: when two words name a material of one surface the higher prio wins ("herringbone parquet").
  var MAT_WORDS = [
    { re: /^(?:paint|painted|painting|emulsion|enamel|enamelled|lacquered)$/, map: { wall: 'paint', ceiling: 'paint', door: 'door-paint' }, def: 'walls', prio: 1 },
    { re: /^(?:matt|matte|flat)$/, map: { wall: 'paint', ceiling: 'matt', door: 'door-paint' }, def: 'walls', prio: 1 },
    { re: /^(?:textured|texture|structured)$/, map: { wall: 'textured' }, def: 'walls', prio: 1 },
    { re: /^(?:wallpapers?|nonwoven|vinyl wallpaper)$/, map: { wall: 'wp-plain' }, def: 'walls', prio: 1 },
    { re: /^(?:horizontal|wide)$/, map: { wall: 'wp-hstripe' }, def: 'walls', prio: 2 },
    { re: /^(?:stripe|stripes|striped|stripy|pinstripe)$/, map: { wall: 'wp-stripe' }, def: 'walls', prio: 2 },
    { re: /^(?:plaster|venetian|stucco)$/, map: { wall: 'plaster' }, def: 'walls', prio: 1 },
    { re: /^bricks?$/, map: { wall: 'brick' }, def: 'walls', prio: 1 },
    { re: /^(?:microcement|micro|cement)$/, map: { wall: 'microcement' }, def: 'walls', prio: 1 },
    { re: /^(?:concrete|screed|poured)$/, map: { wall: 'microcement', floor: 'concrete' }, def: 'floor', prio: 1 },
    { re: /^(?:slat|slats|slatted|batten|battens)$/, map: { wall: 'slats' }, def: 'walls', prio: 1 },
    { re: /^laminate$/, map: { floor: 'laminate' }, def: 'floor', prio: 1 },
    { re: /^parquet$/, map: { floor: 'parquet' }, def: 'floor', prio: 1 },
    { re: /^(?:herringbone|chevron)$/, map: { floor: 'herringbone' }, def: 'floor', prio: 2 },
    { re: /^(?:engineered|solid)$/, map: { floor: 'engineered', door: 'door-solid' }, def: 'floor', prio: 1 },
    { re: /^(?:vinyl|spc|lvt)$/, map: { floor: 'spc' }, def: 'floor', prio: 1 },
    { re: /^(?:tile|tiles|tiled|porcelain|ceramic)$/, map: { floor: 'tile' }, def: 'floor', prio: 1 },
    { re: /^(?:marble|stone|travertine)$/, map: { floor: 'marble' }, def: 'floor', prio: 1 },
    { re: /^(?:carpet|carpeted)$/, map: { floor: 'carpet' }, def: 'floor', prio: 1 },
    { re: /^(?:gloss|glossy|shiny|mirror)$/, map: { ceiling: 'gloss' }, def: 'ceiling', prio: 1 },
    { re: /^whitewash(?:ed)?$/, map: { ceiling: 'paint' }, def: 'ceiling', prio: 1 },
    { re: /^(?:stretch|suspended)$/, map: { ceiling: 'matt' }, def: 'ceiling', prio: 0 },
    { re: /^(?:pvc|plastic)$/, map: { skirting: 'pvc' }, def: 'skirting', prio: 1 },
    { re: /^mdf$/, map: { skirting: 'mdf' }, def: 'skirting', prio: 1 },
    { re: /^(?:wooden|wood)$/, map: { skirting: 'wood', wall: 'slats', floor: 'parquet', door: 'door-veneer' }, def: 'skirting', prio: 0.5 }, // an adjective: a noun such as "slats" wins
    { re: /^(?:alumin(?:i)?um|shadow)$/, map: { skirting: 'alu' }, def: 'skirting', prio: 1 },
    { re: /^(?:veneer|veneered|flush)$/, map: { door: 'door-veneer' }, def: 'door', prio: 1 },
    { re: /^(?:panel|panels|panelled|paneled|panelling)$/, map: { door: 'door-solid' }, def: 'door', prio: 1 },
    { re: /^(?:steel|metal|metallic|armoured|armored|entrance|security)$/, map: { door: 'door-steel' }, def: 'door', prio: 1 }
  ];

  var WALLPAPER = MAT_WORDS.filter(function (e) { return e.map.wall === 'wp-plain'; })[0]; // the entry for the word "wallpaper"

  // ---- Ready-made designs ------------------------------------------------------
  var PRESET_WORDS = [
    { key: 'scandi', re: /^scandi/ },
    { key: 'living', re: /^(?:living|lounge)$/ },
    { key: 'loft', re: /^loft$/ },
    { key: 'classic', re: /^classic/ },
    { key: 'minimal', re: /^minimal/ },
    { key: 'cosy', re: /^(?:cosy|cozy)$/ },
    { key: 'luxe', re: /^(?:luxe|luxury|luxurious)$/ }
  ];

  // ---- Single-word commands ----------------------------------------------------
  var ACTION_WORDS = [
    { type: 'summary', re: /^(?:summary|total|done|finish|price|cost|costs|show|result|results|estimate|quote|checkout|much)$/ },
    { type: 'room', re: /^(?:back|return|room)$/ },
    { type: 'reset', re: /^(?:reset|restart|again|over)$/ },
    { type: 'random', re: /^(?:random|randomise|randomize|surprise|shuffle)$/ },
    { type: 'before', re: /^(?:before|raw|rough|unfinished|original)$/ },
    { type: 'after', re: /^(?:after|renovated|finished)$/ },
    { type: 'light-day', re: /^(?:day|daytime|daylight|morning|noon)$/ },
    { type: 'light-evening', re: /^(?:evening|night|dusk|sunset|lamp|bulb)$/ },
    { type: 'view-city', re: /^(?:city|town|skyline|downtown|urban)$/ },
    { type: 'view-sea', re: /^(?:sea|ocean|caspian|beach|seaside|coast|shore)$/ },
    { type: 'view-garden', re: /^(?:garden|trees|blossom|orchard)$/ }
  ];
  var CLEAR_WORDS = /^(?:no|without|remove|cancel|none)$/;

  // ---- Rooms (walking) and furniture ---------------------------------------------
  // "living" alone is a design name (the "Living room" design), so a room is only chosen by it when the
  // phrase contains a verb such as "go to"; the other room names work alone ("kitchen").
  var ROOM_WORDS = [
    { id: 'hall', re: /\b(?:hall|hallway|corridor|entrance|entry|foyer)\b/ },
    { id: 'living', re: /\b(?:living|lounge)\b/ },
    { id: 'kitchen', re: /\bkitchen\b/ },
    { id: 'bedroom', re: /\b(?:bedroom|bed room)\b/ },
    { id: 'bath', re: /\b(?:bathroom|bath|toilet|shower)\b/ }
  ];
  var GO_WORDS = /\b(?:go|walk|move|take|enter|visit|head|navigate|teleport|bring (?:me|us))\b/;
  var FURNITURE_WORD = /\b(?:furniture|furnishings?)\b/;
  var REMOVE_VERBS = /\b(?:remove|delete|hide|clear|without|empty|off|no)\b/;
  // Words for pieces of furniture; "remove the floor lamp" is furniture even though "floor" is also a finish.
  var FURNITURE_NOUNS = /\b(?:sofa|couch|armchair|chair|chairs|stool|bench|table|desk|lamp|lamps|pendant|chandelier|rug|carpet|runner|mat|bed|nightstand|bedside|wardrobe|closet|fridge|refrigerator|oven|stove|cooker|hood|mirror|painting|picture|plant|plants|cabinet|console|toilet|shower|vanity|washer|washing machine|towels?|kitchen units?|cupboards?|air conditioner|ac)\b/;
  var SHOW_VERBS = /\b(?:show|bring|restore|put|add|return|with|on|back)\b/;

  function matchRoom(norm) {
    var hit = null;
    ROOM_WORDS.forEach(function (r) { if (r.re.test(norm)) hit = r.id; });
    if (!hit) return null;
    if (/\b(?:remove|delete|hide|restore|put back|bring back|take away|get rid)\b/.test(norm)) return null; // "remove toilet" is about furniture
    var words = norm.split(' ');
    if (GO_WORDS.test(norm) || (words.length <= 2 && hit !== 'living')) return hit;
    return null;
  }

  // "remove the sofa" -> { type: 'remove-item', text: 'sofa' }; "remove furniture" -> furniture-off
  function matchFurniture(norm, hasFinishWord) {
    if (/\bempty\b.*\b(?:room|apartment|flat)\b/.test(norm) || (FURNITURE_WORD.test(norm) && REMOVE_VERBS.test(norm))) {
      return { type: 'furniture-off' };
    }
    if (FURNITURE_WORD.test(norm) && SHOW_VERBS.test(norm)) return { type: 'furniture-on' };
    var r = /\b(?:restore|bring back|put back)\s+(?:the\s+|a\s+|my\s+)?(.+)$/.exec(norm);
    if (r) return { type: 'restore-item', text: r[1] };
    var m = /\b(?:remove|delete|hide|take away|get rid of)\s+(?:the\s+|a\s+|my\s+)?(.+)$/.exec(norm);
    if (m && (FURNITURE_NOUNS.test(m[1]) || !hasFinishWord(m[1]))) return { type: 'remove-item', text: m[1] };
    return null;
  }

  // ---- Helpers --------------------------------------------------------------
  function normalise(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\bliving room\b/g, 'living') // "living room" is the design name, not the word "room"
      .trim();
  }

  // A colour word pattern -> regular expression (see catalog.js for the "*" convention).
  var wordCache = {};
  function wordRe(w) {
    if (!wordCache[w]) {
      wordCache[w] = w.charAt(w.length - 1) === '*'
        ? new RegExp('^' + w.slice(0, -1))
        : new RegExp('^' + w + '(?:s|ish)?$');
    }
    return wordCache[w];
  }

  // Every colour word root that exists in any palette.
  var ALL_COLOUR_WORDS = (function () {
    var seen = {};
    Object.keys(Catalog.DB).forEach(function (k) {
      Catalog.DB[k].words.forEach(function (w) { seen[w] = true; });
    });
    return Object.keys(seen);
  })();

  function isColourToken(token) {
    for (var i = 0; i < ALL_COLOUR_WORDS.length; i++) {
      if (wordRe(ALL_COLOUR_WORDS[i]).test(token)) return true;
    }
    return false;
  }

  /**
   * Best colour of a palette for the spoken tokens. A colour scores +1 for every word of its name
   * that was spoken and -0.5 for every word that was not, so "grey" prefers "Grey" over
   * "Light grey". Ties go to the colour that comes first in the palette.
   */
  function bestColour(palette, tokens) {
    var best = null;
    palette.forEach(function (c, idx) {
      var matched = 0;
      c.words.forEach(function (w) {
        var re = wordRe(w);
        if (tokens.some(function (t) { return re.test(t); })) matched++;
      });
      if (!matched) return;
      var score = matched - 0.5 * (c.words.length - matched);
      if (!best || score > best.score) best = { colour: c, score: score, idx: idx };
    });
    return best ? best.colour : null;
  }

  function group(surface) {
    return surface === 'walls' || surface === 'accent' ? 'wall' : surface;
  }

  // ---- Parser ---------------------------------------------------------------
  /**
   * parse(text, ctx) -> { heard, actions, problems }
   *   ctx (optional) describes the current state:
   *     { selected: 'walls'|null, current: { walls: {m,c}|null, ... } }
   *   actions:
   *     {type:'set', surface, material, colour}   (always fully resolved)
   *     {type:'select', surface}   {type:'clear', surface:'accent'}   {type:'preset', key}
   *     {type:'summary'|'room'|'reset'|'random'|'before'|'after'|'light-day'|'light-evening'|'view-city'|'view-sea'|'view-garden'}
   *     {type:'goto', room}  {type:'furniture-on'|'furniture-off'}  {type:'remove-item'|'restore-item', text}
   *   problems: strings that explain what could not be applied.
   */
  function parse(text, ctx) {
    ctx = ctx || {};
    var current = ctx.current || {};
    var heard = String(text || '').trim();
    var norm = normalise(heard);
    var tokens = norm.split(' ').filter(Boolean);
    var actions = [];
    var problems = [];

    // walking and furniture are checked first; they never mix with finishes
    var room = matchRoom(norm);
    if (room) return { heard: heard, actions: [{ type: 'goto', room: room }], problems: [] };
    var furn = matchFurniture(norm, function (text) {
      return text.split(' ').some(function (t) {
        return SURFACE_WORDS.some(function (sw) { return sw.re.test(t); }) ||
          MAT_WORDS.some(function (mw) { return mw.re.test(t); }) || isColourToken(t);
      });
    });
    if (furn) return { heard: heard, actions: [furn], problems: [] };

    var surfaces = []; // { key, idx, mats: [{entry, idx, token}], cols: [{token, idx}] }
    var mats = [];
    var cols = [];
    var clear = false;
    var order = []; // kinds of content tokens in the order they were spoken

    function addAction(type, extra) {
      if (!actions.some(function (a) { return a.type === type; })) {
        var a = { type: type };
        if (extra) Object.keys(extra).forEach(function (k) { a[k] = extra[k]; });
        actions.push(a);
      }
    }

    var prevWasAccent = false;
    for (var i = 0; i < tokens.length; i++) {
      var tok = tokens[i];
      var matched = false;

      // surface words
      for (var s = 0; s < SURFACE_WORDS.length; s++) {
        if (!SURFACE_WORDS[s].re.test(tok)) continue;
        var key = SURFACE_WORDS[s].key;
        var isWallpaper = /^wallpapers?$/.test(tok); // "wallpaper" is a surface and a material at once
        matched = true;
        // "accent wall", "accent wallpaper": this word is the same surface, not a new one.
        // "accent wall striped blue wallpaper": the word "wallpaper" after an accent wall is a material.
        var lastSurface = surfaces.length ? surfaces[surfaces.length - 1].key : null;
        if (key === 'walls' && (prevWasAccent || (isWallpaper && lastSurface === 'accent'))) {
          if (isWallpaper) mats.push({ entry: WALLPAPER, idx: i, token: tok });
          prevWasAccent = false;
          break;
        }
        surfaces.push({ key: key, idx: i, mats: [], cols: [] });
        order.push('surface');
        prevWasAccent = key === 'accent';
        if (isWallpaper) mats.push({ entry: WALLPAPER, idx: i, token: tok });
        break;
      }
      if (matched) continue;
      prevWasAccent = false;

      var presetHit = null;
      for (var p = 0; p < PRESET_WORDS.length; p++) if (PRESET_WORDS[p].re.test(tok)) presetHit = PRESET_WORDS[p].key;
      if (presetHit) { addAction('preset', { key: presetHit }); continue; }

      var matEntry = null;
      for (var m = 0; m < MAT_WORDS.length; m++) if (MAT_WORDS[m].re.test(tok)) { matEntry = MAT_WORDS[m]; break; }
      if (matEntry) { mats.push({ entry: matEntry, idx: i, token: tok }); order.push('mat'); continue; }

      if (isColourToken(tok)) { cols.push({ token: tok, idx: i }); order.push('col'); continue; }

      if (CLEAR_WORDS.test(tok)) { clear = true; continue; }

      for (var a = 0; a < ACTION_WORDS.length; a++) {
        if (ACTION_WORDS[a].re.test(tok)) { addAction(ACTION_WORDS[a].type); break; }
      }
    }

    // "show before", "show the sea": the word "show" must not also open the summary
    if (actions.some(function (a) { return a.type === 'before' || a.type === 'after' || a.type.indexOf('view-') === 0; })) {
      actions = actions.filter(function (a) { return a.type !== 'summary'; });
    }

    // Without a surface word: a material word names its surface; a lone colour goes to the selected one.
    if (!surfaces.length && (mats.length || cols.length)) {
      var implicit = null;
      if (mats.length) {
        // the most specific material word names the surface ("wooden slats" -> walls)
        var top = mats[0];
        mats.forEach(function (x) { if (x.entry.prio >= top.entry.prio) top = x; });
        implicit = top.entry.def;
      }
      else implicit = ctx.selected || null;
      if (implicit) surfaces.push({ key: implicit, idx: -1, mats: [], cols: [], implicit: true });
      else problems.push('First choose what to change: walls, floor, ceiling, skirting board or door.');
    }

    // Who owns a word? "walls blue floor dark oak" (surface first): words belong to the surface
    // before them. "blue walls dark oak floor" (word first): words belong to the surface after them.
    var postfix = order.length === 0 || order[0] === 'surface' || surfaces.length === 1;
    function ownerOf(idx) {
      if (!surfaces.length) return null;
      var k;
      if (postfix) {
        var owner = surfaces[0];
        for (k = 0; k < surfaces.length; k++) if (surfaces[k].idx <= idx) owner = surfaces[k];
        return owner;
      }
      for (k = 0; k < surfaces.length; k++) if (surfaces[k].idx >= idx) return surfaces[k];
      return surfaces[surfaces.length - 1];
    }
    mats.forEach(function (x) { var o = ownerOf(x.idx); if (o) o.mats.push(x); });
    cols.forEach(function (x) { var o = ownerOf(x.idx); if (o) o.cols.push(x); });

    var out = [];
    surfaces.forEach(function (sf) {
      var name = Catalog.SURFACE_LABEL[sf.key].toLowerCase();

      if (sf.key === 'accent' && clear && !sf.mats.length && !sf.cols.length) {
        out.push({ type: 'clear', surface: 'accent' });
        return;
      }
      if (!sf.mats.length && !sf.cols.length) {
        out.push({ type: 'select', surface: sf.key });
        return;
      }

      // 1) material
      var cur = current[sf.key] || null;
      var best = null;
      var wrong = [];
      sf.mats.forEach(function (x) {
        var key = x.entry.map[group(sf.key)];
        if (!key) { wrong.push(x.token); return; }
        if (!best || x.entry.prio > best.prio) best = { key: key, prio: x.entry.prio };
      });
      if (wrong.length && !best) {
        problems.push('"' + wrong[0] + '" does not suit the ' + name + '.');
        if (!sf.cols.length) return; // nothing valid to apply
      }
      var materialKey = best ? best.key : (cur && Catalog.material(sf.key, cur.m) ? cur.m : Catalog.DEFAULT_MATERIAL[sf.key]);

      // 2) colour, searched in the palette of that material
      var pal = Catalog.palette(sf.key, materialKey);
      var colourKey = null;
      var colourFailed = false;
      if (sf.cols.length) {
        var found = bestColour(pal, sf.cols.map(function (c) { return c.token; }));
        if (found) colourKey = found.key;
        else {
          colourFailed = true;
          problems.push('There is no such colour for the ' + name + ' (' + Catalog.material(sf.key, materialKey).label.toLowerCase() + ').');
        }
      }
      if (!colourKey) {
        // keep the current colour when it exists in the new palette, else the first colour
        colourKey = cur && Catalog.colourInPalette(sf.key, materialKey, cur.c) ? cur.c : pal[0].key;
      }
      // A colour that does not exist and no new material: nothing to apply.
      if (colourFailed && !best) return;
      out.push({ type: 'set', surface: sf.key, material: materialKey, colour: colourKey });
    });

    return { heard: heard, actions: out.concat(actions), problems: problems };
  }

  var api = { parse: parse, normalise: normalise, isColourToken: isColourToken, bestColour: bestColour };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Commands = api;
})(typeof window !== 'undefined' ? window : this);
