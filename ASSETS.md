# ASSETS.md — Asset Conventions

## Directory Structure

```
game/assets/
├── models/
│   ├── ships/           # Playable + enemy vessels
│   │   ├── sloop.glb
│   │   ├── brigantine.glb
│   │   ├── galleon.glb
│   │   ├── manowar.glb
│   │   ├── enemy-patrol.glb
│   │   ├── boss-blackthorn.glb
│   │   └── boss-widow.glb
│   ├── ships-palmov/    # Palmov pack ship variants
│   ├── environment/     # Islands, rocks, terrain pieces
│   ├── houses/
│   ├── islands/
│   ├── lands/
│   ├── mountains/
│   ├── plants/
│   ├── stones/
│   ├── trees/
│   ├── vehicles/
│   └── waters/
├── textures/
│   ├── ships.png        # Shared atlas for sailing ships
│   └── locations.png    # Shared atlas for sea locations
├── compositions/        # Pre-authored island compositions (JSON)
│   ├── palmov-30.json
│   └── ports-islands-20.json
└── manifest.json        # Asset registry (see below)
```

## Naming Conventions

- **All lowercase, kebab-case**: `pirate-ship-large-1.glb` not `pirate ship large 1.glb`
- **No spaces in filenames** — ever. Spaces break URL encoding and CLI tools.
- **Descriptive game names over pack names**: `sloop.glb` not `ship medium 5.glb`
- **Numbered variants use suffix**: `palm-tree-1.glb`, `palm-tree-2.glb`
- **Prefixed by role for ships**: player ships by class name, enemies by `enemy-`, bosses by `boss-`

## File Formats

| Type | Format | Notes |
|------|--------|-------|
| 3D Models | `.glb` | Draco-compressed, exported from Unity via UnityGLTF |
| Textures | Embedded in GLB | Flat-color materials, no large atlases |
| Compositions | `.json` | Pre-authored island groups |
| Manifest | `.json` | Asset registry for loader |

## Export Pipeline

Raw FBX source packs are converted to Draco-compressed GLB via `scripts/convert-fbx-to-glb.sh`:

1. **FBX2glTF** → converts source `.fbx` to raw `.glb`
2. **gltf-transform draco** → applies Draco compression
   ```bash
   bash scripts/convert-fbx-to-glb.sh
   ```
3. Optimized GLBs land in `game/assets/models/` per directory structure above

### Size Targets

| Asset type | Target size | Triangle budget |
|-----------|------------|----------------|
| Ship models | <150KB each | <5,000 tris |
| Environment | <250KB each | <8,000 tris |

### Runtime Loader
```js
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/');
const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);
```

## Manifest Format

`game/assets/manifest.json` — single source of truth for what assets exist:

```json
{
  "version": 1,
  "ships": {
    "sloop":          { "model": "models/ships/sloop.glb",           "size": 6 },
    "destroyer":      { "model": "models/ships/sloop.glb",           "size": 6 },
    "brigantine":     { "model": "models/ships/brigantine.glb",      "size": 7 },
    "cruiser":        { "model": "models/ships/brigantine.glb",      "size": 7 },
    "galleon":        { "model": "models/ships/galleon.glb",         "size": 8 },
    "carrier":        { "model": "models/ships/galleon.glb",         "size": 8 },
    "manowar":        { "model": "models/ships/manowar.glb",         "size": 9 },
    "submarine":      { "model": "models/ships/manowar.glb",         "size": 9 },
    "enemy_patrol":   { "model": "models/ships/enemy-patrol.glb",    "size": 6 },
    "boss_battleship":{ "model": "models/ships/boss-blackthorn.glb", "size": 16 },
    "boss_carrier":   { "model": "models/ships/boss-widow.glb",      "size": 18 }
  },
  "textures": {
    "ships": "textures/ships.png",
    "locations": "textures/locations.png"
  },
  "compositions": [
    "compositions/palmov-30.json",
    "compositions/ports-islands-20.json"
  ]
}
```

The loader reads this manifest. If a model path is missing, it falls back to procedural geometry.

## What Belongs in This Repo

✅ **Include:**
- GLB model files used by the game
- Texture atlases (PNG)
- Composition JSON presets
- Manifest file
- Asset conventions (this file)

❌ **Exclude (via .gitignore):**
- Unity `.meta` files
- Unity `.prefab` files
- Unity `.unity` scene files
- Unity `.mat` material files
- Raw FBX source packs (gitignored at `game/assets/Palmov Island/`)
- Guideline PDFs from asset packs

## Source Packs

Raw Palmov Island FBX packs are gitignored at `game/assets/Palmov Island/`:
- **Low Poly Cartoon Sailing Ships** — ships, boats, viking ships, water
- **Low Poly Sea Locations Pack** — islands, houses, environment, vehicles

Conversion to GLB is automated via `scripts/convert-fbx-to-glb.sh` (FBX2glTF + gltf-transform draco).

## Model Requirements

- **Triangle budget:** <5,000 per ship, <8,000 per environment piece
- **Material:** Flat-color low-poly (no PBR, no large textures)
- **Origin:** Bottom-center of model (ships: waterline center)
- **Forward:** +Z axis (Three.js convention)
- **Scale:** Normalized at load time via `fitToSize()` — export scale doesn't matter

## Sail Mesh Naming Convention (Ships)

Ship models must follow this naming for runtime faction recoloring:

| Mesh name | Purpose |
|-----------|---------|
| `sail_main` | Main mast sail |
| `sail_fore` | Fore mast sail |
| `sail_mizzen` | Mizzen mast sail |
| `sail_main_01`, `sail_main_02` | Multiple sails on same mast |

**Rules:**
- Any mesh with `sail` in its name gets recolored at runtime for faction colors
- Hull, deck, rigging meshes must NOT contain the word `sail`
- Rename in Unity Hierarchy BEFORE exporting GLB

**Faction colors:**
```js
player:   0xf5f0dc  // Cream/natural
pirates:  0xff2200  // Red
navy:     0x1a3a6b  // Navy blue
merchant: 0xc8a850  // Gold/tan
```
