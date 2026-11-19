// traffic.js — AI traffic cars and pedestrians.
//
// Traffic cars drive along the road grid: they pick a direction, drive
// to the next intersection, then choose a new direction. Pedestrians
// walk along sidewalks and cross at crosswalks; they run away when the
// player drives at them or punches nearby.

import { SPEEDS, WANTED } from './config.js';
import { RNG } from './random.js';
import { isOnRoad, insideBuilding, inWater, clampToMap } from './world.js';

const CAR_COLORS = ['#c23a3a', '#3a6ac2', '#d8c23a', '#3aa86a', '#8a8d94', '#e8e8e8', '#2a2a2a', '#7a4a9a'];
const PED_COLORS = ['#e8b23a', '#3a8a5a', '#8a3a5a', '#3a5a8a', '#c26a3a', '#6a6a6a'];

export function createTraffic(world, seed) {
  const rng = new RNG(seed + 77);
  const traffic = { cars: [], peds: [] };

  // 18 traffic cars spread across the road grid.
  for (let i = 0; i < 18; i += 1) {
    const road = world.roads[Math.floor(rng.float() * world.roads.length)];
    const x = road.vertical
      ? road.x + road.w / 2 + rng.either(-18, 18)
      : rng.range(120, world.width - 240);
    const y = road.vertical
      ? rng.range(120, world.height - 240)
      : road.y + road.h / 2 + rng.either(-18, 18);
    traffic.cars.push(makeCar(rng, x, y, road.vertical));
  }

  // 42 pedestrians on the sidewalks.
  for (let i = 0; i < 42; i += 1) {
    traffic.peds.push(makePedestrian(rng, world));
  }

  return traffic;
}

function makeCar(rng, x, y, vertical) {
  const model = rng.pick(['sedan', 'sedan', 'sedan', 'taxi', 'truck', 'sports']);
  return {
    x,
    y,
    angle: vertical ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI),
    speed: rng.range(SPEEDS.traffic * 0.7, SPEEDS.traffic),
    color: model === 'taxi' ? '#f2c200' : rng.pick(CAR_COLORS),
    model,
    vertical,
    owned: false,
    drivenByPlayer: false,
    stopped: 0,
    targetSpeed: rng.range(SPEEDS.traffic * 0.7, SPEEDS.traffic),
    length: model === 'truck' ? 52 : 40,
    width: 20,
  };
}

function makePedestrian(rng, world) {
  let x = 0;
  let y = 0;
  // Keep trying until the spot is walkable sidewalk, not road, not
  // inside a building, not in the water.
  for (let tries = 0; tries < 20; tries += 1) {
    x = rng.range(60, world.width - 300);
    y = rng.range(60, world.height - 300);
    if (!isOnRoad(world, x, y) && !insideBuilding(world, x, y) && !inWater(world, x, y)) {
      break;
    }
  }
  return {
    x,
    y,
    angle: rng.range(0, Math.PI * 2),
    speed: rng.range(SPEEDS.pedWalk * 0.7, SPEEDS.pedWalk * 1.3),
    color: rng.pick(PED_COLORS),
    fleeing: 0,
    fleeX: 0,
    fleeY: 0,
    walkTimer: rng.range(2, 6),
    alive: true,
    down: false,
    downTimer: 0,
  };
}

export function updateTraffic(game, dt) {
  updateCars(game, dt);
  updatePedestrians(game, dt);
}

function updateCars(game, dt) {
  const world = game.world;
  const player = game.player;
  for (const car of game.traffic.cars) {
    if (car.drivenByPlayer) {
      continue;
    }
    // Stop briefly if another car is right ahead.
    const ahead = carAhead(game, car, 46);
    if (ahead) {
      car.stopped += dt;
      car.speed = Math.max(0, car.speed - 300 * dt);
    } else {
      car.stopped = 0;
      car.speed += (car.targetSpeed - car.speed) * dt;
    }

    const nextX = car.x + Math.cos(car.angle) * car.speed * dt;
    const nextY = car.y + Math.sin(car.angle) * car.speed * dt;

    // At an intersection, sometimes turn onto the crossing road.
    if (atIntersection(world, nextX, nextY) && game.rng.float() < 0.02) {
      car.angle = pickNewDirection(world, car, game.rng);
      car.vertical = Math.abs(Math.cos(car.angle)) < 0.5;
    }

    // Stay on the roads: if the next step leaves the road grid, turn.
    if (!isOnRoad(world, nextX, nextY)) {
      car.angle = pickNewDirection(world, car, game.rng);
      car.vertical = Math.abs(Math.cos(car.angle)) < 0.5;
      continue;
    }

    car.x = nextX;
    car.y = nextY;

    const clamped = clampToMap(world, car.x, car.y, 60);
    car.x = clamped.x;
    car.y = clamped.y;

    // Hitting the player's car while the player drives is a crash.
    if (player.inCar && player.car) {
      const distance = Math.hypot(car.x - player.car.x, car.y - player.car.y);
      if (distance < 34 && Math.abs(player.car.speed) > 60) {
        game.events.push({ type: 'crash', x: car.x, y: car.y, hard: false });
        car.speed *= 0.4;
      }
    }
  }
}

// True when another car is directly ahead of this one.
function carAhead(game, car, distance) {
  const aheadX = car.x + Math.cos(car.angle) * distance;
  const aheadY = car.y + Math.sin(car.angle) * distance;
  for (const other of game.traffic.cars) {
    if (other === car) {
      continue;
    }
    if (Math.hypot(other.x - aheadX, other.y - aheadY) < 26) {
      return true;
    }
  }
  return false;
}

function atIntersection(world, x, y) {
  // An intersection is where a vertical and a horizontal road cross.
  let vertical = false;
  let horizontal = false;
  for (const road of world.roads) {
    if (x >= road.x && x <= road.x + road.w && y >= road.y && y <= road.y + road.h) {
      if (road.vertical) {
        vertical = true;
      } else {
        horizontal = true;
      }
    }
  }
  return vertical && horizontal;
}

function pickNewDirection(world, car, rng) {
  // Choose a direction that keeps the car on a road.
  const options = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  const valid = [];
  for (const angle of options) {
    const nx = car.x + Math.cos(angle) * 60;
    const ny = car.y + Math.sin(angle) * 60;
    if (isOnRoad(world, nx, ny)) {
      valid.push(angle);
    }
  }
  if (valid.length === 0) {
    return car.angle + Math.PI;
  }
  return valid[Math.floor(rng.float() * valid.length)];
}

function updatePedestrians(game, dt) {
  const world = game.world;
  const player = game.player;
  for (const ped of game.traffic.peds) {
    if (!ped.alive) {
      continue;
    }
    if (ped.down) {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        ped.down = false;
        ped.alive = true;
      }
      continue;
    }

    const distanceToPlayer = Math.hypot(ped.x - player.x, ped.y - player.y);

    // Flee if the player is close and fast, or punched nearby.
    if (ped.fleeing > 0) {
      ped.fleeing -= dt;
      const away = Math.atan2(ped.y - ped.fleeY, ped.x - ped.fleeX);
      ped.x += Math.cos(away) * SPEEDS.pedFlee * dt;
      ped.y += Math.sin(away) * SPEEDS.pedFlee * dt;
      ped.angle = away;
    } else {
      if (distanceToPlayer < 90 && player.moving && Math.abs(player.speed) > 120) {
        ped.fleeing = 2.5;
        ped.fleeX = player.x;
        ped.fleeY = player.y;
      }
      ped.walkTimer -= dt;
      if (ped.walkTimer <= 0) {
        ped.walkTimer = 3 + game.rng.float() * 4;
        ped.angle = game.rng.float() * Math.PI * 2;
      }
      const nextX = ped.x + Math.cos(ped.angle) * ped.speed * dt;
      const nextY = ped.y + Math.sin(ped.angle) * ped.speed * dt;
      if (!isOnRoad(world, nextX, nextY) && !insideBuilding(world, nextX, nextY) && !inWater(world, nextX, nextY)) {
        ped.x = nextX;
        ped.y = nextY;
      } else {
        ped.angle += Math.PI / 2;
      }
    }

    // The player's car hitting a pedestrian knocks them down and
    // raises the wanted level.
    if (player.inCar && player.car && Math.abs(player.car.speed) > 40) {
      const hitDistance = Math.hypot(ped.x - player.car.x, ped.y - player.car.y);
      if (hitDistance < 26) {
        ped.down = true;
        ped.downTimer = 6;
        ped.alive = false;
        game.wanted.stars = Math.min(WANTED.maxStars, game.wanted.stars + WANTED.hitPedestrian);
        game.wanted.seenTimer = 0;
        game.events.push({ type: 'pedHit', x: ped.x, y: ped.y });
      }
    }

    const clamped = clampToMap(world, ped.x, ped.y, 20);
    ped.x = clamped.x;
    ped.y = clamped.y;
  }
}
