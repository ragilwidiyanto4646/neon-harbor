// missions.js — the 3 acts and 15 jobs, plus side activities.
//
// Jobs run in order. Each job has a title, a description, an
// objective type, a target place, and a cash reward. The HUD shows
// the current objective; a yellow marker on the map and minimap
// points at the target. Completing a job pays cash, shows a banner,
// saves the game, and unlocks the next job.

import { REWARDS, TIMING } from './config.js';

export const JOBS = [
  // Act 1 — Small Time
  { title: 'First Wheels', act: 1, type: 'drive-to', target: 'garage', reward: REWARDS.jobBase[0],
    description: 'Steal any car and drive it to the garage.' },
  { title: 'The Pickup', act: 1, type: 'pickup', target: 'docks', reward: REWARDS.jobBase[1],
    description: 'Drive to the docks, collect the package, then return it.' },
  { title: 'Taxi Hustle', act: 1, type: 'taxi', target: 'taxiStand', reward: REWARDS.jobBase[2],
    description: 'Pick up the taxi fare passenger and drive them to their destination.' },
  { title: 'Outrun the Law', act: 1, type: 'survive', target: 'garage', reward: REWARDS.jobBase[3],
    description: 'Reach a 2-star wanted level, then lose the police.' },
  { title: 'The Drop', act: 1, type: 'deliver', target: 'marina', reward: REWARDS.jobBase[4],
    description: 'Deliver the package across town while avoiding police.' },
  // Act 2 — Moving Up
  { title: 'The Heist Setup', act: 2, type: 'steal-car', target: 'chopShop', reward: REWARDS.jobBase[5],
    description: 'Steal a specific sports car and bring it to the chop shop.' },
  { title: 'Checkpoint Rush', act: 2, type: 'race', target: 'raceStart', reward: REWARDS.jobBase[6],
    description: 'Drive through 6 checkpoints in order before the timer ends.' },
  { title: 'The Getaway', act: 2, type: 'survive', target: 'causeway', reward: REWARDS.jobBase[7],
    description: 'After a robbery, escape a 3-star wanted level.' },
  { title: 'Harbor Deal', act: 2, type: 'drive-to', target: 'pier', reward: REWARDS.jobBase[8],
    description: 'Meet the contact at the harbor pier at night.' },
  { title: 'The Chase', act: 2, type: 'survive', target: 'garage', reward: REWARDS.jobBase[9],
    description: 'Outrun 3 police cars for 60 seconds.' },
  // Act 3 — Harbor King
  { title: 'The Big Score', act: 3, type: 'deliver', target: 'marina', reward: REWARDS.jobBase[10],
    description: 'Rob the bank vault and escape with the cash.' },
  { title: 'Five Stars', act: 3, type: 'survive', target: 'causeway', reward: REWARDS.jobBase[11],
    description: 'Survive a 5-star wanted level, helicopter included, for 90 seconds.' },
  { title: 'The Rival', act: 3, type: 'combat', target: 'rivalDocks', reward: REWARDS.jobBase[12],
    description: 'Confront the rival gang at the docks — on foot.' },
  { title: 'The Escape', act: 3, type: 'drive-to', target: 'causeway', reward: REWARDS.jobBase[13],
    description: 'Escape the city by driving to the causeway bridge.' },
  { title: 'Neon Harbor', act: 3, type: 'deliver', target: 'marina', reward: REWARDS.jobBase[14],
    description: 'The final job: deliver the goods to the marina and finish the story.' },
];

export const ACT_NAMES = {
  1: 'Act 1 — Small Time',
  2: 'Act 2 — Moving Up',
  3: 'Act 3 — Harbor King',
};

export function createMissionState() {
  return {
    jobIndex: 0,
    completed: 0,
    stage: 'go-to',
    timer: 0,
    surviveTimer: 0,
    checkpoints: [],
    checkpointIndex: 0,
    raceTimer: 0,
    taxi: null,
    race: null,
    rivals: [],
    rivalsDown: 0,
    rivalsTotal: 0,
    banner: '',
    bannerTimer: 0,
    hasPackage: false,
    targetCar: null,
    victory: false,
    startedAt: 0,
  };
}

export function currentJob(mission) {
  if (mission.jobIndex >= JOBS.length) {
    return null;
  }
  return JOBS[mission.jobIndex];
}

export function jobTargetPosition(game) {
  const job = currentJob(game.mission);
  if (!job) {
    return null;
  }
  // Some jobs move their target as stages progress.
  if (job.type === 'taxi' && game.mission.taxi && game.mission.taxi.pickedUp) {
    return game.mission.taxi.destination;
  }
  if (job.type === 'pickup' && game.mission.hasPackage) {
    return game.world.places.garage;
  }
  if (job.type === 'deliver' && game.mission.hasPackage) {
    return game.world.places[job.target];
  }
  return game.world.places[job.target];
}

export function objectiveText(game) {
  const job = currentJob(game.mission);
  if (!job) {
    return 'All jobs complete — you are the Harbor King.';
  }
  const mission = game.mission;
  if (job.type === 'race' && mission.race) {
    return job.title + ': checkpoint ' + (mission.checkpointIndex + 1) + ' of ' + mission.checkpoints.length
      + ' — ' + Math.ceil(mission.raceTimer) + 's left';
  }
  if (job.type === 'survive' && mission.surviveTimer > 0) {
    return job.title + ': hold on — ' + Math.ceil(mission.surviveTimer) + 's left';
  }
  if (job.type === 'combat') {
    return job.title + ': rivals down ' + mission.rivalsDown + '/' + mission.rivalsTotal;
  }
  if (job.type === 'pickup' && mission.hasPackage) {
    return job.title + ': package collected — return to the garage.';
  }
  if (job.type === 'taxi' && mission.taxi && mission.taxi.pickedUp) {
    return job.title + ': drive the passenger to their destination.';
  }
  return job.title + ': ' + job.description;
}

// Called every frame while playing. Advances job stages and checks
// for completion. Returns the completed job, or null.
export function updateMissions(game, dt) {
  const mission = game.mission;
  const job = currentJob(mission);
  if (!job) {
    return null;
  }
  if (mission.bannerTimer > 0) {
    mission.bannerTimer -= dt;
  }

  const player = game.player;
  const target = jobTargetPosition(game);
  const distance = target ? Math.hypot(player.x - target.x, player.y - target.y) : Infinity;

  switch (job.type) {
    case 'drive-to':
      if (distance < 80) {
        return completeJob(game, job);
      }
      break;
    case 'pickup':
      if (!mission.hasPackage && distance < 80) {
        mission.hasPackage = true;
        game.audio.chime();
        mission.banner = 'Package collected — return to the garage.';
        mission.bannerTimer = TIMING.missionBannerSeconds;
      } else if (mission.hasPackage) {
        const garage = game.world.places.garage;
        if (Math.hypot(player.x - garage.x, player.y - garage.y) < 80) {
          return completeJob(game, job);
        }
      }
      break;
    case 'taxi':
      updateTaxiJob(game, dt);
      if (mission.taxi && mission.taxi.done) {
        return completeJob(game, job);
      }
      break;
    case 'survive':
      return updateSurviveJob(game, job, dt);
    case 'deliver':
      if (!mission.hasPackage) {
        // The package is picked up at the job start point.
        if (distance < 80) {
          mission.hasPackage = true;
          game.audio.chime();
          mission.banner = 'Package in hand — deliver it.';
          mission.bannerTimer = TIMING.missionBannerSeconds;
        }
      } else if (distance < 80) {
        return completeJob(game, job);
      }
      break;
    case 'steal-car':
      if (player.inCar && player.car && player.car.model === 'sports' && distance < 90) {
        return completeJob(game, job);
      }
      break;
    case 'race':
      updateRaceJob(game, job, dt);
      if (mission.race && mission.race.done) {
        return completeJob(game, job);
      }
      if (mission.race && mission.raceTimer <= 0) {
        // Out of time: restart the race from the start marker.
        mission.race = null;
        mission.checkpoints = [];
        mission.checkpointIndex = 0;
        mission.banner = 'Race failed — time ran out. Try again.';
        mission.bannerTimer = TIMING.missionBannerSeconds;
      }
      break;
    case 'combat':
      if (mission.rivals.length === 0) {
        spawnRivals(game);
      }
      if (mission.rivalsTotal > 0 && mission.rivalsDown >= mission.rivalsTotal) {
        return completeJob(game, job);
      }
      break;
    default:
      break;
  }
  return null;
}

function updateTaxiJob(game, dt) {
  const mission = game.mission;
  const player = game.player;
  if (!mission.taxi) {
    const stand = game.world.places.taxiStand;
    mission.taxi = {
      x: stand.x,
      y: stand.y,
      destination: { x: 2400, y: 1200 },
      pickedUp: false,
      done: false,
    };
  }
  const taxi = mission.taxi;
  if (!taxi.pickedUp) {
    if (Math.hypot(player.x - taxi.x, player.y - taxi.y) < 70) {
      taxi.pickedUp = true;
      game.audio.chime();
      mission.banner = 'Passenger aboard — drive to the destination.';
      mission.bannerTimer = TIMING.missionBannerSeconds;
    }
  } else if (Math.hypot(player.x - taxi.destination.x, player.y - taxi.destination.y) < 80) {
    taxi.done = true;
    player.cash += REWARDS.taxiFare;
  }
}

function updateSurviveJob(game, job, dt) {
  const mission = game.mission;
  const wanted = game.wanted;
  // Each survive job has its own heat requirement and timer.
  let neededStars = 2;
  let surviveSeconds = TIMING.chaseSurviveSeconds;
  if (job.title === 'The Getaway') {
    neededStars = 3;
  }
  if (job.title === 'Five Stars') {
    neededStars = 5;
    surviveSeconds = TIMING.fiveStarSurviveSeconds;
  }
  if (wanted.stars >= neededStars) {
    if (mission.surviveTimer <= 0) {
      mission.surviveTimer = surviveSeconds;
    }
    mission.surviveTimer -= dt;
    if (mission.surviveTimer <= 0) {
      return completeJob(game, job);
    }
  } else {
    // Lost the heat before the timer ran out: the clock resets, but
    // the job stays active so the player can try again.
    mission.surviveTimer = 0;
  }
  return null;
}

function updateRaceJob(game, job, dt) {
  const mission = game.mission;
  const player = game.player;
  if (!mission.race) {
    // Lay out 6 checkpoints in a loop around the city.
    mission.checkpoints = [
      { x: 480, y: 1040 },
      { x: 1440, y: 1040 },
      { x: 2400, y: 1040 },
      { x: 2400, y: 400 },
      { x: 1440, y: 400 },
      { x: 480, y: 400 },
    ];
    mission.checkpointIndex = 0;
    mission.raceTimer = TIMING.raceSeconds;
    mission.race = { done: false };
  }
  mission.raceTimer -= dt;
  const checkpoint = mission.checkpoints[mission.checkpointIndex];
  if (checkpoint && Math.hypot(player.x - checkpoint.x, player.y - checkpoint.y) < 70) {
    mission.checkpointIndex += 1;
    game.audio.chime();
    if (mission.checkpointIndex >= mission.checkpoints.length) {
      mission.race.done = true;
      player.cash += REWARDS.raceWin;
    }
  }
}

function spawnRivals(game) {
  const mission = game.mission;
  const docks = game.world.places.rivalDocks;
  mission.rivals = [];
  for (let i = 0; i < 4; i += 1) {
    mission.rivals.push({
      x: docks.x + (i - 1.5) * 70,
      y: docks.y + (i % 2) * 60 - 30,
      angle: 0,
      health: 54,
      alive: true,
      punchCooldown: 0,
    });
  }
  mission.rivalsTotal = 4;
  mission.rivalsDown = 0;
}

function completeJob(game, job) {
  const mission = game.mission;
  const player = game.player;
  player.cash += job.reward;
  mission.completed += 1;
  mission.jobIndex += 1;
  mission.hasPackage = false;
  mission.surviveTimer = 0;
  mission.taxi = null;
  mission.race = null;
  mission.checkpoints = [];
  mission.checkpointIndex = 0;
  mission.rivals = [];
  mission.rivalsDown = 0;
  mission.rivalsTotal = 0;
  mission.banner = 'MISSION PASSED — ' + job.title + '  +$' + job.reward;
  mission.bannerTimer = TIMING.missionBannerSeconds;
  game.audio.jingle();
  game.events.push({ type: 'missionPassed', x: player.x, y: player.y });
  if (mission.jobIndex >= JOBS.length) {
    mission.victory = true;
    game.screen = 'victory';
  }
  return job;
}

// Side activities, always available outside the job list.

// Start a taxi fare: a passenger waits at the stand.
export function startSideTaxi(game) {
  const stand = game.world.places.taxiStand;
  game.sideTaxi = {
    x: stand.x,
    y: stand.y,
    destination: { x: 2080, y: 1680 },
    pickedUp: false,
    active: true,
  };
  game.mission.banner = 'Taxi fare: pick up the passenger at the stand.';
  game.mission.bannerTimer = TIMING.missionBannerSeconds;
}

export function updateSideTaxi(game, dt) {
  const taxi = game.sideTaxi;
  if (!taxi || !taxi.active) {
    return;
  }
  const player = game.player;
  if (!taxi.pickedUp) {
    if (Math.hypot(player.x - taxi.x, player.y - taxi.y) < 70) {
      taxi.pickedUp = true;
      game.audio.chime();
    }
  } else if (Math.hypot(player.x - taxi.destination.x, player.y - taxi.destination.y) < 80) {
    taxi.active = false;
    player.cash += REWARDS.taxiFare;
    game.mission.banner = 'Fare complete  +$' + REWARDS.taxiFare;
    game.mission.bannerTimer = TIMING.missionBannerSeconds;
    game.audio.jingle();
  }
}

// Start a checkpoint race from the race marker.
export function startSideRace(game) {
  game.sideRace = {
    checkpoints: [
      { x: 480, y: 1040 },
      { x: 1120, y: 1040 },
      { x: 1760, y: 1040 },
      { x: 1760, y: 1680 },
      { x: 1120, y: 1680 },
    ],
    index: 0,
    timer: TIMING.raceSeconds,
    active: true,
  };
  game.mission.banner = 'Race started — 5 checkpoints, 90 seconds.';
  game.mission.bannerTimer = TIMING.missionBannerSeconds;
}

export function updateSideRace(game, dt) {
  const race = game.sideRace;
  if (!race || !race.active) {
    return;
  }
  const player = game.player;
  race.timer -= dt;
  const checkpoint = race.checkpoints[race.index];
  if (checkpoint && Math.hypot(player.x - checkpoint.x, player.y - checkpoint.y) < 70) {
    race.index += 1;
    game.audio.chime();
    if (race.index >= race.checkpoints.length) {
      race.active = false;
      player.cash += REWARDS.raceWin;
      game.mission.banner = 'Race won  +$' + REWARDS.raceWin;
      game.mission.bannerTimer = TIMING.missionBannerSeconds;
      game.audio.jingle();
    }
  }
  if (race.timer <= 0 && race.active) {
    race.active = false;
    game.mission.banner = 'Race failed — time ran out.';
    game.mission.bannerTimer = TIMING.missionBannerSeconds;
  }
}
