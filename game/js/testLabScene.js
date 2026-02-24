// testLabScene.js — Three.js scene, rendering, and animation for Test Lab
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { loadTemplate, fitToSize } from "./modelLoader.js";
import { optionByPath } from "./testLabData.js";

function applyFlat(root) {
  root.traverse(function (o) {
    if (!o.isMesh || !o.material) return;
    o.castShadow = false;
    o.receiveShadow = false;
    if (Array.isArray(o.material)) return;
    o.material.flatShading = true;
    o.material.needsUpdate = true;
  });
}

export async function loadVisual(path, targetFit) {
  var tpl = await loadTemplate(path);
  var visual = tpl.clone(true);
  fitToSize(visual, targetFit);
  applyFlat(visual);
  return visual;
}

var scene = new THREE.Scene();
scene.background = new THREE.Color(0x6fa4d4);
scene.fog = new THREE.FogExp2(0x6fa4d4, 0.005);

var renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById("app").appendChild(renderer.domElement);

var camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(50, 38, 55);
var controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 2, 0);
controls.enableDamping = true;
var transform = new TransformControls(camera, renderer.domElement);
transform.setSpace("world");
transform.setSize(0.8);
scene.add(transform);
transform.addEventListener("dragging-changed", function (e) {
  controls.enabled = !e.value;
});

var ambient = new THREE.AmbientLight(0xddeeff, 0.8);
scene.add(ambient);
var sun = new THREE.DirectionalLight(0xffffff, 1.0);
sun.position.set(60, 90, 20);
scene.add(sun);

var oceanGeo = null;
var oceanMat = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide, flatShading: true, vertexColors: true });
var ocean = new THREE.Mesh(new THREE.PlaneGeometry(2, 2, 1, 1), oceanMat);
ocean.rotation.x = -Math.PI / 2;
scene.add(ocean);
var waterModelHolder = new THREE.Group();
scene.add(waterModelHolder);
var waterModelVisual = null;

var rainGeo = new THREE.BufferGeometry();
var rainCount = 1800;
var rainPos = new Float32Array(rainCount * 3);
var rainVel = new Float32Array(rainCount);
for (var r = 0; r < rainCount; r++) {
  rainPos[r * 3] = (Math.random() - 0.5) * 180;
  rainPos[r * 3 + 1] = Math.random() * 70 + 10;
  rainPos[r * 3 + 2] = (Math.random() - 0.5) * 180;
  rainVel[r] = 22 + Math.random() * 16;
}
rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
var rainMat = new THREE.PointsMaterial({ color: 0xaec8de, size: 0.25, transparent: true, opacity: 0, depthWrite: false });
var rain = new THREE.Points(rainGeo, rainMat);
scene.add(rain);

var shipHolder = new THREE.Group();
scene.add(shipHolder);
var shipVisual = null;

var propMap = {};

export function getSceneObjects() {
  return { scene: scene, renderer: renderer, camera: camera, controls: controls, transform: transform, ambient: ambient, sun: sun, ocean: ocean, oceanGeo: oceanGeo, oceanMat: oceanMat, waterModelHolder: waterModelHolder, rainGeo: rainGeo, rainMat: rainMat, rainPos: rainPos, rainVel: rainVel, rainCount: rainCount, shipHolder: shipHolder, propMap: propMap };
}

export function rebuildOceanGeometry(state) {
  var seg = Math.max(1, Math.floor(state.water.segments || 56));
  var size = Math.max(20, state.water.size || 400);
  if (ocean.geometry) ocean.geometry.dispose();
  oceanGeo = new THREE.PlaneGeometry(size, size, seg, seg);
  var oceanColors = new Float32Array(oceanGeo.attributes.position.count * 3);
  oceanGeo.setAttribute("color", new THREE.BufferAttribute(oceanColors, 3));
  ocean.geometry = oceanGeo;
  return oceanGeo;
}

export function applyWeather(state) {
  var w = state.weather;
  scene.fog.density = w.fogDensity;
  ambient.intensity = w.ambientInt;
  sun.intensity = w.sunInt;
  rainMat.opacity = 0.42 * w.rainDensity;
  var sky = new THREE.Color().setHSL(0.56, 0.45, Math.max(0.16, 0.68 - w.fogDensity * 18));
  scene.background = sky;
  scene.fog.color = sky;
}

export async function rebuildShip(state, setStatus) {
  var opt = optionByPath("ship", state.ship.modelPath);
  if (!opt) return;
  if (shipVisual) shipHolder.remove(shipVisual);
  setStatus("Loading ship...");
  try {
    shipVisual = await loadVisual(opt.path, opt.fit);
    shipHolder.add(shipVisual);
    shipHolder.scale.setScalar(state.ship.scale);
    shipHolder.rotation.y = THREE.MathUtils.degToRad(state.ship.rotYDeg);
    setStatus("Ship loaded");
  } catch (e) {
    setStatus("Ship load failed");
  }
}

export async function rebuildWaterModel(state, setStatus) {
  if (waterModelVisual) {
    waterModelHolder.remove(waterModelVisual);
    waterModelVisual = null;
  }
  if (!state.water.modelPath) return;
  var opt = optionByPath("water", state.water.modelPath);
  if (!opt) return;
  setStatus("Loading water model...");
  try {
    waterModelVisual = await loadVisual(opt.path, opt.fit || 26);
    waterModelHolder.add(waterModelVisual);
    waterModelHolder.position.set(0, state.water.modelY, 0);
    waterModelHolder.scale.setScalar(state.water.modelScale);
    setStatus("Water model loaded");
  } catch (e) {
    setStatus("Water model load failed");
  }
}

export async function addProp(prop, shouldSelect, state, callbacks) {
  var setStatus = callbacks.setStatus;
  var getCompositeDef = callbacks.getCompositeDef;
  var refreshObjectList = callbacks.refreshObjectList;
  var applySelectedToInputs = callbacks.applySelectedToInputs;
  var setSelectedPropId = callbacks.setSelectedPropId;

  if (prop.type === "composite") {
    var comp = getCompositeDef(prop.compositeName);
    if (!comp || !Array.isArray(comp.items) || comp.items.length === 0) {
      setStatus("Composite not found");
      return;
    }
    setStatus("Loading composite...");
    try {
      var holder = new THREE.Group();
      for (var ci = 0; ci < comp.items.length; ci++) {
        var item = comp.items[ci];
        var libItemC = optionByPath(item.type, item.modelPath);
        if (!libItemC) continue;
        var visualC = await loadVisual(libItemC.path, libItemC.fit);
        var part = new THREE.Group();
        part.add(visualC);
        part.position.set(item.x || 0, item.y || 0, item.z || 0);
        part.rotation.y = THREE.MathUtils.degToRad(item.rotYDeg || 0);
        part.scale.setScalar(item.scale || 1);
        holder.add(part);
      }
      holder.position.set(prop.x, prop.y, prop.z);
      holder.rotation.y = THREE.MathUtils.degToRad(prop.rotYDeg);
      holder.scale.setScalar(prop.scale);
      scene.add(holder);
      propMap[prop.id] = { holder: holder, visual: holder };
      if (shouldSelect) {
        setSelectedPropId(prop.id);
        refreshObjectList();
        applySelectedToInputs();
      }
      setStatus("Loaded composite");
    } catch (e) {
      setStatus("Failed to load composite");
    }
    return;
  }

  var libItem = optionByPath(prop.type, prop.modelPath);
  if (!libItem) return;
  setStatus("Loading " + prop.type + "...");
  try {
    var visual = await loadVisual(libItem.path, libItem.fit);
    var holder = new THREE.Group();
    holder.add(visual);
    holder.position.set(prop.x, prop.y, prop.z);
    holder.rotation.y = THREE.MathUtils.degToRad(prop.rotYDeg);
    holder.scale.setScalar(prop.scale);
    scene.add(holder);
    propMap[prop.id] = { holder: holder, visual: visual };
    if (shouldSelect) {
      setSelectedPropId(prop.id);
      refreshObjectList();
      applySelectedToInputs();
    }
    setStatus("Loaded " + prop.type);
  } catch (e) {
    setStatus("Failed to load " + prop.type);
  }
}

export function removePropById(id, state) {
  var p = propMap[id];
  if (p) {
    scene.remove(p.holder);
    delete propMap[id];
  }
  state.props = state.props.filter(function (x) { return x.id !== id; });
}

export function clearAllProps() {
  for (var id in propMap) {
    if (Object.prototype.hasOwnProperty.call(propMap, id)) {
      scene.remove(propMap[id].holder);
    }
  }
  for (var k in propMap) delete propMap[k];
}

export function startAnimation(getState) {
  var clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    var t = clock.getElapsedTime();
    var dt = Math.min(0.05, clock.getDelta());
    var state = getState();
    var w = state.water;
    var waveAmp = w.waveAmp;
    var deepColor = new THREE.Color(state.water.colorDeep);
    var shallowColor = new THREE.Color(state.water.colorShallow);
    var tmpColor = new THREE.Color();

    var curOceanGeo = ocean.geometry;
    var pos = curOceanGeo.attributes.position;
    var cols = curOceanGeo.attributes.color;
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i);
      var z = pos.getY(i);
      var h = 0;
      h += Math.sin(x * w.waveFreqX1 + t * w.waveSpeed1) * w.waveWeight1 * waveAmp;
      h += Math.sin(z * w.waveFreqZ2 + t * w.waveSpeed2) * w.waveWeight2 * waveAmp;
      h += Math.sin(x * w.waveFreqX3 + z * w.waveFreqZ3 + t * w.waveSpeed3) * w.waveWeight3 * waveAmp;
      h = Math.floor(h * w.waveSteps) / w.waveSteps;
      pos.setZ(i, h);
      var tcol = THREE.MathUtils.clamp((h / (Math.max(0.01, waveAmp) * 1.6) + 1) * 0.5, 0, 1);
      tmpColor.copy(deepColor).lerp(shallowColor, tcol);
      cols.setXYZ(i, tmpColor.r, tmpColor.g, tmpColor.b);
    }
    pos.needsUpdate = true;
    cols.needsUpdate = true;
    curOceanGeo.computeVertexNormals();

    var rp = rainGeo.attributes.position.array;
    for (var ri = 0; ri < rainCount; ri++) {
      var idx = ri * 3;
      rp[idx + 1] -= rainVel[ri] * dt;
      if (rp[idx + 1] < 0.1) {
        rp[idx] = camera.position.x + (Math.random() - 0.5) * 180;
        rp[idx + 1] = 70 + Math.random() * 20;
        rp[idx + 2] = camera.position.z + (Math.random() - 0.5) * 180;
      }
    }
    rainGeo.attributes.position.needsUpdate = true;

    controls.update();
    renderer.render(scene, camera);
  }
  animate();
}

window.addEventListener("resize", function () {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

rebuildOceanGeometry({ water: { segments: 56, size: 400 } });
