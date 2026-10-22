# PA3 - Augmented Reality Website with Hit-Testing

**Student ID:** 241487
**Variant:** Bedside table (0.45 x 0.40 x 0.55 m), multi mode (up to 5 products; the 6th tap removes the oldest),
surface tolerance 12 degrees, facing rule: the product keeps the orientation of the hit pose.

## Tested on
- Chrome on macOS with the Immersive Web Emulator v2.0.0 (device profile Meta Quest 3, environment Living Room).
- Real Android device: not tested yet (no Android device available).

## How to run
WebXR needs HTTPS or localhost.
1. Open the folder in VS Code and start Live Server (Port 5500).
2. Open `http://127.0.0.1:5500/PA3_241487_Amangeldyyeva/index.html` in Chrome.
3. On an AR-capable Android phone, open the same page over HTTPS (for example GitHub Pages) in Chrome and press START AR.
4. On unsupported browsers (for example iPhone Safari) a visible fallback message is shown.

Three.js 0.186.1 is loaded through an import map pinned to that version (see `index.html`).

## Porting notes (Ch. 7 listing -> Three.js 0.186.1)
1. **WebGLRenderer constructor throws.** The book creates the context with `getContext('webgl', ...)` (WebGL 1).
   Three.js 0.186.1 requires WebGL 2, so I use `getContext('webgl2', { alpha: true, xrCompatible: true })` in `loadScene()`.
2. **Geometry constructors are undefined.** `CylinderBufferGeometry` and `RingBufferGeometry` were removed; the classes are now
   `CylinderGeometry` and `RingGeometry`. I use `RingGeometry` for the reticle and `BoxGeometry` for the product.
3. **A new hit-test source is requested on every frame.** In the book's `render()` the flag `hitTestSourceRequested` is checked
   but never set to `true`, so `requestHitTestSource` (and a new `end` listener) runs every frame. I set the flag to `true`
   before the single request from the viewer space and cancel the source in `onSessionEnd()`.

## Requirement -> where implemented (index.js)
| Task | Requirement | Where |
| --- | --- | --- |
| A | WebGL 2 context, support check, START AR, visible fallback | `loadScene()` |
| A | Own session life cycle, no ARButton, STOP and system end both reset | `onRequestSession()`, `onSessionStarted()`, `onSessionEnd()` |
| B | One hit-test source from viewer space, cancelled on end | `render()`, `onSessionEnd()` |
| B | Reticle (RingGeometry), matrix from hit pose, hidden without a hit | `loadScene()`, `render()` |
| B | Tilt filter 12 degrees from the pose matrix y-axis, green/red | `render()` (`TILT_LIMIT_DEG`) |
| C | Bedside table from several primitives in one Group, origin at the base, metres | `buildProduct()` |
| C | Hemisphere + directional light, MeshStandardMaterial, size log | `loadScene()`, `buildProduct()` |
| D | Tap only sets a flag; placing happens in the frame callback | `onSelect()`, `render()` |
| D | Multi mode (5), facing rule: keep hit-pose orientation | `placeProduct()` (`MAX_PRODUCTS`, `yaw = 0`) |
| D | Anchors created, followed every frame, deleted on removal; "Anchors: off" if unavailable | `placeProduct()`, `render()`, `removeProduct()` |
| E | Overlay with ID, variant, session, reticle, anchors, products | `updateOverlay()` |
| E | Clear does not place; tracking loss blocks placement | `clearAll()`, `beforexrselect` in `loadScene()`, `trackingLost` in `render()` |

## AI assistance
Claude (Anthropic) was used as a coding assistant while building this assignment, as agreed with the instructor.