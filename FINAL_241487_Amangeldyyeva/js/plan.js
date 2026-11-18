/*
 * plan.js
 * The floor plan of the demo apartment "Aurora Residence, Block B, Apartment 128":
 * five rooms, the openings between them, the windows, where a visitor may walk,
 * and the areas that the price is based on.
 *
 * Pure data and functions (no A-Frame, no browser), so Node can load it for the tests and the
 * browser exposes it as the global `Plan`. The 3D walls, floors, doors and windows are built from
 * this data by js/apartment.js, so the picture and the price always agree.
 *
 * Top view (x to the right, z towards the viewer, metres; every number is the CLEAR inner size):
 *
 *   z=-3.5  +-----------------------+-------------------------+
 *           |        LIVING         |         KITCHEN         |
 *           |  window (west)        |  window (north)         |
 *   z= 0.5  +--------+--+-----------+-------------------------+
 *           | BEDROOM | HALL        | BATHROOM                |
 *           | window  | entrance    |                         |
 *   z= 4.5  +---------+-------------+-------------------------+
 *         x=-2.5    1.3 1.4        3.4 3.5                   6.5
 *
 * Interior walls are 0.1 m thick: each room has its own wall faces, and the gap between two faces
 * is closed at every opening by a small "reveal" (jambs and lintel).
 */
(function (root) {
  'use strict';

  var H = 2.7; // room height
  // One arched window: frame 1.4 m wide, sill at 0.97 m, straight part up to 1.9 m, half circle on top.
  var WIN_AREA = 1.4 * (1.9 - 0.97) + Math.PI * 0.7 * 0.7 / 2;

  // ---------------------------------------------------------------------------
  // Rooms (inner rectangles). `lamp` = where the ceiling light of the room hangs.
  // ---------------------------------------------------------------------------
  var ROOMS = [
    { id: 'hall', name: 'Hallway', x0: 1.4, x1: 3.4, z0: 0.6, z1: 4.5, spawn: { x: 2.4, z: 3.6, yaw: 0 }, lamp: [2.4, 2.2, 2.55] },
    { id: 'living', name: 'Living room', x0: -2.5, x1: 2.5, z0: -3.5, z1: 0.5, spawn: { x: -0.55, z: -0.1, yaw: 0 }, lamp: [1.5, 2.1, -1.5] },
    { id: 'kitchen', name: 'Kitchen', x0: 2.6, x1: 6.5, z0: -3.5, z1: 0.5, spawn: { x: 3.2, z: -0.2, yaw: -80 }, lamp: [4.25, 2.1, -1.45] },
    { id: 'bedroom', name: 'Bedroom', x0: -2.5, x1: 1.3, z0: 0.6, z1: 4.5, spawn: { x: 0.7, z: 2.5, yaw: 90 }, lamp: [-0.8, 2.2, 2.55] },
    { id: 'bath', name: 'Bathroom', x0: 3.5, x1: 6.5, z0: 0.6, z1: 4.5, spawn: { x: 4.1, z: 2.5, yaw: -90 }, lamp: [5.0, 2.3, 2.55] }
  ];

  // ---------------------------------------------------------------------------
  // Openings in the interior walls.
  //   axis  : direction of the wall (the opening is measured along it): 'x' or 'z'
  //   c, w  : centre and width along the wall;  h : height of the opening
  //   band  : the thickness of the wall, as coordinates across the wall
  //   faces : the two wall faces that are cut ("room.side": N, S, W, E = the side of the room)
  //   swing : doors only: the room the leaf opens into, and which jamb carries the hinge (-1 = low coordinate)
  // ---------------------------------------------------------------------------
  var OPENINGS = [
    { id: 'arch-living-kitchen', kind: 'arch', axis: 'z', c: -0.75, w: 1.6, h: 2.3, band: [2.5, 2.6], faces: ['living.E', 'kitchen.W'] },
    { id: 'door-living-hall', kind: 'door', axis: 'x', c: 1.95, w: 0.9, h: 2.1, band: [0.5, 0.6], faces: ['living.S', 'hall.N'], swing: { room: 'hall', hinge: -1 } },
    { id: 'door-bedroom-hall', kind: 'door', axis: 'z', c: 2.5, w: 0.9, h: 2.1, band: [1.3, 1.4], faces: ['bedroom.E', 'hall.W'], swing: { room: 'bedroom', hinge: -1 } },
    { id: 'door-hall-bath', kind: 'door', axis: 'z', c: 2.5, w: 0.9, h: 2.1, band: [3.4, 3.5], faces: ['hall.E', 'bath.W'], swing: { room: 'bath', hinge: -1 } }
  ];

  // The front door of the apartment: a closed door in the south wall of the hallway.
  var ENTRANCE = { room: 'hall', side: 'S', c: 2.4, w: 0.9, h: 2.1 };

  // Arched windows (js/windowview.js). pos/rot = position and rotation of the window entity; the
  // entity's local +Z points into the room.
  var WINDOWS = [
    { id: 'win-living', room: 'living', pos: [-2.5, 0, -0.9], rot: [0, 90, 0], radiator: true, curtains: true },
    { id: 'win-kitchen', room: 'kitchen', pos: [4.55, 0, -3.5], rot: [0, 0, 0], radiator: false, curtains: false },
    { id: 'win-bedroom', room: 'bedroom', pos: [-0.6, 0, 4.5], rot: [0, 180, 0], radiator: true, curtains: true }
  ];

  // ---------------------------------------------------------------------------
  // Wall faces and their pieces
  // ---------------------------------------------------------------------------
  function faceOf(room, side) {
    switch (side) {
      case 'N': return { fixed: room.z0, axis: 'x', a0: room.x0, a1: room.x1, nx: 0, nz: 1, rot: 0 };
      case 'S': return { fixed: room.z1, axis: 'x', a0: room.x0, a1: room.x1, nx: 0, nz: -1, rot: 180 };
      case 'W': return { fixed: room.x0, axis: 'z', a0: room.z0, a1: room.z1, nx: 1, nz: 0, rot: 90 };
      default: return { fixed: room.x1, axis: 'z', a0: room.z0, a1: room.z1, nx: -1, nz: 0, rot: -90 };
    }
  }

  // Which finish a wall face gets: 'accent' (feature walls), 'walls', or null (fixed tiles in the bathroom).
  function surfaceFor(room, side) {
    if (room.id === 'bath') return null;
    if (room.id === 'living' && side === 'N') return 'accent';
    if (room.id === 'bedroom' && side === 'W') return 'accent';
    return 'walls';
  }

  function piecesOf(face, opens) {
    var out = [];
    var cur = face.a0;
    opens.slice().sort(function (p, q) { return p.c - q.c; }).forEach(function (o) {
      var o0 = o.c - o.w / 2, o1 = o.c + o.w / 2;
      if (o0 > cur + 1e-6) out.push({ a0: cur, a1: o0, y0: 0, y1: H, base: true });
      out.push({ a0: o0, a1: o1, y0: o.h, y1: H, base: false }); // the wall above the opening
      cur = o1;
    });
    if (face.a1 > cur + 1e-6) out.push({ a0: cur, a1: face.a1, y0: 0, y1: H, base: true });
    return out;
  }

  function buildFaces() {
    var faces = [];
    ROOMS.forEach(function (room) {
      ['N', 'S', 'W', 'E'].forEach(function (side) {
        var f = faceOf(room, side);
        var key = room.id + '.' + side;
        var opens = OPENINGS.filter(function (o) { return o.faces.indexOf(key) >= 0; });
        f.room = room.id;
        f.side = side;
        f.surface = surfaceFor(room, side);
        f.pieces = piecesOf(f, opens);
        faces.push(f);
      });
    });
    return faces;
  }
  var FACES = buildFaces();

  function round2(v) { return Math.round(v * 100) / 100; }

  // Areas used for the price (see Catalog.AREAS).
  function areas() {
    var a = { walls: 0, accent: 0, floor: 0, ceiling: 0, skirting: 0, door: 0 };
    FACES.forEach(function (f) {
      if (!f.surface) return;
      f.pieces.forEach(function (p) {
        a[f.surface] += (p.a1 - p.a0) * (p.y1 - p.y0);
        if (p.base) a.skirting += p.a1 - p.a0;
      });
    });
    WINDOWS.forEach(function (w) { a.walls -= WIN_AREA; }); // windows are not painted
    ROOMS.forEach(function (r) {
      var s = (r.x1 - r.x0) * (r.z1 - r.z0);
      if (r.id !== 'bath') a.floor += s; // the bathroom floor is fixed tile
      a.ceiling += s;
    });
    var doors = OPENINGS.filter(function (o) { return o.kind === 'door'; }).length; // interior doors (the front door is fixed)
    a.door = doors * 0.9 * 2.1;
    Object.keys(a).forEach(function (k) { a[k] = round2(a[k]); });
    return a;
  }

  // ---------------------------------------------------------------------------
  // Where a visitor may walk
  // ---------------------------------------------------------------------------
  var obstacles = []; // furniture footprints { x0, z0, x1, z1 }; added by the furniture sets

  function inRect(x, z, r, m) { return x >= r.x0 + m && x <= r.x1 - m && z >= r.z0 + m && z <= r.z1 - m; }

  // m = radius of the visitor; solid = also respect the furniture
  function walkable(x, z, m, solid) {
    var ok = false;
    for (var i = 0; i < ROOMS.length && !ok; i++) ok = inRect(x, z, ROOMS[i], m);
    for (var j = 0; j < OPENINGS.length && !ok; j++) {
      var o = OPENINGS[j];
      var along = o.axis === 'x' ? x : z; // position along the wall
      var across = o.axis === 'x' ? z : x; // position across the wall
      if (Math.abs(along - o.c) <= o.w / 2 - 0.2 && across >= o.band[0] - m && across <= o.band[1] + m) ok = true;
    }
    if (!ok) return false;
    if (solid) {
      for (var k = 0; k < obstacles.length; k++) {
        var b = obstacles[k];
        if (x > b.x0 - m * 0.6 && x < b.x1 + m * 0.6 && z > b.z0 - m * 0.6 && z < b.z1 + m * 0.6) return false;
      }
    }
    return true;
  }

  function roomAt(x, z) {
    for (var i = 0; i < ROOMS.length; i++) {
      var r = ROOMS[i];
      if (x >= r.x0 - 0.06 && x <= r.x1 + 0.06 && z >= r.z0 - 0.06 && z <= r.z1 + 0.06) return r;
    }
    return null;
  }

  function room(id) {
    for (var i = 0; i < ROOMS.length; i++) if (ROOMS[i].id === id) return ROOMS[i];
    return null;
  }

  var api = {
    H: H, WIN_AREA: WIN_AREA, ROOMS: ROOMS, OPENINGS: OPENINGS, ENTRANCE: ENTRANCE, WINDOWS: WINDOWS, FACES: FACES,
    obstacles: obstacles, areas: areas, walkable: walkable, roomAt: roomAt, room: room, faceOf: faceOf
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Plan = api;
})(typeof window !== 'undefined' ? window : this);
