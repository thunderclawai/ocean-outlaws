// hud.js — speed indicator, compass, and ammo counter overlay

var container = null;
var speedBar = null;
var speedLabel = null;
var compassLabel = null;
var ammoLabel = null;

export function createHUD() {
  container = document.createElement("div");
  container.style.cssText = [
    "position: fixed",
    "bottom: 20px",
    "left: 20px",
    "pointer-events: none",
    "font-family: monospace",
    "color: #8899aa",
    "font-size: 13px",
    "user-select: none",
    "z-index: 10"
  ].join(";");

  // speed bar background
  var barBg = document.createElement("div");
  barBg.style.cssText = [
    "width: 120px",
    "height: 8px",
    "background: rgba(20, 30, 50, 0.7)",
    "border: 1px solid rgba(80, 100, 130, 0.4)",
    "border-radius: 4px",
    "overflow: hidden",
    "margin-bottom: 6px"
  ].join(";");

  speedBar = document.createElement("div");
  speedBar.style.cssText = [
    "width: 0%",
    "height: 100%",
    "background: #4477aa",
    "border-radius: 3px",
    "transition: width 0.1s"
  ].join(";");
  barBg.appendChild(speedBar);
  container.appendChild(barBg);

  // speed text
  speedLabel = document.createElement("div");
  speedLabel.textContent = "0 kn";
  speedLabel.style.marginBottom = "4px";
  container.appendChild(speedLabel);

  // compass heading
  compassLabel = document.createElement("div");
  compassLabel.textContent = "N";
  compassLabel.style.fontSize = "12px";
  compassLabel.style.color = "#667788";
  container.appendChild(compassLabel);

  // ammo counter
  ammoLabel = document.createElement("div");
  ammoLabel.textContent = "AMMO: --";
  ammoLabel.style.marginTop = "8px";
  ammoLabel.style.fontSize = "13px";
  ammoLabel.style.color = "#8899aa";
  container.appendChild(ammoLabel);

  document.body.appendChild(container);
}

export function updateHUD(speedRatio, displaySpeed, heading, ammo, maxAmmo) {
  if (!container) return;

  var pct = Math.min(1, speedRatio) * 100;
  speedBar.style.width = pct + "%";
  speedLabel.textContent = displaySpeed.toFixed(1) + " kn";

  // heading to compass direction
  var deg = ((heading * 180 / Math.PI) % 360 + 360) % 360;
  var dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  var idx = Math.round(deg / 45) % 8;
  compassLabel.textContent = dirs[idx] + " " + Math.round(deg) + "\u00B0";

  // ammo counter
  if (ammo !== undefined) {
    ammoLabel.textContent = "AMMO: " + ammo + " / " + maxAmmo;
    ammoLabel.style.color = ammo <= 5 ? "#cc6644" : "#8899aa";
  }
}
