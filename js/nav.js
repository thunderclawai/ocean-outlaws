// nav.js — click/tap-to-move navigation + destination marker
import * as THREE from "three";
import { setNavTarget } from "./ship.js";
import { getWaveHeight } from "./ocean.js";

var raycaster = new THREE.Raycaster();
var pointer = new THREE.Vector2();
var oceanPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // y=0 plane
var intersectPoint = new THREE.Vector3();

var marker = null;
var markerActive = false;
var markerTargetX = 0;
var markerTargetZ = 0;
var navShipRef = null;
var navCameraRef = null;
var initialized = false;

// --- build destination marker (pulsing ring on water) ---
function buildMarker() {
  var group = new THREE.Group();

  var ringGeo = new THREE.RingGeometry(1.0, 1.4, 24);
  var ringMat = new THREE.MeshBasicMaterial({
    color: 0x44aaff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.6,
    depthWrite: false
  });
  var ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  group.add(ring);

  var dotGeo = new THREE.CircleGeometry(0.3, 12);
  var dotMat = new THREE.MeshBasicMaterial({
    color: 0x66ccff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8,
    depthWrite: false
  });
  var dot = new THREE.Mesh(dotGeo, dotMat);
  dot.rotation.x = -Math.PI / 2;
  dot.position.y = 0.05;
  group.add(dot);

  group.visible = false;
  return group;
}

function projectToOcean(clientX, clientY, camera) {
  pointer.x = (clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  return raycaster.ray.intersectPlane(oceanPlane, intersectPoint);
}

// --- init click/tap handler ---
export function initNav(camera, ship, scene) {
  navShipRef = ship;
  navCameraRef = camera;

  if (initialized) return;
  initialized = true;

  marker = buildMarker();
  scene.add(marker);

  function handleNav(clientX, clientY) {
    if (!navShipRef || !navCameraRef) return;
    var hit = projectToOcean(clientX, clientY, navCameraRef);
    if (hit) {
      markerTargetX = intersectPoint.x;
      markerTargetZ = intersectPoint.z;
      markerActive = true;
      marker.visible = true;
      setNavTarget(navShipRef, intersectPoint.x, intersectPoint.z);
    }
  }

  window.addEventListener("contextmenu", function (e) {
    e.preventDefault();
  });

  window.addEventListener("mousedown", function (e) {
    if (e.button !== 2) return;
    if (e.target !== document.querySelector("canvas")) return;
    handleNav(e.clientX, e.clientY);
  });

  window.addEventListener("touchstart", function (e) {
    if (e.touches.length !== 1) return;
    var touch = e.touches[0];
    handleNav(touch.clientX, touch.clientY);
  }, { passive: true });
}

// --- update marker position (bob on waves, pulse) ---
export function updateNav(ship, elapsed) {
  if (!marker) return;

  if (!ship.navTarget) {
    if (markerActive) {
      markerActive = false;
      marker.visible = false;
    }
    return;
  }

  var waveY = getWaveHeight(markerTargetX, markerTargetZ, elapsed);
  marker.position.set(markerTargetX, waveY + 0.3, markerTargetZ);

  var pulse = 1.0 + Math.sin(elapsed * 3) * 0.15;
  marker.scale.set(pulse, 1, pulse);
}
