import * as THREE from "three";
import { createOcean, updateOcean, getWaveHeight } from "./ocean.js";
import { createCamera, updateCamera, resizeCamera } from "./camera.js";
import { createShip, updateShip, getSpeedRatio, getDisplaySpeed } from "./ship.js";
import { initInput, getInput, getMouse, consumeFire } from "./input.js";
import { createHUD, updateHUD } from "./hud.js";
import { initNav, updateNav } from "./nav.js";
import { createTurretSystem, aimTurrets, fire, updateTurrets, screenToWorld } from "./turret.js";
import { createEnemyManager, updateEnemies, getPlayerHp, setOnDeathCallback, setPlayerHp } from "./enemy.js";
import { initHealthBars, updateHealthBars } from "./health.js";
import { createResources, consumeFuel, getFuelSpeedMult, updateWave } from "./resource.js";
import { createPickupManager, spawnPickup, updatePickups } from "./pickup.js";

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

// --- resources ---
var resources = createResources();

// --- pickup manager ---
var pickupMgr = createPickupManager();

// --- enemy manager ---
var enemyMgr = createEnemyManager();

// wire enemy death → pickup spawn
setOnDeathCallback(enemyMgr, function (x, y, z) {
  spawnPickup(pickupMgr, x, y, z, scene);
});

// --- input ---
initInput();

// --- turret system ---
var turrets = createTurretSystem(ship);
// sync turret display with resource ammo
turrets.ammo = resources.ammo;
turrets.maxAmmo = resources.maxAmmo;

// --- HUD ---
createHUD();

// --- health bars ---
initHealthBars();

// --- camera ---
var cam = createCamera(window.innerWidth / window.innerHeight);

// --- click/tap-to-move navigation ---
initNav(cam.camera, ship, scene);

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
  var mouse = getMouse();

  // fuel affects max speed
  var fuelMult = getFuelSpeedMult(resources);
  updateShip(ship, input, dt, getWaveHeight, elapsed, fuelMult);

  // consume fuel based on throttle
  var speedRatio = getSpeedRatio(ship);
  consumeFuel(resources, speedRatio, dt);

  updateOcean(ocean.uniforms, elapsed);
  updateNav(ship, elapsed);
  updateCamera(cam, dt, ship.posX, ship.posZ);

  // aim turrets toward mouse/touch position projected onto water plane
  var aimTarget = screenToWorld(mouse.x, mouse.y, cam.camera);
  if (aimTarget) {
    aimTurrets(turrets, aimTarget);
  }

  // fire on click/tap (using resource ammo)
  if (mouse.firePressed && !mouse.fireConsumed) {
    fire(turrets, scene, resources);
    consumeFire();
  }

  // update projectiles, effects, hit detection
  updateTurrets(turrets, dt, scene, enemyMgr);

  // update enemies (spawn, AI, firing, destruction) — pass resources for wave gating
  updateEnemies(enemyMgr, ship, dt, scene, getWaveHeight, elapsed, resources);

  // update pickups (bob, collect, despawn)
  updatePickups(pickupMgr, ship, resources, dt, elapsed, getWaveHeight, scene);

  // wave management — repair between waves
  var hpInfo = getPlayerHp(enemyMgr);
  var aliveEnemyCount = 0;
  for (var i = 0; i < enemyMgr.enemies.length; i++) {
    if (enemyMgr.enemies[i].alive) aliveEnemyCount++;
  }
  var newHp = updateWave(resources, aliveEnemyCount, hpInfo.hp, hpInfo.maxHp, dt);
  if (newHp !== null) {
    setPlayerHp(enemyMgr, newHp);
    hpInfo = getPlayerHp(enemyMgr);
  }

  // sync turret ammo display with resources
  turrets.ammo = resources.ammo;
  turrets.maxAmmo = resources.maxAmmo;

  // health bars above ships
  updateHealthBars(cam.camera, enemyMgr.enemies, ship, hpInfo.hp, hpInfo.maxHp);

  updateHUD(
    speedRatio, getDisplaySpeed(ship), ship.heading,
    resources.ammo, resources.maxAmmo,
    hpInfo.hp, hpInfo.maxHp,
    resources.fuel, resources.maxFuel,
    resources.parts,
    resources.wave, resources.waveActive
  );

  renderer.render(scene, cam.camera);
}

animate();
