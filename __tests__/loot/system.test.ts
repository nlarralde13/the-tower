import { generateBossLoot, generateEnemyLoot } from "@/game/loot/system";
import { LOOT_RARITIES } from "@/game/loot/types";

describe("loot system", () => {
  it("generates deterministic loot for identical contexts", () => {
    const context = { runSeed: 123456, floor: 11, sourceId: "cultist" } as const;
    const first = generateEnemyLoot(context);
    const second = generateEnemyLoot(context);
    expect(second).toEqual(first);
  });

  it("respects loot profile tuning", () => {
    const seed = 424242;
    const floor = 18;
    const goblin = generateEnemyLoot({ runSeed: seed, floor, sourceId: "goblin" });
    const slug = generateEnemyLoot({ runSeed: seed, floor, sourceId: "slug" });
    expect(goblin.drops.length).toBeGreaterThanOrEqual(slug.drops.length);

    const rarityIndex = (drops: ReturnType<typeof generateEnemyLoot>["drops"]) =>
      drops.reduce((max, drop) => Math.max(max, LOOT_RARITIES.indexOf(drop.rarity)), 0);

    expect(rarityIndex(goblin.drops)).toBeGreaterThanOrEqual(rarityIndex(slug.drops));
  });

  it("awards handcrafted unique loot for bosses", () => {
    const result = generateBossLoot({ runSeed: 98765, floor: 15, bossId: "ember-queen" });
    const uniqueIds = result.drops.map(drop => drop.id);
    expect(uniqueIds).toContain("ember-heart");
    expect(uniqueIds.length).toBeGreaterThan(0);
  });
});
