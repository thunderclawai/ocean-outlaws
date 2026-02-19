import * as THREE from "three";
import { createOcean, updateOcean } from "./ocean.js";
import { createCamera, updateCamera, resizeCamera } from "./camera.js";
import { createShip, updateShip, getSpeedRatio, getDisplaySpeed } from "./ship.js";
import { initInput, getInput } from "./input.js";
import { createHUD, updateHUD } from "./hud.js";

// --- renderer ---
var renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x0a0e1a);
document.body.appendChild(renderer.domElement);

// --- scene ---
var scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a0e1a, 0.006);

// --- lighting ---
var ambient = new THREE.AmbientLight(0x1a2040, 0.6);
scene.add(ambient);

var sun = new THREE.DirectionalLight(0x4466aa, 0.8);
sun.position.set(50, 80, 30);
scene.add(sun);

// subtle hemisphere for sky/ground tint
var hemi = new THREE.HemisphereLight(0x1a1a3a, 0x050510, 0.3);
scene.add(hemi);

// --- ocean ---
var ocean = createOcean();
scene.add(ocean.mesh);

// --- ship ---
var ship = createShip();
scene.add(ship.mesh);

// --- input ---
initInput();

// --- HUD ---
createHUD();

// --- camera ---
var cam = createCamera(window.innerWidth / window.innerHeight);

// --- resize ---
window.addEventListener("resize", function () {
  renderer.setSize(window.innerWidth, window.innerHeight);
  resizeCamera(cam, window.innerWidth / window.innerHeight);
});

// --- render loop ---
var clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  var dt = clock.getDelta();
  var elapsed = clock.getElapsedTime();

  // cap dt to avoid physics blowup on tab switch
  if (dt > 0.1) dt = 0.1;

  var input = getInput();
  updateShip(ship, input, dt);
  updateOcean(ocean.uniforms, elapsed);
  updateCamera(cam, dt, ship.posX, ship.posZ);
  updateHUD(getSpeedRatio(ship), getDisplaySpeed(ship), ship.heading);

  renderer.render(scene, cam.camera);
}

animate();
