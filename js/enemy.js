// enemy.js — simple enemy ships for hit detection targets
import * as THREE from "three";

var WATER_Y = 0.3;

function buildEnemyMesh() {
  var group = new THREE.Group();

  // hull — simpler red-tinted ship
  var hullShape = new THREE.Shape();
  hullShape.moveTo(0, 1.8);
  hullShape.lineTo(0.5, 0.6);
  hullShape.lineTo(0.6, -0.5);
  hullShape.lineTo(0.5, -1.4);
  hullShape.lineTo(-0.5, -1.4);
  hullShape.lineTo(-0.6, -0.5);
  hullShape.lineTo(-0.5, 0.6);
  hullShape.lineTo(0, 1.8);

  var hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 0.4, bevelEnabled: false });
  var hullMat = new THREE.MeshLambertMaterial({ color: 0x774444 });
  var hull = new THREE.Mesh(hullGeo, hullMat);
  hull.rotation.x = -Math.PI / 2;
  hull.position.y = -0.1;
  group.add(hull);

  // deck
  var deckGeo = new THREE.PlaneGeometry(0.9, 2.6);
  var deckMat = new THREE.MeshLambertMaterial({ color: 0x885555 });
  var deck = new THREE.Mesh(deckGeo, deckMat);
  deck.rotation.x = -Math.PI / 2;
  deck.position.y = 0.3;
  group.add(deck);

  // bridge
  var bridgeGeo = new THREE.BoxGeometry(0.5, 0.5, 0.6);
  var bridgeMat = new THREE.MeshLambertMaterial({ color: 0x996666 });
  var bridge = new THREE.Mesh(bridgeGeo, bridgeMat);
  bridge.position.set(0, 0.55, -0.4);
  group.add(bridge);

  return group;
}

export function createEnemies(count) {
  var enemies = [];
  for (var i = 0; i < count; i++) {
    var mesh = buildEnemyMesh();
    // spread enemies in a ring around origin
    var angle = (i / count) * Math.PI * 2;
    var radius = 40 + Math.random() * 30;
    var x = Math.sin(angle) * radius;
    var z = Math.cos(angle) * radius;
    mesh.position.set(x, WATER_Y, z);
    mesh.rotation.y = Math.random() * Math.PI * 2;

    enemies.push({
      mesh: mesh,
      hp: 3,
      alive: true,
      hitRadius: 2.0
    });
  }
  return enemies;
}
