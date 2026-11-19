// police.js — the wanted level and the police who enforce it.
//
// Wanted stars rise when the player commits crimes and fall when the
// player stays hidden. Police cars spawn at the map edge and chase the
// player's car; foot police chase the player on foot; at 5 stars a
// helicopter joins the hunt from above.

import { WANTED, SPEEDS, HEALTH } from './config.js';
import { damagePlayer } from './player.js';
import { isOnRoad } from './world.js';

export function createWanted() {
  return {
    stars: 0,
    seenTimer: 0,
    hiddenTimer: 0,
    spawnTimer: 0,
    helicopter: null,
    chaseTimer: 0,
  };
}

export function createPolice() {
  return {
    cars: [],
    foot: [],
  };
}

export function addWanted(game, stars) {
  game.wanted.stars = Math.min(WANTED.maxStars, game.wanted.stars + stars);
  game.wanted.seenTimer = 0;
  game.wanted.hiddenTimer = 0;
}

export function clearWanted(game) {
  game.wanted.stars = 0;
  game.wanted.hiddenTimer = 0;
  game.police.cars = [];
  game.police.foot = [];
  game.wanted.helicopter = null;
}

export function updatePolice(game, dt) {
  const wanted = game.wanted;
  const police = game.police;
  const player = game.player;

  if (wanted.stars <= 0) {
    // No heat: slowly despawn any leftover police.
    if (police.cars.length > 0) {
      police.cars = police.cars.filter((car) => Math.hypot(car.x - player.x, car.y - player.y) < 1400);
    }
    game.police.cars = police.cars;
    return;
  }

  wanted.chaseTimer += dt;

  // Wanted decay: if no police can see the player for a while, one
  // star drops. Being seen resets the hidden timer.
  const seen = policeCanSee(game);
  if (seen) {
    wanted.seenTimer += dt;
    wanted.hiddenTimer = 0;
  } else {
    wanted.hiddenTimer += dt;
    if (wanted.hiddenTimer >= WANTED.decaySeconds) {
      wanted.stars = Math.max(0, wanted.stars - 1);
      wanted.hiddenTimer = 0;
      game.events.push({ type: 'starLost', x: player.x, y: player.y });
      if (wanted.stars === 0) {
        clearWanted(game);
        return;
      }
    }
  }

  // Spawn police cars up to the number the wanted level allows.
  const wantedCars = Math.min(WANTED.maxPoliceCars, 1 + wanted.stars);
  wanted.spawnTimer -= dt;
  if (police.cars.length < wantedCars && wanted.spawnTimer <= 0) {
    wanted.spawnTimer = WANTED.policeSpawnDelay;
    police.cars.push(spawnPoliceCar(game));
  }

  // Foot police appear when the player is on foot and wanted.
  if (!player.inCar && police.foot.length < wanted.stars && wanted.spawnTimer <= 0) {
    police.foot.push(spawnFootPolice(game));
  }

  updatePoliceCars(game, dt);
  updateFootPolice(game, dt);
  updateHelicopter(game, dt);
}

function policeCanSee(game) {
  // Any police unit within 420 units and with a rough line of sight
  // counts as seeing the player. Buildings block sight at short range
  // only in the sense that distance is the main factor here.
  const player = game.player;
  for (const car of game.police.cars) {
    if (Math.hypot(car.x - player.x, car.y - player.y) < 420) {
      return true;
    }
  }
  for (const officer of game.police.foot) {
    if (Math.hypot(officer.x - player.x, officer.y - player.y) < 260) {
      return true;
    }
  }
  if (game.wanted.helicopter) {
    return true;
  }
  return false;
}

function spawnPoliceCar(game) {
  const player = game.player;
  const rng = game.rng;
  // Spawn on a road near the player, but off-screen if possible.
  const angle = rng.float() * Math.PI * 2;
  const distance = 700 + rng.float() * 300;
  let x = player.x + Math.cos(angle) * distance;
  let y = player.y + Math.sin(angle) * distance;
  x = Math.max(60, Math.min(game.world.width - 60, x));
  y = Math.max(60, Math.min(game.world.height - 60, y));
  // Nudge onto the nearest road so the car does not spawn in a building.
  const center = nearestRoadPoint(game.world, x, y);
  return {
    x: center.x,
    y: center.y,
    angle: Math.atan2(player.y - center.y, player.x - center.x),
    speed: 0,
    color: '#1a2a6a',
    model: 'police',
    owned: false,
    drivenByPlayer: false,
    length: 42,
    width: 20,
    ramCooldown: 0,
    sirenPhase: rng.float() * Math.PI * 2,
  };
}

function nearestRoadPoint(world, x, y) {
  let best = { x, y };
  let bestDistance = Infinity;
  for (const road of world.roads) {
    const cx = Math.max(road.x, Math.min(road.x + road.w, x));
    const cy = Math.max(road.y, Math.min(road.y + road.h, y));
    const distance = Math.hypot(cx - x, cy - y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { x: cx, y: cy };
    }
  }
  return best;
}

function spawnFootPolice(game) {
  const player = game.player;
  const angle = game.rng.float() * Math.PI * 2;
  return {
    x: player.x + Math.cos(angle) * 320,
    y: player.y + Math.sin(angle) * 320,
    angle,
    speed: SPEEDS.policeFoot,
    health: 40,
    punchCooldown: 0,
  };
}

function updatePoliceCars(game, dt) {
  const player = game.player;
  const wanted = game.wanted;
  for (const car of game.police.cars) {
    if (car.ramCooldown > 0) {
      car.ramCooldown -= dt;
    }
    // Steer toward the player, with a little wobble so the chase
    // does not look like a perfect homing missile.
    const targetAngle = Math.atan2(player.y - car.y, player.x - car.x);
    let difference = targetAngle - car.angle;
    while (difference > Math.PI) {
      difference -= Math.PI * 2;
    }
    while (difference < -Math.PI) {
      difference += Math.PI * 2;
    }
    const turnRate = 2.2 + wanted.stars * 0.15;
    car.angle += Math.max(-turnRate * dt, Math.min(turnRate * dt, difference));
    const targetSpeed = Math.min(SPEEDS.policeCarMax, 380 + wanted.stars * 36);
    car.speed += (targetSpeed - car.speed) * dt * 0.9;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.sirenPhase += dt * 6;

    // Ramming the player's car damages the player.
    const distance = Math.hypot(car.x - player.x, car.y - player.y);
    if (distance < 40 && car.ramCooldown <= 0) {
      car.ramCooldown = 1.2;
      game.events.push({ type: 'crash', x: car.x, y: car.y, hard: false });
      if (player.inCar && player.car) {
        player.car.speed *= 0.55;
      }
      damagePlayer(game, HEALTH.policeRamDamage);
      game.audio.crash();
    }
  }
}

function updateFootPolice(game, dt) {
  const player = game.player;
  for (const officer of game.police.foot) {
    const distance = Math.hypot(officer.x - player.x, officer.y - player.y);
    const angle = Math.atan2(player.y - officer.y, player.x - officer.x);
    officer.angle = angle;
    if (distance > 24) {
      officer.x += Math.cos(angle) * officer.speed * dt;
      officer.y += Math.sin(angle) * officer.speed * dt;
    }
    // A foot officer who catches the player punches them.
    if (officer.punchCooldown > 0) {
      officer.punchCooldown -= dt;
    }
    if (distance < 30 && officer.punchCooldown <= 0) {
      officer.punchCooldown = 1.0;
      damagePlayer(game, HEALTH.policePunchDamage);
      game.events.push({ type: 'hurt', x: player.x, y: player.y });
    }
  }
  // Officers who fell too far behind despawn.
  game.police.foot = game.police.foot.filter((officer) => {
    return Math.hypot(officer.x - player.x, officer.y - player.y) < 1600;
  });
}

function updateHelicopter(game, dt) {
  const wanted = game.wanted;
  const player = game.player;
  if (wanted.stars >= WANTED.helicopterAtStars) {
    if (!wanted.helicopter) {
      wanted.helicopter = {
        x: player.x - 300,
        y: player.y - 300,
        angle: 0,
        rotor: 0,
      };
      game.events.push({ type: 'heli', x: player.x, y: player.y });
    }
    const heli = wanted.helicopter;
    heli.rotor += dt * 30;
    const targetAngle = Math.atan2(player.y - heli.y, player.x - heli.x);
    heli.angle = targetAngle;
    const distance = Math.hypot(player.x - heli.x, player.y - heli.y);
    const speed = Math.min(SPEEDS.helicopter, distance * 0.8);
    heli.x += Math.cos(targetAngle) * speed * dt;
    heli.y += Math.sin(targetAngle) * speed * dt;
  } else if (wanted.helicopter) {
    wanted.helicopter = null;
  }
}

// Pay the Fixer to clear the wanted level. Returns true on success.
export function payBribe(game) {
  const player = game.player;
  const fixer = game.world.places.fixer;
  const distance = Math.hypot(player.x - fixer.x, player.y - fixer.y);
  if (distance > 90) {
    return false;
  }
  if (player.cash < WANTED.bribeCost) {
    return false;
  }
  player.cash -= WANTED.bribeCost;
  clearWanted(game);
  game.events.push({ type: 'bribe', x: fixer.x, y: fixer.y });
  return true;
}
