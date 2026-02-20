// ship.js — procedural ship model, physics state, update loop
import * as THREE from "three";

// --- physics tuning ---
var MAX_SPEED = 30;
var ACCEL = 12;
var REVERSE_ACCEL = 6;
var DRAG = 4;
var TURN_SPEED_LOW = 2.2;   // turning rate at zero speed (rad/s)
var TURN_SPEED_HIGH = 0.8;  // turning rate at max speed (rad/s)
var FLOAT_OFFSET = 1.2;     // height above wave surface so hull clears peaks

// --- auto-nav tuning ---
var NAV_ARRIVE_RADIUS = 3;    // stop within this distance
var NAV_SLOW_RADIUS = 15;     // start decelerating
var NAV_TURN_SPEED = 2.5;     // auto-nav turning rate (rad/s)

// --- procedural ship geometry ---
function buildShipMesh() {
  var group = new THREE.Group();

  // hull — tapered box narrowing at bow
  var hullShape = new THREE.Shape();
  hullShape.moveTo(0, 2.4);     // bow tip
  hullShape.lineTo(0.7, 1.0);
  hullShape.lineTo(0.8, -0.6);
  hullShape.lineTo(0.7, -1.8);  // stern quarter
  hullShape.lineTo(0.5, -2.2);  // stern
  hullShape.lineTo(-0.5, -2.2);
  hullShape.lineTo(-0.7, -1.8);
  hullShape.lineTo(-0.8, -0.6);
  hullShape.lineTo(-0.7, 1.0);
  hullShape.lineTo(0, 2.4);

  var extrudeSettings = { depth: 0.5, bevelEnabled: false };
  var hullGeo = new THREE.ExtrudeGeometry(hullShape, extrudeSettings);
  var hullMat = new THREE.MeshLambertMaterial({ color: 0x556677 });
  var hull = new THREE.Mesh(hullGeo, hullMat);
  hull.rotation.x = -Math.PI / 2;
  hull.position.y = -0.1;
  group.add(hull);

  // deck — flat plane on top
  var deckGeo = new THREE.PlaneGeometry(1.2, 3.6);
  var deckMat = new THREE.MeshLambertMaterial({ color: 0x667788 });
  var deck = new THREE.Mesh(deckGeo, deckMat);
  deck.rotation.x = -Math.PI / 2;
  deck.position.y = 0.4;
  deck.position.z = -0.2;
  group.add(deck);

  // bridge — small box toward stern
  var bridgeGeo = new THREE.BoxGeometry(0.7, 0.6, 0.8);
  var bridgeMat = new THREE.MeshLambertMaterial({ color: 0x778899 });
  var bridge = new THREE.Mesh(bridgeGeo, bridgeMat);
  bridge.position.set(0, 0.7, -0.6);
  group.add(bridge);

  // forward turret — rotatable group (child of ship so it moves with ship)
  var turretGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.3, 6);
  var turretMat = new THREE.MeshLambertMaterial({ color: 0x445566 });
  var barrelGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.7, 4);
  var barrelMat = new THREE.MeshLambertMaterial({ color: 0x334455 });

  var fwdTurret = new THREE.Group();
  fwdTurret.position.set(0, 0.55, 0.8);
  var fwdBase = new THREE.Mesh(turretGeo, turretMat);
  fwdTurret.add(fwdBase);
  var fwdBarrel = new THREE.Mesh(barrelGeo, barrelMat);
  fwdBarrel.rotation.x = Math.PI / 2;
  fwdBarrel.position.set(0, 0.1, 0.35);
  fwdTurret.add(fwdBarrel);
  group.add(fwdTurret);

  // rear turret — rotatable group
  var rearTurret = new THREE.Group();
  rearTurret.position.set(0, 0.55, -1.4);
  var rearBase = new THREE.Mesh(turretGeo, turretMat);
  rearTurret.add(rearBase);
  var rearBarrel = new THREE.Mesh(barrelGeo, barrelMat);
  rearBarrel.rotation.x = Math.PI / 2;
  rearBarrel.position.set(0, 0.1, 0.35);
  rearTurret.add(rearBarrel);
  group.add(rearTurret);

  group.userData.turrets = [fwdTurret, rearTurret];

  // mast / antenna
  var mastGeo = new THREE.CylinderGeometry(0.02, 0.03, 1.0, 4);
  var mastMat = new THREE.MeshLambertMaterial({ color: 0x556677 });
  var mast = new THREE.Mesh(mastGeo, mastMat);
  mast.position.set(0, 1.3, -0.6);
  group.add(mast);

  return group;
}

// --- create ship ---
export function createShip() {
  var mesh = buildShipMesh();

  var state = {
    mesh: mesh,
    speed: 0,
    heading: 0,          // radians, 0 = +Z direction initially facing "north"
    posX: 0,
    posZ: 0,
    // auto-navigation
    navTarget: null       // { x, z } or null when no auto-nav
  };

  return state;
}

// --- set auto-nav destination ---
export function setNavTarget(ship, x, z) {
  ship.navTarget = { x: x, z: z };
}

// --- clear auto-nav ---
export function clearNavTarget(ship) {
  ship.navTarget = null;
}

// --- normalize angle to [-PI, PI] ---
function normalizeAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

// --- update ship physics ---
// fuelMult: 0-1 multiplier on max speed from fuel level (optional, defaults to 1)
export function updateShip(ship, input, dt, getWaveHeight, elapsed, fuelMult) {
  var effectiveMaxSpeed = MAX_SPEED * (fuelMult !== undefined ? fuelMult : 1);
  var wasdActive = input.forward || input.backward || input.left || input.right;

  // WASD overrides auto-nav
  if (wasdActive) {
    ship.navTarget = null;
  }

  if (ship.navTarget && !wasdActive) {
    // --- auto-navigation ---
    var dx = ship.navTarget.x - ship.posX;
    var dz = ship.navTarget.z - ship.posZ;
    var dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < NAV_ARRIVE_RADIUS) {
      // arrived — stop
      ship.navTarget = null;
      ship.speed *= 0.8; // gentle decel
    } else {
      // steer toward target
      var targetAngle = Math.atan2(dx, dz);
      var angleDiff = normalizeAngle(targetAngle - ship.heading);

      // rotate toward target
      var maxTurn = NAV_TURN_SPEED * dt;
      if (Math.abs(angleDiff) < maxTurn) {
        ship.heading = targetAngle;
      } else {
        ship.heading += Math.sign(angleDiff) * maxTurn;
      }

      // throttle — full speed far away, decelerate near target
      var speedFactor = Math.min(1, dist / NAV_SLOW_RADIUS);
      var desiredSpeed = effectiveMaxSpeed * speedFactor;
      // only accelerate when roughly facing target
      if (Math.abs(angleDiff) < Math.PI * 0.5) {
        if (ship.speed < desiredSpeed) {
          ship.speed += ACCEL * dt;
          if (ship.speed > desiredSpeed) ship.speed = desiredSpeed;
        } else {
          ship.speed -= DRAG * dt;
          if (ship.speed < desiredSpeed) ship.speed = desiredSpeed;
        }
      } else {
        // turning in place — slow down
        ship.speed -= DRAG * dt;
        if (ship.speed < 0) ship.speed = 0;
      }
    }
  } else {
    // --- manual WASD controls ---
    if (input.forward) {
      ship.speed += ACCEL * dt;
    } else if (input.backward) {
      ship.speed -= REVERSE_ACCEL * dt;
    }

    // drag — always opposes motion
    if (!input.forward && !input.backward) {
      if (ship.speed > 0) {
        ship.speed -= DRAG * dt;
        if (ship.speed < 0) ship.speed = 0;
      } else if (ship.speed < 0) {
        ship.speed += DRAG * dt;
        if (ship.speed > 0) ship.speed = 0;
      }
    }

    // turning — interpolate turn rate based on speed ratio
    var speedRatio = Math.abs(ship.speed) / effectiveMaxSpeed;
    var turnRate = TURN_SPEED_LOW + (TURN_SPEED_HIGH - TURN_SPEED_LOW) * speedRatio;
    var turnMult = Math.max(0.1, Math.min(1, Math.abs(ship.speed) / 5));

    if (input.left)  ship.heading += turnRate * turnMult * dt;
    if (input.right) ship.heading -= turnRate * turnMult * dt;
  }

  // clamp speed
  var maxReverse = effectiveMaxSpeed * 0.3;
  ship.speed = Math.max(-maxReverse, Math.min(effectiveMaxSpeed, ship.speed));

  // movement
  ship.posX += Math.sin(ship.heading) * ship.speed * dt;
  ship.posZ += Math.cos(ship.heading) * ship.speed * dt;

  // apply to mesh
  ship.mesh.position.x = ship.posX;
  ship.mesh.position.z = ship.posZ;
  ship.mesh.rotation.y = ship.heading;

  // --- buoyancy: sample wave height and float above it ---
  if (getWaveHeight) {
    var waveY = getWaveHeight(ship.posX, ship.posZ, elapsed);
    ship.mesh.position.y = waveY + FLOAT_OFFSET;

    // gentle pitch/roll from wave slope
    var sampleDist = 1.5;
    var waveFore = getWaveHeight(ship.posX + Math.sin(ship.heading) * sampleDist, ship.posZ + Math.cos(ship.heading) * sampleDist, elapsed);
    var waveAft  = getWaveHeight(ship.posX - Math.sin(ship.heading) * sampleDist, ship.posZ - Math.cos(ship.heading) * sampleDist, elapsed);
    var wavePort = getWaveHeight(ship.posX + Math.cos(ship.heading) * sampleDist, ship.posZ - Math.sin(ship.heading) * sampleDist, elapsed);
    var waveStbd = getWaveHeight(ship.posX - Math.cos(ship.heading) * sampleDist, ship.posZ + Math.sin(ship.heading) * sampleDist, elapsed);

    var pitch = Math.atan2(waveFore - waveAft, sampleDist * 2) * 0.3;
    var roll  = Math.atan2(wavePort - waveStbd, sampleDist * 2) * 0.3;

    ship.mesh.rotation.x = pitch;
    ship.mesh.rotation.z = roll;
  }
}

// --- get normalized speed for HUD (0-1) ---
export function getSpeedRatio(ship) {
  return Math.abs(ship.speed) / MAX_SPEED;
}

// --- get speed in display units (knots-like) ---
export function getDisplaySpeed(ship) {
  return Math.abs(ship.speed);
}
