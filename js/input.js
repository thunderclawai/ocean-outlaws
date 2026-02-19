// input.js — keyboard input handler for ship controls

var keys = {
  forward: false,
  backward: false,
  left: false,
  right: false
};

function onKeyDown(e) {
  setKey(e.code, true);
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

export function initInput() {
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
}

export function getInput() {
  return keys;
}
