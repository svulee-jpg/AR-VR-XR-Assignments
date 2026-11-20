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

The demo is a whole **70 m² apartment with five rooms** (living room, kitchen, hallway, bedroom, bathroom) that the
buyer can walk through (W A S D, the room bar, or by voice: "go to the kitchen"). The finishes apply to the whole
apartment, so the price is for the whole apartment. The furniture is optional: the buyer can **remove any piece**
(click it in "Remove furniture" mode, or say "remove the sofa"), bring it back, or empty the whole apartment.
Nothing is chosen for the buyer: the apartment starts in the rough state and changes only when the buyer asks.

This is an independent student concept for a **fictional developer**. Real developers already offer
turnkey finishing to buyers (for example the "Smart Remont" service of BI Group in Kazakhstan); this
project is not affiliated with any company, uses no company branding, and all **prices are made up
(demo prices in tenge)**. The fictional brand in the demo is **"Aurora Homes"** (project "Aurora Residence").

## Target device and how to run

- **Target device:** desktop Chrome with the **Immersive Web Emulator** (Meta Quest profile); the specification accepts an emulator as a VR target. The page also runs in the Quest browser (voice is usually not available there; the buttons are).
- **Live URL:** https://svulee-jpg.github.io/AR-VR-XR-Assignments/FINAL_241487_Amangeldyyeva/ (GitHub Pages, branch `main`)

Run from a fresh clone (needs Python 3; A-Frame is stored in `vendor/`, so the page opens without a CDN. Voice recognition still needs an internet connection):

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
| A-Frame | 1.8.0 (copy in `vendor/aframe-1.8.0.min.js`, MIT licence) |
| aframe-extras (animation-mixer) | 7.7.0 (copy in `vendor/aframe-extras-7.7.0.min.js`, MIT licence) |
| Browser tested | Chrome (desktop) |

No API keys, no server, no build step.

## The catalogue

| Surface | Materials | Colours |
|---|---|---|
| Walls and accent wall | matt paint, textured paint, wallpaper, striped wallpaper, wide horizontal stripe wallpaper, decorative plaster, brick, microcement, wooden slats | 51 paint colours (light / normal / dark tones), 12 stripe, 20 plaster, 10 microcement, 12 brick, 12 wood |
| Floor | laminate, parquet board, herringbone parquet, engineered board, vinyl (SPC), porcelain tile, marble, poured concrete, carpet | 12 wood tones, 12 stone, 10 marble, 6 concrete, 12 carpet |
| Ceiling | painted, stretch matt, stretch gloss | 8 colours |
| Skirting board | PVC, painted MDF, wood, hidden aluminium (different heights) | 8 colours |
| Interior door | painted panel door, wood veneer, solid wood (panelled), steel entrance door | 24 enamel colours, 12 wood tones, 7 solid-wood tones, 6 steel colours |

The surface options multiply to **196 484 198 400 different variants** (shown on the intro page and the summary).
Seven **ready-made designs** (Scandinavian, Living room, Loft, Classic, Minimal, Cosy, Dark luxe) apply a whole room in one step.
Every material is drawn by code as a seamless texture with a bump map (`js/textures.js`), so there are
no image files and no licence issues. Texture tiles have real-world sizes (a brick is 25 cm wide, a plank 1.2 m).

## Controls

| Input | Action |
|---|---|
| Look at a surface for 1.2 s (ring shrinks) | Select it (gaze / fuse cursor, VR) |
| Mouse click, or controller trigger in VR | Select / press a button |
| Panel: design buttons, surface tabs, material buttons, colour swatches | Choose finishes (hover a swatch to read its name) |
| Panel: Random, Before, Light day/evening, View city/sea/garden | Extra tools (the same View button is in the top bar) |
| Panel: Done: show summary | Costs per surface, total, monthly payment, variant code, copy link |
| Mouse drag (desktop) / head (VR) | Look around, full 360 degrees |
| W A S D or arrow keys Up / Down (desktop) | Walk forward / back / sideways in the direction you look. Walls and furniture block you; doors and the kitchen arch are open, so you can walk through the whole apartment |
| Q / E or arrow keys Left / Right (desktop) | Turn the whole view left / right |
| Left thumbstick / right thumbstick (VR) | Walk / turn in 30 degree steps |
| (automatic) | The configurator panel glides to stay in front of you when you turn or walk away, and snaps into the room you enter |
| Bottom bar "Hallway / Living room / Kitchen / Bedroom / Bathroom" (also in the VR panel) | Jump to a room; the current room is highlighted and shown in the top bar |
| Bottom bar "Remove furniture" | Remove mode: hover a piece (red frame and caption), click it and it disappears (and stops blocking you). "Restore all" brings everything back |
| `?debug` in the URL | Shows the frame rate and a button to download the event log (CSV) |
| `#v=...` in the URL | Restores a shared variant |
| Top bar: Get quote | Printable offer with a picture of the room, item table, total, mortgage (Print / Save as PDF, copy link) |
| Left drawer "Choose your finishes" (desktop) | Surface tabs, material cards with a texture sample and the price per m², colour swatches. It changes the same state as the 3D panel. On a desktop screen it replaces the floating 3D panel; in a headset (or when the drawer is hidden) the 3D panel is shown |
| Top bar: Before / after | Full-screen wipe between the rough apartment and your variant (drag the divider or use the slider) |
| Top bar: Furniture on/off | Shows or hides all furniture of the apartment (41 pieces in five rooms; own work, `js/livingset.js` and `js/rooms.js`); hidden in the "before renovation" view. Individual pieces can be removed with the bottom bar (see above) |
| Top bar: View (city / sea / garden) | What is behind the arched steel window. Three pictures drawn in code (`js/windowview.js`), each for daytime and evening light, with a small parallax when you move your head. Also by voice: "sea view", "city view", "garden view" |
| Top bar: Book consultation | Request form (name, contact, day, time); registers a demo reference number, nothing is sent |
| Landing page (shown before the VR scene) | Company front page of the fictional finishing atelier "Aurora Homes" in a quiet-luxury style (warm black, ivory, champagne accent, thin serif, full-screen hero picture): the collection of seven interiors with a picture and the price of each, the finishes, the process, and a private-viewing section that explains the microphone permission before it is requested. The pictures are renders of the own 3D room (`img/`). No web fonts or external images, so it works offline |

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
| "loft design", "living room design", "scandinavian", "cosy", "classic", "minimal", "luxe" | Ready-made designs |
| "random", "show before", "show after", "evening", "day" | Tools |
| "sea view", "city view", "garden view" | Changes what is behind the window (a single word such as "sea" works too) |
| "show summary", "how much does it cost", "done", "back", "reset" | Summary / back to the room / reset |
| "go to the kitchen", "take me to the bedroom", "walk to the hallway", "bathroom" | Walk to that room (for the living room say "go to the living room"; "living room" alone is the design) |
| "remove the sofa", "hide the floor lamp", "remove toilet" | Remove one piece of furniture |
| "restore the sofa", "bring back the toilet" | Bring one piece back |
| "remove the furniture", "empty apartment", "furniture on" | All furniture off / on |

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
| Showroom living room (reference photo) with its own furniture and the "Living room" design | `js/livingset.js` (component `living-set` on `#furniture`), `wp-hstripe` material in `js/catalog.js` / `js/textures.js` |
| Five-room apartment you can walk through (floor plan, walls, doors, arch, windows, per-room lights) | `js/plan.js` (data and walking rules, tested), `js/apartment.js` (3D build), `rig-move` in `js/app.js` |
| Furnished kitchen, bedroom, hallway and bathroom | `js/rooms.js` (component `room-set`) |
| Remove / restore furniture (click, voice, all at once) | `Kit.Furniture` in `js/kit.js`, voice words in `js/commands.js`, buttons in `js/shop.js` and the panel in `js/configurator.js` |
| Realistic look (like a photo of a real flat, not a game) | `js/realism.js`: image-based lighting from a CC0 HDR photo of an empty apartment (reflections in floors, tiles and metal), soft furniture shadows (the shadow map is redrawn only when the furniture changes, so it costs nothing while looking around), corner shading in the shader, fabric sheen. `js/windowview.js`: photographic window views and soft daylight through each window. `js/kit.js`: furniture with 1 cm rounded edges and contact shadows. Neutral tone mapping (`renderer` in `index.html`) so finish colours stay true |
| Tests for parser, catalogue, floor plan | `tests/commands.test.js` (`npm test`; includes "every room can be reached on foot") |
| Door as a sixth finishable surface | `door` in `js/catalog.js`, door textures in `js/textures.js`, `surface="name: door"` in `index.html` |

## Frame rate

*Not measured on a real GPU yet.* (A screenshot test in a headless browser with software rendering runs at about 1-2 frames per second; that says nothing about a real computer, so it is not used here.) Procedure: open `?debug`, enter the scene, wait 30 s and write the mean and the minimum here with the device and Chrome version.

## Assets and credits

| Asset | Source | Licence |
|---|---|---|
| `models/fan.glb` (ceiling fan, animation "Spin") | Own work, generated by `tools/make_fan.py` | Own work (use freely) |
| Room (walls, radiator, door) | Own work from A-Frame primitives | Own work |
| Arched steel window with curtains and marble sill | Own work, built in code in `js/windowview.js` | Own work |
| Window views (city, sea, garden; day and evening) and the lighting panorama (`img/views/`, `img/env/`) | Cut from four Poly Haven panoramas by `tools/make_realism_assets.py`; see [ASSETS.md](ASSETS.md). The older drawn views are kept in `js/windowview.js` as a fallback | CC0 |
| Living room furniture and decor (sofa, armchair, coffee table, rug, lamps, mirror, painting) | Own work, built from simple Three.js shapes and drawn textures in `js/livingset.js`; modelled on a photo of a real living room used only as a visual reference (the photo is not in the repository) | Own work |
| Apartment shell, kitchen, bedroom, hallway and bathroom furniture and decor (`js/plan.js`, `js/apartment.js`, `js/rooms.js`) | Own work, built from boxes, cylinders, spheres and drawn textures (including the pictures on the walls). The look follows a set of reference photos of a modern white apartment, used only as visual inspiration; no photo, model or texture from them is in the repository | Own work |
| `img/hero-living.jpg`, `img/room-*.jpg` (landing page pictures) | Own work: screenshots of this project's own 3D room rendered with each design (made by a headless-browser script, no third-party photos) | Own work |
| All material textures (brick, parquet, marble, ...) | Own work, drawn by `js/textures.js` at runtime | Own work |
| Prices, designs, catalogue | Invented for this demo | Own work |

| `vendor/aframe-1.8.0.min.js`, `vendor/aframe-extras-7.7.0.min.js` | A-Frame (aframe.io) and aframe-extras (Don McCurdy), unmodified copies of the pinned releases | MIT (licence files in `vendor/`) |

No AI-generated images. The only third-party images are the four CC0 panoramas in [ASSETS.md](ASSETS.md); no third-party models or textures.

## AI service disclosure

- **Speech recognition:** the browser's Web Speech API (`en-US`). In Chrome, while the microphone is on, the audio is sent to Google's speech service. The app stores no audio and no personal data and has no API key. The intro page tells the user before the permission is requested.
- **AI as a development helper:** see [AI_LOG.md](AI_LOG.md).

## Files

```
index.html            page, room, landing, top bar, quote and booking dialogs, HUD
img/                  landing page pictures (renders of the own 3D room); env/ lighting panorama; views/ window views (CC0, see ASSETS.md)
css/shop.css          styles of the landing page, top bar, quote sheet (incl. A4 print) and booking form
js/shop.js            company layer: design packages, live total, quote with room picture, booking form, furniture toggle
js/plan.js            floor plan (rooms, doors, arch, windows), walking rules and the areas the price is based on (testable without a browser)
js/kit.js             helpers for building furniture (Item, merged geometry) and the furniture registry (remove / restore, contact shadows)
js/apartment.js       builds walls, floors, ceilings, doors, cornices, radiator and lights from the plan
js/livingset.js       living room furniture and decor built from simple shapes and procedural textures (sofa, armchair, glass table, rug, lamps, mirror, painting)
js/rooms.js           kitchen, bedroom, hallway and bathroom furniture and decor
js/windowview.js      arched steel windows with curtains, photographic views and daylight through the window
js/realism.js         realistic lighting: HDR image-based lighting, soft shadows, corner shading, fabric sheen
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
tools/make_realism_assets.py  builds img/env and img/views from the CC0 panoramas
tests/                catalogue and parser tests
AI_LOG.md             record of AI use
ASSETS.md             third-party assets (four CC0 panoramas) and how they were processed
```
