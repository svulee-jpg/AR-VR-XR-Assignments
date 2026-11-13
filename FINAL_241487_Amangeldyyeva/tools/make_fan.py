#!/usr/bin/env python3
"""
make_fan.py - builds models/fan.glb, a small ceiling fan with an animated rotor.

This is the project's own model (no third-party asset, no licence problems).
It needs only the Python standard library. Run:   python3 tools/make_fan.py

What the file contains
  * Node tree:  Fan -> Mount, Rod, Motor, Blades -> (Hub, Blade1..Blade4)
  * One animation named "Spin": the node "Blades" turns 360 degrees around the
    Y axis in 1.2 s; the loop is seamless. The scene plays it with the
    animation-mixer component (aframe-extras).
  * The model hangs down from the origin (0, 0, 0), so placing the entity on the
    ceiling is enough.
"""
import json
import math
import os
import struct

# ----------------------------------------------------------------------------
# Geometry helpers: each returns (positions, normals, indices), centred on (0,0,0)
# ----------------------------------------------------------------------------

def box(sx, sy, sz):
    hx, hy, hz = sx / 2, sy / 2, sz / 2
    faces = [
        # normal, four corners (counter-clockwise seen from outside)
        ((0, 0, 1), [(-hx, -hy, hz), (hx, -hy, hz), (hx, hy, hz), (-hx, hy, hz)]),
        ((0, 0, -1), [(hx, -hy, -hz), (-hx, -hy, -hz), (-hx, hy, -hz), (hx, hy, -hz)]),
        ((1, 0, 0), [(hx, -hy, hz), (hx, -hy, -hz), (hx, hy, -hz), (hx, hy, hz)]),
        ((-1, 0, 0), [(-hx, -hy, -hz), (-hx, -hy, hz), (-hx, hy, hz), (-hx, hy, -hz)]),
        ((0, 1, 0), [(-hx, hy, hz), (hx, hy, hz), (hx, hy, -hz), (-hx, hy, -hz)]),
        ((0, -1, 0), [(-hx, -hy, -hz), (hx, -hy, -hz), (hx, -hy, hz), (-hx, -hy, hz)]),
    ]
    pos, nor, idx = [], [], []
    for normal, corners in faces:
        base = len(pos)
        for c in corners:
            pos.append(c)
            nor.append(normal)
        idx += [base, base + 1, base + 2, base, base + 2, base + 3]
    return pos, nor, idx


def cylinder(radius, height, segments=24):
    hh = height / 2
    pos, nor, idx = [], [], []
    # side
    for i in range(segments + 1):
        a = 2 * math.pi * i / segments
        x, z = math.cos(a) * radius, math.sin(a) * radius
        n = (math.cos(a), 0, math.sin(a))
        pos += [(x, -hh, z), (x, hh, z)]
        nor += [n, n]
    for i in range(segments):
        b = i * 2
        # counter-clockwise seen from outside
        idx += [b, b + 2, b + 1, b + 1, b + 2, b + 3]
    # caps
    for y, ny in ((hh, 1), (-hh, -1)):
        centre = len(pos)
        pos.append((0, y, 0))
        nor.append((0, ny, 0))
        for i in range(segments + 1):
            a = 2 * math.pi * i / segments
            pos.append((math.cos(a) * radius, y, math.sin(a) * radius))
            nor.append((0, ny, 0))
        for i in range(segments):
            a, b = centre + 1 + i, centre + 2 + i
            idx += [centre, b, a] if ny == 1 else [centre, a, b]
    return pos, nor, idx


def quat_y(angle):
    """Quaternion (x, y, z, w) for a rotation around the Y axis."""
    return [0.0, math.sin(angle / 2), 0.0, math.cos(angle / 2)]


# ----------------------------------------------------------------------------
# glTF writer
# ----------------------------------------------------------------------------
class Builder:
    def __init__(self):
        self.bin = bytearray()
        self.views, self.accessors = [], []

    def _pad(self):
        while len(self.bin) % 4:
            self.bin.append(0)

    def add(self, data, component_type, count, type_, target=None, min_max=None):
        self._pad()
        offset = len(self.bin)
        self.bin += data
        view = {"buffer": 0, "byteOffset": offset, "byteLength": len(data)}
        if target:
            view["target"] = target
        self.views.append(view)
        acc = {"bufferView": len(self.views) - 1, "componentType": component_type,
               "count": count, "type": type_}
        if min_max:
            acc["min"], acc["max"] = min_max
        self.accessors.append(acc)
        return len(self.accessors) - 1

    def mesh(self, geometry, material):
        pos, nor, idx = geometry
        pos_data = b"".join(struct.pack("<3f", *p) for p in pos)
        nor_data = b"".join(struct.pack("<3f", *n) for n in nor)
        idx_data = b"".join(struct.pack("<H", i) for i in idx)
        mins = [min(p[k] for p in pos) for k in range(3)]
        maxs = [max(p[k] for p in pos) for k in range(3)]
        a_pos = self.add(pos_data, 5126, len(pos), "VEC3", 34962, (mins, maxs))
        a_nor = self.add(nor_data, 5126, len(nor), "VEC3", 34962)
        a_idx = self.add(idx_data, 5123, len(idx), "SCALAR", 34963)
        return {"primitives": [{"attributes": {"POSITION": a_pos, "NORMAL": a_nor},
                                "indices": a_idx, "material": material}]}


def build():
    b = Builder()

    materials = [
        {"name": "Metal", "pbrMetallicRoughness": {"baseColorFactor": [0.72, 0.72, 0.74, 1], "metallicFactor": 0.8, "roughnessFactor": 0.35}},
        {"name": "Wood", "pbrMetallicRoughness": {"baseColorFactor": [0.55, 0.38, 0.22, 1], "metallicFactor": 0.0, "roughnessFactor": 0.7}},
        {"name": "White", "pbrMetallicRoughness": {"baseColorFactor": [0.95, 0.95, 0.94, 1], "metallicFactor": 0.0, "roughnessFactor": 0.6}},
    ]
    METAL, WOOD, WHITE = 0, 1, 2

    meshes = [
        b.mesh(cylinder(0.09, 0.03), WHITE),    # 0 ceiling plate
        b.mesh(cylinder(0.012, 0.25, 12), METAL),  # 1 rod
        b.mesh(cylinder(0.07, 0.10), WHITE),    # 2 motor housing
        b.mesh(cylinder(0.06, 0.04), METAL),    # 3 hub
        b.mesh(box(0.55, 0.012, 0.12), WOOD),   # 4 blade
    ]

    nodes = []

    def node(**kw):
        nodes.append(kw)
        return len(nodes) - 1

    # Parts (origin = point on the ceiling; the fan hangs downwards)
    mount = node(name="Mount", mesh=0, translation=[0, -0.015, 0])
    rod = node(name="Rod", mesh=1, translation=[0, -0.155, 0])
    motor = node(name="Motor", mesh=2, translation=[0, -0.33, 0])
    hub = node(name="Hub", mesh=3, translation=[0, 0, 0])
    blades_children = [hub]
    for k in range(4):
        angle = k * math.pi / 2
        # blade centre is 0.36 m from the axis, rotated around Y by k * 90 degrees
        blade_pivot = node(name=f"Blade{k + 1}", rotation=quat_y(angle),
                           children=[node(name=f"Blade{k + 1}Mesh", mesh=4, translation=[0.36, 0, 0],
                                          rotation=[0, 0, 0, 1], extras={})])
        blades_children.append(blade_pivot)
    blades = node(name="Blades", translation=[0, -0.39, 0], children=blades_children)
    root = node(name="Fan", children=[mount, rod, motor, blades])

    # Animation: 5 keys, 90 degrees apart, linear (slerp) -> one full turn in 1.2 s
    period = 1.2
    times = [period * i / 4 for i in range(5)]
    rotations = [quat_y(i * math.pi / 2) for i in range(5)]
    t_data = b"".join(struct.pack("<f", t) for t in times)
    r_data = b"".join(struct.pack("<4f", *q) for q in rotations)
    a_time = b.add(t_data, 5126, 5, "SCALAR", None, ([times[0]], [times[-1]]))
    a_rot = b.add(r_data, 5126, 5, "VEC4")

    gltf = {
        "asset": {"version": "2.0", "generator": "tools/make_fan.py (project's own script)"},
        "scene": 0,
        "scenes": [{"name": "Scene", "nodes": [root]}],
        "nodes": nodes,
        "meshes": meshes,
        "materials": materials,
        "animations": [{
            "name": "Spin",
            "samplers": [{"input": a_time, "output": a_rot, "interpolation": "LINEAR"}],
            "channels": [{"sampler": 0, "target": {"node": blades, "path": "rotation"}}],
        }],
        "accessors": b.accessors,
        "bufferViews": b.views,
        "buffers": [{"byteLength": len(b.bin)}],
    }
    return gltf, bytes(b.bin)


def write_glb(path, gltf, binary):
    js = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    js += b" " * ((4 - len(js) % 4) % 4)
    binary += b"\x00" * ((4 - len(binary) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(binary)
    with open(path, "wb") as f:
        f.write(struct.pack("<4sII", b"glTF", 2, total))
        f.write(struct.pack("<I4s", len(js), b"JSON"))
        f.write(js)
        f.write(struct.pack("<I4s", len(binary), b"BIN\x00"))
        f.write(binary)
    return total


if __name__ == "__main__":
    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "models")
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, "fan.glb")
    gltf, binary = build()
    size = write_glb(out, gltf, binary)
    print(f"Wrote {os.path.normpath(out)} ({size} bytes)")
