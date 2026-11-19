// shots.js — deterministic screenshot staging for Neon Harbor.
//
// The game supports ?shot=<name>&seed=<n>. When present, the world is
// reset from the seed, the simulation is run forward a fixed number
// of steps with a simple autopilot (no input needed), and the right
// screen is drawn. The same seed always stages the same scene, so
// screenshots are reproducible.

import { WORLD } from './config.js';
import { RNG } from './random.js';
import { addWanted } from './police.js';

export const SHOT_NAMES = ['chase', 'title', 'street', 'night'];

// Stage the named scene on a live game object. The game must already
// have a world, player, traffic and police; this function resets
// them to the staged state.
export function stageShot(game, name, seed) {
  const rng = new RNG(seed * 1000 + 41);
  const world = game.world;
  const player = game.player;

  if (name === 'title') {
    game.screen = 'title';
    game.night = false;
    player.x = world.places.spawn.x;
    player.y = world.places.spawn.y;
    return true;
  }

  if (name === 'street') {
    game.screen = 'playing';
    game.night = false;
    placePlayerOnRoad(game, 480, 720);
    givePlayerCar(game, '#c23a3a', 'sedan');
    runAutopilot(game, 60, { drive: true });
    // A clean daytime drive: no wanted level, no police, full health,
    // and the car still moving so the frame reads as driving.
    finishStagedDrive(game, 0);
    return true;
  }

  if (name === 'chase') {
    game.screen = 'playing';
    game.night = false;
    placePlayerOnRoad(game, 800, 1040);
    givePlayerCar(game, '#e8e8e8', 'sports');
    addWanted(game, 3);
    // Put two police cars right behind the player car.
    const police = game.police.cars;
    for (let i = 0; i < 3; i += 1) {
      const behind = 90 + i * 70;
      police.push({
        x: player.x - behind,
        y: player.y + rng.range(-30, 30),
        angle: 0,
        speed: 420,
        color: '#1a2a6a',
        model: 'police',
        owned: false,
        drivenByPlayer: false,
        length: 42,
        width: 20,
        ramCooldown: 0,
        sirenPhase: rng.range(0, Math.PI * 2),
      });
    }
    runAutopilot(game, 90, { drive: true, flee: true });
    // The autopilot drive can end with the player busted (police rams
    // drain health fast) or at 5 stars. A chase screenshot must show
    // a chase in progress, so restore the staged state afterwards:
    // full health, 3 stars, playing, police re-placed behind the car.
    game.player.health = 100;
    game.wanted.stars = 3;
    game.screen = 'playing';
    game.police.cars = [];
    for (let i = 0; i < 3; i += 1) {
      const behind = 110 + i * 80;
      game.police.cars.push({
        x: player.x - behind,
        y: player.y + (i - 1) * 36,
        angle: 0,
        speed: 430,
        color: '#1a2a6a',
        model: 'police',
        owned: false,
        drivenByPlayer: false,
        length: 42,
        width: 20,
        ramCooldown: 1,
        sirenPhase: rng.range(0, Math.PI * 2),
      });
    }
    if (player.car) {
      player.car.speed = 320;
    }
    return true;
  }

  if (name === 'night') {
    game.screen = 'playing';
    game.night = true;
    placePlayerOnRoad(game, 1440, 720);
    givePlayerCar(game, '#3a6ac2', 'sedan');
    runAutopilot(game, 60, { drive: true });
    finishStagedDrive(game, 0);
    return true;
  }

  return false;
}

// After a staged drive, reset the cosmetic state so the frame shows
// a clean scene: full health, the given wanted level, no police
// unless the scene wants them, and the game still playing.
function finishStagedDrive(game, stars) {
  game.player.health = 100;
  game.wanted.stars = stars;
  game.wanted.helicopter = null;
  game.police.cars = [];
  game.police.foot = [];
  game.screen = 'playing';
  if (game.player.car) {
    game.player.car.speed = 280;
  }
}

function placePlayerOnRoad(game, x, y) {
  const player = game.player;
  player.x = x;
  player.y = y;
  player.angle = 0;
  player.inCar = false;
  player.car = null;
}

function givePlayerCar(game, color, model) {
  const player = game.player;
  const car = {
    x: player.x,
    y: player.y,
    angle: 0,
    speed: 260,
    color,
    model,
    owned: true,
    drivenByPlayer: true,
    length: 40,
    width: 20,
  };
  game.traffic.cars.push(car);
  player.inCar = true;
  player.car = car;
}

// Run the simulation forward a fixed number of steps. The autopilot
// holds W (drive forward) and steers toward the road ahead so the
// car stays on the road instead of drifting into buildings.
export function runAutopilot(game, steps, options) {
  const input = game.input;
  const dt = 1 / 60;
  for (let step = 0; step < steps; step += 1) {
    if (options && options.drive) {
      input.simulateHold('w');
    }
    // Road-following steering: find the road the car is on and steer
    // toward its direction, so the car drives straight down the road
    // instead of veering diagonally into a block.
    if (game.player.inCar && game.player.car) {
      steerAlongRoad(game);
    }
    game.step(dt);
  }
  input.keys.clear();
}

// Steer the player's car toward the direction of the road it is on.
function steerAlongRoad(game) {
  const car = game.player.car;
  const world = game.world;
  let road = null;
  for (const candidate of world.roads) {
    if (car.x >= candidate.x && car.x <= candidate.x + candidate.w
      && car.y >= candidate.y && car.y <= candidate.y + candidate.h) {
      road = candidate;
      break;
    }
  }
  if (!road) {
    // Off the road: turn gently back toward the nearest road center.
    const center = { x: 1600, y: 1200 };
    const target = Math.atan2(center.y - car.y, center.x - car.x);
    car.angle += angleDifference(target, car.angle) * 0.06;
    return;
  }
  // The road's direction: keep the car's current heading sign so it
  // does not U-turn, just straighten out.
  let target;
  if (road.vertical) {
    target = car.angle > 0 ? Math.PI / 2 : -Math.PI / 2;
    // Snap the car toward the road center line.
    const centerX = road.x + road.w / 2;
    car.x += (centerX - car.x) * 0.02;
  } else {
    target = Math.abs(car.angle) < Math.PI / 2 ? 0 : Math.PI;
    const centerY = road.y + road.h / 2;
    car.y += (centerY - car.y) * 0.02;
  }
  car.angle += angleDifference(target, car.angle) * 0.08;
}

function angleDifference(target, current) {
  let difference = target - current;
  while (difference > Math.PI) {
    difference -= Math.PI * 2;
  }
  while (difference < -Math.PI) {
    difference += Math.PI * 2;
  }
  return difference;
}

// Parse the ?shot= and &seed= parameters from the page URL.
export function parseShotParams(search) {
  const params = new URLSearchParams(search || '');
  const shot = params.get('shot');
  const seedRaw = params.get('seed');
  const seed = seedRaw ? parseInt(seedRaw, 10) : WORLD.seed;
  if (!shot || !SHOT_NAMES.includes(shot)) {
    return null;
  }
  return { shot, seed: Number.isFinite(seed) ? seed : WORLD.seed };
}
