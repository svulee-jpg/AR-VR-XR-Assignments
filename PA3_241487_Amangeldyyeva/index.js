import * as THREE from "three"; // or the node_modules path from Ch. 7

// global scene values
let btn, gl, glCanvas, camera, scene, renderer, controller, reticle;
// global xr values
let xrSession = null, hitTestSource = null, hitTestSourceRequested = false;
let placeRequested = false;
const placed = []; // { object, anchor, yaw }

loadScene();

function loadScene() {
  glCanvas = document.createElement("canvas");
  gl = glCanvas.getContext(/* TODO: which context, which options? */);
  // TODO: camera, scene, lights, renderer (xr.enabled), reticle, controller + 'select'
  // TODO: isSessionSupported('immersive-ar') -> START AR button, or #fallback
}
function buildProduct() {
  // TODO: THREE.Group of >= 3 primitives, metres, origin at base centre
}
function onRequestSession() {
  // TODO: requestSession('immersive-ar', { requiredFeatures, optionalFeatures, domOverlay })
}
function onSessionStarted(session) {
  // TODO: button -> STOP, session 'end' listener, setReferenceSpaceType, setSession, animate
}
function animate() {
  renderer.setAnimationLoop(render);
}
function render(time, frame) {
  if (frame) {
    // TODO: viewer pose + tracking-lost check
    // TODO: request the hit-test source ONCE
    // TODO: hit results -> reticle matrix, tilt filter, colour
    // TODO: if (placeRequested) place with this frame's hit (+ createAnchor)
    // TODO: update every anchored product from frame.getPose(anchor.anchorSpace, ...)
    // TODO: update the overlay
  }
  renderer.render(scene, camera);
}
function endXRSession() {
  // TODO: xrSession.end()
}
function onSessionEnd() {
  // TODO: reset button, cancel hit-test source, delete anchors, clear state
}