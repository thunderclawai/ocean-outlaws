// input.js — keyboard, mouse, and touch input handler

var keys = {
  forward: false,
  backward: false,
  left: false,
  right: false
};

var mouse = {
  x: 0,
  y: 0,
  firePressed: false,
  fireConsumed: false
};

var weaponSwitch = -1;  // -1 means no switch requested
var abilityPressed = false;

function onKeyDown(e) {
  setKey(e.code, true);
  // weapon switch: 1, 2, 3
  if (e.code === "Digit1") weaponSwitch = 0;
  if (e.code === "Digit2") weaponSwitch = 1;
  if (e.code === "Digit3") weaponSwitch = 2;
  // ability: Q
  if (e.code === "KeyQ") abilityPressed = true;
}

function onKeyUp(e) {
  setKey(e.code, false);
}

function setKey(code, down) {
  if (code === "KeyW" || code === "ArrowUp")    keys.forward  = down;
  if (code === "KeyS" || code === "ArrowDown")   keys.backward = down;
  if (code === "KeyA" || code === "ArrowLeft")   keys.left     = down;
  if (code === "KeyD" || code === "ArrowRight")  keys.right    = down;
}

function onMouseMove(e) {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
}

function onMouseDown(e) {
  if (e.button === 0) {
    mouse.firePressed = true;
    mouse.fireConsumed = false;
  }
}

function onTouchStart(e) {
  var touch = e.touches[0];
  mouse.x = touch.clientX;
  mouse.y = touch.clientY;
  mouse.firePressed = true;
  mouse.fireConsumed = false;
}

function onTouchMove(e) {
  var touch = e.touches[0];
  mouse.x = touch.clientX;
  mouse.y = touch.clientY;
}

export function initInput() {
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mousedown", onMouseDown);
  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: true });
}

export function getInput() {
  return keys;
}

export function getMouse() {
  return mouse;
}

export function consumeFire() {
  mouse.firePressed = false;
  mouse.fireConsumed = true;
}

export function consumeWeaponSwitch() {
  var val = weaponSwitch;
  weaponSwitch = -1;
  return val;
}

export function consumeAbility() {
  var val = abilityPressed;
  abilityPressed = false;
  return val;
}
