# Voice-controlled VR configurator for apartment finishes

Final capstone, **AR/VR/XR Applications (AIB)**, brief **B6 (Real estate, VR)**.
Student: Saule Amangeldyyeva, ID 241487 (solo project; owner of all modules).

## Concept

A developer sells apartments in a raw state ("rough finish"). Instead of making buyers look for builders,
the developer offers a finishing package: the buyer stands in the bare room in VR, picks a **ready-made
design** or builds their own (walls, accent wall, floor, ceiling, skirting board, interior door), sees the room change
at once, and gets a **cost estimate and a monthly mortgage payment** for the finishing.
The buyer can choose by gaze, mouse or controller, or **by voice in English**, for example
**"red brick walls"** or **"dark walnut herringbone floor"**.

This is an independent student concept for a **fictional developer**. Real developers already offer
turnkey finishing to buyers (for example the "Smart Remont" service of BI Group in Kazakhstan); this
project is not affiliated with any company, uses no company branding, and all **prices are made up
(demo prices in tenge)**. The fictional brand in the demo is **"Aurora Homes"** (project "Aurora Residence").

## Target device and how to run

- **Target device:** desktop Chrome with the **Immersive Web Emulator** (Meta Quest profile); the specification accepts an emulator as a VR target. The page also runs in the Quest browser (voice is usually not available there; the buttons are).
- **Live URL:** *(add after deployment to GitHub Pages)*

Run from a fresh clone (needs Python 3 and an internet connection for the A-Frame scripts):

```bash
git clone https://github.com/svulee-jpg/AR-VR-XR-Assignments.git
cd AR-VR-XR-Assignments/FINAL_241487_Amangeldyyeva
npm start          # same as: python3 -m http.server 8000
# open http://localhost:8000 in Chrome
```

Tests (no install needed, Node 18+): `npm test`
Rebuild the fan model: `npm run build-model` (Python 3, standard library only).

## Pinned versions

| Part | Version |
|---|---|
| A-Frame | 1.8.0 (CDN: aframe.io/releases/1.8.0) |
| aframe-extras (animation-mixer) | 7.7.0 (CDN: jsDelivr) |
| Browser tested | Chrome (desktop) |

No API keys, no server, no build step.

## The catalogue

| Surface | Materials | Colours |
|---|---|---|
| Walls and accent wall | matt paint, textured paint, wallpaper, striped wallpaper, decorative plaster, brick, microcement, wooden slats | 51 paint colours (light / normal / dark tones), 12 stripe, 20 plaster, 10 microcement, 12 brick, 12 wood |
| Floor | laminate, parquet board, herringbone parquet, engineered board, vinyl (SPC), porcelain tile, marble, poured concrete, carpet | 12 wood tones, 12 stone, 10 marble, 6 concrete, 12 carpet |
| Ceiling | painted, stretch matt, stretch gloss | 8 colours |
| Skirting board | PVC, painted MDF, wood, hidden aluminium (different heights) | 8 colours |
| Interior door | painted panel door, wood veneer, solid wood (panelled), steel entrance door | 24 enamel colours, 12 wood tones, 7 solid-wood tones, 6 steel colours |

The surface options multiply to **3 599 769 600 different variants** (shown on the intro page and the summary).
Six **ready-made designs** (Scandinavian, Loft, Classic, Minimal, Cosy, Dark luxe) apply a whole room in one step.
Every material is drawn by code as a seamless texture with a bump map (`js/textures.js`), so there are
no image files and no licence issues. Texture tiles have real-world sizes (a brick is 25 cm wide, a plank 1.2 m).

## Controls

| Input | Action |
|---|---|
| Look at a surface for 1.2 s (ring shrinks) | Select it (gaze / fuse cursor, VR) |
| Mouse click, or controller trigger in VR | Select / press a button |
| Panel: design buttons, surface tabs, material buttons, colour swatches | Choose finishes (hover a swatch to read its name) |
| Panel: Random variant, Show before renovation, Light day/evening | Extra tools |
| Panel: Done: show summary | Costs per surface, total, monthly payment, variant code, copy link |
| Mouse drag (desktop) / head (VR) | Look around, full 360 degrees |
| W A S D or arrow keys Up / Down (desktop) | Walk forward / back / sideways in the direction you look (kept inside the room) |
| Q / E or arrow keys Left / Right (desktop) | Turn the whole view left / right |
| Left thumbstick / right thumbstick (VR) | Walk / turn in 30 degree steps |
| (automatic) | The configurator panel glides to stay in front of you when you turn or walk away |
| `?debug` in the URL | Shows the frame rate and a button to download the event log (CSV) |
| `#v=...` in the URL | Restores a shared variant |
| Top bar: Get quote | Printable offer with a picture of the room, item table, total, mortgage (Print / Save as PDF, copy link) |
| Left drawer "Choose your finishes" (desktop) | Surface tabs, material cards with a texture sample and the price per m², colour swatches. It changes the same state as the 3D panel. On a desktop screen it replaces the floating 3D panel; in a headset (or when the drawer is hidden) the 3D panel is shown |
| Top bar: Before / after | Full-screen wipe between the rough apartment and your variant (drag the divider or use the slider) |
| Top bar: Furniture on/off | Shows the furnished showroom living room (sofa, armchair, glass table, rug, lamps, mirror, painting; own work, `js/livingset.js`); hidden in the "before renovation" view. The "Living room" design package (white walls, brown wide-stripe feature wall, light oak floor) is pre-selected on the landing page |
| Top bar: Book consultation | Request form (name, contact, day, time); registers a demo reference number, nothing is sent |
| Landing page: design packages | Pick a ready-made design with its price before entering the room |

### Voice commands (English, Chrome)

| Say | Result |
|---|---|
| "walls red brick", "red brick walls" | Brick walls in red |
| "dark walnut herringbone floor", "floor herringbone dark walnut" | Herringbone parquet in dark walnut |
| "walls light grey and floor dark oak" | Two surfaces in one phrase |
| "accent wall striped blue wallpaper", "no accent" | Accent wall on / off |
| "ceiling glossy white", "skirting black", "wooden slats" | Ceiling, skirting board, a material alone names its surface |
| "steel door black", "wooden door walnut", "panelled door walnut", "door white" | Interior door (veneer / solid / steel / painted) |
| "dark" (with a surface selected) | Changes only the colour and keeps the material |
| "loft design", "scandinavian", "cosy", "classic", "minimal", "luxe" | Ready-made designs |
| "random", "show before", "show after", "evening", "day" | Tools |
| "show summary", "how much does it cost", "done", "back", "reset" | Summary / back to the room / reset |

## Requirement → where it is implemented

| Requirement | Where |
|---|---|
| 3 scenes/states: intro page, room, summary | `index.html` (`#intro`), `configurator` modes `room` / `summary` in `js/configurator.js` |
| 2 interactions with XR input | Gaze or controller selection of a surface, panel buttons, spoken commands (`surface`, `ui-button` in `js/configurator.js`, `js/voice.js`) |
| AI-driven feature (speech) + fallback | `js/voice.js` (recognition), `js/commands.js` (parser); fallback: gaze + buttons, messages for denied / unsupported / no network |
| Animated GLTF via animation mixer | `models/fan.glb` (`tools/make_fan.py`), `animation-mixer` on `#fan` |
| Permissions explained before they are asked | Intro page in `index.html` |
| Every message is text, colour is never the only cue | `canvas-text` captions, ✓ marks, hover border, colour names on hover |
| Comfort | No camera motion is ever forced; everything is reachable from a stationary position |
| Pinned versions, one-command run | Sections above, `package.json` |
| Product feel (landing, live price, quote, booking) | `index.html` (`#intro`, `#topbar`, `#quote`, `#booking`), `css/shop.css`, `js/shop.js` |
| Shop-style pickers and before/after wipe | `#drawer` and `#cmp` in `index.html`, `js/drawer.js`, `js/compare.js`, `css/shop.css` |
| Door as a sixth finishable surface | `door` in `js/catalog.js`, door textures in `js/textures.js`, `surface="name: door"` in `index.html` |

## Frame rate

*Not measured yet.* Procedure: open `?debug`, enter the scene, wait 30 s and write the mean and the minimum here with the device and Chrome version.

## Assets and credits

| Asset | Source | Licence |
|---|---|---|
| `models/fan.glb` (ceiling fan, animation "Spin") | Own work, generated by `tools/make_fan.py` | Own work (use freely) |
| Room (walls, window, radiator, door) | Own work from A-Frame primitives | Own work |
| All material textures (brick, parquet, marble, ...) | Own work, drawn by `js/textures.js` at runtime | Own work |
| Prices, designs, catalogue | Invented for this demo | Own work |

No AI-generated images. No third-party models or textures.

## AI service disclosure

- **Speech recognition:** the browser's Web Speech API (`en-US`). In Chrome, while the microphone is on, the audio is sent to Google's speech service. The app stores no audio and no personal data and has no API key. The intro page tells the user before the permission is requested.
- **AI as a development helper:** see [AI_LOG.md](AI_LOG.md).

## Files

```
index.html            page, room, landing, top bar, quote and booking dialogs, HUD
css/shop.css          styles of the landing page, top bar, quote sheet (incl. A4 print) and booking form
js/shop.js            company layer: design packages, live total, quote with room picture, booking form, furniture toggle
js/livingset.js       living room furniture and decor built from simple shapes and procedural textures (sofa, armchair, glass table, rug, lamps, mirror, painting)
js/drawer.js          HTML finishes drawer (material cards with samples and prices)
js/compare.js         before / after wipe
js/catalog.js         materials, colours, designs, demo prices, variant code (testable without a browser)
js/textures.js        procedural seamless textures and bump maps
js/commands.js        voice-command parser (testable without a browser)
js/voice.js           Web Speech API wrapper with status handling
js/app.js             small A-Frame components (canvas-text, rig-move, panel-follow, radiator, fps-meter)
js/configurator.js    surfaces, panel, price, state machine, voice wiring
models/fan.glb        animated ceiling fan
tools/make_fan.py     generator of the fan model
tests/                catalogue and parser tests
AI_LOG.md             record of AI use
```
