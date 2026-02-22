// minimap.js - radar-style minimap showing player, enemies, pickups, ports, and terrain markers

var minimapCanvas = null;
var minimapCtx = null;
var MINIMAP_SIZE = 140;
var MINIMAP_RANGE = 120;

export function createMinimap(parentEl) {
  minimapCanvas = document.createElement("canvas");
  minimapCanvas.width = MINIMAP_SIZE;
  minimapCanvas.height = MINIMAP_SIZE;
  minimapCanvas.style.cssText = [
    "width:" + MINIMAP_SIZE + "px", "height:" + MINIMAP_SIZE + "px",
    "border-radius:50%", "border:2px solid rgba(80,100,130,0.4)",
    "background:rgba(5,10,20,0.7)"
  ].join(";");
  minimapCtx = minimapCanvas.getContext("2d");
  parentEl.appendChild(minimapCanvas);
}

function drawMarker(ctx, x, y, type, sizePx) {
  var s = Math.max(1.4, Math.min(4.8, sizePx || 2.2));
  if (type === "port") {
    ctx.fillStyle = "#4aa3ff";
    ctx.fillRect(x - s, y - s, s * 2, s * 2);
    return;
  }
  if (type === "tree") {
    ctx.fillStyle = "#5ac878";
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.lineTo(x - s * 0.9, y + s * 0.9);
    ctx.lineTo(x + s * 0.9, y + s * 0.9);
    ctx.closePath();
    ctx.fill();
    return;
  }
  if (type === "island_big") ctx.fillStyle = "#d2c08f";
  else if (type === "island_mid") ctx.fillStyle = "#c8b27a";
  else ctx.fillStyle = "#b6a16a";
  ctx.beginPath();
  ctx.arc(x, y, s, 0, Math.PI * 2);
  ctx.fill();
}

export function updateMinimap(playerX, playerZ, playerHeading, enemies, pickups, ports, terrainMarkers, remotePlayers) {
  if (!minimapCtx) return;
  var ctx = minimapCtx;
  var cx = MINIMAP_SIZE / 2;
  var cy = MINIMAP_SIZE / 2;
  var radius = MINIMAP_SIZE / 2 - 4;

  ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(5,10,20,0.8)";
  ctx.fill();
  ctx.strokeStyle = "rgba(80,100,130,0.5)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.clip();

  ctx.strokeStyle = "rgba(80,100,130,0.2)";
  ctx.lineWidth = 0.5;
  for (var r = 1; r <= 3; r++) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius * r / 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(cx - 6, cy);
  ctx.lineTo(cx + 6, cy);
  ctx.moveTo(cx, cy - 6);
  ctx.lineTo(cx, cy + 6);
  ctx.strokeStyle = "rgba(80,100,130,0.4)";
  ctx.lineWidth = 1;
  ctx.stroke();

  var scale = radius / MINIMAP_RANGE;

  if (terrainMarkers) {
    for (var ti = 0; ti < terrainMarkers.length; ti++) {
      var tm = terrainMarkers[ti];
      var tdx = (tm.x - playerX) * scale;
      var tdz = (tm.z - playerZ) * scale;
      if (tdx * tdx + tdz * tdz >= radius * radius) continue;
      drawMarker(ctx, cx + tdx, cy + tdz, tm.type, (tm.size || 1) * 2.0);
    }
  }

  if (ports) {
    for (var pi = 0; pi < ports.length; pi++) {
      var p = ports[pi];
      var pdx = (p.x - playerX) * scale;
      var pdz = (p.z - playerZ) * scale;
      if (pdx * pdx + pdz * pdz < radius * radius) {
        drawMarker(ctx, cx + pdx, cy + pdz, "port", 2.2);
      }
    }
  }

  if (pickups) {
    ctx.fillStyle = "#44dd66";
    for (var ki = 0; ki < pickups.length; ki++) {
      var pk = pickups[ki];
      if (!pk.mesh) continue;
      var kdx = (pk.mesh.position.x - playerX) * scale;
      var kdz = (pk.mesh.position.z - playerZ) * scale;
      if (kdx * kdx + kdz * kdz < radius * radius) {
        ctx.beginPath();
        ctx.arc(cx + kdx, cy + kdz, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  if (enemies) {
    ctx.fillStyle = "#ff4444";
    for (var ei = 0; ei < enemies.length; ei++) {
      var e = enemies[ei];
      if (!e.alive) continue;
      var edx = (e.posX - playerX) * scale;
      var edz = (e.posZ - playerZ) * scale;
      if (edx * edx + edz * edz < radius * radius) {
        ctx.beginPath();
        ctx.arc(cx + edx, cy + edz, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  if (remotePlayers) {
    var mpColors = ["#44aaff", "#ff6644", "#44dd66", "#ffcc44"];
    for (var ri = 0; ri < remotePlayers.length; ri++) {
      var rp = remotePlayers[ri];
      var rdx = (rp.posX - playerX) * scale;
      var rdz = (rp.posZ - playerZ) * scale;
      if (rdx * rdx + rdz * rdz < radius * radius) {
        ctx.save();
        ctx.translate(cx + rdx, cy + rdz);
        ctx.rotate(-rp.heading);
        ctx.fillStyle = mpColors[ri % mpColors.length];
        ctx.beginPath();
        ctx.moveTo(0, -4);
        ctx.lineTo(-2.5, 3);
        ctx.lineTo(2.5, 3);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-playerHeading);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(0, -5);
  ctx.lineTo(-3, 4);
  ctx.lineTo(3, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "rgba(136,153,170,0.6)";
  ctx.font = "9px monospace";
  ctx.textAlign = "center";
  ctx.fillText("N", cx, 14);

  ctx.restore();
}
