// testLabData.js — catalog, state, presets, normalization for Test Lab
import { loadTemplate, fitToSize } from "./modelLoader.js";

var STORAGE_KEY = "ocean_outlaws_test_lab_v1";
var CATALOG_URL = "data/testLabModelCatalog.json";
var SHIP_SLOT_FALLBACK = [
  "destroyer",
  "cruiser",
  "carrier",
  "submarine",
  "enemy_patrol",
  "boss_battleship",
  "boss_carrier",
  "boss_kraken"
];

var LIB = {
  ship: [
    { label: "Ship Small 3", path: "assets/models/ships-palmov/small/ship-small-3.glb", fit: 8 },
    { label: "Ship Medium 2", path: "assets/models/ships-palmov/medium/ship-medium-2.glb", fit: 10 },
    { label: "Ship Large 2", path: "assets/models/ships-palmov/large/ship-large-2.glb", fit: 12 },
    { label: "Pirate Large 1", path: "assets/models/ships-palmov/large/pirate-ship-large-1.glb", fit: 13 },
    { label: "Pirate Large 2", path: "assets/models/ships-palmov/large/pirate-ship-large-2.glb", fit: 13 }
  ],
  tree: [
    { label: "Palm Large", path: "assets/models/trees/palm/palm-tree-large.glb", fit: 11 },
    { label: "Palm Bent", path: "assets/models/trees/palm/palm-tree-bent.glb", fit: 9 },
    { label: "Palm Small", path: "assets/models/trees/palm/palm-tree-small.glb", fit: 7 }
  ],
  island: [
    { label: "Stone Large 2", path: "assets/models/stones/large/stone-large-2.glb", fit: 10 },
    { label: "Stone Small 6", path: "assets/models/stones/small/stone-small-6.glb", fit: 6 },
    { label: "Island Arch", path: "assets/models/islands/island-mountain-arch.glb", fit: 20 },
    { label: "Island Lighthouse Pier", path: "assets/models/islands/island-lighthouse-pier.glb", fit: 22 }
  ],
  port: [
    { label: "Trade Port Land", path: "assets/models/lands/land-trade-port.glb", fit: 18 },
    { label: "Pirate Seaport Land", path: "assets/models/lands/land-pirate-seaport.glb", fit: 18 },
    { label: "Wooden Pier", path: "assets/models/environment/wooden-piers/wooden-pier.glb", fit: 18 },
    { label: "Wooden Pier 2", path: "assets/models/environment/wooden-piers/wooden-pier-2.glb", fit: 18 },
    { label: "Wooden Pier 3", path: "assets/models/environment/wooden-piers/wooden-pier-3.glb", fit: 18 },
    { label: "Wooden Pier 4", path: "assets/models/environment/wooden-piers/wooden-pier-4.glb", fit: 18 },
    { label: "Wooden Pier 5", path: "assets/models/environment/wooden-piers/wooden-pier-5.glb", fit: 18 },
    { label: "Destroyed Wooden Pier", path: "assets/models/environment/destroyed-wooden-pier.glb", fit: 18 }
  ],
  water: [
    { label: "Cartoon Water", path: "assets/models/ships-palmov/water.glb", fit: 26 },
    { label: "Trade Port Water", path: "assets/models/waters/water-location-trade-port.glb", fit: 26 },
    { label: "Pirate Seaport Water", path: "assets/models/waters/water-location-pirate-seaport.glb", fit: 26 }
  ]
};

var SHIP_SLOTS = SHIP_SLOT_FALLBACK.slice();

function normalizeCatalog(catalog) {
  if (!catalog || typeof catalog !== "object") return null;
  ["ship", "tree", "island", "port", "water"].forEach(function (k) {
    if (Array.isArray(catalog[k]) && catalog[k].length) LIB[k] = catalog[k];
  });
  if (Array.isArray(catalog.shipSlots) && catalog.shipSlots.length) SHIP_SLOTS = catalog.shipSlots.slice();
  return catalog;
}

export async function loadCatalog() {
  try {
    var res = await fetch(CATALOG_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("catalog not found");
    var json = await res.json();
    normalizeCatalog(json);
  } catch (e) {
    // keep fallback library if catalog isn't available
  }
}

export var PRESETS = {
  calm: { fogDensity: 0.005, ambientInt: 0.8, sunInt: 1.0, rainDensity: 0.0 },
  rough: { fogDensity: 0.009, ambientInt: 0.65, sunInt: 0.9, rainDensity: 0.25 },
  storm: { fogDensity: 0.015, ambientInt: 0.45, sunInt: 0.55, rainDensity: 1.0 }
};

export function getLib() { return LIB; }
export function getShipSlots() { return SHIP_SLOTS; }

export function defaultState() {
  var shipOverrides = {};
  for (var i = 0; i < SHIP_SLOTS.length; i++) shipOverrides[SHIP_SLOTS[i]] = LIB.ship[0].path;
  return {
    ship: { modelPath: LIB.ship[0].path, scale: 1, rotYDeg: 0 },
    weather: { preset: "calm", fogDensity: PRESETS.calm.fogDensity, ambientInt: PRESETS.calm.ambientInt, sunInt: PRESETS.calm.sunInt, rainDensity: PRESETS.calm.rainDensity },
    water: {
      modelPath: "",
      modelScale: 1,
      modelY: 0,
      size: 400,
      segments: 56,
      waveAmp: 1.0,
      waveSteps: 7,
      waveWeight1: 0.8,
      waveFreqX1: 0.22,
      waveSpeed1: 0.9,
      waveWeight2: 0.65,
      waveFreqZ2: 0.18,
      waveSpeed2: 0.7,
      waveWeight3: 0.25,
      waveFreqX3: 0.55,
      waveFreqZ3: 0.4,
      waveSpeed3: 1.1,
      colorDeep: "#2a5577",
      colorShallow: "#4ea3c4"
    },
    shipOverrides: shipOverrides,
    props: [],
    composites: []
  };
}

export function sanitizeColor(value, fallback) {
  var s = String(value || "");
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s;
  return fallback;
}

export function loadState() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    var parsed = JSON.parse(raw);
    return normalizeImportedState(parsed);
  } catch (e) {
    return defaultState();
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function normalizeImportedState(parsed) {
  var base = defaultState();
  var s = Object.assign({}, base, parsed || {});
  if (Array.isArray(parsed && parsed.objects) && !Array.isArray(parsed && parsed.props)) {
    s.props = parsed.objects;
  }
  s.ship = Object.assign({}, base.ship, s.ship || {});
  s.weather = Object.assign({}, base.weather, s.weather || {});
  s.water = Object.assign({}, base.water, s.water || {});
  if (parsed && parsed.weather && parsed.weather.waveAmp !== undefined) {
    s.water.waveAmp = parsed.weather.waveAmp;
  }
  if (parsed && parsed.water && parsed.water.waveStrength !== undefined) {
    s.water.waveAmp = s.water.waveAmp * parsed.water.waveStrength;
  }
  s.water.waveSteps = Math.max(1, Math.floor(s.water.waveSteps || base.water.waveSteps));
  s.water.segments = Math.max(1, Math.floor(s.water.segments || base.water.segments));
  s.water.colorDeep = sanitizeColor(s.water.colorDeep, base.water.colorDeep);
  s.water.colorShallow = sanitizeColor(s.water.colorShallow, base.water.colorShallow);
  s.shipOverrides = Object.assign({}, base.shipOverrides, s.shipOverrides || {});
  for (var si = 0; si < SHIP_SLOTS.length; si++) {
    var slot = SHIP_SLOTS[si];
    if (!s.shipOverrides[slot]) s.shipOverrides[slot] = base.ship.modelPath;
  }
  if (!Array.isArray(s.props)) s.props = [];
  if (!Array.isArray(s.composites)) s.composites = [];
  return s;
}

export function optionByPath(type, path) {
  var arr = LIB[type] || [];
  for (var i = 0; i < arr.length; i++) if (arr[i].path === path) return arr[i];
  return arr[0] || null;
}

export function fillSelect(select, options, selectedPath) {
  select.innerHTML = "";
  for (var i = 0; i < options.length; i++) {
    var o = document.createElement("option");
    var v = options[i].path !== undefined ? options[i].path : options[i].value;
    o.value = v;
    o.textContent = options[i].label;
    if (v === selectedPath) o.selected = true;
    select.appendChild(o);
  }
}

export function nextId() {
  return "p_" + Date.now() + "_" + Math.floor(Math.random() * 999999);
}
