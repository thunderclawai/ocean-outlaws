// fbxVisual.js - shared FBX loading/fit helpers for runtime model overrides
import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";

var cache = {};

function remapTextureUrl(url, sourcePath) {
  var lower = String(url).toLowerCase();
  var isMain = lower.indexOf("texture%20main.png") >= 0 || lower.indexOf("texture main.png") >= 0;
  if (!isMain) return url;
  var sp = String(sourcePath).toLowerCase();
  if (sp.indexOf("low poly cartoon sailing ships") >= 0) {
    return "assets/Palmov Island/Low Poly Cartoon Sailing Ships/Textures/texture main.png";
  }
  if (sp.indexOf("low poly sea locations pack") >= 0) {
    return "assets/Palmov Island/Low Poly Sea Locations Pack/Textures/texture main.png";
  }
  return url;
}

function fitToSize(root, target) {
  var box = new THREE.Box3().setFromObject(root);
  var size = new THREE.Vector3();
  var center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  var maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > 0.0001) root.scale.setScalar(target / maxDim);
  box.setFromObject(root);
  box.getCenter(center);
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= box.min.y;
}

function applyFlat(root) {
  root.traverse(function (o) {
    if (!o.isMesh || !o.material) return;
    if (Array.isArray(o.material)) return;
    o.material.flatShading = true;
    o.material.needsUpdate = true;
  });
}

function loadTemplate(path) {
  if (cache[path]) return cache[path];
  cache[path] = new Promise(function (resolve, reject) {
    var loader = new FBXLoader();
    loader.manager.setURLModifier(function (url) {
      return remapTextureUrl(url, path);
    });
    loader.load(encodeURI(path), resolve, undefined, reject);
  });
  return cache[path];
}

export async function loadFbxVisual(path, fitSize, flatShaded) {
  var tpl = await loadTemplate(path);
  var visual = tpl.clone(true);
  fitToSize(visual, fitSize || 10);
  if (flatShaded !== false) applyFlat(visual);
  return visual;
}

