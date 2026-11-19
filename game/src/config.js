// config.js — constants for Neon Harbor.
//
// Every tunable number for the game lives here so balancing the game
// means editing this one file instead of hunting through the modules.
// World units are pixels in world space; the camera shows a window of
// the world on the 1280x800 canvas.

export const WORLD = {
  width: 3200,
  height: 2400,
  roadSpacing: 320,
  roadWidth: 96,
  sidewalkWidth: 18,
  blockSize: 320 - 96,
  beachWidth: 220,
  seed: 1337,
};

// The 14 districts of Neon Harbor. Each entry has a name and a
// rectangular bound in world coordinates. districtAt() in world.js
// returns the first district whose bounds contain a point, so the
// order below also decides the priority where bounds overlap.
export const DISTRICTS = [
  { name: 'Harborfront', x: 0, y: 0, w: 640, h: 480 },
  { name: 'Old Town', x: 640, y: 0, w: 640, h: 480 },
  { name: 'Neon Strip', x: 1280, y: 0, w: 640, h: 480 },
  { name: 'Dockside', x: 1920, y: 0, w: 640, h: 480 },
  { name: 'Palm Court', x: 2560, y: 0, w: 640, h: 480 },
  { name: 'The Marina', x: 0, y: 480, w: 640, h: 480 },
  { name: 'Copper Row', x: 640, y: 480, w: 640, h: 480 },
  { name: 'Sunset Bluff', x: 1280, y: 480, w: 640, h: 480 },
  { name: "Fisherman's Wharf", x: 1920, y: 480, w: 640, h: 480 },
  { name: 'The Yard', x: 2560, y: 480, w: 640, h: 480 },
  { name: 'Coral Heights', x: 0, y: 960, w: 640, h: 1440 },
  { name: 'Bayview', x: 640, y: 960, w: 640, h: 1440 },
  { name: 'The Causeway', x: 1280, y: 960, w: 640, h: 1440 },
  { name: 'Lantern District', x: 1920, y: 960, w: 1280, h: 1440 },
];

// Palette. Day colors are the default; render.js darkens them at night.
export const COLORS = {
  grass: '#2e6b34',
  road: '#23252b',
  roadEdge: '#3a3d46',
  lane: '#e8d44d',
  sidewalk: '#8a8d94',
  buildingRoof: ['#7a4a3a', '#4a6a8a', '#8a6a3a', '#5a4a7a', '#3a7a5a', '#9a5a6a'],
  buildingWall: '#5a5148',
  windowLit: '#ffd76a',
  windowDark: '#2a3242',
  sand: '#d9c27a',
  water: '#1d6fb8',
  waterDeep: '#155a96',
  dockWood: '#8a6a42',
  tree: '#2a7a3a',
  treeTrunk: '#6a4a2a',
  player: '#f2f2f2',
  playerShirt: '#e33e3e',
  police: '#2a4ad8',
  policeLight: '#ff2a2a',
  taxi: '#f2c200',
  hudBg: 'rgba(8, 10, 16, 0.72)',
  hudText: '#f2f2f2',
  hudAccent: '#ffd76a',
  minimapWater: '#155a96',
  minimapRoad: '#5a5d66',
  missionMarker: '#ffd700',
};

// Movement and driving speeds, in world units per second.
export const SPEEDS = {
  walk: 170,
  run: 290,
  carAccel: 420,
  carMax: 520,
  carReverseMax: 180,
  carBrake: 700,
  carTurn: 2.6,
  carDrag: 0.6,
  traffic: 150,
  trafficMax: 210,
  pedWalk: 55,
  pedFlee: 150,
  policeCarMax: 560,
  policeFoot: 200,
  helicopter: 260,
};

// Wanted-level rules.
export const WANTED = {
  maxStars: 5,
  stealCar: 1,
  hitPedestrian: 1,
  hitPoliceCar: 1,
  robbery: 2,
  decaySeconds: 12,
  bribeCost: 400,
  policeSpawnDelay: 2.5,
  maxPoliceCars: 6,
  helicopterAtStars: 5,
};

// Health and damage numbers.
export const HEALTH = {
  max: 100,
  punchDamage: 18,
  carHitDamage: 25,
  policeRamDamage: 12,
  policePunchDamage: 8,
  regenPerSecond: 2,
};

// Cash rewards per job, in dollars. Side activities pay less.
export const REWARDS = {
  jobBase: [250, 300, 350, 400, 450, 600, 650, 700, 750, 800, 1200, 1300, 1400, 1500, 2500],
  taxiFare: 120,
  raceWin: 500,
  pickupBonus: 50,
};

// Camera and canvas.
export const CAMERA = {
  width: 1280,
  height: 800,
  followLerp: 6,
};

// Timing.
export const TIMING = {
  chaseSurviveSeconds: 60,
  fiveStarSurviveSeconds: 90,
  raceSeconds: 90,
  missionBannerSeconds: 3,
};
