const UINT32_MAX = 0xffffffff;

export function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export type RNG = () => number;

export function createRNG(seed: number): RNG {
  return mulberry32(seed);
}

export function mixSeed(...parts: number[]): number {
  let x = 0x9e3779b9;
  for (const part of parts) {
    x ^= part + 0x9e3779b9 + ((x << 6) >>> 0) + (x >>> 2);
    x >>>= 0;
  }
  return x >>> 0;
}

export class SeededRNG {
  private readonly seed: number;
  private state: number;

  constructor(seed: number) {
    this.seed = seed >>> 0;
    this.state = this.seed || 1;
  }

  clone(): SeededRNG {
    const cloned = new SeededRNG(this.seed);
    cloned.state = this.state;
    return cloned;
  }

  nextFloat(): number {
    this.state += 0x6d2b79f5;
    let r = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  }

  nextInt(min: number, max: number): number {
    if (max < min) {
      throw new Error("Invalid range for nextInt");
    }
    const span = max - min + 1;
    return Math.floor(this.nextFloat() * span) + min;
  }

  nextBool(): boolean {
    return this.nextInt(0, 1) === 1;
  }

  shuffle<T>(items: T[]): T[] {
    const clone = [...items];
    for (let i = clone.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [clone[i], clone[j]] = [clone[j], clone[i]];
    }
    return clone;
  }
}

export function deriveNumericSeed(seed: string | number): number {
  if (typeof seed === "number") {
    return seed >>> 0;
  }
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createSeededRNG(seed: string | number): SeededRNG {
  return new SeededRNG(deriveNumericSeed(seed));
}

export function randInt(rng: RNG, min: number, max: number) {
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

export function forkRng(seed: string | number, offset: number | string): SeededRNG {
  const base = deriveNumericSeed(seed);
  const offsetValue = typeof offset === "number" ? offset : deriveNumericSeed(offset);
  return new SeededRNG((base + offsetValue) & UINT32_MAX);
}
