# Palmov Composition Integration Notes

## Overview
This branch integrates Palmov Island art assets into the live game terrain flow and adds dedicated composition preview tooling.

The changes focus on:
- Composition-driven terrain visuals in the real game.
- Expanded model catalog support for Palmov asset packs.
- Dedicated composition viewer for clean visual review.
- Iterative cleanup of composition data (spacing, no props/ports where requested, tree-on-land constraints).

## New/Updated Data Files

### `game/data/testLabModelCatalog.json`
Model catalog rebuilt/expanded to map Palmov FBX content into editor categories:
- `ship`
- `water`
- `island`
- `tree`
- `port`

This catalog is used by lab/editor tooling for model selection and composition authoring.

### `game/data/compositePresetsPalmov30.json`
Primary composition pack used by the game.
- 30 compositions
- Built around larger land/island masses
- Iteratively adjusted to reduce center clustering
- Current state reflects latest request constraints:
  - Ports/props removed from compositions
  - Trees repositioned to ensure they sit on land support areas

### Other preset files
- `game/data/compositePresetsPortsIslands.json`
- `game/data/compositePresetsPortsIslands20.json`

These were also normalized to match current constraints where requested.

## New Viewer Page

### `game/compositions-viewer.html`
Dedicated clean scene for composition review.

### `game/js/compositionsViewer.js`
Viewer logic:
- Load preset packs
- Select and cycle compositions
- Toggle item classes (islands/ports/trees)
- Fit camera to composition
- Auto rotate for quick visual inspection

Use this page for art direction and composition quality checks before applying to runtime systems.

## Runtime Integration

### `game/js/terrain.js`
Terrain visuals now use composition presets in the generation path (`composite-field` mode) and expose marker/collider metadata for gameplay and minimap.

Important runtime behavior:
- Terrain composition instances are spatially separated by center/radius checks.
- Visual colliders are generated from island-type models for gameplay collision.
- Minimap marker data is produced for placed visual assets.

## Supporting Runtime Files

The branch also includes updates in:
- `game/js/main.js`
- `game/js/hud.js`
- `game/js/minimap.js`
- `game/js/ship.js`
- `game/js/ocean.js`
- `game/js/weather.js`
- `game/js/enemy.js`
- `game/js/boss.js`
- `game/js/artOverrides.js`
- `game/js/fbxVisual.js`
- `game/js/testLab.js`
- `game/test-lab.html`

These support the broader graphics/model workflow and runtime art replacement pipeline.

## Current Composition Constraints
Applied to preset packs per latest direction:
- No `port` entries inside compositions.
- Trees/plants should not be floating/water-placed.
- Tree positions are corrected to sit within island/land support zones.

## Suggested Validation Flow
1. Open `game/compositions-viewer.html` and review the `Palmov 30` pack.
2. Open game runtime and verify terrain composition density/readability.
3. Check collision feel around large islands and generated clusters.
4. Iterate composition JSON only, then re-verify in viewer and runtime.

## Notes
- This commit intentionally keeps all current workspace changes together to preserve momentum and avoid losing intermediate integration work.
- If needed later, this branch can be split into smaller PRs (viewer/data/runtime) via cherry-pick.
