// upgradeScreen.js — between-wave upgrade UI overlay with ship diagram
import { getUpgradeTree, canAfford, buyUpgrade, getNextCost, getMultipliers } from "./upgrade.js";

var root = null;
var salvageLabel = null;
var categoryEls = {};
var onCloseCallback = null;
var currentState = null;
var continueBtn = null;

// --- create the upgrade screen DOM (called once) ---
export function createUpgradeScreen() {
  root = document.createElement("div");
  root.id = "upgrade-screen";
  root.style.cssText = [
    "position: fixed",
    "top: 0", "left: 0",
    "width: 100%", "height: 100%",
    "display: none",
    "flex-direction: column",
    "align-items: center",
    "justify-content: center",
    "background: rgba(5, 5, 15, 0.92)",
    "z-index: 90",
    "font-family: monospace",
    "user-select: none",
    "overflow-y: auto"
  ].join(";");

  // title
  var title = document.createElement("div");
  title.textContent = "UPGRADES";
  title.style.cssText = [
    "font-size: 36px",
    "font-weight: bold",
    "color: #ffcc44",
    "margin-bottom: 8px",
    "margin-top: 20px",
    "text-shadow: 0 0 15px rgba(255,200,60,0.4)"
  ].join(";");
  root.appendChild(title);

  // salvage display
  salvageLabel = document.createElement("div");
  salvageLabel.style.cssText = [
    "font-size: 18px",
    "color: #ffcc44",
    "margin-bottom: 20px"
  ].join(";");
  root.appendChild(salvageLabel);

  // ship diagram + categories container
  var body = document.createElement("div");
  body.style.cssText = [
    "display: flex",
    "flex-wrap: wrap",
    "justify-content: center",
    "align-items: flex-start",
    "gap: 16px",
    "max-width: 900px",
    "width: 90%"
  ].join(";");
  root.appendChild(body);

  // ship diagram (center)
  var diagram = buildShipDiagram();
  body.appendChild(diagram);

  // category panels
  var tree = getUpgradeTree();
  var cats = Object.keys(tree);
  for (var c = 0; c < cats.length; c++) {
    var catKey = cats[c];
    var cat = tree[catKey];
    var panel = buildCategoryPanel(catKey, cat);
    body.appendChild(panel);
  }

  // continue button
  continueBtn = document.createElement("button");
  continueBtn.textContent = "CONTINUE";
  continueBtn.style.cssText = [
    "font-family: monospace",
    "font-size: 20px",
    "padding: 14px 48px",
    "margin-top: 20px",
    "margin-bottom: 20px",
    "background: rgba(40, 80, 60, 0.8)",
    "color: #44dd66",
    "border: 1px solid rgba(60, 140, 90, 0.6)",
    "border-radius: 6px",
    "cursor: pointer",
    "pointer-events: auto",
    "text-shadow: 0 0 10px rgba(60,200,90,0.3)"
  ].join(";");
  continueBtn.addEventListener("click", function () {
    hideUpgradeScreen();
    if (onCloseCallback) onCloseCallback();
  });
  root.appendChild(continueBtn);

  document.body.appendChild(root);
}

// --- build ship diagram (SVG top-down view) ---
function buildShipDiagram() {
  var wrap = document.createElement("div");
  wrap.style.cssText = [
    "width: 160px",
    "min-height: 300px",
    "display: flex",
    "flex-direction: column",
    "align-items: center",
    "justify-content: center"
  ].join(";");

  var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "120");
  svg.setAttribute("height", "260");
  svg.setAttribute("viewBox", "0 0 120 260");

  // hull outline
  var hull = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  hull.setAttribute("points", "60,10 85,60 90,130 85,200 75,240 45,240 35,200 30,130 35,60");
  hull.setAttribute("fill", "rgba(50,65,80,0.6)");
  hull.setAttribute("stroke", "#556677");
  hull.setAttribute("stroke-width", "2");
  svg.appendChild(hull);

  // system markers with labels
  var markers = [
    { cx: 60, cy: 70,  color: "#ffaa22", label: "W" },  // weapons (bow turret)
    { cx: 60, cy: 180, color: "#22aaff", label: "P" },  // propulsion (stern)
    { cx: 60, cy: 130, color: "#44dd66", label: "D" },  // defense (mid)
    { cx: 60, cy: 50,  color: "#cc66ff", label: "R" }   // radar (top)
  ];

  for (var i = 0; i < markers.length; i++) {
    var m = markers[i];
    var circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", String(m.cx));
    circle.setAttribute("cy", String(m.cy));
    circle.setAttribute("r", "12");
    circle.setAttribute("fill", m.color);
    circle.setAttribute("opacity", "0.7");
    svg.appendChild(circle);

    var text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", String(m.cx));
    text.setAttribute("y", String(m.cy + 4));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("font-size", "12");
    text.setAttribute("font-family", "monospace");
    text.setAttribute("font-weight", "bold");
    text.setAttribute("fill", "#000");
    text.textContent = m.label;
    svg.appendChild(text);
  }

  wrap.appendChild(svg);

  // legend
  var legend = document.createElement("div");
  legend.style.cssText = "font-size:10px;color:#667788;margin-top:8px;text-align:center;line-height:1.6";
  legend.innerHTML = '<span style="color:#ffaa22">W</span>=Weapons ' +
    '<span style="color:#22aaff">P</span>=Propulsion<br>' +
    '<span style="color:#44dd66">D</span>=Defense ' +
    '<span style="color:#cc66ff">R</span>=Radar';
  wrap.appendChild(legend);

  return wrap;
}

// --- build a category panel ---
function buildCategoryPanel(catKey, cat) {
  var panel = document.createElement("div");
  panel.style.cssText = [
    "background: rgba(15, 20, 35, 0.8)",
    "border: 1px solid " + cat.color + "33",
    "border-radius: 8px",
    "padding: 12px",
    "width: 180px"
  ].join(";");

  var heading = document.createElement("div");
  heading.textContent = cat.label;
  heading.style.cssText = [
    "font-size: 15px",
    "font-weight: bold",
    "color: " + cat.color,
    "margin-bottom: 10px",
    "text-align: center"
  ].join(";");
  panel.appendChild(heading);

  var upgradeEls = [];
  for (var u = 0; u < cat.upgrades.length; u++) {
    var up = cat.upgrades[u];
    // skip placeholder upgrades with 0 cost at tier 0
    var row = buildUpgradeRow(up, cat.color);
    panel.appendChild(row.el);
    upgradeEls.push(row);
  }

  categoryEls[catKey] = upgradeEls;
  return panel;
}

// --- build a single upgrade row ---
function buildUpgradeRow(up, color) {
  var el = document.createElement("div");
  el.style.cssText = [
    "margin-bottom: 8px",
    "padding: 6px",
    "border-radius: 4px",
    "background: rgba(20, 25, 40, 0.6)"
  ].join(";");

  // label
  var label = document.createElement("div");
  label.textContent = up.label;
  label.style.cssText = "font-size:12px;color:#8899aa;margin-bottom:4px";
  el.appendChild(label);

  // tier pips
  var pips = document.createElement("div");
  pips.style.cssText = "display:flex;gap:3px;margin-bottom:4px";
  var pipEls = [];
  for (var t = 0; t < 3; t++) {
    var pip = document.createElement("div");
    pip.style.cssText = [
      "width: 14px",
      "height: 6px",
      "border-radius: 2px",
      "background: rgba(40, 50, 70, 0.8)",
      "border: 1px solid rgba(80, 100, 130, 0.3)"
    ].join(";");
    pips.appendChild(pip);
    pipEls.push(pip);
  }
  el.appendChild(pips);

  // cost + buy button
  var costRow = document.createElement("div");
  costRow.style.cssText = "display:flex;justify-content:space-between;align-items:center";

  var costLabel = document.createElement("span");
  costLabel.style.cssText = "font-size:11px;color:#667788";
  costRow.appendChild(costLabel);

  var btn = document.createElement("button");
  btn.textContent = "BUY";
  btn.style.cssText = [
    "font-family: monospace",
    "font-size: 11px",
    "padding: 2px 10px",
    "background: rgba(40, 60, 90, 0.6)",
    "color: #8899aa",
    "border: 1px solid rgba(80, 100, 130, 0.4)",
    "border-radius: 3px",
    "cursor: pointer",
    "pointer-events: auto"
  ].join(";");

  btn.addEventListener("click", function () {
    if (!currentState) return;
    if (buyUpgrade(currentState, up.key)) {
      refreshUI();
    }
  });

  costRow.appendChild(btn);
  el.appendChild(costRow);

  return {
    el: el,
    key: up.key,
    pipEls: pipEls,
    costLabel: costLabel,
    btn: btn,
    color: color
  };
}

// --- refresh all UI elements ---
function refreshUI() {
  if (!currentState || !root) return;

  salvageLabel.textContent = "Salvage: " + currentState.salvage;

  var tree = getUpgradeTree();
  var cats = Object.keys(tree);

  for (var c = 0; c < cats.length; c++) {
    var catKey = cats[c];
    var rows = categoryEls[catKey];
    if (!rows) continue;

    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      var level = currentState.levels[row.key] || 0;
      var cost = getNextCost(currentState, row.key);
      var affordable = canAfford(currentState, row.key);

      // update pips
      for (var t = 0; t < 3; t++) {
        if (t < level) {
          row.pipEls[t].style.background = row.color;
          row.pipEls[t].style.borderColor = row.color;
        } else {
          row.pipEls[t].style.background = "rgba(40, 50, 70, 0.8)";
          row.pipEls[t].style.borderColor = "rgba(80, 100, 130, 0.3)";
        }
      }

      // update cost and button
      if (level >= 3) {
        row.costLabel.textContent = "MAX";
        row.costLabel.style.color = row.color;
        row.btn.style.display = "none";
      } else if (cost <= 0) {
        row.costLabel.textContent = "N/A";
        row.costLabel.style.color = "#445566";
        row.btn.style.display = "none";
      } else {
        row.costLabel.textContent = cost + " salvage";
        row.costLabel.style.color = affordable ? "#aabbcc" : "#556677";
        row.btn.style.display = "inline-block";
        row.btn.disabled = !affordable;
        row.btn.style.opacity = affordable ? "1" : "0.4";
        row.btn.style.cursor = affordable ? "pointer" : "default";
      }
    }
  }
}

// --- show upgrade screen ---
export function showUpgradeScreen(upgradeState, closeCb) {
  if (!root) return;
  currentState = upgradeState;
  onCloseCallback = closeCb;
  refreshUI();
  root.style.display = "flex";
}

// --- hide upgrade screen ---
export function hideUpgradeScreen() {
  if (!root) return;
  root.style.display = "none";
  currentState = null;
}

// --- is upgrade screen visible? ---
export function isUpgradeScreenVisible() {
  return root && root.style.display !== "none";
}
