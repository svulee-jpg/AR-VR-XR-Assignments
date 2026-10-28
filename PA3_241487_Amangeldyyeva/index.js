import * as THREE from "three"; // resolved by the import map in index.html (Three.js 0.186.1)

// ---------- My variant (student ID 241487) ----------
const STUDENT_ID = "241487";
const VARIANT_TEXT = "Bedside table | multi (5) | 12 deg | hit-pose orientation";
const MAX_PRODUCTS = 5;     // 2nd-to-last digit 8 (even)        -> multi mode, up to 5 products
const TILT_LIMIT_DEG = 12;  // 3rd-to-last digit 4 (4 mod 3 = 1) -> surface within 12 degrees of up
// 4th-to-last digit 1 (odd) -> the product keeps the orientation of the hit pose (yaw = 0)

// global scene values
let btn, gl, glCanvas, camera, scene, renderer, controller, reticle;
// global xr values
let xrSession = null, hitTestSource = null, hitTestSourceRequested = false;
let placeRequested = false;
const placed = []; // { object, anchor, yaw }

// [Part 2] per-frame state and reusable math objects
let trackingLost = false;
let lastStatusText = "";
const _up = new THREE.Vector3(0, 1, 0);
const _normal = new THREE.Vector3();
const _yawMatrix = new THREE.Matrix4();

const overlay = document.getElementById("overlay");
const statusEl = document.getElementById("status");
const fallbackEl = document.getElementById("fallback");

loadScene();

function loadScene() {
  // [Task A, break 1] Three.js 0.186 needs a WebGL 2 context. The old WebGL 1
  // context from the Ch. 7 listing makes the WebGLRenderer constructor throw.
  glCanvas = document.createElement("canvas");
  gl = glCanvas.getContext("webgl2", { alpha: true, xrCompatible: true });
  if (!gl) {
    showFallback("WebGL 2 is not available in this browser.");
    return;
  }

  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);
  scene = new THREE.Scene();

  // [Task C] lights: one HemisphereLight + one DirectionalLight
  scene.add(new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(1, 3, 2);
  scene.add(sun);

  renderer = new THREE.WebGLRenderer({ canvas: glCanvas, context: gl, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  document.body.appendChild(renderer.domElement);

  // [Task B] reticle: a flat ring (lying on the floor), its matrix comes from the hit pose
  // [Task A, break 2] RingGeometry (the old RingBufferGeometry name no longer exists)
  reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.08, 0.1, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x00ff00 })
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  // [Task D] a tap only sets a flag; the placing happens later inside render()
  controller = renderer.xr.getController(0);
  controller.addEventListener("select", onSelect);
  scene.add(controller);

  // [Task E] taps on the panel must not place a product
  overlay.addEventListener("beforexrselect", (e) => e.preventDefault());
  document.getElementById("clear").addEventListener("click", clearAll);

  // START / STOP button lives inside the overlay so it is visible in AR too
  btn = document.createElement("button");
  btn.textContent = "START AR";
  btn.hidden = true;
  btn.addEventListener("click", () => {
    if (xrSession) {
      endXRSession();
    } else {
      onRequestSession();
    }
  });
  overlay.insertBefore(btn, document.getElementById("clear"));

  // [Task C] check the product size (should be about 0.45 x 0.55 x 0.40 m)
  const size = new THREE.Box3().setFromObject(buildProduct()).getSize(new THREE.Vector3());
  console.log("Product size (m): x=" + size.x.toFixed(3) + " y=" + size.y.toFixed(3) + " z=" + size.z.toFixed(3));

  // [Task A] is AR supported? -> START AR button, or a visible fallback message
  setStatus("Checking AR support...");
  if (navigator.xr) {
    navigator.xr.isSessionSupported("immersive-ar")
      .then((supported) => {
        if (supported) {
          btn.hidden = false;
          setStatus("AR is supported. Press START AR.");
        } else {
          showFallback("AR (immersive-ar) is not supported on this device or browser. Use Chrome on an AR-capable Android phone.");
        }
      })
      .catch(() => showFallback("Could not check AR support."));
  } else {
    showFallback("WebXR is not available in this browser. Use Chrome on an AR-capable Android phone.");
  }
}

// [Task C] Bedside table 0.45 x 0.40 x 0.55 m. Origin = centre of the base (y = 0 is the floor).
// The drawer front looks towards +z.
function buildProduct() {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x8b5a2b });
  const light = new THREE.MeshStandardMaterial({ color: 0xa9743f });
  const dark = new THREE.MeshStandardMaterial({ color: 0x333333 });

  function addBox(w, h, d, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    group.add(mesh);
  }

  addBox(0.45, 0.03, 0.40, 0, 0.535, 0, wood);        // table top
  addBox(0.41, 0.30, 0.36, 0, 0.37, -0.01, wood);     // cabinet body
  addBox(0.37, 0.12, 0.02, 0, 0.42, 0.18, light);     // drawer front
  addBox(0.10, 0.015, 0.01, 0, 0.42, 0.195, dark);    // drawer handle
  for (const sx of [-1, 1]) {                         // four legs
    for (const sz of [-1, 1]) {
      addBox(0.04, 0.22, 0.04, sx * 0.18, 0.11, sz * 0.15, wood);
    }
  }
  return group;
}

function onSelect() {
  placeRequested = true;
}

// [Task A] start the AR session ourselves (no ARButton)
function onRequestSession() {
  navigator.xr.requestSession("immersive-ar", {
    requiredFeatures: ["hit-test"],
    optionalFeatures: ["anchors", "dom-overlay"],
    domOverlay: { root: overlay }
  })
    .then(onSessionStarted)
    .catch((err) => setStatus("Could not start AR: " + err.message));
}

function onSessionStarted(session) {
  xrSession = session;
  btn.textContent = "STOP AR";
  session.addEventListener("end", onSessionEnd); // STOP button AND system back gesture both end up here
  renderer.xr.setReferenceSpaceType("local");
  renderer.xr.setSession(session);
  setStatus(STUDENT_ID + " - " + VARIANT_TEXT + "\nAR session starting...");
  animate();
}

function animate() {
  renderer.setAnimationLoop(render);
}

// [Part 2] the frame callback: tracking check, hit test, reticle, placement, anchors, overlay
function render(time, frame) {
  const referenceSpace = frame ? renderer.xr.getReferenceSpace() : null;

  if (frame && referenceSpace) {
    const session = frame.session;
    const anchorsOn = !!(session.enabledFeatures && session.enabledFeatures.includes("anchors"));

    // [Task E] tracking-lost check: no viewer pose, or the position is only guessed
    const viewerPose = frame.getViewerPose(referenceSpace);
    trackingLost = !viewerPose || viewerPose.emulatedPosition;

    // [Task B + Task A, break 3] request the hit-test source from the VIEWER space only ONCE
    if (!hitTestSourceRequested) {
      hitTestSourceRequested = true;
      session.requestReferenceSpace("viewer").then((viewerSpace) => {
        session.requestHitTestSource({ space: viewerSpace }).then((source) => {
          if (xrSession === session) {
            hitTestSource = source;
          } else {
            source.cancel(); // the session ended while we were waiting
          }
        });
      });
    }

    // [Task B] hit results -> reticle matrix, tilt filter, colour
    let hit = null;
    let surfaceOk = false;
    let reticleText = "none";
    reticle.visible = false;
    if (hitTestSource) {
      const results = frame.getHitTestResults(hitTestSource);
      if (results.length > 0) {
        const pose = results[0].getPose(referenceSpace);
        if (pose) {
          hit = results[0];
          reticle.matrix.fromArray(pose.transform.matrix);
          reticle.matrixWorldNeedsUpdate = true;
          reticle.visible = true;
          // the y-axis column of the pose matrix is the surface normal
          const e = reticle.matrix.elements;
          _normal.set(e[4], e[5], e[6]).normalize();
          const tiltDeg = THREE.MathUtils.radToDeg(_normal.angleTo(_up));
          surfaceOk = tiltDeg <= TILT_LIMIT_DEG;
          reticle.material.color.set(surfaceOk ? 0x00ff00 : 0xff0000);
          reticleText = (surfaceOk ? "valid" : "too tilted") + " (" + tiltDeg.toFixed(1) + " deg)";
        }
      }
    }

    // [Task D] place with THIS frame's hit (only on a green reticle and with tracking)
    if (placeRequested) {
      placeRequested = false;
      if (hit && surfaceOk && !trackingLost) {
        placeProduct(hit, anchorsOn);
      }
    }

    // [Task D] every anchored product follows its anchor
    for (const p of placed) {
      if (p.anchor) {
        const anchorPose = frame.getPose(p.anchor.anchorSpace, referenceSpace);
        p.object.visible = !!anchorPose;
        if (anchorPose) {
          p.object.matrix.fromArray(anchorPose.transform.matrix).multiply(_yawMatrix.makeRotationY(p.yaw));
          p.object.matrixWorldNeedsUpdate = true;
        }
      }
    }

    // [Task E] overlay
    updateOverlay(reticleText, anchorsOn);
  }
  renderer.render(scene, camera);
}

// [Task D] multi mode: up to MAX_PRODUCTS, the next tap removes the oldest
function placeProduct(hit, anchorsOn) {
  if (placed.length >= MAX_PRODUCTS) {
    removeProduct(placed.shift());
  }
  // yaw = 0 means: keep the orientation of the hit pose (facing rule of my variant)
  const entry = { object: buildProduct(), anchor: null, yaw: 0 };
  entry.object.matrixAutoUpdate = false;
  entry.object.matrix.copy(reticle.matrix);
  entry.object.matrixWorldNeedsUpdate = true;
  scene.add(entry.object);
  placed.push(entry);

  // anchors available -> keep the product fixed to the world; otherwise it just keeps the reticle matrix
  if (anchorsOn && hit.createAnchor) {
    hit.createAnchor()
      .then((anchor) => {
        if (placed.includes(entry)) {
          entry.anchor = anchor;
        } else {
          anchor.delete(); // the product was removed while the anchor was being created
        }
      })
      .catch((err) => console.warn("createAnchor failed, product keeps the hit-pose matrix", err));
  }
}

function removeProduct(entry) {
  if (entry.anchor) {
    try {
      entry.anchor.delete();
    } catch (e) {
      // the session may already be over
    }
  }
  scene.remove(entry.object);
}

function endXRSession() {
  if (xrSession) {
    xrSession.end();
  }
}

// [Task A] one reset for both ways of ending the session
function onSessionEnd() {
  btn.textContent = "START AR";
  if (hitTestSource) {
    hitTestSource.cancel();
    hitTestSource = null;
  }
  hitTestSourceRequested = false;
  clearAll();
  placeRequested = false;
  trackingLost = false;
  lastStatusText = "";
  reticle.visible = false;
  xrSession = null;
  renderer.setAnimationLoop(null);
  setStatus("AR session ended. Press START AR.");
}

// [Task E] Clear: remove every product and delete its anchor
function clearAll() {
  for (const p of placed) {
    removeProduct(p);
  }
  placed.length = 0;
}

// [Task E] the panel: ID, variant, session state, reticle state, anchors, product count
function updateOverlay(reticleText, anchorsOn) {
  const text =
    "ID: " + STUDENT_ID + "\n" +
    "Variant: " + VARIANT_TEXT + "\n" +
    "Session: " + (trackingLost ? "tracking lost" : "running") + "\n" +
    "Reticle: " + reticleText + "\n" +
    "Anchors: " + (anchorsOn ? "on" : "off") + "\n" +
    "Products: " + placed.length + "/" + MAX_PRODUCTS +
    (trackingLost ? "\nTracking lost - move the phone slowly" : "");
  if (text !== lastStatusText) {
    lastStatusText = text;
    setStatus(text);
  }
}

function setStatus(text) {
  statusEl.textContent = text;
}

function showFallback(message) {
  fallbackEl.textContent = message;
  fallbackEl.hidden = false;
  if (btn) {
    btn.hidden = true;
  }
  setStatus(message);
}
