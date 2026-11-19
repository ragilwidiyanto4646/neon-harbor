// render.js — canvas rendering for Neon Harbor.
//
// Draws the city (water, beach, roads, buildings, trees, docks),
// every car, pedestrian and police unit, the helicopter, the HUD
// (stars, health, cash, district, speed, objective), the minimap,
// and the screens (title, pause, busted, wasted, mission passed,
// victory). Night mode darkens the world and lights the windows.

import { COLORS, DISTRICTS } from './config.js';
import { districtAt } from './world.js';
import { currentJob, objectiveText, ACT_NAMES } from './missions.js';

export function createRenderer(canvas) {
  return {
    canvas,
    ctx: canvas.getContext('2d'),
    width: canvas.width,
    height: canvas.height,
  };
}

// The main draw entry point. The camera is centered on the player.
export function drawGame(renderer, game) {
  const ctx = renderer.ctx;
  const camera = game.camera;
  const night = game.night;

  ctx.save();
  ctx.clearRect(0, 0, renderer.width, renderer.height);

  // Sky/ground base color.
  ctx.fillStyle = night ? '#0d1a12' : COLORS.grass;
  ctx.fillRect(0, 0, renderer.width, renderer.height);

  ctx.translate(-camera.x + renderer.width / 2, -camera.y + renderer.height / 2);

  drawWater(renderer, game);
  drawBeach(renderer, game);
  drawDocks(renderer, game);
  drawRoads(renderer, game);
  drawBuildings(renderer, game);
  drawTrees(renderer, game);
  drawParkedCars(renderer, game);
  drawTraffic(renderer, game);
  drawMissionMarkers(renderer, game);
  drawPolice(renderer, game);
  drawPlayer(renderer, game);
  drawHelicopter(renderer, game);

  ctx.restore();

  if (night) {
    drawNightOverlay(renderer, game);
  }

  drawHUD(renderer, game);
  drawMinimap(renderer, game);
  drawBanners(renderer, game);
  drawScreen(renderer, game);
}

function drawWater(renderer, game) {
  const ctx = renderer.ctx;
  const time = game.time;
  const water = game.world.water;
  // Animated waves: a few lighter stripes that drift with time.
  ctx.fillStyle = COLORS.water;
  ctx.fillRect(water.south.x, water.south.y, water.south.w, water.south.h);
  ctx.fillRect(water.east.x, water.east.y, water.east.w, water.east.h);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  for (let i = 0; i < 10; i += 1) {
    const offset = ((time * 24 + i * 90) % 3200);
    ctx.fillRect(offset - 100, water.south.y + 18 + (i % 4) * 22, 70, 3);
  }
  for (let i = 0; i < 8; i += 1) {
    const offset = ((time * 20 + i * 110) % 2400);
    ctx.fillRect(water.east.x + 18 + (i % 4) * 22, offset - 100, 3, 70);
  }
}

function drawBeach(renderer, game) {
  const ctx = renderer.ctx;
  const beach = game.world.beach;
  ctx.fillStyle = COLORS.sand;
  ctx.fillRect(beach.south.x, beach.south.y, beach.south.w, beach.south.h);
  ctx.fillRect(beach.east.x, beach.east.y, beach.east.w, beach.east.h);
  // A darker wet-sand line where the sand meets the water.
  ctx.fillStyle = '#b89a55';
  ctx.fillRect(beach.south.x, beach.south.y + beach.south.h - 26, beach.south.w, 12);
  ctx.fillRect(beach.east.x + beach.east.w - 26, beach.east.y, 12, beach.east.h);
}

function drawDocks(renderer, game) {
  const ctx = renderer.ctx;
  for (const dock of game.world.docks) {
    ctx.fillStyle = COLORS.dockWood;
    ctx.fillRect(dock.x, dock.y, dock.w, dock.h);
    ctx.fillStyle = '#6a4e2e';
    for (let i = 0; i < dock.planks; i += 1) {
      const y = dock.y + (i * dock.h) / dock.planks;
      ctx.fillRect(dock.x, y, dock.w, 2);
    }
    ctx.fillStyle = '#a8824a';
    ctx.fillRect(dock.x - 3, dock.y, 3, dock.h);
    ctx.fillRect(dock.x + dock.w, dock.y, 3, dock.h);
  }
}

function drawRoads(renderer, game) {
  const ctx = renderer.ctx;
  for (const road of game.world.roads) {
    ctx.fillStyle = COLORS.road;
    ctx.fillRect(road.x, road.y, road.w, road.h);
    // Sidewalk edges.
    ctx.fillStyle = COLORS.sidewalk;
    if (road.vertical) {
      ctx.fillRect(road.x - 10, road.y, 10, road.h);
      ctx.fillRect(road.x + road.w, road.y, 10, road.h);
    } else {
      ctx.fillRect(road.x, road.y - 10, road.w, 10);
      ctx.fillRect(road.x, road.y + road.h, road.w, 10);
    }
    // Dashed center line.
    ctx.fillStyle = COLORS.lane;
    if (road.vertical) {
      const cx = road.x + road.w / 2;
      for (let y = road.y; y < road.y + road.h; y += 44) {
        ctx.fillRect(cx - 2, y, 4, 24);
      }
    } else {
      const cy = road.y + road.h / 2;
      for (let x = road.x; x < road.x + road.w; x += 44) {
        ctx.fillRect(x, cy - 2, 24, 4);
      }
    }
  }
}

function drawBuildings(renderer, game) {
  const ctx = renderer.ctx;
  const night = game.night;
  for (const building of game.world.buildings) {
    // Drop shadow so buildings read as solid volumes.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(building.x + 5, building.y + 6, building.w, building.h);
    ctx.fillStyle = building.color;
    ctx.fillRect(building.x, building.y, building.w, building.h);
    // A lighter roof edge.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.fillRect(building.x, building.y, building.w, 6);
    ctx.fillRect(building.x, building.y, 6, building.h);
    // Tall downtown buildings get a rooftop box.
    if (building.tall) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(building.x + building.w / 2 - 12, building.y + building.h / 2 - 12, 24, 24);
    }
    // Windows: lit at night, dark by day.
    for (const window of building.windows) {
      const lit = night ? window.lit : false;
      ctx.fillStyle = lit ? COLORS.windowLit : COLORS.windowDark;
      ctx.fillRect(building.x + window.x, building.y + window.y, 12, 12);
    }
  }
}

function drawTrees(renderer, game) {
  const ctx = renderer.ctx;
  const time = game.time;
  for (const tree of game.world.trees) {
    const sway = Math.sin(time + tree.sway) * 1.5;
    ctx.fillStyle = COLORS.treeTrunk;
    ctx.fillRect(tree.x - 2, tree.y - 2, 4, 8);
    ctx.fillStyle = COLORS.tree;
    ctx.beginPath();
    ctx.arc(tree.x + sway, tree.y - 4, tree.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.arc(tree.x + sway - 3, tree.y - 8, tree.r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParkedCars(renderer, game) {
  const ctx = renderer.ctx;
  for (const car of game.world.parkedCars) {
    drawCarShape(ctx, car.x, car.y, car.angle, car.color, car.model, false);
  }
}

function drawTraffic(renderer, game) {
  const ctx = renderer.ctx;
  for (const car of game.traffic.cars) {
    drawCarShape(ctx, car.x, car.y, car.angle, car.color, car.model, car.drivenByPlayer);
  }
  for (const ped of game.traffic.peds) {
    if (!ped.alive) {
      continue;
    }
    drawPerson(ctx, ped.x, ped.y, ped.angle, ped.color, 7);
  }
}

// A top-down car: body, windshield, roof, headlights, and (for the
// player's car) a white outline so it stands out in traffic.
export function drawCarShape(ctx, x, y, angle, color, model, isPlayer) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const length = model === 'truck' ? 52 : 40;
  const width = model === 'truck' ? 22 : 20;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(-length / 2 + 3, -width / 2 + 3, length, width);
  ctx.fillStyle = color;
  roundRect(ctx, -length / 2, -width / 2, length, width, 6);
  ctx.fill();
  // Windshield and rear window.
  ctx.fillStyle = '#1a2530';
  ctx.fillRect(length / 2 - 12, -width / 2 + 3, 7, width - 6);
  ctx.fillRect(-length / 2 + 4, -width / 2 + 3, 6, width - 6);
  // Roof.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.fillRect(-4, -width / 2 + 4, 12, width - 8);
  // Headlights.
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(length / 2 - 2, -width / 2 + 2, 2, 4);
  ctx.fillRect(length / 2 - 2, width / 2 - 6, 2, 4);
  if (model === 'taxi') {
    ctx.fillStyle = '#111111';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
  }
  if (isPlayer) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    roundRect(ctx, -length / 2 - 2, -width / 2 - 2, length + 4, width + 4, 8);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, color, radius) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.arc(2, 2, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  // Head.
  ctx.fillStyle = '#e8c39a';
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMissionMarkers(renderer, game) {
  const ctx = renderer.ctx;
  const time = game.time;
  const pulse = 1 + Math.sin(time * 5) * 0.12;
  // The current job target.
  const job = currentJob(game.mission);
  if (job) {
    const target = missionTarget(game);
    if (target) {
      drawMarker(ctx, target.x, target.y, COLORS.missionMarker, 16 * pulse, job.title);
    }
  }
  // Race checkpoints.
  const checkpoints = activeCheckpoints(game);
  checkpoints.forEach((checkpoint, index) => {
    const color = index === 0 ? '#ffd700' : '#ff8c00';
    drawMarker(ctx, checkpoint.x, checkpoint.y, color, 12, String(index + 1));
  });
  // Taxi passenger.
  if (game.sideTaxi && game.sideTaxi.active && !game.sideTaxi.pickedUp) {
    drawMarker(ctx, game.sideTaxi.x, game.sideTaxi.y, '#3ad8ff', 12, 'TAXI');
  }
  if (game.mission.taxi && !game.mission.taxi.pickedUp) {
    drawMarker(ctx, game.mission.taxi.x, game.mission.taxi.y, '#3ad8ff', 12, 'TAXI');
  }
}

function missionTarget(game) {
  const job = currentJob(game.mission);
  if (!job) {
    return null;
  }
  if (job.type === 'taxi' && game.mission.taxi && game.mission.taxi.pickedUp) {
    return game.mission.taxi.destination;
  }
  if (job.type === 'pickup' && game.mission.hasPackage) {
    return game.world.places.garage;
  }
  if (job.type === 'race' && game.mission.checkpoints.length > 0) {
    return game.mission.checkpoints[game.mission.checkpointIndex];
  }
  return game.world.places[job.target];
}

function activeCheckpoints(game) {
  if (game.mission.race && game.mission.checkpoints.length > 0) {
    return game.mission.checkpoints.slice(game.mission.checkpointIndex);
  }
  if (game.sideRace && game.sideRace.active) {
    return game.sideRace.checkpoints.slice(game.sideRace.index);
  }
  return [];
}

function drawMarker(ctx, x, y, color, radius, label) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#111111';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, -radius - 12);
  ctx.restore();
}

function drawPolice(renderer, game) {
  const ctx = renderer.ctx;
  const time = game.time;
  for (const car of game.police.cars) {
    drawCarShape(ctx, car.x, car.y, car.angle, car.color, 'police', false);
    // Flashing light bar.
    const flashing = Math.sin(time * 12 + car.sirenPhase) > 0;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = flashing ? '#ff2a2a' : '#2a6aff';
    ctx.fillRect(-6, -9, 10, 5);
    ctx.fillStyle = flashing ? '#2a6aff' : '#ff2a2a';
    ctx.fillRect(-6, 4, 10, 5);
    ctx.restore();
  }
  for (const officer of game.police.foot) {
    drawPerson(ctx, officer.x, officer.y, officer.angle, '#1a2a6a', 8);
  }
  for (const rival of game.mission.rivals) {
    if (rival.alive) {
      drawPerson(ctx, rival.x, rival.y, rival.angle, '#7a1a1a', 8);
    }
  }
}

function drawPlayer(renderer, game) {
  const ctx = renderer.ctx;
  const player = game.player;
  if (player.inCar && player.car) {
    drawCarShape(ctx, player.car.x, player.car.y, player.car.angle, player.car.color, player.car.model, true);
    return;
  }
  // On foot: a circle body, a direction nose, and a punch arc.
  drawPerson(ctx, player.x, player.y, player.angle, COLORS.playerShirt, 9);
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);
  ctx.fillStyle = '#111111';
  ctx.fillRect(6, -2, 8, 4);
  if (player.punchAnim > 0) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(18, 0, 10, -0.9, 0.9);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHelicopter(renderer, game) {
  const ctx = renderer.ctx;
  const heli = game.wanted.helicopter;
  if (!heli) {
    return;
  }
  ctx.save();
  ctx.translate(heli.x, heli.y);
  ctx.rotate(heli.angle);
  // Searchlight cone on the ground.
  ctx.fillStyle = 'rgba(255, 240, 160, 0.18)';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(180, -70);
  ctx.lineTo(180, 70);
  ctx.closePath();
  ctx.fill();
  // Body and rotor.
  ctx.fillStyle = '#222831';
  ctx.beginPath();
  ctx.ellipse(0, 0, 26, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 3;
  const rotor = Math.sin(heli.rotor) * 30;
  ctx.beginPath();
  ctx.moveTo(-rotor, 0);
  ctx.lineTo(rotor, 0);
  ctx.stroke();
  ctx.restore();
}

function drawNightOverlay(renderer, game) {
  const ctx = renderer.ctx;
  // A dark blue wash over everything, then lamp glows cut through.
  ctx.fillStyle = 'rgba(8, 12, 40, 0.42)';
  ctx.fillRect(0, 0, renderer.width, renderer.height);
  const camera = game.camera;
  for (const lamp of game.world.lamps) {
    const screenX = lamp.x - camera.x + renderer.width / 2;
    const screenY = lamp.y - camera.y + renderer.height / 2;
    if (screenX < -80 || screenX > renderer.width + 80 || screenY < -80 || screenY > renderer.height + 80) {
      continue;
    }
    const glow = ctx.createRadialGradient(screenX, screenY, 4, screenX, screenY, 70);
    glow.addColorStop(0, 'rgba(255, 214, 106, 0.5)');
    glow.addColorStop(1, 'rgba(255, 214, 106, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(screenX, screenY, 70, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHUD(renderer, game) {
  const ctx = renderer.ctx;
  const player = game.player;
  const wanted = game.wanted;

  // Top-left panel: stars, health, cash.
  ctx.fillStyle = COLORS.hudBg;
  roundRect(ctx, 12, 12, 260, 92, 8);
  ctx.fill();
  ctx.fillStyle = COLORS.hudAccent;
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  let stars = '';
  for (let i = 0; i < 5; i += 1) {
    stars += i < wanted.stars ? '★' : '☆';
  }
  ctx.fillText(stars, 24, 42);
  // Health bar.
  ctx.fillStyle = '#333333';
  ctx.fillRect(24, 52, 200, 12);
  ctx.fillStyle = player.health > 40 ? '#3ad86a' : '#e33e3e';
  ctx.fillRect(24, 52, 200 * (player.health / 100), 12);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = '14px sans-serif';
  ctx.fillText('HP ' + Math.ceil(player.health), 24, 82);
  ctx.fillStyle = '#3ad86a';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('$' + player.cash, 130, 82);

  // Bottom-left: district and speed.
  ctx.fillStyle = COLORS.hudBg;
  roundRect(ctx, 12, renderer.height - 64, 300, 52, 8);
  ctx.fill();
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(districtAt(player.x, player.y), 24, renderer.height - 40);
  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#bbbbbb';
  const speedText = player.inCar ? Math.round(Math.abs(player.car ? player.car.speed : 0) * 0.18) + ' km/h' : 'On foot';
  ctx.fillText(speedText, 24, renderer.height - 20);

  // Bottom-center: current objective.
  const objective = objectiveText(game);
  ctx.font = 'bold 15px sans-serif';
  const objectiveWidth = ctx.measureText(objective).width;
  ctx.fillStyle = COLORS.hudBg;
  roundRect(ctx, (renderer.width - objectiveWidth) / 2 - 14, renderer.height - 52, objectiveWidth + 28, 34, 8);
  ctx.fill();
  ctx.fillStyle = COLORS.hudAccent;
  ctx.textAlign = 'center';
  ctx.fillText(objective, renderer.width / 2, renderer.height - 29);
  ctx.textAlign = 'left';

  // Top-center: act and job name.
  const job = currentJob(game.mission);
  if (job) {
    ctx.fillStyle = 'rgba(8, 10, 16, 0.6)';
    const actLabel = ACT_NAMES[job.act] + '  ·  ' + job.title + '  (' + (game.mission.completed + 1) + '/15)';
    ctx.font = '13px sans-serif';
    const actWidth = ctx.measureText(actLabel).width;
    roundRect(ctx, (renderer.width - actWidth) / 2 - 10, 12, actWidth + 20, 26, 6);
    ctx.fill();
    ctx.fillStyle = '#dddddd';
    ctx.textAlign = 'center';
    ctx.fillText(actLabel, renderer.width / 2, 30);
    ctx.textAlign = 'left';
  }

  // Mute indicator.
  if (game.audio.muted) {
    ctx.fillStyle = '#ff5a5a';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('MUTED (M)', renderer.width - 120, renderer.height - 20);
  }
}

function drawMinimap(renderer, game) {
  const ctx = renderer.ctx;
  const mapWidth = 180;
  const mapHeight = 140;
  const mapX = renderer.width - mapWidth - 12;
  const mapY = 12;
  const scaleX = mapWidth / game.world.width;
  const scaleY = mapHeight / game.world.height;

  ctx.fillStyle = 'rgba(8, 10, 16, 0.78)';
  roundRect(ctx, mapX - 4, mapY - 4, mapWidth + 8, mapHeight + 8, 6);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(mapX, mapY, mapWidth, mapHeight);
  ctx.clip();

  // Water and beach.
  ctx.fillStyle = COLORS.minimapWater;
  ctx.fillRect(mapX + game.world.water.south.x * scaleX, mapY + game.world.water.south.y * scaleY,
    game.world.water.south.w * scaleX, game.world.water.south.h * scaleY);
  ctx.fillStyle = '#2e6b34';
  ctx.fillRect(mapX, mapY, mapWidth, mapHeight);
  ctx.fillStyle = COLORS.minimapWater;
  ctx.fillRect(mapX + game.world.water.east.x * scaleX, mapY + game.world.water.east.y * scaleY,
    game.world.water.east.w * scaleX, game.world.water.east.h * scaleY);

  // Roads.
  ctx.fillStyle = COLORS.minimapRoad;
  for (const road of game.world.roads) {
    ctx.fillRect(mapX + road.x * scaleX, mapY + road.y * scaleY, Math.max(2, road.w * scaleX), Math.max(2, road.h * scaleY));
  }

  // Districts grid labels are too small; the mission marker matters.
  const target = missionTarget(game);
  if (target) {
    ctx.fillStyle = COLORS.missionMarker;
    ctx.beginPath();
    ctx.arc(mapX + target.x * scaleX, mapY + target.y * scaleY, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Police dots.
  ctx.fillStyle = '#4a7aff';
  for (const car of game.police.cars) {
    ctx.beginPath();
    ctx.arc(mapX + car.x * scaleX, mapY + car.y * scaleY, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Player dot, with a white ring so it is easy to spot.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(mapX + game.player.x * scaleX, mapY + game.player.y * scaleY, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(mapX + game.player.x * scaleX, mapY + game.player.y * scaleY, 4, 0, Math.PI * 2);
  ctx.stroke();

  // Camera view rectangle.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 1;
  const viewX = mapX + (game.camera.x - renderer.width / 2) * scaleX;
  const viewY = mapY + (game.camera.y - renderer.height / 2) * scaleY;
  ctx.strokeRect(viewX, viewY, renderer.width * scaleX, renderer.height * scaleY);

  ctx.restore();
  ctx.fillStyle = '#bbbbbb';
  ctx.font = '11px sans-serif';
  ctx.fillText('NEON HARBOR', mapX, mapY + mapHeight + 14);
}

function drawBanners(renderer, game) {
  const ctx = renderer.ctx;
  if (game.mission.bannerTimer > 0 && game.mission.banner) {
    ctx.font = 'bold 22px sans-serif';
    const width = ctx.measureText(game.mission.banner).width;
    ctx.fillStyle = 'rgba(8, 10, 16, 0.8)';
    roundRect(ctx, (renderer.width - width) / 2 - 16, 110, width + 32, 44, 8);
    ctx.fill();
    ctx.fillStyle = COLORS.hudAccent;
    ctx.textAlign = 'center';
    ctx.fillText(game.mission.banner, renderer.width / 2, 140);
    ctx.textAlign = 'left';
  }
}

function drawScreen(renderer, game) {
  const screen = game.screen;
  if (screen === 'playing') {
    return;
  }
  if (screen === 'title') {
    drawTitleScreen(renderer, game);
  } else if (screen === 'paused') {
    drawCenterOverlay(renderer, 'PAUSED', 'Press P or Esc to resume.  M mute · S save.', '#f2f2f2');
  } else if (screen === 'busted') {
    drawCenterOverlay(renderer, 'BUSTED', 'The police caught you. Press Enter to restart from your last save.', '#ff5a5a');
  } else if (screen === 'wasted') {
    drawCenterOverlay(renderer, 'WASTED', 'You ran out of health. Press Enter to restart from your last save.', '#ff5a5a');
  } else if (screen === 'victory') {
    const seconds = Math.round(game.playSeconds || 0);
    drawCenterOverlay(renderer, 'VICTORY — HARBOR KING',
      'All 15 jobs complete. Total cash $' + game.player.cash + ' · Time ' + seconds + 's. Press Enter to keep playing.',
      '#ffd76a');
  }
}

function drawTitleScreen(renderer, game) {
  const ctx = renderer.ctx;
  ctx.fillStyle = 'rgba(6, 8, 18, 0.82)';
  ctx.fillRect(0, 0, renderer.width, renderer.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff2a6a';
  ctx.font = 'bold 72px sans-serif';
  ctx.fillText('NEON HARBOR', renderer.width / 2, 200);
  ctx.fillStyle = COLORS.hudAccent;
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('A top-down open-world coastal crime game', renderer.width / 2, 250);
  ctx.fillStyle = '#f2f2f2';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('Press Enter to start', renderer.width / 2, 330);
  if (game.saveData) {
    ctx.fillStyle = '#3ad86a';
    ctx.font = '16px sans-serif';
    ctx.fillText('Save found — press C to Continue', renderer.width / 2, 362);
  }
  ctx.fillStyle = '#cccccc';
  ctx.font = '16px sans-serif';
  const controls = [
    'WASD / Arrows — move / drive',
    'E — enter / exit / steal car      F — punch',
    'Shift — run      Space — handbrake',
    'S — save      M — mute      P / Esc — pause',
  ];
  controls.forEach((line, index) => {
    ctx.fillText(line, renderer.width / 2, 430 + index * 28);
  });
  ctx.fillStyle = '#888888';
  ctx.font = '14px sans-serif';
  ctx.fillText('15 jobs across 3 acts · steal cars · outrun the police · survive 5 stars', renderer.width / 2, 580);
  if (game.bestCash > 0) {
    ctx.fillStyle = '#ffd76a';
    ctx.fillText('Best cash: $' + game.bestCash, renderer.width / 2, 612);
  }
  ctx.textAlign = 'left';
}

function drawCenterOverlay(renderer, title, subtitle, color) {
  const ctx = renderer.ctx;
  ctx.fillStyle = 'rgba(6, 8, 18, 0.72)';
  ctx.fillRect(0, 0, renderer.width, renderer.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.font = 'bold 56px sans-serif';
  ctx.fillText(title, renderer.width / 2, renderer.height / 2 - 20);
  ctx.fillStyle = '#f2f2f2';
  ctx.font = '18px sans-serif';
  ctx.fillText(subtitle, renderer.width / 2, renderer.height / 2 + 30);
  ctx.textAlign = 'left';
}

// Rounded rectangle path helper (fills the current path).
export function roundRect(ctx, x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
