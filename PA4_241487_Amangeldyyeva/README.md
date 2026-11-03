# PA4 – A-Frame VR Scene with Custom Component

- Course: AR/VR/XR Applications (6B04103 AI Business, 3rd year)
- Student: Saule Amangeldyyeva
- Student ID: 241487
- A-Frame version: 1.8.0 (core only, no community components, no model files)

## My variant (ID 241487 → last four digits 1487)

| Rule | Digit | Result |
|---|---|---|
| Component prefix | last four digits | `x1487-` |
| Theme | last digit 7 | **Winter steppe** |
| Exhibit motion | 2nd-to-last 8, 8 mod 3 = 2 | **pulse** (scale up and down) |
| Interaction | 3rd-to-last 4, 4 mod 2 = 0 | **gaze** (fuse cursor, 1.5 s, visible ring) |
| Layout | 4th-to-last 1, 1 mod 2 = 1 | **corridor** (two rows of 3, rows 3 m apart, along 10 m) |

How I read the corridor layout: the two rows are at x = −1.5 and x = +1.5 (3 m apart), the exhibits in each row
at z = −2, −5 and −8 (3 m apart), so the six exhibits spread over a 10 m corridor that ends at z = −10.

## How to run

The scene must be served from a local web server (opening the file by double click will not load the textures).

1. Open this folder in VS Code and click **Go Live** (Live Server extension), **or** in a terminal run
   `python3 -m http.server 8000` inside this folder and open `http://localhost:8000/`.
2. Use current Chrome or Firefox. An internet connection is needed for the A-Frame script (CDN) and the text font.
3. Enter VR: click the VR button (bottom right). In a laptop browser use the *Immersive Web Emulator* Chrome
   extension; on a Meta Quest open the page in the Quest browser.

## Controls and key map

| Input | Action |
|---|---|
| Mouse drag | look around |
| W A S D | walk (movement axes are fixed to the world, the rig does not turn with the view) |
| Look at an exhibit | cursor ring turns the exhibit yellow (hover) |
| Keep looking 1.5 s | fuse completes → click → exhibit is selected (blue), info panel appears above it, its pulse amplitude doubles |
| Look away and gaze again for 1.5 s | click again → deselect |
| Select another exhibit | the previous one is deselected (only one at a time) |
| **M** | pause / resume the motion of all exhibits |
| **X** | remove the selected exhibit from the DOM |
| `?log` at the end of the URL | print every life-cycle call of `x1487-motion` with a timestamp (experiment E1) |

The panel at the end of the corridor shows the student ID, the variant and a live line
`Selected: <name> (<n> of <total>)`.

## Requirement → where implemented

| Task | Requirement | Where |
|---|---|---|
| A | A-Frame 1.8.0 in `<head>`, `components.js` before `<a-scene>` | `index.html` lines 8–9 |
| A | Ground, sky, ambient + directional light, fog on `<a-scene>` | `index.html` (`#ground`, `<a-sky>`, two `light` entities, `fog` attribute) |
| A | ≥ 3 preloaded images in `<a-assets>`, credited | `index.html` `<a-assets>` (4 images), credits below |
| A | Exhibits as generic `<a-entity>` with geometry + material | all six exhibits in `index.html` |
| A | Camera rig, camera at 1.6 m, wasd-controls + look-controls | `#rig` in `index.html` |
| A | Six themed exhibits, class `exhibit`, name, variant layout | `index.html`, corridor section |
| A | ID and variant panel | `#info-board` in `index.html` |
| B | Typed schema (oneOf type, amplitude, period, phase) | `x1487-motion` schema in `components.js` |
| B | Base pose stored in `init`, pose computed in `tick`, no drift | `init`, `tick` |
| B | Live changes without jumps | `tick` eases amplitude and phase, period only changes the speed of the angle |
| B | Different phases, pause / play | phases 0 … 5.25 in `index.html`; component `pause` / `play`; own clock |
| C | Config-only schema, runtime objects on `this` | `x1487-texture` schema, `init` |
| C | Safe mesh access (now or on `object3dset`) | `init`, `onObject3DSet` |
| C | Real three.js properties, anti-shimmer filters, anisotropy | `createTexture`, `sync` |
| C | Reload only when `src` changed | `update` → `sync(oldData)` |
| C | `remove()` disposes and restores the material | `remove` |
| C | ≥ 2 entities, ground repeat ≥ 10 × 10 | ground (16 × 16), ice path, end wall |
| D | Gaze: fuse cursor with visible ring, raycaster limited to `.exhibit` | cursor entity in `#rig` |
| D | Events map: mouseenter / mouseleave / click | `x1487-exhibit` `events` |
| D | Info panel above the selected exhibit, motion changed via `setAttribute` | `showPanel`, `boostMotion` |
| E | System: register in `init`, unregister in `remove` | `x1487-gallery` `register` / `unregister` |
| E | One selected exhibit at a time | `select` |
| E | M pauses / resumes all motion, X removes selected | `toggleMotion`, `removeSelected` |
| E | Live `Selected: <name> (<n> of <total>)` | `updatePanel` |

## Project structure

```
index.html            scene (A-Frame 1.8.0 from the CDN)
components.js         x1487-gallery (system), x1487-motion, x1487-texture, x1487-exhibit
textures/             snow.jpg, snow_normal.jpg, ice.jpg, wood.jpg  (1024 × 1024 px each)
tools/                generate_textures.py – script that made the textures
README.md             this file
writeup.pdf           experiments E1–E6 and development log
demo.mp4              screen recording
```

## Texture credits and licences

All four images are original, procedurally generated by `tools/generate_textures.py` (no third-party images).
They are released under **CC0 1.0 Universal** (public domain dedication).

| File | Description | Author | Licence |
|---|---|---|---|
| `textures/snow.jpg` | snow with dry steppe grass specks (ground colour map) | generated by the project script | CC0 1.0 |
| `textures/snow_normal.jpg` | snow bump / normal map (ground) | generated by the project script | CC0 1.0 |
| `textures/ice.jpg` | frosted ice (path) | generated by the project script | CC0 1.0 |
| `textures/wood.jpg` | wooden planks (end wall) | generated by the project script | CC0 1.0 |

## AI assistance

The code, this README and the experiment checklist were drafted with Claude (Anthropic, model Sonnet 5.5) through
Claude Code, with the instructor's permission to use AI in this course. The way AI was used is described in the
AI-usage note at the end of `writeup.pdf`.
