// Deterministic PRNG. The same seed + same call sequence always yields the
// same stream. The world owns exactly one instance for its whole life.
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The world's own stream: same algorithm as mulberry32, but the state is
 * stored on the world object, so serializing the World captures the RNG too.
 */
export function worldRng(world: { rngState: number }): () => number {
  return function rng() {
    const a = (world.rngState + 0x6d2b79f5) | 0;
    world.rngState = a;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function range(rng: () => number, a: number, b: number) {
  return a + (b - a) * rng();
}

export function irange(rng: () => number, a: number, b: number) {
  return Math.floor(range(rng, a, b + 1));
}

export function chance(rng: () => number, p: number) {
  return rng() < p;
}
