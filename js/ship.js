// ship.js — procedural ship model, physics state, update loop
import * as THREE from "three";

// --- physics tuning ---
var MAX_SPEED = 30;
var ACCEL = 12;
var REVERSE_ACCEL = 6;
var DRAG = 4;
var TURN_SPEED_LOW = 2.2;   // turning rate at zero speed (rad/s)
var TURN_SPEED_HIGH = 0.8;  // turning rate at max speed (rad/s)
var WATER_Y = 0.3;          // height of ship on water plane

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

  // forward turret mount
  var turretGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.3, 6);
  var turretMat = new THREE.MeshLambertMaterial({ color: 0x445566 });
  var turret1 = new THREE.Mesh(turretGeo, turretMat);
  turret1.position.set(0, 0.55, 0.8);
  group.add(turret1);

  // barrel on forward turret
  var barrelGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.7, 4);
  var barrelMat = new THREE.MeshLambertMaterial({ color: 0x334455 });
  var barrel1 = new THREE.Mesh(barrelGeo, barrelMat);
  barrel1.rotation.x = Math.PI / 2;
  barrel1.position.set(0, 0.65, 1.15);
  group.add(barrel1);

  // rear turret mount
  var turret2 = new THREE.Mesh(turretGeo, turretMat);
  turret2.position.set(0, 0.55, -1.4);
  group.add(turret2);

  // barrel on rear turret
  var barrel2 = new THREE.Mesh(barrelGeo, barrelMat);
  barrel2.rotation.x = -Math.PI / 2;
  barrel2.position.set(0, 0.65, -1.75);
  group.add(barrel2);

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
  mesh.position.y = WATER_Y;

  var state = {
    mesh: mesh,
    speed: 0,
    heading: 0,          // radians, 0 = +Z direction initially facing "north"
    posX: 0,
    posZ: 0
  };

  return state;
}

// --- update ship physics ---
export function updateShip(ship, input, dt) {
  // acceleration / deceleration
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

  // clamp speed
  var maxReverse = MAX_SPEED * 0.3;
  ship.speed = Math.max(-maxReverse, Math.min(MAX_SPEED, ship.speed));

  // turning — interpolate turn rate based on speed ratio
  var speedRatio = Math.abs(ship.speed) / MAX_SPEED;
  var turnRate = TURN_SPEED_LOW + (TURN_SPEED_HIGH - TURN_SPEED_LOW) * speedRatio;

  // only turn when moving (or barely turn when stopped)
  var turnMult = Math.max(0.1, Math.min(1, Math.abs(ship.speed) / 5));

  if (input.left)  ship.heading += turnRate * turnMult * dt;
  if (input.right) ship.heading -= turnRate * turnMult * dt;

  // movement
  ship.posX += Math.sin(ship.heading) * ship.speed * dt;
  ship.posZ += Math.cos(ship.heading) * ship.speed * dt;

  // apply to mesh
  ship.mesh.position.x = ship.posX;
  ship.mesh.position.z = ship.posZ;
  ship.mesh.position.y = WATER_Y;
  ship.mesh.rotation.y = ship.heading;
}

// --- get normalized speed for HUD (0-1) ---
export function getSpeedRatio(ship) {
  return Math.abs(ship.speed) / MAX_SPEED;
}

// --- get speed in display units (knots-like) ---
export function getDisplaySpeed(ship) {
  return Math.abs(ship.speed);
}
