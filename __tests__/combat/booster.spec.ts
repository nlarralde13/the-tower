import { resolveBooster } from "@/engine/combat/booster";
import { createSeededRNG } from "@/engine/rng";

describe("booster resolution", () => {
  it("precision perfect beats good damage multiplier", () => {
    const rng = createSeededRNG("booster-precision");
    const good = resolveBooster(
      "precision",
      { rng, requested: "good" },
      { autoGood: false }
    );
    const perfect = resolveBooster(
      "precision",
      { rng, requested: "perfect" },
      { autoGood: false }
    );
    expect(perfect.damageMult).toBeGreaterThan(good.damageMult);
    expect(perfect.critBonus).toBeGreaterThanOrEqual(good.critBonus);
  });

  it("focus maps status bonus by outcome", () => {
    const rng = createSeededRNG("booster-focus");
    const miss = resolveBooster("focus", { rng, requested: "miss" }, {});
    const perfect = resolveBooster(
      "focus",
      { rng, requested: "perfect" },
      {}
    );
    expect(miss.statusBonus).toBeLessThan(0);
    expect(perfect.statusBonus).toBeGreaterThan(miss.statusBonus);
  });

  it("accessibility autoGood overrides roll", () => {
    const rng = createSeededRNG("booster-access");
    const result = resolveBooster("precision", { rng }, { autoGood: true });
    expect(result.outcome).toBe("good");
  });
});

