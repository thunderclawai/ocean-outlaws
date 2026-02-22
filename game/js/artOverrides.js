// artOverrides.js - hardcoded art/model overrides from Test Lab exports

export var MODEL_OVERRIDES = {
  destroyer: "assets/Palmov Island/Low Poly Cartoon Sailing Ships/Models/ships medium/ship medium 5.fbx",
  // fixed path (original export used ships medium/ship large 4.fbx, which does not exist)
  cruiser: "assets/Palmov Island/Low Poly Cartoon Sailing Ships/Models/ships large/ship large 4.fbx",
  carrier: "assets/Palmov Island/Low Poly Cartoon Sailing Ships/Models/ships large/pirate ship large 1.fbx",
  submarine: "assets/Palmov Island/Low Poly Cartoon Sailing Ships/Models/ships large/pirate ship large 2.fbx",
  enemy_patrol: "assets/Palmov Island/Low Poly Cartoon Sailing Ships/Models/ships medium/chinese ship medium.fbx",
  boss_battleship: "assets/Palmov Island/Low Poly Cartoon Sailing Ships/Models/ships large/chinese ship large.fbx",
  boss_carrier: "assets/Palmov Island/Low Poly Cartoon Sailing Ships/Models/ships large/ship large 5.fbx"
};

export function getOverridePath(slot) {
  return MODEL_OVERRIDES[slot] || null;
}

