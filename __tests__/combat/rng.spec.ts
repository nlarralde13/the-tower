import { createSeededRNG } from "@/engine/rng";

describe("seeded rng", () => {
  it("produces deterministic sequences for same seed", () => {
    const rngA = createSeededRNG("seed");
    const rngB = createSeededRNG("seed");
    const sequenceA = [rngA.nextFloat(), rngA.nextFloat(), rngA.nextFloat()];
    const sequenceB = [rngB.nextFloat(), rngB.nextFloat(), rngB.nextFloat()];
    expect(sequenceA).toEqual(sequenceB);
  });

  it("shuffles identically when seeded", () => {
    const rng = createSeededRNG("shuffle");
    const values = [1, 2, 3, 4, 5];
    const resultA = rng.shuffle(values);
    const rng2 = createSeededRNG("shuffle");
    const resultB = rng2.shuffle(values);
    expect(resultA).toEqual(resultB);
  });
});

