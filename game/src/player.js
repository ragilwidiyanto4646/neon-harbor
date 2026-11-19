// player.js — the player character, on foot and in a car.
//
// The player has a position, a facing angle, health, cash, and either
// walks around or drives the car they are currently inside. Entering
// a car that is not theirs is stealing: it raises the wanted level.

import { SPEEDS, HEALTH, WANTED } from './config.js';
import { clampToMap, insideBuilding, inWater } from './world.js';

export function createPlayer(spawn) {
  return {
    x: spawn.x,
    y: spawn.y,
    angle: -Math.PI / 2,
    speed: 0,
    health: HEALTH.max,
    cash: 100,
    inCar: false,
    car: null,
    running: false,
    moving: false,
    punchCooldown: 0,
    punchAnim: 0,
    lastSafeX: spawn.x,
    lastSafeY: spawn.y,
  };
}

// Read the movement keys and return a normalized direction vector.
function moveDirection(input) {
  let dx = 0;
  let dy = 0;
  if (input.isDown('w') || input.isDown('ArrowUp')) {
    dy -= 1;
  }
  if (input.isDown('s') || input.isDown('ArrowDown')) {
    dy += 1;
  }
  if (input.isDown('a') || input.isDown('ArrowLeft')) {
    dx -= 1;
  }
  if (input.isDown('d') || input.isDown('ArrowRight')) {
    dx += 1;
  }
  if (dx === 0 && dy === 0) {
    return { x: 0, y: 0 };
  }
  const length = Math.hypot(dx, dy);
  return { x: dx / length, y: dy / length };
}

export function updatePlayer(game, input, dt) {
  const player = game.player;
  const world = game.world;

  if (player.punchCooldown > 0) {
    player.punchCooldown -= dt;
  }
  if (player.punchAnim > 0) {
    player.punchAnim -= dt;
  }

  if (player.inCar && player.car) {
    updateDriving(game, input, dt);
  } else {
    updateWalking(game, input, dt);
  }

  // Remember the last position that was not inside a building or
  // water, so a busted/wasted respawn has somewhere safe to use.
  if (!insideBuilding(world, player.x, player.y) && !inWater(world, player.x, player.y)) {
    player.lastSafeX = player.x;
    player.lastSafeY = player.y;
  }

  // Slow health regeneration while the player is not being chased.
  if (game.wanted.stars === 0 && player.health > 0 && player.health < HEALTH.max) {
    player.health = Math.min(HEALTH.max, player.health + HEALTH.regenPerSecond * dt);
  }
}

function updateWalking(game, input, dt) {
  const player = game.player;
  const world = game.world;
  const direction = moveDirection(input);
  const running = input.isDown('Shift');
  const speed = running ? SPEEDS.run : SPEEDS.walk;
  player.running = running;
  player.moving = direction.x !== 0 || direction.y !== 0;

  if (player.moving) {
    const nextX = player.x + direction.x * speed * dt;
    const nextY = player.y + direction.y * speed * dt;
    // Buildings and water block walking; slide along them instead of
    // stopping dead by testing each axis separately.
    if (!insideBuilding(world, nextX, player.y) && !inWater(world, nextX, player.y)) {
      player.x = nextX;
    }
    if (!insideBuilding(world, player.x, nextY) && !inWater(world, player.x, nextY)) {
      player.y = nextY;
    }
    player.angle = Math.atan2(direction.y, direction.x);
    const clamped = clampToMap(world, player.x, player.y, 12);
    player.x = clamped.x;
    player.y = clamped.y;
  }
}

function updateDriving(game, input, dt) {
  const player = game.player;
  const car = player.car;
  const world = game.world;

  const forward = input.isDown('w') || input.isDown('ArrowUp');
  const backward = input.isDown('s') || input.isDown('ArrowDown');
  const left = input.isDown('a') || input.isDown('ArrowLeft');
  const right = input.isDown('d') || input.isDown('ArrowRight');
  const handbrake = input.isDown(' ');

  if (forward) {
    car.speed += SPEEDS.carAccel * dt;
  } else if (backward) {
    if (car.speed > 20) {
      car.speed -= SPEEDS.carBrake * dt;
    } else {
      car.speed -= SPEEDS.carAccel * 0.5 * dt;
    }
  } else {
    // Natural drag when neither pedal is pressed.
    car.speed -= car.speed * SPEEDS.carDrag * dt;
    if (Math.abs(car.speed) < 4) {
      car.speed = 0;
    }
  }

  if (handbrake) {
    car.speed -= car.speed * 4 * dt;
  }

  car.speed = Math.max(-SPEEDS.carReverseMax, Math.min(SPEEDS.carMax, car.speed));

  // Steering only works while the car is moving, and reverses when
  // the car is reversing, like a real car.
  const steerDirection = car.speed >= 0 ? 1 : -1;
  if (left) {
    car.angle -= SPEEDS.carTurn * steerDirection * dt * Math.min(1, Math.abs(car.speed) / 120 + 0.25);
  }
  if (right) {
    car.angle += SPEEDS.carTurn * steerDirection * dt * Math.min(1, Math.abs(car.speed) / 120 + 0.25);
  }

  const nextX = car.x + Math.cos(car.angle) * car.speed * dt;
  const nextY = car.y + Math.sin(car.angle) * car.speed * dt;

  // Buildings block cars. Water blocks cars too. Hitting a building
  // at speed is a crash: lose speed and take a little damage.
  if (!insideBuilding(world, nextX, nextY) && !inWater(world, nextX, nextY)) {
    car.x = nextX;
    car.y = nextY;
  } else if (Math.abs(car.speed) > 120) {
    game.events.push({ type: 'crash', x: car.x, y: car.y, hard: true });
    car.speed *= -0.25;
    damagePlayer(game, 6);
  } else {
    car.speed *= 0.4;
  }

  const clamped = clampToMap(world, car.x, car.y, 16);
  car.x = clamped.x;
  car.y = clamped.y;

  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  player.speed = Math.abs(car.speed);
  player.moving = Math.abs(car.speed) > 10;
}

// Try to enter the nearest car within reach. Returns a short label
// describing what happened, or null if there was no car nearby.
export function tryEnterCar(game) {
  const player = game.player;
  if (player.inCar) {
    return null;
  }
  const car = nearestCar(game, player.x, player.y, 56);
  if (!car) {
    return null;
  }
  player.inCar = true;
  player.car = car;
  car.drivenByPlayer = true;
  // Parked cars have no speed yet (they never drove): initialize the
  // driving state so the car does not go NaN on the first frame.
  if (typeof car.speed !== 'number') {
    car.speed = 0;
  }
  if (typeof car.length !== 'number') {
    car.length = 40;
  }
  if (typeof car.width !== 'number') {
    car.width = 20;
  }
  // Stealing a car that is not yours raises the wanted level.
  if (!car.owned) {
    game.wanted.stars = Math.min(WANTED.maxStars, game.wanted.stars + WANTED.stealCar);
    game.wanted.seenTimer = 0;
    game.events.push({ type: 'stolen', x: car.x, y: car.y });
    return 'stolen';
  }
  return 'entered';
}

// Step out of the current car, next to it.
export function exitCar(game) {
  const player = game.player;
  if (!player.inCar || !player.car) {
    return;
  }
  const car = player.car;
  car.drivenByPlayer = false;
  player.inCar = false;
  player.car = null;
  player.speed = 0;
  // Step out to the side of the car so the player does not stand
  // inside the car body.
  player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 26;
  player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 26;
}

// Find the nearest stealable car (traffic, parked, or police) to a point.
export function nearestCar(game, x, y, maxDistance) {
  let best = null;
  let bestDistance = maxDistance;
  const candidates = [];
  for (const car of game.traffic.cars) {
    candidates.push(car);
  }
  for (const car of game.world.parkedCars) {
    candidates.push(car);
  }
  for (const car of game.police.cars) {
    candidates.push(car);
  }
  for (const car of candidates) {
    const distance = Math.hypot(car.x - x, car.y - y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = car;
    }
  }
  return best;
}

// Damage the player, clamping at zero. Returns true if the player died.
export function damagePlayer(game, amount) {
  const player = game.player;
  if (player.health <= 0) {
    return true;
  }
  player.health = Math.max(0, player.health - amount);
  game.events.push({ type: 'hurt', x: player.x, y: player.y });
  return player.health <= 0;
}

// Heal the player, up to the maximum.
export function healPlayer(game, amount) {
  const player = game.player;
  player.health = Math.min(HEALTH.max, player.health + amount);
}
