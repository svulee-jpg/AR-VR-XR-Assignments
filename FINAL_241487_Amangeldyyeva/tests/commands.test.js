/*
 * Tests for the catalogue and the voice-command parser.
 * Run: node tests/commands.test.js   (uses only Node's built-in assert, nothing to install)
 */
'use strict';
const assert = require('assert');
const Catalog = require('../js/catalog.js');
const C = require('../js/commands.js');

let passed = 0;

// Compact text form of the actions, e.g. "set:walls:paint:skyblue".
function show(a) {
  if (a.type === 'set') return `set:${a.surface}:${a.material}:${a.colour}`;
  if (a.type === 'select' || a.type === 'clear') return `${a.type}:${a.surface}`;
  if (a.type === 'preset') return `preset:${a.key}`;
  return a.type;
}
function check(phrase, expected, ctx, note) {
  const r = C.parse(phrase, ctx);
  const got = r.actions.map(show);
  assert.deepStrictEqual(got, expected, `"${phrase}" -> ${JSON.stringify(got)} (expected ${JSON.stringify(expected)})${note ? ' [' + note + ']' : ''}`);
  passed++;
}
function problems(phrase, count, ctx) {
  const r = C.parse(phrase, ctx);
  assert.strictEqual(r.problems.length, count, `"${phrase}" problems: ${JSON.stringify(r.problems)}`);
  passed++;
}

// ---- Colour only: the material stays or defaults ---------------------------------
check('walls sky blue', ['set:walls:paint:skyblue']);
check('Walls blue.', ['set:walls:paint:blue'], null, 'capital letter and full stop');
check('floor dark', ['set:floor:laminate:dark-oak']);
check('paint the floor dark', ['set:floor:laminate:dark-oak']);
check('blue walls', ['set:walls:paint:blue'], null, 'colour before surface');
check('make the walls green', ['set:walls:paint:green']);
check('walls grey', ['set:walls:paint:grey'], null, '"grey" prefers the plain grey');
check('walls gray', ['set:walls:paint:grey'], null, 'US spelling (Chrome returns "gray")');
check('walls light grey', ['set:walls:paint:grey-l']);
check('walls dark gray', ['set:walls:paint:grey-d']);
check('walls graphite', ['set:walls:paint:graphite']);
check('walls sage green', ['set:walls:paint:sage'], null, 'the more specific colour wins');
check('walls green', ['set:walls:paint:green']);
check('walls light blue', ['set:walls:paint:blue-l']);
check('floor light', ['set:floor:laminate:light-oak']);
check('floor walnut', ['set:floor:laminate:walnut']);
check('floor dark walnut', ['set:floor:laminate:dark-walnut']);
check('walls beige', ['set:walls:paint:beige']);

// ---- Material (+ colour) ------------------------------------------------------
check('walls brick red', ['set:walls:brick:brk-red']);
check('walls red brick', ['set:walls:brick:brk-red']);
check('brick', ['set:walls:brick:brk-red'], null, 'material word names its surface');
check('white brick walls', ['set:walls:brick:brk-white']);
check('floor herringbone dark walnut', ['set:floor:herringbone:dark-walnut']);
check('herringbone parquet', ['set:floor:herringbone:oak'], null, 'herringbone wins over parquet');
check('floor laminate light oak', ['set:floor:laminate:light-oak']);
check('floor porcelain tile light grey', ['set:floor:tile:grey-l']);
check('floor marble black', ['set:floor:marble:black']);
check('floor carpet blue', ['set:floor:carpet:blue']);
check('microcement grey', ['set:walls:microcement:grey']);
check('concrete', ['set:floor:concrete:milk'], null, '"concrete" alone means the floor');
check('walls concrete', ['set:walls:microcement:white']);
check('wooden slats walnut', ['set:walls:slats:walnut']);
check('striped wallpaper blue', ['set:walls:wp-stripe:blue']);
check('wallpaper', ['set:walls:wp-plain:white']);
check('textured paint sand', ['set:walls:textured:sand']);
check('walls plaster cream', ['set:walls:plaster:cream']);

// ---- Door ---------------------------------------------------------------------
check('steel door black', ['set:door:door-steel:black']);
check('wooden door walnut', ['set:door:door-veneer:walnut']);
check('panelled door walnut', ['set:door:door-solid:walnut']);
check('door white', ['set:door:door-paint:white']);
check('accent wall wide horizontal stripe wallpaper brown', ['set:accent:wp-hstripe:brown']);

// ---- Ceiling, skirting, accent wall ---------------------------------------------
check('ceiling glossy white', ['set:ceiling:gloss:white']);
check('ceiling matt grey', ['set:ceiling:matt:grey']);
check('matt black ceiling', ['set:ceiling:matt:black']);
check('ceiling', ['select:ceiling']);
check('skirting black', ['set:skirting:mdf:black']);
check('aluminium skirting white', ['set:skirting:alu:white']);
check('accent wall brick', ['set:accent:brick:brk-red']);
check('accent wall striped blue wallpaper', ['set:accent:wp-stripe:blue'], null, '"wallpaper" after an accent wall is a material');
check('accent wallpaper striped blue', ['set:accent:wp-stripe:blue']);
check('accent wall wooden slats', ['set:accent:slats:oak']);
check('no accent', ['clear:accent']);
check('without accent wall', ['clear:accent']);

// ---- Several surfaces in one phrase ---------------------------------------------
check('walls white floor dark', ['set:walls:paint:white', 'set:floor:laminate:dark-oak']);
check('floor dark walls blue', ['set:floor:laminate:dark-oak', 'set:walls:paint:blue']);
check('blue walls dark floor', ['set:walls:paint:blue', 'set:floor:laminate:dark-oak'], null, 'colour before surface twice');
check('red brick walls and dark oak floor', ['set:walls:brick:brk-red', 'set:floor:laminate:dark-oak']);
check('walls brick red floor laminate light oak', ['set:walls:brick:brk-red', 'set:floor:laminate:light-oak']);

// ---- Context: the current choice and the selected surface -------------------------
const ctx = { selected: 'floor', current: { floor: { m: 'tile', c: 'grey' }, walls: { m: 'brick', c: 'brk-red' } } };
check('light', ['set:floor:tile:grey-l'], ctx, 'a lone colour goes to the selected surface, keeps the material');
check('black', ['set:floor:tile:black'], ctx);
check('walls white', ['set:walls:brick:brk-white'], ctx, 'keeps the brick material');
check('walls paint white', ['set:walls:paint:white'], ctx);
check('herringbone', ['set:floor:herringbone:oak'], ctx, 'colour not in the new palette -> first colour');
check('light', [], { selected: null, current: {} }, 'no surface selected');
problems('light', 1, { selected: null, current: {} });

// ---- Surface only / presets / actions ----------------------------------------------
check('walls', ['select:walls']);
check('floor', ['select:floor']);
check('loft design', ['preset:loft']);
check('scandinavian', ['preset:scandi']);
check('classic style', ['preset:classic']);
check('cozy', ['preset:cosy'], null, 'US spelling');
check('dark luxe', ['preset:luxe']);
check('show summary', ['summary'], null, 'two trigger words, one action');
check('how much does it cost', ['summary']);
check('done', ['summary']);
check('back', ['room']);
check('reset', ['reset']);
check('random', ['random']);
check('before', ['before']);
check('show before', ['before'], null, '"show" must not open the summary');
check('after', ['after']);
check('evening', ['light-evening']);
check('day', ['light-day']);
check('hello there', [], null, 'not a command');

// ---- Things that do not exist -------------------------------------------------------
problems('floor blue', 1); // no blue laminate
check('floor blue', []);
problems('floor brick', 1); // brick is a wall material
check('floor brick', []);
problems('how are you', 0);
check('how are you', []);
check('', []);
check('flooded', [], null, '"flooded" is not "floor"');
check('walled', [], null, '"walled" is not "wall"');

// ---- Catalogue sanity -----------------------------------------------------------------
// Every colour key is unique, every hex is valid, every palette is not empty.
const keys = Object.keys(Catalog.DB);
keys.forEach(k => {
  assert.ok(/^#[0-9a-f]{6}$/i.test(Catalog.DB[k].hex), `bad hex ${k}`);
  assert.ok(Catalog.DB[k].words.length > 0, `no words for ${k}`);
});
passed++;
Object.keys(Catalog.PALETTES).forEach(p => assert.ok(Catalog.PALETTES[p].length > 0, `empty palette ${p}`));
passed++;
// Every material points to an existing palette and has a price.
Catalog.SURFACES.forEach(s => Catalog.materials(s).forEach(m => {
  assert.ok(Catalog.PALETTES[m.palette], `${s}/${m.key}: no palette`);
  assert.ok(m.price > 0, `${s}/${m.key}: no price`);
}));
passed++;
// Material keys are unique inside a surface.
Catalog.SURFACES.forEach(s => {
  const mk = Catalog.materials(s).map(m => m.key);
  assert.strictEqual(new Set(mk).size, mk.length, `duplicate material in ${s}`);
});
passed++;
// Ready-made designs only use real materials and colours; the code survives a round trip.
Catalog.PRESETS.forEach(p => {
  const ch = Catalog.presetChoice(p.key);
  Catalog.SURFACES.forEach(s => { if (ch[s]) assert.ok(Catalog.validChoice(s, ch[s]), `${p.key}/${s}`); });
  assert.deepStrictEqual(Catalog.decode(Catalog.encode(ch)), ch, `round trip ${p.key}`);
  assert.ok(Catalog.price(ch).total > 0);
});
passed++;
// Random variants are valid and survive the code round trip too.
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
for (let i = 0; i < 200; i++) {
  const ch = Catalog.randomChoice(rnd);
  Catalog.SURFACES.forEach(s => { if (ch[s]) assert.ok(Catalog.validChoice(s, ch[s])); });
  assert.deepStrictEqual(Catalog.decode(Catalog.encode(ch)), ch);
}
passed++;
assert.strictEqual(Catalog.decode('garbage'), null);
assert.strictEqual(Catalog.decode('9.9-x-x-x-x'), null);   // old 5-part codes are no longer valid
assert.strictEqual(Catalog.SURFACES.length, 6);
passed += 3;
// Product goal: at least 50 000 variants.
assert.ok(Catalog.countVariants() >= 50000, 'fewer than 50 000 variants');
passed++;
// Price: nothing chosen costs nothing; the accent wall follows the walls when it is not set.
assert.strictEqual(Catalog.price(Catalog.emptyChoice()).total, 0);
const onlyWalls = Catalog.emptyChoice();
onlyWalls.walls = { m: 'paint', c: 'white' };
const wallsPrice = Math.round(2800 * Catalog.AREAS.walls) + Math.round(2800 * Catalog.AREAS.accent);
assert.strictEqual(Catalog.price(onlyWalls).total, wallsPrice);
const withDoor = Catalog.emptyChoice();
withDoor.door = { m: 'door-solid', c: 'oak' };
assert.strictEqual(Catalog.price(withDoor).total, Math.round(38000 * Catalog.AREAS.door));
passed += 3;

console.log(`OK: ${passed} checks passed; ${Catalog.fmt(Catalog.countVariants())} variants in the catalogue`);
