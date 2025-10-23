/* eslint-disable no-bitwise */
// Tiny, deterministic, seedable RNG. Returns a float in [0, 1).

export type RNG = () => number;

/** Creates a Mulberry32 RNG from a 32-bit unsigned seed. */
export function createRNG(seed: number): RNG {
  // force to uint32
  let s = seed >>> 0;
  return function rng() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), (s | 1));
    t ^= t + Math.imul(t ^ (t >>> 7), (t | 61));
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Convenience: mix multiple integers into a single 32-bit seed. */
export function mixSeed(...parts: number[]): number {
  let x = 0x9E3779B9; // golden ratio constant
  for (const p of parts) {
    x ^= p + 0x9E3779B9 + ((x << 6) >>> 0) + (x >>> 2);
    x >>>= 0;
  }
  return x >>> 0;
}
