// resource.js — resource state management: ammo, fuel, repair parts, wave tracking

// --- balance tuning ---
var STARTING_AMMO = 50;
var MAX_AMMO = 80;
var STARTING_FUEL = 100;
var MAX_FUEL = 100;
var FUEL_BURN_RATE = 1.5;        // fuel per second at full throttle
var LOW_FUEL_SPEED_MULT = 0.35;  // min speed multiplier at zero fuel
var REPAIR_PER_PART = 2;         // HP restored per repair part between waves
var WAVE_ENEMY_COUNT_BASE = 3;   // enemies in wave 1
var WAVE_ENEMY_INCREMENT = 2;    // extra enemies per wave
var WAVE_PAUSE_DURATION = 4;     // seconds between waves (repair phase)

// --- create resource state ---
export function createResources() {
  return {
    ammo: STARTING_AMMO,
    maxAmmo: MAX_AMMO,
    fuel: STARTING_FUEL,
    maxFuel: MAX_FUEL,
    parts: 0,

    // wave tracking
    wave: 1,
    waveEnemiesRemaining: WAVE_ENEMY_COUNT_BASE,
    waveActive: true,
    wavePauseTimer: 0,
    repairing: false
  };
}

// --- consume fuel based on current throttle ---
export function consumeFuel(res, speedRatio, dt) {
  if (res.fuel <= 0) return;
  var burn = FUEL_BURN_RATE * speedRatio * dt;
  res.fuel = Math.max(0, res.fuel - burn);
}

// --- get speed multiplier from fuel level ---
export function getFuelSpeedMult(res) {
  if (res.fuel <= 0) return LOW_FUEL_SPEED_MULT;
  // smooth ramp: below 20% fuel starts reducing speed
  var ratio = res.fuel / res.maxFuel;
  if (ratio > 0.2) return 1.0;
  // lerp from LOW_FUEL_SPEED_MULT to 1.0 over 0-20% range
  var t = ratio / 0.2;
  return LOW_FUEL_SPEED_MULT + (1.0 - LOW_FUEL_SPEED_MULT) * t;
}

// --- try to spend ammo; returns true if ammo available ---
export function spendAmmo(res) {
  if (res.ammo <= 0) return false;
  res.ammo--;
  return true;
}

// --- add resource from pickup ---
export function addAmmo(res, amount) {
  res.ammo = Math.min(res.maxAmmo, res.ammo + amount);
}

export function addFuel(res, amount) {
  res.fuel = Math.min(res.maxFuel, res.fuel + amount);
}

export function addParts(res, amount) {
  res.parts += amount;
}

// --- wave management ---
// waveEnemiesRemaining tracks enemies yet to spawn; activeEnemyCount = living enemies on field
export function updateWave(res, activeEnemyCount, playerHp, playerMaxHp, dt) {
  if (res.waveActive) {
    // wave complete when all enemies spawned AND all on-field enemies dead
    if (res.waveEnemiesRemaining <= 0 && activeEnemyCount === 0) {
      res.waveActive = false;
      res.wavePauseTimer = WAVE_PAUSE_DURATION;
      res.repairing = true;
    }
    return null;
  }

  // between waves — repair phase
  res.wavePauseTimer -= dt;
  if (res.repairing && res.parts > 0 && playerHp < playerMaxHp) {
    // auto-repair: consume parts at start of pause
    var repaired = doRepair(res, playerHp, playerMaxHp);
    if (repaired !== null) return repaired;
  }

  if (res.wavePauseTimer <= 0) {
    // start next wave
    res.wave++;
    res.waveEnemiesRemaining = WAVE_ENEMY_COUNT_BASE + WAVE_ENEMY_INCREMENT * (res.wave - 1);
    res.waveActive = true;
    res.repairing = false;
  }

  return null;
}

// --- consume parts for repair, return new HP or null ---
function doRepair(res, playerHp, playerMaxHp) {
  if (res.parts <= 0 || playerHp >= playerMaxHp) {
    res.repairing = false;
    return null;
  }
  // repair all at once at start of pause
  var hpNeeded = playerMaxHp - playerHp;
  var hpFromParts = res.parts * REPAIR_PER_PART;
  var hpRestored = Math.min(hpNeeded, hpFromParts);
  var partsUsed = Math.ceil(hpRestored / REPAIR_PER_PART);
  res.parts -= partsUsed;
  res.repairing = false;
  return playerHp + hpRestored;
}

