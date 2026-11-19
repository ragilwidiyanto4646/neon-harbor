// combat.js — punching, damage, and the BUSTED / WASTED states.
//
// On foot, F punches whatever is in front of the player: pedestrians
// and police officers take damage, and punching a police officer
// raises the wanted level. If the player's health reaches zero while
// wanted, they are BUSTED; with no wanted level they are WASTED.
// Either way the game offers a restart from the last save.

import { HEALTH, WANTED } from './config.js';
import { damagePlayer } from './player.js';

export function tryPunch(game) {
  const player = game.player;
  if (player.inCar) {
    return false;
  }
  if (player.punchCooldown > 0) {
    return false;
  }
  player.punchCooldown = 0.45;
  player.punchAnim = 0.25;
  game.audio.thud();

  const reach = 52;
  const px = player.x + Math.cos(player.angle) * reach;
  const py = player.y + Math.sin(player.angle) * reach;
  let hitSomething = false;

  // Punch pedestrians in front of the player.
  for (const ped of game.traffic.peds) {
    if (!ped.alive) {
      continue;
    }
    if (Math.hypot(ped.x - px, ped.y - py) < 34) {
      ped.down = true;
      ped.downTimer = 5;
      ped.alive = false;
      ped.fleeing = 0;
      hitSomething = true;
      game.events.push({ type: 'pedHit', x: ped.x, y: ped.y });
      // Punching a pedestrian in view of the law is a crime.
      game.wanted.stars = Math.min(WANTED.maxStars, game.wanted.stars + 1);
    }
  }

  // Punch foot police in front of the player.
  for (const officer of game.police.foot) {
    if (Math.hypot(officer.x - px, officer.y - py) < 36) {
      officer.health -= HEALTH.punchDamage;
      hitSomething = true;
      game.wanted.stars = Math.min(WANTED.maxStars, game.wanted.stars + 1);
      game.events.push({ type: 'hurt', x: officer.x, y: officer.y });
      if (officer.health <= 0) {
        officer.x = player.x + 5000;
        officer.y = player.y + 5000;
      }
    }
  }

  // Punching a rival gang member (mission 13) hurts them too.
  for (const rival of game.mission.rivals) {
    if (rival.alive && Math.hypot(rival.x - px, rival.y - py) < 38) {
      rival.health -= HEALTH.punchDamage;
      hitSomething = true;
      if (rival.health <= 0) {
        rival.alive = false;
        game.mission.rivalsDown += 1;
        game.events.push({ type: 'rivalDown', x: rival.x, y: rival.y });
      }
    }
  }

  return hitSomething;
}

// Check whether the player has been busted or wasted, and set the
// game screen accordingly. Returns 'busted', 'wasted', or null.
export function checkPlayerDown(game) {
  const player = game.player;
  if (player.health > 0) {
    return null;
  }
  if (game.wanted.stars > 0) {
    game.screen = 'busted';
    game.audio.sirenStop();
    return 'busted';
  }
  game.screen = 'wasted';
  game.audio.sirenStop();
  return 'wasted';
}

// Restart from the last save: restore health and position, drop some
// cash as the cost of getting caught, and clear the wanted level.
export function respawnFromSave(game) {
  const player = game.player;
  const save = game.saveData;
  player.health = HEALTH.max;
  player.cash = Math.max(0, player.cash - 200);
  game.wanted.stars = 0;
  game.police.cars = [];
  game.police.foot = [];
  game.wanted.helicopter = null;
  if (save && save.playerX !== undefined) {
    player.x = save.playerX;
    player.y = save.playerY;
  } else {
    player.x = player.lastSafeX;
    player.y = player.lastSafeY;
  }
  if (player.inCar && player.car) {
    player.car.drivenByPlayer = false;
    player.inCar = false;
    player.car = null;
  }
  game.screen = 'playing';
  game.camera.x = player.x;
  game.camera.y = player.y;
}

// The rival gang members for mission 13 chase and punch the player.
export function updateRivals(game, dt) {
  const player = game.player;
  for (const rival of game.mission.rivals) {
    if (!rival.alive) {
      continue;
    }
    const distance = Math.hypot(rival.x - player.x, rival.y - player.y);
    const angle = Math.atan2(player.y - rival.y, player.x - rival.x);
    rival.angle = angle;
    if (rival.punchCooldown > 0) {
      rival.punchCooldown -= dt;
    }
    if (distance > 28) {
      rival.x += Math.cos(angle) * 150 * dt;
      rival.y += Math.sin(angle) * 150 * dt;
    } else if (rival.punchCooldown <= 0) {
      rival.punchCooldown = 1.1;
      damagePlayer(game, 10);
    }
  }
}
