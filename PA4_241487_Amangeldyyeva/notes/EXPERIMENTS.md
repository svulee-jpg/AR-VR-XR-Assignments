# Experiment cheat-sheet for the write-up (E1–E6)

Not part of the ZIP. Work in Chrome with DevTools open (Cmd+Option+J on a Mac), console tab.
Every screenshot must show the ID panel (`241487`) in the 3D view, so **dock DevTools to the right or bottom**
and keep the scene visible. Walk to the end of the corridor, or press W until the board is readable.

Order for every experiment: **prediction (write it BEFORE you run) → result (screenshot / console) → explanation.**
The snippets only produce the evidence. The predictions and the explanations must be in your own words.

---------------------------------------------------------------------------------------------------

## E1 – life cycle of x1487-motion (4 pts)

1. Open `http://localhost:8000/?log` (the `?log` switches on the timestamped log).
2. Console, run one line at a time and wait a second between them:

```js
const e = document.querySelector('.exhibit');          // first exhibit (Yurt)
e.setAttribute('x1487-motion', 'amplitude', 0.4);      // 1) live change
e.pause();                                              // 2) entity pause
e.play();                                               //    entity play
e.removeAttribute('x1487-motion');                      // 3) remove the component
e.parentNode.removeChild(e);                            // 4) remove the entity
```

3. Screenshot of the log (page load part + these steps). Filter the console with `x1487-motion`.

Things your explanation must cover: when `update` fires (first call right after `init`, then after every
`setAttribute`), what `oldData` holds on the first call (an empty object `{}`) and later (the previous values),
which methods fire on `pause()` / `play()` and on `removeAttribute`.

---------------------------------------------------------------------------------------------------

## E2 – checking Ch. 8 (4 pts)

(a) Open `http://localhost:8000/notes/ch8-original.html` (original Ch. 8 component, re-typed from the book).

```js
const el = document.querySelector('#ch8box');
const c = el.components['texture-loader'];
const before = c.data.texture;                         // keep the reference
console.log('before', Object.keys(c.data), c.data);
el.setAttribute('texture-loader', 'src', '../textures/ice.jpg');
console.log('after', c.data);
console.log('same texture object?', before === c.data.texture);   // what do you expect?
```

Compare `this.data` before and after, and what happened to the old texture (was it disposed?). Explain why runtime
objects (texture, material, mesh) belong on `this` and not in `this.data` (hint: what is `data` for, who writes it,
what does A-Frame do with it on every update?).

(b) Compare the `<a-assets>` element with what `AFRAME.registerSystem` creates. Look at
`AFRAME.scenes[0].systems` in the console (my system is `x1487-gallery`) and at
`document.querySelector('a-assets')`. Say whether "a-assets is a system" holds.

---------------------------------------------------------------------------------------------------

## E3 – texture filtering (3 pts)

Make a low grazing view of the repeated ground first:

```js
const rig = document.querySelector('#rig');
rig.object3D.position.set(0, -1.35, 4);                 // camera about 0.25 m above the snow
const lc = document.querySelector('[camera]').components['look-controls'];
lc.pitchObject.rotation.x = -0.03; lc.yawObject.rotation.y = 0;
```

Then take three screenshots of the same view, **moving the camera slowly (W/S) a little before each shot** so the
shimmer shows. Shimmer is best seen in a short screen recording, but a screenshot of the far snow is fine.

```js
const map = document.querySelector('#ground').getObject3D('mesh').material.map;
const apply = (min, mag, aniso) => { map.minFilter = min; map.magFilter = mag; map.anisotropy = aniso; map.needsUpdate = true; };

// 1) Ch. 8 filters (minFilter = Nearest, anisotropy = 16; the "maxFilter" line does nothing)
map.maxFilter = THREE.NearestFilter;
apply(THREE.NearestFilter, THREE.LinearFilter, 16);

// 2) three.js defaults
apply(THREE.LinearMipmapLinearFilter, THREE.LinearFilter, 1);

// 3) my choice: trilinear mipmaps + maximum anisotropy
apply(THREE.LinearMipmapLinearFilter, THREE.LinearFilter, AFRAME.scenes[0].renderer.capabilities.getMaxAnisotropy());
```

Check whether the property used in Ch. 8 exists: `'maxFilter' in new THREE.Texture()` → `false`
(the real name is `magFilter`). Explain minification, magnification, mipmaps and why you chose your filters.

---------------------------------------------------------------------------------------------------

## E4 – what `<a-scene>` builds (3 pts)

```js
const s = AFRAME.scenes[0];
console.log(s.renderer);          // THREE.WebGLRenderer (renderer.xr is the WebXR manager)
console.log(s.object3D);          // THREE.Scene = root of every entity
console.log(s.camera);            // active THREE.PerspectiveCamera
console.log(s.renderer.info);     // draw calls, triangles
```

Where does A-Frame start the WebXR session? In A-Frame's `a-scene.js` (method `enterVR`): it calls
`navigator.xr.requestSession(...)` and then `renderer.xr.setSession(...)`, and stores the result in
`sceneEl.xrSession` (visible after you press Enter VR in the emulator:
`AFRAME.scenes[0].xrSession`). You can find it yourself in DevTools → Sources → search
`requestSession` in `aframe.min.js`. Compare with your PA3 code (you wrote the session request, the reference
space and the render loop yourself). Give one situation for raw Three.js and one for A-Frame.

---------------------------------------------------------------------------------------------------

## E5 – performance (3 pts)

The scene already has the `stats` panel (top left). Record fps, draw calls and triangles:

```js
const info = AFRAME.scenes[0].renderer.info.render;
console.log('calls', info.calls, 'triangles', info.triangles);
```

(My headless run: about 16 draw calls and 12.8 k triangles; yours will differ a little, **use your own numbers**.)

Add 60 exhibits by script, wait two seconds, record again:

```js
const scene = AFRAME.scenes[0];
for (let i = 0; i < 60; i++) {
  const n = document.createElement('a-entity');
  n.classList.add('exhibit', 'extra');
  n.setAttribute('position', `${-12 + (i % 10) * 2.6} 1 ${-14 - Math.floor(i / 10) * 2}`);
  n.setAttribute('geometry', 'primitive: sphere; radius: 0.4');
  n.setAttribute('material', 'color: #cccccc');
  n.setAttribute('x1487-motion', `phase: ${i * 0.3}`);
  n.setAttribute('x1487-exhibit', `name: Extra ${i}; info: test exhibit`);
  scene.appendChild(n);
}
```

(In my run this gave about 76 draw calls and 86 k triangles, status shows `0 of 66`.)

One change that reduces draw calls: **merge the 60 static spheres into one mesh** (one mesh with one material = one
draw call). Because merged meshes cannot move individually, first stop their motion: use
`document.querySelectorAll('.extra').forEach(e => e.removeAttribute('x1487-motion'))`, then run:

```js
const scene = AFRAME.scenes[0];
const geos = [];
document.querySelectorAll('.extra').forEach(e => {
  const mesh = e.getObject3D('mesh');
  e.object3D.updateMatrixWorld(true);
  const g = mesh.geometry.clone();
  g.applyMatrix4(mesh.matrixWorld);                  // bake the position into the geometry
  geos.push(g);
});
const merged = THREE.BufferGeometryUtils.mergeGeometries(geos);
const holder = document.createElement('a-entity');
scene.appendChild(holder);
holder.setObject3D('mesh', new THREE.Mesh(merged, new THREE.MeshStandardMaterial({color: 0xcccccc})));
document.querySelectorAll('.extra').forEach(e => e.parentNode.removeChild(e));
// then wait one second and read renderer.info.render.calls again
```

(My run: 76 → 17 draw calls, triangles unchanged.) Another quick way to cut **triangles** (not calls): lower
`segmentsWidth` / `segmentsHeight` on the spheres. Explain why draw calls matter more in VR: every draw call is
repeated for each eye (two views) and the headset needs 72–90 fps with a mobile CPU/GPU.

---------------------------------------------------------------------------------------------------

## E6 – comfort and design (≤ 150 words)

Numbers from my scene, check them yourself:

- rows 3 m apart → every exhibit is at least 1.5 m from the centre line; the nearest ones are about 2.5 m from the start point, the farthest about 8.1 m.
- Angular size = `2 · atan(height / (2 · distance))`. Measure the info-panel text height in the scene
  (roughly 0.1 m per line) and compute the angle at 3 m. About 1.5° and more is comfortable to read in a headset.
- Gaze fuse 1.5 s: long enough to avoid accidental selections, short enough not to tire the neck. Ring shrinks
  while fusing as visual feedback.
- Comfort risks to pick from: smooth WASD walking in VR (motion sickness: the rig speed is limited with
  `acceleration: 30`), constant pulsing of large objects close to the eyes (amplitude only ±15 %, period 3 s), fog
  and a bright white scene (glare).

---------------------------------------------------------------------------------------------------

## Development log (3–5 lines at the end of the write-up)

One real bug, how you found it, and the commit hash that fixed it. Get hashes with `git log --oneline`.
Only write what really happened to you while you built, tested or changed the project (a typo in an attribute,
a wrong path to a texture, text not showing, a console error). Do not invent a bug: the instructor uses this log in
the code check.

---------------------------------------------------------------------------------------------------

## AI-usage note (last lines of writeup.pdf)

The instructor allows AI use and asks to name the AI. Write which one you used (Claude, Anthropic, model
Sonnet 5.5, through Claude Code), and in two or three sentences what it did (drafted the components, the scene, the
README and this checklist) and what you did yourself (ran the experiments, took the screenshots, wrote the
explanations, tested in your browser and in VR).

---------------------------------------------------------------------------------------------------

## ZIP and submission

From the folder that contains the PA4 files, select only: `index.html`, `components.js`, `textures`, `README.md`,
`writeup.pdf`, `demo.mp4` (not `notes`, not `tools`, not `.DS_Store`, not `.git`). Right click → Compress →
rename to `PA4_241487_Amangeldyyeva.zip`. Check the size (< 10 MB).
