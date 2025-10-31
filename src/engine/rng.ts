// Lightweight deterministic RNG (Mulberry32) + helpers
export function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export type RNG = () => number;

export function randInt(rng: RNG, min: number, max: number) {
  // inclusive min, inclusive max
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function choice<T>(rng: RNG, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function shuffleInPlace<T>(rng: RNG, arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
