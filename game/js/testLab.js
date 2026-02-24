// testLab.js — UI bindings and init for Test Lab
import * as THREE from "three";
import {
  loadCatalog, PRESETS, getLib, getShipSlots, sanitizeColor,
  loadState, saveState, normalizeImportedState, fillSelect, nextId
} from "./testLabData.js";
import {
  getSceneObjects, rebuildOceanGeometry, applyWeather, rebuildShip,
  rebuildWaterModel, addProp, removePropById, clearAllProps,
  startAnimation
} from "./testLabScene.js";

var state = loadState();
var selectedPropId = null;

var so = getSceneObjects();
var transform = so.transform;
var shipHolder = so.shipHolder;
var waterModelHolder = so.waterModelHolder;
var propMap = so.propMap;

function el(id) { return document.getElementById(id); }
var ui = {
  shipModel: el("shipModel"), shipScale: el("shipScale"), shipRotY: el("shipRotY"),
  shipOverrideClass: el("shipOverrideClass"), shipOverrideModel: el("shipOverrideModel"),
  saveShipOverrideBtn: el("saveShipOverrideBtn"), weatherPreset: el("weatherPreset"),
  fogDensity: el("fogDensity"), ambientInt: el("ambientInt"), sunInt: el("sunInt"),
  rainDensity: el("rainDensity"), waterModel: el("waterModel"),
  waterModelScale: el("waterModelScale"), waterModelY: el("waterModelY"),
  waterSize: el("waterSize"), waterSegments: el("waterSegments"),
  waterWaveAmp: el("waterWaveAmp"), waterWaveSteps: el("waterWaveSteps"),
  waterWaveWeight1: el("waterWaveWeight1"), waterWaveFreqX1: el("waterWaveFreqX1"),
  waterWaveSpeed1: el("waterWaveSpeed1"), waterWaveWeight2: el("waterWaveWeight2"),
  waterWaveFreqZ2: el("waterWaveFreqZ2"), waterWaveSpeed2: el("waterWaveSpeed2"),
  waterWaveWeight3: el("waterWaveWeight3"), waterWaveFreqX3: el("waterWaveFreqX3"),
  waterWaveFreqZ3: el("waterWaveFreqZ3"), waterWaveSpeed3: el("waterWaveSpeed3"),
  waterColorDeep: el("waterColorDeep"), waterColorShallow: el("waterColorShallow"),
  newType: el("newType"), newModel: el("newModel"), addObjectBtn: el("addObjectBtn"),
  compositeName: el("compositeName"), createCompositeBtn: el("createCompositeBtn"),
  compositeList: el("compositeList"), spawnCompositeBtn: el("spawnCompositeBtn"),
  exportCompositeBtn: el("exportCompositeBtn"), deleteCompositeBtn: el("deleteCompositeBtn"),
  objectList: el("objectList"), gizmoTranslateBtn: el("gizmoTranslateBtn"),
  gizmoRotateBtn: el("gizmoRotateBtn"), gizmoScaleBtn: el("gizmoScaleBtn"),
  objectModel: el("objectModel"), objX: el("objX"), objY: el("objY"), objZ: el("objZ"),
  objScale: el("objScale"), objRotY: el("objRotY"), deleteObjectBtn: el("deleteObjectBtn"),
  saveBtn: el("saveBtn"), resetBtn: el("resetBtn"), presetJson: el("presetJson"),
  exportJsonBtn: el("exportJsonBtn"), exportObjectsBtn: el("exportObjectsBtn"),
  exportWaterBtn: el("exportWaterBtn"), exportWeatherBtn: el("exportWeatherBtn"),
  exportShipOverridesBtn: el("exportShipOverridesBtn"), importJsonBtn: el("importJsonBtn"),
  applyToGameBtn: el("applyToGameBtn"), status: el("status")
};

function setStatus(msg) { ui.status.textContent = msg; }

function exportToClipboard(obj, label) {
  var txt = JSON.stringify(obj, null, 2);
  ui.presetJson.value = txt;
  try { navigator.clipboard.writeText(txt); } catch (e) { /* ignore */ }
  setStatus(label);
}

function getCompositeDef(name) {
  if (!name) return null;
  for (var i = 0; i < state.composites.length; i++) {
    if (state.composites[i].name === name) return state.composites[i];
  }
  return null;
}

function selectedProp() {
  for (var i = 0; i < state.props.length; i++) if (state.props[i].id === selectedPropId) return state.props[i];
  return null;
}

function refreshObjectList() {
  ui.objectList.innerHTML = "";
  var none = document.createElement("option");
  none.value = "";
  none.textContent = "(none)";
  ui.objectList.appendChild(none);
  for (var i = 0; i < state.props.length; i++) {
    var p = state.props[i];
    var o = document.createElement("option");
    o.value = p.id;
    o.textContent = p.type === "composite" ? (p.type + ":" + (p.compositeName || "?") + " #" + (i + 1)) : (p.type + " #" + (i + 1));
    if (selectedPropId === p.id) o.selected = true;
    ui.objectList.appendChild(o);
  }
}

function refreshCompositeList() {
  var opts = [];
  for (var i = 0; i < state.composites.length; i++) {
    opts.push({ value: state.composites[i].name, label: state.composites[i].name });
  }
  if (opts.length === 0) opts.push({ value: "", label: "(none)" });
  fillSelect(ui.compositeList, opts, ui.compositeList.value || opts[0].value);
}

function fillModelSelectForType(select, type, selectedPath) {
  var LIB = getLib();
  if (type === "composite") {
    var comps = [];
    for (var i = 0; i < state.composites.length; i++) {
      comps.push({ value: state.composites[i].name, label: state.composites[i].name });
    }
    if (comps.length === 0) comps.push({ value: "", label: "(no composites)" });
    fillSelect(select, comps, selectedPath);
    return;
  }
  fillSelect(select, LIB[type] || [], selectedPath);
}

function applySelectedToInputs() {
  var p = selectedProp();
  if (!p) { transform.detach(); return; }
  fillModelSelectForType(ui.objectModel, p.type, p.type === "composite" ? p.compositeName : p.modelPath);
  ui.objX.value = String(p.x);
  ui.objY.value = String(p.y);
  ui.objZ.value = String(p.z);
  ui.objScale.value = String(p.scale);
  ui.objRotY.value = String(p.rotYDeg);
  var live = propMap[p.id];
  if (live) transform.attach(live.holder);
}

function applySelectedTransform() {
  var p = selectedProp();
  if (!p) return;
  var live = propMap[p.id];
  if (!live) return;
  live.holder.position.set(p.x, p.y, p.z);
  live.holder.rotation.y = THREE.MathUtils.degToRad(p.rotYDeg);
  live.holder.scale.setScalar(p.scale);
}

function applyWaterSurface() {
  state.water.colorDeep = sanitizeColor(state.water.colorDeep, "#2a5577");
  state.water.colorShallow = sanitizeColor(state.water.colorShallow, "#4ea3c4");
  ui.waterColorDeep.value = state.water.colorDeep;
  ui.waterColorShallow.value = state.water.colorShallow;
}

function setGizmoMode(mode) {
  transform.setMode(mode);
  ui.gizmoTranslateBtn.className = mode === "translate" ? "" : "secondary";
  ui.gizmoRotateBtn.className = mode === "rotate" ? "" : "secondary";
  ui.gizmoScaleBtn.className = mode === "scale" ? "" : "secondary";
}

function deleteCompositeByName(name) {
  if (!name) return 0;
  state.composites = state.composites.filter(function (c) { return c.name !== name; });
  var toRemove = [];
  for (var i = 0; i < state.props.length; i++) {
    if (state.props[i].type === "composite" && state.props[i].compositeName === name) toRemove.push(state.props[i].id);
  }
  for (var j = 0; j < toRemove.length; j++) removePropById(toRemove[j], state);
  if (selectedPropId && !selectedProp()) selectedPropId = null;
  refreshObjectList();
  transform.detach();
  return toRemove.length;
}

var propCallbacks = {
  setStatus: setStatus, getCompositeDef: getCompositeDef,
  refreshObjectList: refreshObjectList, applySelectedToInputs: applySelectedToInputs,
  setSelectedPropId: function (id) { selectedPropId = id; }
};

var saveTimer = null;
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(function () { saveState(state); setStatus("Settings saved"); }, 180);
}

transform.addEventListener("objectChange", function () {
  var p = selectedProp();
  var live = p ? propMap[p.id] : null;
  if (!p || !live) return;
  p.x = parseFloat(live.holder.position.x.toFixed(2));
  p.y = parseFloat(live.holder.position.y.toFixed(2));
  p.z = parseFloat(live.holder.position.z.toFixed(2));
  p.scale = parseFloat(live.holder.scale.x.toFixed(3));
  p.rotYDeg = parseFloat(THREE.MathUtils.radToDeg(live.holder.rotation.y).toFixed(1));
  applySelectedToInputs();
  scheduleSave();
});

// --- Populate UI from state ---
function populateUIFromState() {
  var LIB = getLib();
  var SHIP_SLOTS = getShipSlots();
  fillSelect(ui.shipModel, LIB.ship, state.ship.modelPath);
  ui.shipScale.value = String(state.ship.scale);
  ui.shipRotY.value = String(state.ship.rotYDeg);
  fillSelect(ui.shipOverrideClass, SHIP_SLOTS.map(function (s) { return { value: s, label: s.toUpperCase() }; }), ui.shipOverrideClass.value || SHIP_SLOTS[0]);
  fillSelect(ui.shipOverrideModel, LIB.ship, state.shipOverrides[ui.shipOverrideClass.value] || state.ship.modelPath);
  ui.weatherPreset.value = state.weather.preset;
  ui.fogDensity.value = String(state.weather.fogDensity);
  ui.ambientInt.value = String(state.weather.ambientInt);
  ui.sunInt.value = String(state.weather.sunInt);
  ui.rainDensity.value = String(state.weather.rainDensity);
  fillSelect(ui.waterModel, [{ value: "", label: "(none)" }].concat(LIB.water), state.water.modelPath || "");
  ui.waterModelScale.value = String(state.water.modelScale);
  ui.waterModelY.value = String(state.water.modelY);
  ui.waterSize.value = String(state.water.size);
  ui.waterSegments.value = String(state.water.segments);
  var wKeys = ["waveAmp", "waveSteps", "waveWeight1", "waveFreqX1", "waveSpeed1", "waveWeight2", "waveFreqZ2", "waveSpeed2", "waveWeight3", "waveFreqX3", "waveFreqZ3", "waveSpeed3"];
  var wIds = ["waterWaveAmp", "waterWaveSteps", "waterWaveWeight1", "waterWaveFreqX1", "waterWaveSpeed1", "waterWaveWeight2", "waterWaveFreqZ2", "waterWaveSpeed2", "waterWaveWeight3", "waterWaveFreqX3", "waterWaveFreqZ3", "waterWaveSpeed3"];
  for (var wi = 0; wi < wKeys.length; wi++) ui[wIds[wi]].value = String(state.water[wKeys[wi]]);
  ui.waterColorDeep.value = state.water.colorDeep;
  ui.waterColorShallow.value = state.water.colorShallow;
  refreshCompositeList();
  fillModelSelectForType(ui.newModel, ui.newType.value || "tree");
}

// Initial weather preset options
for (var k in PRESETS) {
  var opt = document.createElement("option");
  opt.value = k; opt.textContent = k.toUpperCase();
  if (k === state.weather.preset) opt.selected = true;
  ui.weatherPreset.appendChild(opt);
}
["tree", "island", "port", "water", "composite"].forEach(function (t) {
  var o = document.createElement("option");
  o.value = t; o.textContent = t.toUpperCase();
  ui.newType.appendChild(o);
});
populateUIFromState();
refreshObjectList();
setGizmoMode("translate");

// --- Event handlers ---
ui.shipModel.addEventListener("change", function () {
  state.ship.modelPath = ui.shipModel.value;
  rebuildShip(state, setStatus); scheduleSave();
});
ui.shipScale.addEventListener("input", function () {
  state.ship.scale = parseFloat(ui.shipScale.value);
  shipHolder.scale.setScalar(state.ship.scale); scheduleSave();
});
ui.shipRotY.addEventListener("input", function () {
  state.ship.rotYDeg = parseFloat(ui.shipRotY.value);
  shipHolder.rotation.y = THREE.MathUtils.degToRad(state.ship.rotYDeg); scheduleSave();
});
ui.shipOverrideClass.addEventListener("change", function () {
  fillSelect(ui.shipOverrideModel, getLib().ship, state.shipOverrides[ui.shipOverrideClass.value] || state.ship.modelPath);
});
ui.saveShipOverrideBtn.addEventListener("click", function () {
  var slot = ui.shipOverrideClass.value;
  if (!slot) return;
  state.shipOverrides[slot] = ui.shipOverrideModel.value;
  scheduleSave(); setStatus("Ship override set: " + slot);
});
ui.weatherPreset.addEventListener("change", function () {
  state.weather.preset = ui.weatherPreset.value;
  var p = PRESETS[state.weather.preset];
  if (p) {
    state.weather.fogDensity = p.fogDensity; state.weather.ambientInt = p.ambientInt;
    state.weather.sunInt = p.sunInt; state.weather.rainDensity = p.rainDensity;
    ui.fogDensity.value = String(p.fogDensity); ui.ambientInt.value = String(p.ambientInt);
    ui.sunInt.value = String(p.sunInt); ui.rainDensity.value = String(p.rainDensity);
    applyWeather(state);
  }
  scheduleSave();
});
[["fogDensity", "fogDensity"], ["ambientInt", "ambientInt"], ["sunInt", "sunInt"], ["rainDensity", "rainDensity"]].forEach(function (pair) {
  ui[pair[0]].addEventListener("input", function () {
    state.weather[pair[1]] = parseFloat(ui[pair[0]].value); applyWeather(state); scheduleSave();
  });
});
ui.waterModel.addEventListener("change", function () {
  state.water.modelPath = ui.waterModel.value; rebuildWaterModel(state, setStatus); scheduleSave();
});
ui.waterModelScale.addEventListener("input", function () {
  state.water.modelScale = parseFloat(ui.waterModelScale.value);
  waterModelHolder.scale.setScalar(state.water.modelScale); scheduleSave();
});
ui.waterModelY.addEventListener("input", function () {
  state.water.modelY = parseFloat(ui.waterModelY.value);
  waterModelHolder.position.y = state.water.modelY; scheduleSave();
});
ui.waterSize.addEventListener("input", function () {
  state.water.size = parseFloat(ui.waterSize.value); rebuildOceanGeometry(state); scheduleSave();
});
ui.waterSegments.addEventListener("input", function () {
  state.water.segments = parseFloat(ui.waterSegments.value); rebuildOceanGeometry(state); scheduleSave();
});
[
  ["waterWaveAmp", "waveAmp"], ["waterWaveSteps", "waveSteps"],
  ["waterWaveWeight1", "waveWeight1"], ["waterWaveFreqX1", "waveFreqX1"],
  ["waterWaveSpeed1", "waveSpeed1"], ["waterWaveWeight2", "waveWeight2"],
  ["waterWaveFreqZ2", "waveFreqZ2"], ["waterWaveSpeed2", "waveSpeed2"],
  ["waterWaveWeight3", "waveWeight3"], ["waterWaveFreqX3", "waveFreqX3"],
  ["waterWaveFreqZ3", "waveFreqZ3"], ["waterWaveSpeed3", "waveSpeed3"]
].forEach(function (pair) {
  ui[pair[0]].addEventListener("input", function () {
    state.water[pair[1]] = parseFloat(ui[pair[0]].value); scheduleSave();
  });
});
ui.waterColorDeep.addEventListener("input", function () {
  state.water.colorDeep = ui.waterColorDeep.value; applyWaterSurface(); scheduleSave();
});
ui.waterColorShallow.addEventListener("input", function () {
  state.water.colorShallow = ui.waterColorShallow.value; applyWaterSurface(); scheduleSave();
});
ui.newType.addEventListener("change", function () { fillModelSelectForType(ui.newModel, ui.newType.value); });
ui.addObjectBtn.addEventListener("click", function () {
  var type = ui.newType.value;
  var p = null;
  if (type === "composite") {
    if (!ui.newModel.value) { setStatus("No composite selected"); return; }
    p = { id: nextId(), type: type, compositeName: ui.newModel.value, x: 0, y: 0, z: 0, scale: 1, rotYDeg: 0 };
  } else {
    p = { id: nextId(), type: type, modelPath: ui.newModel.value, x: 0, y: 0, z: 0, scale: 1, rotYDeg: 0 };
  }
  state.props.push(p); addProp(p, true, state, propCallbacks); scheduleSave();
});
ui.createCompositeBtn.addEventListener("click", function () {
  var name = (ui.compositeName.value || "").trim();
  if (!name) { setStatus("Enter a composite name"); return; }
  var parts = state.props.filter(function (p) { return p.type !== "composite"; });
  if (parts.length === 0) { setStatus("Add objects first"); return; }
  var cx = 0, cy = 0, cz = 0;
  for (var i = 0; i < parts.length; i++) { cx += parts[i].x; cy += parts[i].y; cz += parts[i].z; }
  cx /= parts.length; cy /= parts.length; cz /= parts.length;
  var def = {
    name: name,
    items: parts.map(function (p) {
      return { type: p.type, modelPath: p.modelPath, x: p.x - cx, y: p.y - cy, z: p.z - cz, scale: p.scale, rotYDeg: p.rotYDeg };
    })
  };
  state.composites = state.composites.filter(function (c) { return c.name !== name; });
  state.composites.push(def);
  refreshCompositeList();
  fillModelSelectForType(ui.newModel, "composite", name);
  ui.newType.value = "composite";
  setStatus("Composite created: " + name); scheduleSave();
});
ui.spawnCompositeBtn.addEventListener("click", function () {
  if (!ui.compositeList.value) { setStatus("No composite selected"); return; }
  var p = { id: nextId(), type: "composite", compositeName: ui.compositeList.value, x: 0, y: 0, z: 0, scale: 1, rotYDeg: 0 };
  state.props.push(p); addProp(p, true, state, propCallbacks); scheduleSave();
});
ui.exportCompositeBtn.addEventListener("click", function () {
  var def = getCompositeDef(ui.compositeList.value);
  if (!def) { setStatus("No composite selected"); return; }
  exportToClipboard(def, "Composite exported: " + ui.compositeList.value);
});
ui.deleteCompositeBtn.addEventListener("click", function () {
  var name = ui.compositeList.value;
  if (!name) { setStatus("No composite selected"); return; }
  var removed = deleteCompositeByName(name);
  refreshCompositeList();
  fillModelSelectForType(ui.newModel, ui.newType.value || "tree");
  scheduleSave(); setStatus("Composite deleted: " + name + " (removed " + removed + " instances)");
});
ui.objectList.addEventListener("change", function () { selectedPropId = ui.objectList.value || null; applySelectedToInputs(); });
ui.gizmoTranslateBtn.addEventListener("click", function () { setGizmoMode("translate"); });
ui.gizmoRotateBtn.addEventListener("click", function () { setGizmoMode("rotate"); });
ui.gizmoScaleBtn.addEventListener("click", function () { setGizmoMode("scale"); });
ui.objectModel.addEventListener("change", async function () {
  var p = selectedProp();
  if (!p) return;
  if (p.type === "composite") p.compositeName = ui.objectModel.value;
  else p.modelPath = ui.objectModel.value;
  removePropById(p.id, state); state.props.push(p);
  await addProp(p, true, state, propCallbacks); scheduleSave();
});
[["objX", "x"], ["objY", "y"], ["objZ", "z"], ["objScale", "scale"], ["objRotY", "rotYDeg"]].forEach(function (pair) {
  ui[pair[0]].addEventListener("input", function () {
    var p = selectedProp(); if (!p) return;
    p[pair[1]] = parseFloat(ui[pair[0]].value); applySelectedTransform(); scheduleSave();
  });
});
ui.deleteObjectBtn.addEventListener("click", function () {
  if (!selectedPropId) return;
  removePropById(selectedPropId, state); selectedPropId = null; refreshObjectList(); scheduleSave();
});
ui.saveBtn.addEventListener("click", function () { saveState(state); setStatus("Settings saved"); });
ui.resetBtn.addEventListener("click", function () { localStorage.removeItem("ocean_outlaws_test_lab_v1"); location.reload(); });
ui.exportJsonBtn.addEventListener("click", function () { exportToClipboard(state, "Preset JSON exported"); });
ui.exportObjectsBtn.addEventListener("click", function () {
  var out = [];
  for (var i = 0; i < state.props.length; i++) {
    var p = state.props[i];
    out.push({
      type: p.type, modelPath: p.modelPath, compositeName: p.compositeName,
      x: parseFloat(Number(p.x).toFixed(2)), y: parseFloat(Number(p.y).toFixed(2)),
      z: parseFloat(Number(p.z).toFixed(2)), scale: parseFloat(Number(p.scale).toFixed(3)),
      rotYDeg: parseFloat(Number(p.rotYDeg).toFixed(2))
    });
  }
  exportToClipboard({ composites: state.composites, objects: out }, "Object transforms exported");
});
ui.exportWaterBtn.addEventListener("click", function () { exportToClipboard({ water: state.water }, "Water settings exported"); });
ui.exportWeatherBtn.addEventListener("click", function () { exportToClipboard({ presets: PRESETS, active: state.weather }, "Weather settings exported"); });
ui.exportShipOverridesBtn.addEventListener("click", function () {
  exportToClipboard({ slots: getShipSlots(), overrides: state.shipOverrides, selectedLabModel: state.ship.modelPath }, "Ship override mapping exported");
});
ui.importJsonBtn.addEventListener("click", async function () {
  try { await rebuildFromState(JSON.parse(ui.presetJson.value || "{}")); setStatus("Preset JSON imported"); }
  catch (e) { setStatus("Import failed: invalid JSON"); }
});
ui.applyToGameBtn.addEventListener("click", function () {
  exportToClipboard({
    ship: { scale: state.ship.scale, modelPath: state.ship.modelPath, overrides: state.shipOverrides },
    weather: { preset: state.weather.preset, fogDensity: state.weather.fogDensity, ambientInt: state.weather.ambientInt, sunInt: state.weather.sunInt },
    water: state.water,
    objects: state.props.map(function (p) {
      return { type: p.type, modelPath: p.modelPath, compositeName: p.compositeName, x: p.x, y: p.y, z: p.z, scale: p.scale, rotYDeg: p.rotYDeg };
    }),
    composites: state.composites
  }, "Full game graphics JSON exported");
});

// --- Rebuild & Init ---
async function rebuildFromState(newState) {
  state = normalizeImportedState(newState);
  clearAllProps();
  selectedPropId = null;
  transform.detach();
  populateUIFromState();
  rebuildOceanGeometry(state);
  applyWeather(state);
  applyWaterSurface();
  await rebuildShip(state, setStatus);
  await rebuildWaterModel(state, setStatus);
  for (var i = 0; i < state.props.length; i++) await addProp(state.props[i], false, state, propCallbacks);
  refreshObjectList();
  saveState(state);
}

async function init() {
  await loadCatalog();
  state = normalizeImportedState(state);
  await rebuildFromState(state);
  setStatus("Ready");
}

init();
startAnimation(function () { return state; });
