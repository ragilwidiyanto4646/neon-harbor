// random.js — small seeded random number generator.
//
// The whole city is generated from one seed so the same seed always
// produces the same Neon Harbor. We use mulberry32, a tiny well-known
// PRNG, plus a few helpers so callers never touch raw Math.random()
// for anything that must be deterministic.

export function mulberry32(seed) {
  // Force the seed into an unsigned 32-bit integer.
  let state = seed >>> 0;

  return function next() {
    // The mulberry32 step. The magic constants are part of the
    // algorithm and are the same in every implementation.
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    const result = ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    return result;
  };
}

// A small wrapper object so game code can ask for ranges, integers,
// picks and shuffles without repeating the same arithmetic everywhere.
export class RNG {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.next = mulberry32(this.seed);
  }

  // A float in [0, 1).
  float() {
    return this.next();
  }

  // A float in [min, max).
  range(min, max) {
    return min + this.next() * (max - min);
  }

  // An integer in [min, max] inclusive.
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  // True with the given probability (0..1).
  chance(probability) {
    return this.next() < probability;
  }

  // Pick one element from an array.
  pick(list) {
    if (list.length === 0) {
      return undefined;
    }
    return list[Math.floor(this.next() * list.length)];
  }

  // Return a new array with the elements shuffled (Fisher-Yates).
  shuffle(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.next() * (i + 1));
      const temp = copy[i];
      copy[i] = copy[j];
      copy[j] = temp;
    }
    return copy;
  }

  // Pick one of two values, like a coin flip.
  either(a, b) {
    return this.next() < 0.5 ? a : b;
  }
}

// A one-off helper for code that only needs a single seeded value
// without keeping an RNG instance around.
export function seededValue(seed, min, max) {
  const rng = new RNG(seed);
  return rng.range(min, max);
}
