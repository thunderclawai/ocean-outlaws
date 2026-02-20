// shipModels.js — unique procedural 3D models for each ship class
import * as THREE from "three";

// --- Destroyer: sleek, narrow, fast-looking hull ---
function buildDestroyerMesh() {
  var group = new THREE.Group();

  var hullShape = new THREE.Shape();
  hullShape.moveTo(0, 2.8);
  hullShape.lineTo(0.5, 1.4);
  hullShape.lineTo(0.6, 0);
  hullShape.lineTo(0.55, -1.6);
  hullShape.lineTo(0.3, -2.0);
  hullShape.lineTo(-0.3, -2.0);
  hullShape.lineTo(-0.55, -1.6);
  hullShape.lineTo(-0.6, 0);
  hullShape.lineTo(-0.5, 1.4);
  hullShape.lineTo(0, 2.8);

  var hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 0.4, bevelEnabled: false });
  var hullMat = new THREE.MeshLambertMaterial({ color: 0x3366aa });
  var hull = new THREE.Mesh(hullGeo, hullMat);
  hull.rotation.x = -Math.PI / 2;
  hull.position.y = -0.1;
  group.add(hull);

  var deckGeo = new THREE.PlaneGeometry(0.9, 3.8);
  var deckMat = new THREE.MeshLambertMaterial({ color: 0x4477aa });
  var deck = new THREE.Mesh(deckGeo, deckMat);
  deck.rotation.x = -Math.PI / 2;
  deck.position.y = 0.3;
  deck.position.z = -0.1;
  group.add(deck);

  // small bridge
  var bridgeGeo = new THREE.BoxGeometry(0.5, 0.45, 0.6);
  var bridgeMat = new THREE.MeshLambertMaterial({ color: 0x5588bb });
  var bridge = new THREE.Mesh(bridgeGeo, bridgeMat);
  bridge.position.set(0, 0.55, -0.5);
  group.add(bridge);

  // turrets
  var turretGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.25, 6);
  var turretMat = new THREE.MeshLambertMaterial({ color: 0x2255aa });
  var barrelGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.65, 4);
  var barrelMat = new THREE.MeshLambertMaterial({ color: 0x224488 });

  var fwdTurret = new THREE.Group();
  fwdTurret.position.set(0, 0.5, 1.0);
  fwdTurret.add(new THREE.Mesh(turretGeo, turretMat));
  var fwdBarrel = new THREE.Mesh(barrelGeo, barrelMat);
  fwdBarrel.rotation.x = Math.PI / 2;
  fwdBarrel.position.set(0, 0.08, 0.33);
  fwdTurret.add(fwdBarrel);
  group.add(fwdTurret);

  var rearTurret = new THREE.Group();
  rearTurret.position.set(0, 0.5, -1.2);
  rearTurret.add(new THREE.Mesh(turretGeo, turretMat));
  var rearBarrel = new THREE.Mesh(barrelGeo, barrelMat);
  rearBarrel.rotation.x = Math.PI / 2;
  rearBarrel.position.set(0, 0.08, 0.33);
  rearTurret.add(rearBarrel);
  group.add(rearTurret);

  group.userData.turrets = [fwdTurret, rearTurret];

  // antenna
  var mastGeo = new THREE.CylinderGeometry(0.015, 0.025, 0.8, 4);
  var mastMat = new THREE.MeshLambertMaterial({ color: 0x3366aa });
  var mast = new THREE.Mesh(mastGeo, mastMat);
  mast.position.set(0, 1.0, -0.5);
  group.add(mast);

  return group;
}

// --- Cruiser: wide, sturdy, balanced hull (reuse original design with tweaks) ---
function buildCruiserMesh() {
  var group = new THREE.Group();

  var hullShape = new THREE.Shape();
  hullShape.moveTo(0, 2.4);
  hullShape.lineTo(0.8, 1.0);
  hullShape.lineTo(0.9, -0.4);
  hullShape.lineTo(0.8, -1.8);
  hullShape.lineTo(0.5, -2.2);
  hullShape.lineTo(-0.5, -2.2);
  hullShape.lineTo(-0.8, -1.8);
  hullShape.lineTo(-0.9, -0.4);
  hullShape.lineTo(-0.8, 1.0);
  hullShape.lineTo(0, 2.4);

  var hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 0.55, bevelEnabled: false });
  var hullMat = new THREE.MeshLambertMaterial({ color: 0x7a6633 });
  var hull = new THREE.Mesh(hullGeo, hullMat);
  hull.rotation.x = -Math.PI / 2;
  hull.position.y = -0.1;
  group.add(hull);

  var deckGeo = new THREE.PlaneGeometry(1.4, 3.8);
  var deckMat = new THREE.MeshLambertMaterial({ color: 0x887744 });
  var deck = new THREE.Mesh(deckGeo, deckMat);
  deck.rotation.x = -Math.PI / 2;
  deck.position.y = 0.45;
  deck.position.z = -0.2;
  group.add(deck);

  // large bridge
  var bridgeGeo = new THREE.BoxGeometry(0.8, 0.7, 0.9);
  var bridgeMat = new THREE.MeshLambertMaterial({ color: 0x998855 });
  var bridge = new THREE.Mesh(bridgeGeo, bridgeMat);
  bridge.position.set(0, 0.8, -0.5);
  group.add(bridge);

  // three turrets for broadside
  var turretGeo = new THREE.CylinderGeometry(0.22, 0.27, 0.3, 6);
  var turretMat = new THREE.MeshLambertMaterial({ color: 0x665522 });
  var barrelGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.7, 4);
  var barrelMat = new THREE.MeshLambertMaterial({ color: 0x554411 });

  var turrets = [];
  var positions = [
    [0, 0.6, 1.0],
    [0, 0.6, -0.2],
    [0, 0.6, -1.5]
  ];
  for (var i = 0; i < positions.length; i++) {
    var t = new THREE.Group();
    t.position.set(positions[i][0], positions[i][1], positions[i][2]);
    t.add(new THREE.Mesh(turretGeo, turretMat));
    var b = new THREE.Mesh(barrelGeo, barrelMat);
    b.rotation.x = Math.PI / 2;
    b.position.set(0, 0.1, 0.35);
    t.add(b);
    group.add(t);
    turrets.push(t);
  }
  group.userData.turrets = turrets;

  // mast
  var mastGeo = new THREE.CylinderGeometry(0.025, 0.035, 1.2, 4);
  var mastMat = new THREE.MeshLambertMaterial({ color: 0x7a6633 });
  var mast = new THREE.Mesh(mastGeo, mastMat);
  mast.position.set(0, 1.5, -0.5);
  group.add(mast);

  return group;
}

// --- Carrier: large, flat deck for drones, wide body ---
function buildCarrierMesh() {
  var group = new THREE.Group();

  var hullShape = new THREE.Shape();
  hullShape.moveTo(0, 2.6);
  hullShape.lineTo(1.0, 1.2);
  hullShape.lineTo(1.1, -0.4);
  hullShape.lineTo(1.0, -2.0);
  hullShape.lineTo(0.7, -2.6);
  hullShape.lineTo(-0.7, -2.6);
  hullShape.lineTo(-1.0, -2.0);
  hullShape.lineTo(-1.1, -0.4);
  hullShape.lineTo(-1.0, 1.2);
  hullShape.lineTo(0, 2.6);

  var hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 0.6, bevelEnabled: false });
  var hullMat = new THREE.MeshLambertMaterial({ color: 0x336644 });
  var hull = new THREE.Mesh(hullGeo, hullMat);
  hull.rotation.x = -Math.PI / 2;
  hull.position.y = -0.1;
  group.add(hull);

  // flight deck — large flat area
  var deckGeo = new THREE.PlaneGeometry(1.8, 4.2);
  var deckMat = new THREE.MeshLambertMaterial({ color: 0x447755 });
  var deck = new THREE.Mesh(deckGeo, deckMat);
  deck.rotation.x = -Math.PI / 2;
  deck.position.y = 0.5;
  deck.position.z = -0.2;
  group.add(deck);

  // runway markings (thin stripe)
  var stripeGeo = new THREE.PlaneGeometry(0.08, 3.2);
  var stripeMat = new THREE.MeshLambertMaterial({ color: 0xccccaa });
  var stripe = new THREE.Mesh(stripeGeo, stripeMat);
  stripe.rotation.x = -Math.PI / 2;
  stripe.position.y = 0.51;
  stripe.position.z = 0.2;
  group.add(stripe);

  // island (bridge offset to starboard)
  var bridgeGeo = new THREE.BoxGeometry(0.5, 0.8, 0.7);
  var bridgeMat = new THREE.MeshLambertMaterial({ color: 0x558866 });
  var bridge = new THREE.Mesh(bridgeGeo, bridgeMat);
  bridge.position.set(0.65, 0.9, -0.8);
  group.add(bridge);

  // single defensive turret
  var turretGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.25, 6);
  var turretMat = new THREE.MeshLambertMaterial({ color: 0x335533 });
  var barrelGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.6, 4);
  var barrelMat = new THREE.MeshLambertMaterial({ color: 0x224422 });

  var fwdTurret = new THREE.Group();
  fwdTurret.position.set(0, 0.6, 1.2);
  fwdTurret.add(new THREE.Mesh(turretGeo, turretMat));
  var fwdBarrel = new THREE.Mesh(barrelGeo, barrelMat);
  fwdBarrel.rotation.x = Math.PI / 2;
  fwdBarrel.position.set(0, 0.08, 0.3);
  fwdTurret.add(fwdBarrel);
  group.add(fwdTurret);

  var rearTurret = new THREE.Group();
  rearTurret.position.set(0, 0.6, -1.8);
  rearTurret.add(new THREE.Mesh(turretGeo, turretMat));
  var rearBarrel = new THREE.Mesh(barrelGeo, barrelMat);
  rearBarrel.rotation.x = Math.PI / 2;
  rearBarrel.position.set(0, 0.08, 0.3);
  rearTurret.add(rearBarrel);
  group.add(rearTurret);

  group.userData.turrets = [fwdTurret, rearTurret];

  // mast
  var mastGeo = new THREE.CylinderGeometry(0.02, 0.03, 1.0, 4);
  var mastMat = new THREE.MeshLambertMaterial({ color: 0x336644 });
  var mast = new THREE.Mesh(mastGeo, mastMat);
  mast.position.set(0.65, 1.5, -0.8);
  group.add(mast);

  return group;
}

// --- Submarine: low profile, rounded hull, conning tower ---
function buildSubmarineMesh() {
  var group = new THREE.Group();

  // elongated rounded hull
  var hullShape = new THREE.Shape();
  hullShape.moveTo(0, 2.2);
  hullShape.lineTo(0.4, 1.4);
  hullShape.lineTo(0.5, 0);
  hullShape.lineTo(0.45, -1.4);
  hullShape.lineTo(0.2, -2.0);
  hullShape.lineTo(-0.2, -2.0);
  hullShape.lineTo(-0.45, -1.4);
  hullShape.lineTo(-0.5, 0);
  hullShape.lineTo(-0.4, 1.4);
  hullShape.lineTo(0, 2.2);

  var hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 0.35, bevelEnabled: false });
  var hullMat = new THREE.MeshLambertMaterial({ color: 0x445566 });
  var hull = new THREE.Mesh(hullGeo, hullMat);
  hull.rotation.x = -Math.PI / 2;
  hull.position.y = -0.15;
  group.add(hull);

  // low deck
  var deckGeo = new THREE.PlaneGeometry(0.7, 3.4);
  var deckMat = new THREE.MeshLambertMaterial({ color: 0x556677 });
  var deck = new THREE.Mesh(deckGeo, deckMat);
  deck.rotation.x = -Math.PI / 2;
  deck.position.y = 0.2;
  deck.position.z = -0.1;
  group.add(deck);

  // conning tower (tall, narrow)
  var towerGeo = new THREE.BoxGeometry(0.4, 0.7, 0.5);
  var towerMat = new THREE.MeshLambertMaterial({ color: 0x667788 });
  var tower = new THREE.Mesh(towerGeo, towerMat);
  tower.position.set(0, 0.55, -0.2);
  group.add(tower);

  // periscope
  var periGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.6, 4);
  var periMat = new THREE.MeshLambertMaterial({ color: 0x778899 });
  var peri = new THREE.Mesh(periGeo, periMat);
  peri.position.set(0, 1.2, -0.2);
  group.add(peri);

  // single forward turret
  var turretGeo = new THREE.CylinderGeometry(0.15, 0.2, 0.2, 6);
  var turretMat = new THREE.MeshLambertMaterial({ color: 0x3a4a5a });
  var barrelGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 4);
  var barrelMat = new THREE.MeshLambertMaterial({ color: 0x2a3a4a });

  var fwdTurret = new THREE.Group();
  fwdTurret.position.set(0, 0.35, 0.8);
  fwdTurret.add(new THREE.Mesh(turretGeo, turretMat));
  var fwdBarrel = new THREE.Mesh(barrelGeo, barrelMat);
  fwdBarrel.rotation.x = Math.PI / 2;
  fwdBarrel.position.set(0, 0.06, 0.25);
  fwdTurret.add(fwdBarrel);
  group.add(fwdTurret);

  var rearTurret = new THREE.Group();
  rearTurret.position.set(0, 0.35, -1.2);
  rearTurret.add(new THREE.Mesh(turretGeo, turretMat));
  var rearBarrel2 = new THREE.Mesh(barrelGeo, barrelMat);
  rearBarrel2.rotation.x = Math.PI / 2;
  rearBarrel2.position.set(0, 0.06, 0.25);
  rearTurret.add(rearBarrel2);
  group.add(rearTurret);

  group.userData.turrets = [fwdTurret, rearTurret];

  return group;
}

// --- build mesh by class key ---
export function buildClassMesh(classKey) {
  if (classKey === "destroyer") return buildDestroyerMesh();
  if (classKey === "cruiser") return buildCruiserMesh();
  if (classKey === "carrier") return buildCarrierMesh();
  if (classKey === "submarine") return buildSubmarineMesh();
  return buildCruiserMesh();
}
