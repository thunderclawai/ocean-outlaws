// terrain.js — procedural island generation, 3D mesh, collision queries
import * as THREE from "three";
import { loadFbxVisual } from "./fbxVisual.js";

// --- tuning ---
var MAP_SIZE = 400;           // world units, matches ocean plane
var GRID_RES = 128;           // heightmap resolution (NxN)
var CELL_SIZE = MAP_SIZE / GRID_RES;
var SEA_LEVEL = 0.0;          // threshold: above = land, below = water
var TERRAIN_HEIGHT = 4;       // max land elevation (lowered for small islands)
var BEACH_HEIGHT = 0.8;       // height below which land counts as beach
var NOISE_SCALE = 0.02;       // noise frequency tuned for island-sized features
var OCTAVES = 4;
var PERSISTENCE = 0.5;
var LACUNARITY = 2.0;
var SPAWN_CLEAR_RADIUS = 40;  // keep center clear for player spawn
var COLLISION_RADIUS = 1.5;   // ship collision sampling radius
var BOUNCE_STRENGTH = 8;      // push-back force on collision
var LARGE_LAND_THRESHOLD = 0.13; // use composite visuals when land coverage is high
var MID_LAND_THRESHOLD = 0.08; // multi-island field visuals, scaled up for mid-sized land
var TERRAIN_VISUAL_Y_OFFSET = 4.0;
var SMALL_ISLAND_MODEL = "assets/Palmov Island/Low Poly Sea Locations Pack/Models/Islands/island mountain arch 2.fbx";
var VISUAL_COLLIDER_PAD = 0.35;
var MIN_SMALL_ISLANDS = 10;
var MIN_MEDIUM_ISLANDS = 7;
var MIN_BIG_ISLANDS = 3;
var FORCE_BIG_COMPOSITE = true;
var COMPOSITE_PRESET_PATH = "data/compositePresetsPalmov30.json";
var MIN_COMPOSITE_OBJECTS = 30;
var MIN_COMPOSITE_INSTANCES = 4;
var MAX_COMPOSITE_INSTANCES = 7;
var COMPOSITE_CENTER_MIN_DIST = SPAWN_CLEAR_RADIUS + 36;
var COMPOSITE_CENTER_MAX_DIST = MAP_SIZE * 0.44;
var COMPOSITE_CENTER_ATTEMPTS = 220;
var VISUAL_COLLIDER_SHRINK = 0.82;

var _compositePackPromise = null;

// --- map boundary ---
var EDGE_FOG_START = 160;     // distance from center where fog begins
var EDGE_PUSH_START = 180;    // distance from center where push-back begins
var EDGE_HARD_LIMIT = 200;    // absolute boundary (MAP_SIZE / 2)

// --- simplex-style 2D noise (value noise with smooth interpolation) ---
// Seeded pseudo-random hash
var _seed = 0;

function hashCoord(ix, iy) {
  var n = ix * 374761393 + iy * 668265263 + _seed;
  n = (n ^ (n >> 13)) * 1274126177;
  n = n ^ (n >> 16);
  return (n & 0x7fffffff) / 0x7fffffff;  // 0..1
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function noise2D(x, y) {
  var ix = Math.floor(x);
  var iy = Math.floor(y);
  var fx = x - ix;
  var fy = y - iy;
  var sx = smoothstep(fx);
  var sy = smoothstep(fy);

  var n00 = hashCoord(ix, iy);
  var n10 = hashCoord(ix + 1, iy);
  var n01 = hashCoord(ix, iy + 1);
  var n11 = hashCoord(ix + 1, iy + 1);

  var nx0 = n00 + (n10 - n00) * sx;
  var nx1 = n01 + (n11 - n01) * sx;
  return nx0 + (nx1 - nx0) * sy;
}

function fbm(x, y) {
  var value = 0;
  var amplitude = 1;
  var frequency = 1;
  var maxAmp = 0;
  for (var i = 0; i < OCTAVES; i++) {
    value += noise2D(x * frequency, y * frequency) * amplitude;
    maxAmp += amplitude;
    amplitude *= PERSISTENCE;
    frequency *= LACUNARITY;
  }
  return value / maxAmp;  // normalized 0..1
}

// --- Gaussian blur for smoother, more organic island shapes ---
function gaussianBlur(data, size, passes) {
  var tmp = new Float32Array(data.length);
  // 3x3 Gaussian kernel weights (sigma ~0.85)
  var k0 = 4 / 16, k1 = 2 / 16, k2 = 1 / 16;
  for (var p = 0; p < passes; p++) {
    for (var y = 0; y < size; y++) {
      for (var x = 0; x < size; x++) {
        var x0 = Math.max(0, x - 1), x1 = Math.min(size - 1, x + 1);
        var y0 = Math.max(0, y - 1), y1 = Math.min(size - 1, y + 1);
        tmp[y * size + x] =
          data[y * size + x] * k0 +
          (data[y * size + x0] + data[y * size + x1] +
           data[y0 * size + x] + data[y1 * size + x]) * k1 +
          (data[y0 * size + x0] + data[y0 * size + x1] +
           data[y1 * size + x0] + data[y1 * size + x1]) * k2;
      }
    }
    for (var i = 0; i < data.length; i++) data[i] = tmp[i];
  }
}

// --- generate heightmap ---
function generateHeightmap(seed, difficulty) {
  _seed = seed;
  var size = GRID_RES + 1;  // +1 for vertex grid
  var data = new Float32Array(size * size);
  var half = MAP_SIZE / 2;

  // scale noise coverage based on difficulty (more land at higher difficulty)
  // ~95% ocean at easy (diff 1), ~90% ocean at hard (diff 6); archipelago feel
  var landThreshold = Math.max(0.70, 0.76 - difficulty * 0.01);  // higher = less land

  for (var iy = 0; iy < size; iy++) {
    for (var ix = 0; ix < size; ix++) {
      var worldX = (ix / GRID_RES) * MAP_SIZE - half;
      var worldZ = (iy / GRID_RES) * MAP_SIZE - half;

      // base noise
      var n = fbm(worldX * NOISE_SCALE, worldZ * NOISE_SCALE);

      // remap: shift so threshold is at sea level
      var h = (n - landThreshold) * 2;  // -1..1 range roughly

      // no border — open ocean fading to horizon

      // clear center area for player spawn
      var distFromCenter = Math.sqrt(worldX * worldX + worldZ * worldZ);
      if (distFromCenter < SPAWN_CLEAR_RADIUS) {
        var clearFactor = 1 - distFromCenter / SPAWN_CLEAR_RADIUS;
        clearFactor = clearFactor * clearFactor;
        h = h - clearFactor * 3;  // push below sea level
      }

      data[iy * size + ix] = h;
    }
  }

  // smooth heightmap for rounder, more natural island profiles
  gaussianBlur(data, size, 2);

  return { data: data, size: size };
}

function calcLandCoverage(heightmap) {
  var d = heightmap.data;
  var land = 0;
  for (var i = 0; i < d.length; i++) if (d[i] > SEA_LEVEL) land++;
  return land / d.length;
}

function ensureDebugOverlay() {
  if (typeof document === "undefined") return null;
  var el = document.getElementById("terrainDebugOverlay");
  if (el) return el;
  el = document.createElement("div");
  el.id = "terrainDebugOverlay";
  el.style.cssText = [
    "position:fixed",
    "left:10px",
    "bottom:10px",
    "z-index:9999",
    "padding:8px 10px",
    "background:rgba(8,18,28,0.78)",
    "border:1px solid rgba(120,160,190,0.45)",
    "border-radius:8px",
    "color:#cfe2f2",
    "font:12px/1.35 monospace",
    "pointer-events:none",
    "white-space:pre"
  ].join(";");
  document.body.appendChild(el);
  return el;
}

function updateDebugOverlay(terrain) {
  var el = ensureDebugOverlay();
  if (!el || !terrain) return;
  var txt = "";
  txt += "Terrain Debug\n";
  txt += "seed: " + terrain.seed + "\n";
  txt += "difficulty: " + terrain.difficulty + "\n";
  txt += "coverage: " + terrain.landCoverage.toFixed(3) + "\n";
  txt += "visual mode: " + (terrain.visualMode || "procedural") + "\n";
  txt += "composite instances: " + (terrain.compositeInstanceCount || 0) + "\n";
  txt += "composite objects: " + (terrain.compositePlacedCount || 0) + "\n";
  txt += "placed models: " + (terrain.placedModelCount || 0) + "\n";
  txt += "visual colliders: " + (terrain.visualColliders ? terrain.visualColliders.length : 0) + "\n";
  txt += "visual collision: " + (!!terrain.useVisualCollision);
  el.textContent = txt;
}

function addVisualColliderFromObject(terrain, obj) {
  if (!terrain || !obj) return;
  var box = new THREE.Box3().setFromObject(obj);
  if (!isFinite(box.min.x) || !isFinite(box.max.x)) return;
  var cx = (box.min.x + box.max.x) * 0.5;
  var cz = (box.min.z + box.max.z) * 0.5;
  var hx = (box.max.x - box.min.x) * 0.5 * VISUAL_COLLIDER_SHRINK;
  var hz = (box.max.z - box.min.z) * 0.5 * VISUAL_COLLIDER_SHRINK;
  terrain.visualColliders.push({
    minX: cx - hx,
    maxX: cx + hx,
    minZ: cz - hz,
    maxZ: cz + hz
  });
}

function addMinimapMarker(terrain, type, x, z, size, modelPath) {
  if (!terrain) return;
  if (!terrain.minimapMarkers) terrain.minimapMarkers = [];
  terrain.minimapMarkers.push({
    type: type || "island",
    x: x,
    z: z,
    size: size || 1,
    modelPath: modelPath || ""
  });
}

function shouldAddCompositeCollider(item) {
  // Keep collision on actual island mass only. Trees/props/piers should not block ships.
  return item && item.type === "island";
}

function pointInVisualLand(terrain, x, z, radiusPad) {
  if (!terrain || !terrain.visualColliders || terrain.visualColliders.length === 0) return false;
  var pad = radiusPad || 0;
  for (var i = 0; i < terrain.visualColliders.length; i++) {
    var c = terrain.visualColliders[i];
    if (x >= c.minX - pad && x <= c.maxX + pad && z >= c.minZ - pad && z <= c.maxZ + pad) return true;
  }
  return false;
}

function resolveVisualCollision(terrain, posX, posZ, prevX, prevZ) {
  if (!terrain || !terrain.visualColliders) return null;
  var pad = COLLISION_RADIUS + VISUAL_COLLIDER_PAD;
  var nx = posX;
  var nz = posZ;
  var collided = false;

  // Iterate a few times in case the projected point is still inside another collider.
  for (var it = 0; it < 4; it++) {
    var any = false;
    for (var i = 0; i < terrain.visualColliders.length; i++) {
      var c = terrain.visualColliders[i];
      var minX = c.minX - pad, maxX = c.maxX + pad, minZ = c.minZ - pad, maxZ = c.maxZ + pad;
      if (nx < minX || nx > maxX || nz < minZ || nz > maxZ) continue;

      any = true;
      collided = true;
      var leftDist = Math.abs(nx - minX);
      var rightDist = Math.abs(maxX - nx);
      var downDist = Math.abs(nz - minZ);
      var upDist = Math.abs(maxZ - nz);
      var minDist = Math.min(leftDist, rightDist, downDist, upDist);
      if (minDist === leftDist) nx = minX - 0.02;
      else if (minDist === rightDist) nx = maxX + 0.02;
      else if (minDist === downDist) nz = minZ - 0.02;
      else nz = maxZ + 0.02;
    }
    if (!any) break;
  }
  if (!collided) return null;
  return { collided: true, newX: nx, newZ: nz };
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// --- public: obstacle proximity + avoidance vector for ship steering ---
// Returns { factor, awayX, awayZ, distance } where factor is 0..1.
export function getTerrainAvoidance(terrain, worldX, worldZ, range) {
  var out = { factor: 0, awayX: 0, awayZ: 0, distance: Infinity };
  if (!terrain || !terrain.useVisualCollision || !terrain.visualColliders || terrain.visualColliders.length === 0) return out;
  var avoidRange = range || 14;
  var bestDist = Infinity;
  var bestDx = 0;
  var bestDz = 0;

  for (var i = 0; i < terrain.visualColliders.length; i++) {
    var c = terrain.visualColliders[i];
    var nx = clamp(worldX, c.minX, c.maxX);
    var nz = clamp(worldZ, c.minZ, c.maxZ);
    var dx = worldX - nx;
    var dz = worldZ - nz;
    var inside = (worldX >= c.minX && worldX <= c.maxX && worldZ >= c.minZ && worldZ <= c.maxZ);
    var d = Math.sqrt(dx * dx + dz * dz);

    if (inside) {
      var ccx = (c.minX + c.maxX) * 0.5;
      var ccz = (c.minZ + c.maxZ) * 0.5;
      dx = worldX - ccx;
      dz = worldZ - ccz;
      d = 0;
    }
    if (d < bestDist) {
      bestDist = d;
      bestDx = dx;
      bestDz = dz;
    }
  }

  if (!isFinite(bestDist) || bestDist >= avoidRange) return out;
  var len = Math.sqrt(bestDx * bestDx + bestDz * bestDz);
  if (len < 0.0001) {
    bestDx = 0;
    bestDz = -1;
    len = 1;
  }
  out.awayX = bestDx / len;
  out.awayZ = bestDz / len;
  var t = 1 - bestDist / avoidRange;
  out.factor = Math.max(0, Math.min(1, t * t));
  out.distance = bestDist;
  return out;
}

// --- flood fill to ensure all water is navigable ---
function ensureNavigable(heightmap) {
  var size = heightmap.size;
  var data = heightmap.data;
  // find the center cell (guaranteed water)
  var cx = Math.floor(size / 2);
  var cy = Math.floor(size / 2);

  // BFS from center to mark all reachable water
  var visited = new Uint8Array(size * size);
  var queue = [cx + cy * size];
  visited[cx + cy * size] = 1;

  while (queue.length > 0) {
    var idx = queue.shift();
    var y = Math.floor(idx / size);
    var x = idx - y * size;
    var neighbors = [
      [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]
    ];
    for (var i = 0; i < neighbors.length; i++) {
      var nx = neighbors[i][0];
      var ny = neighbors[i][1];
      if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
      var ni = ny * size + nx;
      if (visited[ni]) continue;
      if (data[ni] <= SEA_LEVEL) {
        visited[ni] = 1;
        queue.push(ni);
      }
    }
  }

  // any water cell NOT visited is a landlocked pocket — fill with land
  // (alternatively, lower unreachable land to make it water, but filling is simpler)
  for (var i = 0; i < data.length; i++) {
    if (data[i] <= SEA_LEVEL && !visited[i]) {
      // this water pocket is unreachable — raise it to land
      data[i] = 0.3;
    }
  }
}

// --- query heightmap at world position ---
function sampleHeight(terrain, worldX, worldZ) {
  var half = MAP_SIZE / 2;
  var u = (worldX + half) / MAP_SIZE * GRID_RES;
  var v = (worldZ + half) / MAP_SIZE * GRID_RES;
  var size = terrain.heightmap.size;
  var data = terrain.heightmap.data;

  var ix = Math.floor(u);
  var iy = Math.floor(v);
  ix = Math.max(0, Math.min(size - 2, ix));
  iy = Math.max(0, Math.min(size - 2, iy));
  var fx = u - ix;
  var fy = v - iy;

  var h00 = data[iy * size + ix];
  var h10 = data[iy * size + ix + 1];
  var h01 = data[(iy + 1) * size + ix];
  var h11 = data[(iy + 1) * size + ix + 1];

  var hx0 = h00 + (h10 - h00) * fx;
  var hx1 = h01 + (h11 - h01) * fx;
  return hx0 + (hx1 - hx0) * fy;
}

// --- public: check if a world position is on land ---
export function isLand(terrain, worldX, worldZ) {
  if (!terrain) return false;
  if (terrain.useVisualCollision && pointInVisualLand(terrain, worldX, worldZ, COLLISION_RADIUS)) return true;
  return sampleHeight(terrain, worldX, worldZ) > SEA_LEVEL;
}

// --- public: get terrain height at world position ---
export function getTerrainHeight(terrain, worldX, worldZ) {
  if (!terrain) return -1;
  if (terrain.useVisualCollision && pointInVisualLand(terrain, worldX, worldZ, COLLISION_RADIUS)) {
    return 1;
  }
  return sampleHeight(terrain, worldX, worldZ);
}

// --- public: collide a moving entity with terrain ---
// Returns { collided, newX, newZ } — pushes entity out of land
export function collideWithTerrain(terrain, posX, posZ, prevX, prevZ) {
  if (!terrain) return { collided: false, newX: posX, newZ: posZ };
  if (terrain.useVisualCollision) {
    var vcol = resolveVisualCollision(terrain, posX, posZ, prevX, prevZ);
    if (vcol) return vcol;
    return { collided: false, newX: posX, newZ: posZ };
  }

  var h = sampleHeight(terrain, posX, posZ);
  if (h <= SEA_LEVEL) return { collided: false, newX: posX, newZ: posZ };

  // sample gradient to find push direction (away from higher terrain)
  var step = CELL_SIZE;
  var hL = sampleHeight(terrain, posX - step, posZ);
  var hR = sampleHeight(terrain, posX + step, posZ);
  var hU = sampleHeight(terrain, posX, posZ - step);
  var hD = sampleHeight(terrain, posX, posZ + step);

  var gradX = hR - hL;
  var gradZ = hD - hU;
  var gradLen = Math.sqrt(gradX * gradX + gradZ * gradZ);

  if (gradLen > 0.001) {
    // push along negative gradient (downhill = toward water)
    var pushX = -gradX / gradLen;
    var pushZ = -gradZ / gradLen;
    // push distance proportional to penetration
    var penetration = h - SEA_LEVEL;
    var pushDist = penetration * 2 + 0.5;
    var newX = posX + pushX * pushDist;
    var newZ = posZ + pushZ * pushDist;
    // verify the pushed position is actually water
    if (sampleHeight(terrain, newX, newZ) <= SEA_LEVEL) {
      return { collided: true, newX: newX, newZ: newZ };
    }
  }

  // fallback: revert to previous position
  return { collided: true, newX: prevX, newZ: prevZ };
}

// --- public: check line-of-sight between two points ---
// Returns true if terrain blocks the line
export function terrainBlocksLine(terrain, x1, z1, x2, z2) {
  if (!terrain) return false;
  if (terrain.useVisualCollision) {
    var vdx = x2 - x1;
    var vdz = z2 - z1;
    var vdist = Math.sqrt(vdx * vdx + vdz * vdz);
    var vsteps = Math.ceil(vdist / 2.0);
    if (vsteps < 2) vsteps = 2;
    for (var vi = 1; vi < vsteps; vi++) {
      var vt = vi / vsteps;
      var vx = x1 + vdx * vt;
      var vz = z1 + vdz * vt;
      if (pointInVisualLand(terrain, vx, vz, VISUAL_COLLIDER_PAD)) return true;
    }
    return false;
  }
  var dx = x2 - x1;
  var dz = z2 - z1;
  var dist = Math.sqrt(dx * dx + dz * dz);
  var steps = Math.ceil(dist / (CELL_SIZE * 0.5));
  if (steps < 2) steps = 2;

  for (var i = 1; i < steps; i++) {
    var t = i / steps;
    var sx = x1 + dx * t;
    var sz = z1 + dz * t;
    if (sampleHeight(terrain, sx, sz) > SEA_LEVEL + 0.5) {
      return true;
    }
  }
  return false;
}

// --- marching squares: interpolated shoreline vertex along cell edge ---
// Returns the interpolated position (0..1 fraction) where sea level crosses
function edgeLerp(hA, hB) {
  var denom = hA - hB;
  if (Math.abs(denom) < 0.0001) return 0.5;
  return Math.max(0, Math.min(1, hA / denom));
}

// Convert heightmap value to mesh Y with gentle beach slope
function heightToY(h) {
  if (h <= SEA_LEVEL) return 0;
  // gradual beach ramp: ease-in for low heights
  var beachRamp = Math.min(h / BEACH_HEIGHT, 1.0);
  beachRamp = beachRamp * beachRamp;  // quadratic ease-in for gentle slope
  return h * TERRAIN_HEIGHT * (0.3 + 0.7 * beachRamp);
}

// Edge connectivity: edge 0=bottom(0→1), 1=right(1→2), 2=top(3→2), 3=left(0→3)
var EDGE_FROM = [0, 1, 3, 0];
var EDGE_TO   = [1, 2, 2, 3];

// --- build 3D mesh from heightmap using marching squares ---
// Interpolates shoreline edges for smooth, curved coastlines that match
// the bilinear-interpolated collision boundary exactly.
function buildTerrainMesh(heightmap) {
  var size = heightmap.size;
  var data = heightmap.data;
  var half = MAP_SIZE / 2;

  var positions = [];
  var colors = [];

  var colorLand = new THREE.Color(0x4a7a35);
  var colorDirt = new THREE.Color(0x8b6914);
  var colorBeach = new THREE.Color(0xe8d5a0);
  var colorPeak = new THREE.Color(0x5a5a5a);

  for (var iy = 0; iy < size - 1; iy++) {
    for (var ix = 0; ix < size - 1; ix++) {
      var h00 = data[iy * size + ix];
      var h10 = data[iy * size + ix + 1];
      var h01 = data[(iy + 1) * size + ix];
      var h11 = data[(iy + 1) * size + ix + 1];

      // marching squares case index: bit per corner above sea level
      var caseIdx =
        (h00 > SEA_LEVEL ? 1 : 0) |
        (h10 > SEA_LEVEL ? 2 : 0) |
        (h11 > SEA_LEVEL ? 4 : 0) |
        (h01 > SEA_LEVEL ? 8 : 0);

      // skip all-water cells
      if (caseIdx === 0) continue;

      // world-space corners of this cell
      var x0 = (ix / GRID_RES) * MAP_SIZE - half;
      var x1 = ((ix + 1) / GRID_RES) * MAP_SIZE - half;
      var z0 = (iy / GRID_RES) * MAP_SIZE - half;
      var z1 = ((iy + 1) / GRID_RES) * MAP_SIZE - half;

      // corners: 0=SW(x0,z0) 1=SE(x1,z0) 2=NE(x1,z1) 3=NW(x0,z1)
      var cx = [x0, x1, x1, x0];
      var cz = [z0, z0, z1, z1];
      var ch = [h00, h10, h11, h01];
      var cy = [heightToY(h00), heightToY(h10), heightToY(h11), heightToY(h01)];

      // interpolated edge crossing points where sea level meets cell edges
      var ex = [], ez = [], ey = [];
      for (var e = 0; e < 4; e++) {
        var a = EDGE_FROM[e], b = EDGE_TO[e];
        var t = edgeLerp(ch[a], ch[b]);
        ex[e] = cx[a] + (cx[b] - cx[a]) * t;
        ez[e] = cz[a] + (cz[b] - cz[a]) * t;
        ey[e] = 0;  // shoreline vertices at sea level
      }

      // all-land: full quad, same as before but with beach slopes
      if (caseIdx === 15) {
        pushTri(positions, cx[0], cy[0], cz[0], cx[1], cy[1], cz[1], cx[3], cy[3], cz[3]);
        pushTri(positions, cx[1], cy[1], cz[1], cx[2], cy[2], cz[2], cx[3], cy[3], cz[3]);
        var avgH1 = (ch[0] + ch[1] + ch[3]) / 3;
        var avgH2 = (ch[1] + ch[2] + ch[3]) / 3;
        colorTriangle(colors, avgH1, colorBeach, colorLand, colorDirt, colorPeak);
        colorTriangle(colors, avgH2, colorBeach, colorLand, colorDirt, colorPeak);
        continue;
      }

      // marching squares triangulation for partial cells
      // Each case emits triangles covering only the land portion
      var tris = marchTris(caseIdx, cx, cy, cz, ex, ey, ez);
      for (var ti = 0; ti < tris.length; ti += 9) {
        positions.push(
          tris[ti], tris[ti + 1], tris[ti + 2],
          tris[ti + 3], tris[ti + 4], tris[ti + 5],
          tris[ti + 6], tris[ti + 7], tris[ti + 8]
        );
        // average height of the triangle's source data for coloring
        var triAvgH = Math.max(0, (tris[ti + 1] + tris[ti + 4] + tris[ti + 7]) / (3 * TERRAIN_HEIGHT));
        colorTriangle(colors, triAvgH, colorBeach, colorLand, colorDirt, colorPeak);
      }
    }
  }

  var geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  var material = new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: true,
    side: THREE.DoubleSide
  });

  var mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = TERRAIN_VISUAL_Y_OFFSET;  // raise terrain above max wave height
  mesh.renderOrder = 2;
  return mesh;
}

function fitForCompositeItem(item) {
  if (item.type === "tree") return 10;
  if (item.type === "port") return 18;
  return 20;
}

function getCompositeMarkerTypeByScale(itemType, worldScale) {
  if (itemType === "port") return "port";
  if (itemType === "tree") return "tree";
  if (worldScale >= 1.35) return "island_big";
  if (worldScale >= 1.0) return "island_mid";
  return "island_small";
}

function rotateXZ(x, z, rad) {
  var c = Math.cos(rad);
  var s = Math.sin(rad);
  return { x: x * c - z * s, z: x * s + z * c };
}

function scaleBucket(rng) {
  var p = rng();
  if (p < 0.34) return 0.72 + rng() * 0.22; // small
  if (p < 0.78) return 0.96 + rng() * 0.30; // mid
  return 1.30 + rng() * 0.38;               // big
}

function estimateCompositeRadius(def, instanceScale) {
  if (!def || !Array.isArray(def.items) || def.items.length === 0) return 28 * instanceScale;
  var maxD2 = 0;
  for (var i = 0; i < def.items.length; i++) {
    var it = def.items[i];
    var lx = (it.x || 0);
    var lz = (it.z || 0);
    var localScale = (it.scale || 1);
    var d2 = lx * lx + lz * lz;
    if (d2 > maxD2) maxD2 = d2;
    d2 = d2 + (16 * localScale * localScale);
    if (d2 > maxD2) maxD2 = d2;
  }
  return Math.sqrt(maxD2) * instanceScale + 8;
}

function loadCompositePack() {
  if (_compositePackPromise) return _compositePackPromise;
  _compositePackPromise = fetch(COMPOSITE_PRESET_PATH).then(function (res) {
    if (!res.ok) throw new Error("failed to load composite presets");
    return res.json();
  }).then(function (json) {
    return Array.isArray(json.composites) ? json.composites : [];
  }).catch(function () {
    return [];
  });
  return _compositePackPromise;
}

async function addCompositeFieldVisual(root, terrain, seed) {
  var defs = await loadCompositePack();
  if (!defs || defs.length === 0) return { itemsPlaced: 0, instancesPlaced: 0 };

  var rng = seededRand(seed + 4041);
  var centers = [];
  var itemsPlaced = 0;
  var instancesPlaced = 0;
  var used = {};

  while (instancesPlaced < MAX_COMPOSITE_INSTANCES) {
    if (instancesPlaced >= MIN_COMPOSITE_INSTANCES && itemsPlaced >= MIN_COMPOSITE_OBJECTS) break;

    var chosenIdx = Math.floor(rng() * defs.length);
    if (instancesPlaced < defs.length) {
      // Spread the first passes so we don't keep repeating one preset.
      var scan = 0;
      while (scan < defs.length && used[chosenIdx]) { chosenIdx = (chosenIdx + 1) % defs.length; scan++; }
    }
    used[chosenIdx] = true;
    var def = defs[chosenIdx];
    if (!def || !Array.isArray(def.items) || def.items.length === 0) continue;

    var instScale = scaleBucket(rng);
    var radius = estimateCompositeRadius(def, instScale);
    var rot = rng() * Math.PI * 2;

    var found = null;
    for (var a = 0; a < COMPOSITE_CENTER_ATTEMPTS; a++) {
      var ang = rng() * Math.PI * 2;
      var dist = COMPOSITE_CENTER_MIN_DIST + rng() * (COMPOSITE_CENTER_MAX_DIST - COMPOSITE_CENTER_MIN_DIST);
      var cx = Math.sin(ang) * dist;
      var cz = Math.cos(ang) * dist;

      var ok = true;
      for (var c = 0; c < centers.length; c++) {
        var dx = cx - centers[c].x;
        var dz = cz - centers[c].z;
        var minD = radius + centers[c].radius + 14;
        if (dx * dx + dz * dz < minD * minD) { ok = false; break; }
      }
      if (!ok) continue;
      if (cx * cx + cz * cz < COMPOSITE_CENTER_MIN_DIST * COMPOSITE_CENTER_MIN_DIST) continue;
      found = { x: cx, z: cz };
      break;
    }
    if (!found) continue;

    centers.push({ x: found.x, z: found.z, radius: radius });
    instancesPlaced++;

    for (var i = 0; i < def.items.length; i++) {
      var item = def.items[i];
      try {
        var local = rotateXZ((item.x || 0) * instScale, (item.z || 0) * instScale, rot);
        var visual = await loadFbxVisual(item.modelPath, fitForCompositeItem(item), true);
        var holder = new THREE.Group();
        holder.add(visual);
        holder.position.set(
          found.x + local.x,
          TERRAIN_VISUAL_Y_OFFSET + (item.y || 0) * instScale,
          found.z + local.z
        );
        holder.rotation.y = rot + THREE.MathUtils.degToRad(item.rotYDeg || 0);
        var worldScale = (item.scale || 1) * instScale;
        holder.scale.setScalar(worldScale);
        root.add(holder);
        if (shouldAddCompositeCollider(item)) addVisualColliderFromObject(terrain, holder);
        addMinimapMarker(
          terrain,
          getCompositeMarkerTypeByScale(item.type, worldScale),
          holder.position.x,
          holder.position.z,
          worldScale,
          item.modelPath
        );
        itemsPlaced++;
      } catch (e) {
        // keep loading remaining objects
      }
    }
  }

  return { itemsPlaced: itemsPlaced, instancesPlaced: instancesPlaced };
}

function seededRand(seed) {
  var s = (seed >>> 0) || 1;
  return function () {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function collectLandPoints(heightmap, minDistFromCenter) {
  var pts = [];
  var half = MAP_SIZE / 2;
  var size = heightmap.size;
  var data = heightmap.data;
  for (var iy = 0; iy < size; iy++) {
    for (var ix = 0; ix < size; ix++) {
      var h = data[iy * size + ix];
      if (h <= SEA_LEVEL + 0.03) continue;
      var x = (ix / GRID_RES) * MAP_SIZE - half;
      var z = (iy / GRID_RES) * MAP_SIZE - half;
      var d2 = x * x + z * z;
      if (d2 < minDistFromCenter * minDistFromCenter) continue;
      pts.push({ x: x, z: z, h: h });
    }
  }
  return pts;
}

async function addSingleIslandFieldVisual(root, terrain, heightmap, seed, count, baseScale) {
  var land = collectLandPoints(heightmap, SPAWN_CLEAR_RADIUS + 12);
  if (land.length === 0) return 0;

  var rng = seededRand(seed + 1337);
  var placed = [];
  var minSpacing = 20;
  var target = Math.max(2, count || 4);

  for (var t = 0; t < land.length * 2 && placed.length < target; t++) {
    var cand = land[Math.floor(rng() * land.length)];
    var ok = true;
    for (var i = 0; i < placed.length; i++) {
      var dx = cand.x - placed[i].x;
      var dz = cand.z - placed[i].z;
      if (dx * dx + dz * dz < minSpacing * minSpacing) { ok = false; break; }
    }
    if (ok) placed.push(cand);
  }
  if (placed.length === 0) return 0;

  try {
    var template = await loadFbxVisual(SMALL_ISLAND_MODEL, 20, true);
    for (var p = 0; p < placed.length; p++) {
      var holder = new THREE.Group();
      holder.add(template.clone(true));
      holder.position.set(placed[p].x, TERRAIN_VISUAL_Y_OFFSET + placed[p].h * TERRAIN_HEIGHT * 0.05, placed[p].z);
      holder.rotation.y = rng() * Math.PI * 2;
      var s = (baseScale || 1) * (0.82 + rng() * 0.36);
      holder.scale.setScalar(s);
      root.add(holder);
      addVisualColliderFromObject(terrain, holder);
      addMinimapMarker(terrain, "island", placed[p].x, placed[p].z, s, SMALL_ISLAND_MODEL);
    }
    return placed.length;
  } catch (e) {
    return 0;
  }
}

async function addTieredIslandFieldVisual(root, terrain, heightmap, seed) {
  var land = collectLandPoints(heightmap, SPAWN_CLEAR_RADIUS + 12);
  if (land.length === 0) return 0;

  var rng = seededRand(seed + 1337);
  var placed = [];

  function tryPlace(count, minScale, maxScale, minSpacing, template, markerType) {
    var placedNow = 0;
    for (var t = 0; t < land.length * 4 && placedNow < count; t++) {
      var cand = land[Math.floor(rng() * land.length)];
      // Avoid placing too close to already placed/composite island colliders.
      if (pointInVisualLand(terrain, cand.x, cand.z, minSpacing * 0.75)) continue;
      var ok = true;
      for (var i = 0; i < placed.length; i++) {
        var dx = cand.x - placed[i].x;
        var dz = cand.z - placed[i].z;
        if (dx * dx + dz * dz < minSpacing * minSpacing) { ok = false; break; }
      }
      if (!ok) continue;
      var holder = new THREE.Group();
      holder.add(template.clone(true));
      holder.position.set(cand.x, TERRAIN_VISUAL_Y_OFFSET + cand.h * TERRAIN_HEIGHT * 0.05, cand.z);
      holder.rotation.y = rng() * Math.PI * 2;
      holder.scale.setScalar(minScale + rng() * (maxScale - minScale));
      root.add(holder);
      addVisualColliderFromObject(terrain, holder);
      addMinimapMarker(terrain, markerType, cand.x, cand.z, holder.scale.x, SMALL_ISLAND_MODEL);
      placed.push({ x: cand.x, z: cand.z });
      placedNow++;
    }
    return placedNow;
  }

  try {
    var template = await loadFbxVisual(SMALL_ISLAND_MODEL, 20, true);
    var total = 0;
    total += tryPlace(MIN_BIG_ISLANDS, 1.7, 2.05, 38, template, "island_big");
    total += tryPlace(MIN_MEDIUM_ISLANDS, 1.2, 1.55, 30, template, "island_mid");
    total += tryPlace(MIN_SMALL_ISLANDS, 0.82, 1.12, 21, template, "island_small");
    return total;
  } catch (e) {
    return 0;
  }
}

function pushTri(arr, ax, ay, az, bx, by, bz, cx, cy, cz) {
  arr.push(ax, ay, az, bx, by, bz, cx, cy, cz);
}

// Marching squares triangle tables. Corners: 0=SW 1=SE 2=NE 3=NW.
// Edges: 0=bottom 1=right 2=top 3=left. Negative = edge idx (offset by -1).
// caseIdx bits: corner0=1, corner1=2, corner2=4, corner3=8.
var MARCH_TABLE = [];
MARCH_TABLE[1]  = [0, -1, -4];
MARCH_TABLE[2]  = [1, -2, -1];
MARCH_TABLE[4]  = [2, -3, -2];
MARCH_TABLE[8]  = [3, -4, -3];
MARCH_TABLE[3]  = [0, 1, -2,  0, -2, -4];
MARCH_TABLE[6]  = [1, 2, -3,  1, -3, -1];
MARCH_TABLE[12] = [3, -4, 2,  2, -4, -2];
MARCH_TABLE[9]  = [0, -1, 3,  3, -1, -3];
MARCH_TABLE[5]  = [0, -1, -4,  2, -3, -2];
MARCH_TABLE[10] = [1, -2, -1,  3, -4, -3];
MARCH_TABLE[14] = [1, 2, 3,  1, 3, -4,  1, -4, -1];
MARCH_TABLE[13] = [0, -1, 3,  3, -1, -2,  3, -2, 2];
MARCH_TABLE[11] = [0, 1, -2,  0, -2, -3,  0, -3, 3];
MARCH_TABLE[7]  = [0, 1, 2,  0, 2, -3,  0, -3, -4];

function marchTris(caseIdx, cx, cy, cz, ex, ey, ez) {
  var table = MARCH_TABLE[caseIdx];
  if (!table) return [];
  var out = [];
  for (var i = 0; i < table.length; i++) {
    var v = table[i];
    if (v >= 0) { out.push(cx[v], cy[v], cz[v]); }
    else { var e = -v - 1; out.push(ex[e], ey[e], ez[e]); }
  }
  return out;
}

function colorTriangle(colors, avgH, beach, land, dirt, peak) {
  var c;
  if (avgH < BEACH_HEIGHT * 0.3) {
    c = beach;
  } else if (avgH < BEACH_HEIGHT) {
    var t = avgH / BEACH_HEIGHT;
    c = beach.clone().lerp(dirt, t);
  } else if (avgH < 0.6) {
    var t = (avgH - BEACH_HEIGHT) / (0.6 - BEACH_HEIGHT);
    c = dirt.clone().lerp(land, t);
  } else {
    var t = Math.min(1, (avgH - 0.6) / 0.4);
    c = land.clone().lerp(peak, t);
  }
  for (var i = 0; i < 3; i++) {
    colors.push(c.r, c.g, c.b);
  }
}

// --- public: create terrain for a zone ---
export function createTerrain(seed, difficulty) {
  var heightmap = generateHeightmap(seed, difficulty);
  ensureNavigable(heightmap);
  var baseMesh = buildTerrainMesh(heightmap);
  var mesh = new THREE.Group();
  mesh.add(baseMesh);
  var terrain = {
    mesh: mesh,
    baseMesh: baseMesh,
    heightmap: heightmap,
    seed: seed,
    difficulty: difficulty,
    landCoverage: calcLandCoverage(heightmap),
    visualMode: "procedural",
    compositePlacedCount: 0,
    compositeInstanceCount: 0,
    placedModelCount: 0,
    visualColliders: [],
    useVisualCollision: false,
    minimapMarkers: [],
    compositeOrigin: { x: 0, z: 0 }
  };

  terrain.visualMode = "composite-field";
  addCompositeFieldVisual(mesh, terrain, seed + difficulty * 101).then(function (res) {
    terrain.compositePlacedCount = res ? (res.itemsPlaced || 0) : 0;
    terrain.compositeInstanceCount = res ? (res.instancesPlaced || 0) : 0;
    terrain.placedModelCount = terrain.compositePlacedCount;

    // Fallback: ensure we still have geography if composite loading fails.
    if (terrain.placedModelCount <= 0) {
      terrain.visualMode = "composite-fallback-tiered";
      addTieredIslandFieldVisual(mesh, terrain, heightmap, seed).then(function (placed) {
        terrain.placedModelCount = placed;
        terrain.useVisualCollision = placed > 0;
        baseMesh.visible = placed <= 0;
        updateDebugOverlay(terrain);
      });
      return;
    }
    terrain.useVisualCollision = true;
    baseMesh.visible = false;
    updateDebugOverlay(terrain);
  });
  updateDebugOverlay(terrain);
  return terrain;
}

// --- public: remove terrain from scene ---
export function removeTerrain(terrain, scene) {
  if (!terrain) return;
  if (!terrain.mesh) return;
  scene.remove(terrain.mesh);
  terrain.mesh.traverse(function (o) {
    if (o.geometry) o.geometry.dispose();
    if (!o.material) return;
    if (Array.isArray(o.material)) {
      for (var i = 0; i < o.material.length; i++) if (o.material[i] && o.material[i].dispose) o.material[i].dispose();
    } else if (o.material.dispose) {
      o.material.dispose();
    }
  });
}

// --- public: find a valid (water) spawn position near a point ---
export function findWaterPosition(terrain, nearX, nearZ, minDist, maxDist) {
  if (!terrain) {
    var angle = Math.random() * Math.PI * 2;
    var dist = minDist + Math.random() * (maxDist - minDist);
    return { x: nearX + Math.sin(angle) * dist, z: nearZ + Math.cos(angle) * dist };
  }
  // try random positions until we find water
  for (var attempt = 0; attempt < 50; attempt++) {
    var angle = Math.random() * Math.PI * 2;
    var dist = minDist + Math.random() * (maxDist - minDist);
    var x = nearX + Math.sin(angle) * dist;
    var z = nearZ + Math.cos(angle) * dist;
    if (!isLand(terrain, x, z)) {
      return { x: x, z: z };
    }
  }
  // fallback: return center (always water)
  return { x: 0, z: 0 };
}

// --- public: get edge proximity factor (0 = safe, 1 = at hard limit) ---
export function getEdgeFactor(worldX, worldZ) {
  var dist = Math.sqrt(worldX * worldX + worldZ * worldZ);
  if (dist <= EDGE_FOG_START) return 0;
  return Math.min(1, (dist - EDGE_FOG_START) / (EDGE_HARD_LIMIT - EDGE_FOG_START));
}

// --- public: apply map edge push-back to a position ---
// Returns { posX, posZ, pushed } — nudges entity toward center when near edge
export function applyEdgeBoundary(posX, posZ) {
  var dist = Math.sqrt(posX * posX + posZ * posZ);
  if (dist <= EDGE_PUSH_START) return { posX: posX, posZ: posZ, pushed: false };

  var factor = Math.min(1, (dist - EDGE_PUSH_START) / (EDGE_HARD_LIMIT - EDGE_PUSH_START));
  factor = factor * factor;  // ease-in: gentle at first, strong near limit

  // push toward center
  var pushStrength = factor * 15;  // max push force
  var nx = posX / dist;
  var nz = posZ / dist;
  var newX = posX - nx * pushStrength * 0.016;  // ~1 frame at 60fps
  var newZ = posZ - nz * pushStrength * 0.016;

  // hard clamp at absolute limit
  var newDist = Math.sqrt(newX * newX + newZ * newZ);
  if (newDist > EDGE_HARD_LIMIT) {
    newX = newX / newDist * EDGE_HARD_LIMIT;
    newZ = newZ / newDist * EDGE_HARD_LIMIT;
  }

  return { posX: newX, posZ: newZ, pushed: true };
}

export function getTerrainMinimapMarkers(terrain) {
  if (!terrain || !terrain.minimapMarkers) return [];
  return terrain.minimapMarkers;
}
