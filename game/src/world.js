// world.js — deterministic city generation for Neon Harbor.
//
// The city is a regular grid of roads with blocks between them. The
// south and east edges are coast: sand, then animated water. The
// harbor district has wooden docks reaching into the water. Buildings,
// trees and parked cars are placed from a seeded RNG, so the same seed
// always builds the same city.

import { WORLD, DISTRICTS, COLORS } from './config.js';
import { RNG } from './random.js';

export function generateWorld(seed) {
  const rng = new RNG(seed);
  const world = {
    seed,
    width: WORLD.width,
    height: WORLD.height,
    roads: [],
    buildings: [],
    trees: [],
    docks: [],
    parkedCars: [],
    lamps: [],
    // Named places the missions and side activities use as targets.
    places: {},
    // The beach is the sand strip along the south and east edges.
    beach: {
      south: { x: 0, y: WORLD.height - WORLD.beachWidth, w: WORLD.width, h: WORLD.beachWidth },
      east: { x: WORLD.width - WORLD.beachWidth, y: 0, w: WORLD.beachWidth, h: WORLD.height },
    },
    // Water sits beyond the beach on both coastal edges.
    water: {
      south: { x: 0, y: WORLD.height - 110, w: WORLD.width, h: 110 },
      east: { x: WORLD.width - 110, y: 0, w: 110, h: WORLD.height },
    },
  };

  buildRoads(world);
  buildBuildings(world, rng);
  buildTrees(world, rng);
  buildDocks(world, rng);
  buildParkedCars(world, rng);
  buildLamps(world, rng);
  buildPlaces(world);

  return world;
}

function buildRoads(world) {
  // Vertical roads at every grid line, horizontal roads at every
  // grid line. Roads run the full width/height of the map.
  for (let x = WORLD.roadSpacing; x < WORLD.width; x += WORLD.roadSpacing) {
    world.roads.push({ x: x - WORLD.roadWidth / 2, y: 0, w: WORLD.roadWidth, h: WORLD.height, vertical: true });
  }
  for (let y = WORLD.roadSpacing; y < WORLD.height; y += WORLD.roadSpacing) {
    world.roads.push({ x: 0, y: y - WORLD.roadWidth / 2, w: WORLD.width, h: WORLD.roadWidth, vertical: false });
  }
  // The outer ring road hugs the map edge so the player can always
  // drive around the city.
  world.roads.push({ x: 0, y: 0, w: WORLD.width, h: WORLD.roadWidth, vertical: false });
  world.roads.push({ x: 0, y: WORLD.height - WORLD.roadWidth, w: WORLD.width, h: WORLD.roadWidth, vertical: false });
  world.roads.push({ x: 0, y: 0, w: WORLD.roadWidth, h: WORLD.height, vertical: true });
  world.roads.push({ x: WORLD.width - WORLD.roadWidth, y: 0, w: WORLD.roadWidth, h: WORLD.height, vertical: true });
}

function buildBuildings(world, rng) {
  // One or two buildings per block, placed inside the block bounds
  // with a margin so sidewalks stay clear.
  const margin = 26;
  for (let bx = 0; bx < 9; bx += 1) {
    for (let by = 0; by < 7; by += 1) {
      const blockX = bx * WORLD.roadSpacing + WORLD.roadWidth;
      const blockY = by * WORLD.roadSpacing + WORLD.roadWidth;
      const blockW = WORLD.blockSize;
      const blockH = WORLD.blockSize;
      // Skip blocks that fall in the beach strip.
      if (blockY + blockH > WORLD.height - WORLD.beachWidth) {
        continue;
      }
      if (blockX + blockW > WORLD.width - WORLD.beachWidth) {
        continue;
      }
      const count = rng.chance(0.35) ? 2 : 1;
      for (let i = 0; i < count; i += 1) {
        const w = rng.range(70, 150);
        const h = rng.range(70, 150);
        const x = blockX + margin + rng.range(0, Math.max(1, blockW - w - margin * 2));
        const y = blockY + margin + rng.range(0, Math.max(1, blockH - h - margin * 2));
        const tall = rng.chance(0.22);
        world.buildings.push({
          x,
          y,
          w,
          h,
          color: rng.pick(COLORS.buildingRoof),
          floors: tall ? rng.int(6, 14) : rng.int(1, 3),
          tall,
          windows: buildWindows(rng, w, h),
        });
      }
    }
  }
}

function buildWindows(rng, w, h) {
  // A small grid of windows per building face. Each window remembers
  // whether it is lit, so night scenes can glow.
  const windows = [];
  const cols = Math.max(2, Math.floor(w / 26));
  const rows = Math.max(2, Math.floor(h / 26));
  for (let cx = 0; cx < cols; cx += 1) {
    for (let cy = 0; cy < rows; cy += 1) {
      windows.push({
        x: 8 + cx * 26,
        y: 8 + cy * 26,
        lit: rng.chance(0.45),
      });
    }
  }
  return windows;
}

function buildTrees(world, rng) {
  // Trees line the sidewalks and cluster in the park blocks.
  for (let i = 0; i < 220; i += 1) {
    const x = rng.range(40, WORLD.width - WORLD.beachWidth - 40);
    const y = rng.range(40, WORLD.height - WORLD.beachWidth - 40);
    if (isOnRoad(world, x, y)) {
      continue;
    }
    if (insideBuilding(world, x, y)) {
      continue;
    }
    world.trees.push({
      x,
      y,
      r: rng.range(9, 15),
      sway: rng.range(0, Math.PI * 2),
    });
  }
}

function buildDocks(world, rng) {
  // Wooden piers in the harbor district, reaching south into the water.
  for (let i = 0; i < 5; i += 1) {
    const x = 180 + i * 300 + rng.range(-20, 20);
    world.docks.push({
      x,
      y: WORLD.height - WORLD.beachWidth - 30,
      w: 46,
      h: WORLD.beachWidth + 60,
      planks: 9,
    });
  }
}

function buildParkedCars(world, rng) {
  // Parked cars sit along road edges. They can be stolen.
  const colors = ['#c23a3a', '#3a6ac2', '#d8c23a', '#3aa86a', '#8a8d94', '#e8e8e8', '#2a2a2a'];
  const models = ['sedan', 'sedan', 'sedan', 'sports', 'truck', 'taxi'];
  for (let i = 0; i < 34; i += 1) {
    const vertical = rng.chance(0.5);
    let x;
    let y;
    if (vertical) {
      x = WORLD.roadSpacing * rng.int(1, 8) + rng.either(-1, 1) * 34;
      y = rng.range(140, WORLD.height - 260);
    } else {
      x = rng.range(140, WORLD.width - 260);
      y = WORLD.roadSpacing * rng.int(1, 6) + rng.either(-1, 1) * 34;
    }
    world.parkedCars.push({
      x,
      y,
      angle: vertical ? Math.PI / 2 : 0,
      color: rng.pick(colors),
      model: rng.pick(models),
      owned: false,
    });
  }
}

function buildLamps(world, rng) {
  // Street lamps at intersections, for the night scene.
  for (let x = WORLD.roadSpacing; x < WORLD.width; x += WORLD.roadSpacing) {
    for (let y = WORLD.roadSpacing; y < WORLD.height; y += WORLD.roadSpacing) {
      if (rng.chance(0.8)) {
        world.lamps.push({ x: x + 62, y: y + 62 });
      }
    }
  }
}

function buildPlaces(world) {
  // Fixed, memorable locations the missions point at.
  world.places = {
    garage: { x: 480, y: 400, label: 'Garage' },
    docks: { x: 480, y: 2180, label: 'Docks' },
    chopShop: { x: 2720, y: 720, label: 'Chop Shop' },
    bank: { x: 1440, y: 400, label: 'Bank' },
    marina: { x: 320, y: 720, label: 'Marina' },
    pier: { x: 780, y: 2240, label: 'Pier' },
    causeway: { x: 1440, y: 1040, label: 'Causeway Bridge' },
    fixer: { x: 2080, y: 400, label: 'Fixer' },
    rivalDocks: { x: 1080, y: 2200, label: 'Rival Docks' },
    raceStart: { x: 480, y: 1040, label: 'Race Start' },
    taxiStand: { x: 800, y: 720, label: 'Taxi Stand' },
    spawn: { x: 480, y: 560, label: 'Spawn' },
  };
}

// True when the point is on a road surface.
export function isOnRoad(world, x, y) {
  for (const road of world.roads) {
    if (x >= road.x && x <= road.x + road.w && y >= road.y && y <= road.y + road.h) {
      return true;
    }
  }
  return false;
}

// True when the point is inside any building.
export function insideBuilding(world, x, y) {
  for (const building of world.buildings) {
    if (x >= building.x && x <= building.x + building.w && y >= building.y && y <= building.y + building.h) {
      return true;
    }
  }
  return false;
}

// True when the point is in the water (not swimmable — it blocks).
export function inWater(world, x, y) {
  const w = world.water;
  return (x >= w.south.x && x <= w.south.x + w.south.w && y >= w.south.y && y <= w.south.y + w.south.h)
    || (x >= w.east.x && x <= w.east.x + w.east.w && y >= w.east.y && y <= w.east.y + w.east.h);
}

// True when the point is on the beach sand.
export function onBeach(world, x, y) {
  const b = world.beach;
  return (x >= b.south.x && x <= b.south.x + b.south.w && y >= b.south.y && y <= b.south.y + b.south.h)
    || (x >= b.east.x && x <= b.east.x + b.east.w && y >= b.east.y && y <= b.east.y + b.east.h);
}

// The district containing a point, or 'Neon Harbor' as a fallback.
export function districtAt(x, y) {
  for (const district of DISTRICTS) {
    if (x >= district.x && x < district.x + district.w && y >= district.y && y < district.y + district.h) {
      return district.name;
    }
  }
  return 'Neon Harbor';
}

// Clamp a point inside the walkable map (not into the water).
export function clampToMap(world, x, y, margin) {
  const maxX = WORLD.width - 120 - margin;
  const maxY = WORLD.height - 120 - margin;
  return {
    x: Math.max(margin, Math.min(maxX, x)),
    y: Math.max(margin, Math.min(maxY, y)),
  };
}

// Find the nearest road center to a point (used by traffic AI).
export function nearestRoadCenter(world, x, y) {
  let best = null;
  let bestDistance = Infinity;
  for (const road of world.roads) {
    const cx = road.x + road.w / 2;
    const cy = road.y + road.h / 2;
    const dx = road.vertical ? x - cx : 0;
    const dy = road.vertical ? 0 : y - cy;
    const distance = Math.abs(dx) + Math.abs(dy);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { x: cx, y: cy, vertical: road.vertical };
    }
  }
  return best;
}
