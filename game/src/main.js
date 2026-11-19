// main.js — game loop and wiring for Neon Harbor.
//
// Owns the single game state object, the screens state machine
// (title / playing / paused / busted / wasted / victory), the
// ?shot= staging, and the per-frame update order: input, player,
// traffic, police, combat, missions, save, audio, camera, render.

import { WORLD, CAMERA, HEALTH } from './config.js';
import { RNG } from './random.js';
import { generateWorld } from './world.js';
import { Input } from './input.js';
import { createPlayer, updatePlayer, tryEnterCar, exitCar, damagePlayer } from './player.js';
import { createTraffic, updateTraffic } from './traffic.js';
import { createWanted, createPolice, updatePolice, payBribe } from './police.js';
import { tryPunch, checkPlayerDown, respawnFromSave, updateRivals } from './combat.js';
import { createMissionState, updateMissions, updateSideTaxi, updateSideRace, startSideTaxi, startSideRace, currentJob } from './missions.js';
import { saveGame, loadGame, applySave, saveSummary } from './save.js';
import { AudioSys } from './audio.js';
import { createRenderer, drawGame } from './render.js';
import { stageShot, parseShotParams } from './shots.js';

export function createGame(canvas, seed) {
  const world = generateWorld(seed);
  const spawn = world.places.spawn;
  const game = {
    world,
    seed,
    // The gameplay RNG: every random choice during play (traffic
    // turns, pedestrian direction changes, police spawns) draws from
    // this seeded stream, so the same seed stages the same scene.
    rng: new RNG(seed + 999),
    canvas,
    input: new Input(),
    audio: new AudioSys(),
    player: createPlayer(spawn),
    traffic: createTraffic(world, seed),
    wanted: createWanted(),
    police: createPolice(),
    mission: createMissionState(),
    sideTaxi: null,
    sideRace: null,
    screen: 'title',
    night: false,
    time: 0,
    playSeconds: 0,
    camera: { x: spawn.x, y: spawn.y },
    events: [],
    saveData: loadGame(),
    bestCash: 0,
    shotMode: false,
    frameCount: 0,
    lastTick: 0,
  };
  if (game.saveData) {
    game.bestCash = game.saveData.bestCash || 0;
  }
  game.renderer = createRenderer(canvas);
  return game;
}

// One fixed update step. Used by the live loop and by the shot
// autopilot, so staged scenes run the exact same simulation.
export function stepGame(game, dt) {
  const input = game.input;
  game.time += dt;
  game.frameCount += 1;

  if (game.screen === 'playing') {
    game.playSeconds += dt;
  }

  // Screen transitions from keys.
  if (input.wasPressed('Enter')) {
    handleEnter(game);
  }
  if (input.wasPressed('p') || input.wasPressed('Escape')) {
    if (game.screen === 'playing') {
      game.screen = 'paused';
    } else if (game.screen === 'paused') {
      game.screen = 'playing';
    }
  }
  if (input.wasPressed('m')) {
    game.audio.toggleMute();
  }
  if (input.wasPressed('c') && game.screen === 'title' && game.saveData) {
    applySave(game, game.saveData);
    game.screen = 'playing';
  }

  if (game.screen !== 'playing') {
    // On the title screen the world still idles: traffic moves and
    // the camera drifts slowly over the city.
    if (game.screen === 'title') {
      updateTraffic(game, dt);
      game.camera.x = game.world.width / 2 + Math.sin(game.time * 0.05) * 300;
      game.camera.y = game.world.height / 2 + Math.cos(game.time * 0.04) * 200;
    }
    input.update();
    return;
  }

  // Gameplay keys.
  if (input.wasPressed('e')) {
    if (game.player.inCar) {
      exitCar(game);
    } else {
      const result = tryEnterCar(game);
      if (result === 'stolen') {
        game.mission.banner = 'Car stolen — the police are on their way.';
        game.mission.bannerTimer = 2.5;
      }
    }
  }
  if (input.wasPressed('f')) {
    tryPunch(game);
  }
  if (input.wasPressed('s')) {
    const saved = saveGame(game);
    game.mission.banner = saved ? 'Game saved.' : 'Save failed — storage unavailable.';
    game.mission.bannerTimer = 2;
  }
  if (input.wasPressed('b')) {
    const paid = payBribe(game);
    game.mission.banner = paid ? 'Bribe paid — the heat is off.' : 'The Fixer is not nearby, or you are short on cash.';
    game.mission.bannerTimer = 2.5;
  }
  if (input.wasPressed('t')) {
    startSideTaxi(game);
  }
  if (input.wasPressed('r')) {
    startSideRace(game);
  }

  // Night falls for the harbor-deal job and stays after 21:00 game time.
  if (currentJob(game.mission) && currentJob(game.mission).title === 'Harbor Deal') {
    game.night = true;
  }

  updatePlayer(game, input, dt);
  updateTraffic(game, dt);
  updatePolice(game, dt);
  updateRivals(game, dt);
  updateMissions(game, dt);
  updateSideTaxi(game, dt);
  updateSideRace(game, dt);
  checkPlayerDown(game);

  // Audio follows the game state.
  if (game.player.inCar) {
    game.audio.ensure();
    game.audio.engineStart();
    const speedRatio = Math.abs(game.player.car ? game.player.car.speed : 0) / 520;
    game.audio.engineUpdate(speedRatio);
  } else {
    game.audio.engineStop();
  }
  if (game.wanted.stars > 0) {
    game.audio.ensure();
    game.audio.sirenStart();
    game.audio.sirenUpdate(dt);
  } else {
    game.audio.sirenStop();
  }

  // Camera follows the player with a soft lag.
  const targetX = game.player.x;
  const targetY = game.player.y;
  const lerp = Math.min(1, CAMERA.followLerp * dt);
  game.camera.x += (targetX - game.camera.x) * lerp;
  game.camera.y += (targetY - game.camera.y) * lerp;

  // Event sounds: drain the per-frame event list.
  for (const event of game.events) {
    if (event.type === 'crash') {
      game.audio.crash();
    } else if (event.type === 'pedHit') {
      game.audio.thud();
    } else if (event.type === 'missionPassed') {
      game.audio.pickup();
    }
  }
  game.events = [];

  input.update();
}

function handleEnter(game) {
  if (game.screen === 'title') {
    game.audio.ensure();
    game.audio.resume();
    game.screen = 'playing';
  } else if (game.screen === 'busted' || game.screen === 'wasted') {
    respawnFromSave(game);
  } else if (game.screen === 'victory') {
    game.screen = 'playing';
  }
}

// Expose a step function on the game object for the shot autopilot.
export function attachStep(game) {
  game.step = (dt) => stepGame(game, dt);
}

// Boot the game when the page loads.
export function boot(canvas) {
  const params = parseShotParams(window.location.search);
  const seed = params ? params.seed : WORLD.seed;
  const game = createGame(canvas, seed);
  attachStep(game);
  game.input.attach();

  if (params) {
    // Screenshot mode: stage the scene, then render it every frame
    // without waiting for input.
    game.shotMode = true;
    game.screen = 'playing';
    const staged = stageShot(game, params.shot, seed);
    if (!staged) {
      game.screen = 'title';
    }
    game.camera.x = game.player.x;
    game.camera.y = game.player.y;
    window.__neonHarbor = game;
    drawGame(game.renderer, game);
    // Keep the loop running so the canvas stays live.
    requestAnimationFrame(function loop() {
      stepGame(game, 1 / 60);
      drawGame(game.renderer, game);
      requestAnimationFrame(loop);
    });
    return game;
  }

  window.__neonHarbor = game;
  window.__neonHarborSaveSummary = game.saveData ? saveSummary(game.saveData) : null;

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    stepGame(game, dt);
    drawGame(game.renderer, game);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  return game;
}

// Auto-boot when loaded as a module from index.html.
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('game');
    if (canvas) {
      boot(canvas);
    }
  });
}
