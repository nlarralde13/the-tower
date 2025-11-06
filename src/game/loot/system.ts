import { createRNG, mixSeed } from "@/engine/rng";

import {
  bossTables,
  catalog,
  curves,
  getLootDefinition,
  getLootProfile,
} from "./data";
import {
  LOOT_RARITIES,
  type BossLootContext,
  type BossLootOption,
  type LootCategory,
  type LootContext,
  type LootDrop,
  type LootProfile,
  type LootRarity,
  type LootResult,
  type QuantitySpec,
  type ResolvedLootDefinition,
  type WeightedCurveNode,
  type WeightMap,
} from "./types";

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (Math.imul(31, hash) + input.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

function weightsForFloor<T extends string>(
  nodes: WeightedCurveNode<T>[],
  floor: number
): WeightMap<T> {
  if (nodes.length === 0) throw new Error("No curve data defined");
  if (floor <= nodes[0].floor) return { ...nodes[0].weights };
  if (floor >= nodes[nodes.length - 1].floor) return { ...nodes[nodes.length - 1].weights };

  let lower = nodes[0];
  let upper = nodes[nodes.length - 1];
  for (let i = 0; i < nodes.length - 1; i += 1) {
    const a = nodes[i];
    const b = nodes[i + 1];
    if (floor >= a.floor && floor <= b.floor) {
      lower = a;
      upper = b;
      break;
    }
  }
  const span = Math.max(1, upper.floor - lower.floor);
  const t = Math.min(1, Math.max(0, (floor - lower.floor) / span));
  const result: Partial<WeightMap<T>> = {};
  for (const key of Object.keys(lower.weights) as T[]) {
    const lw = lower.weights[key] ?? 0;
    const uw = upper.weights[key] ?? lw;
    result[key] = lw + (uw - lw) * t;
  }
  return result as WeightMap<T>;
}

function applyMultipliers<T extends string>(
  weights: WeightMap<T>,
  multipliers: Record<T, number>
): WeightMap<T> {
  const result: Partial<WeightMap<T>> = {};
  for (const key of Object.keys(weights) as T[]) {
    const w = weights[key];
    const m = multipliers[key] ?? 1;
    result[key] = Math.max(0, w * m);
  }
  return result as WeightMap<T>;
}

function normalizeWeights<T extends string>(weights: WeightMap<T>): WeightMap<T> {
  const total = (Object.values(weights) as number[]).reduce((acc, v) => acc + v, 0);
  if (total <= 0) return weights;
  const result: Partial<WeightMap<T>> = {};
  for (const key of Object.keys(weights) as T[]) {
    result[key] = weights[key] / total;
  }
  return result as WeightMap<T>;
}

function sampleWeighted<T extends string>(weights: WeightMap<T>, rng: () => number): T | null {
  let total = 0;
  for (const key of Object.keys(weights) as T[]) {
    total += Math.max(0, weights[key]);
  }
  if (total <= 0) return null;
  let cursor = rng() * total;
  for (const key of Object.keys(weights) as T[]) {
    const weight = Math.max(0, weights[key]);
    if (weight <= 0) continue;
    if (cursor < weight) return key;
    cursor -= weight;
  }
  return null;
}

function computeEntryWeight(def: { weight: number; minFloor: number; maxFloor: number }, floor: number): number {
  const span = Math.max(1, def.maxFloor - def.minFloor);
  const progress = Math.min(1, Math.max(0, (floor - def.minFloor) / span));
  return Math.max(0, def.weight * (0.6 + progress * 0.8));
}

function resolveQuantity(
  quantity: QuantitySpec | undefined,
  fallback: QuantitySpec | undefined,
  floor: number,
  rng: () => number
): number {
  const spec = quantity ?? fallback;
  if (spec === undefined) return 1;
  if (typeof spec === "number") return Math.max(0, Math.floor(spec));
  const perFloor = spec.perFloor ?? 0;
  const floorBonus = Math.max(0, floor - 1) * perFloor;
  const min = Math.floor(spec.min + floorBonus);
  const max = Math.floor(spec.max + floorBonus);
  if (max <= min) return Math.max(0, min);
  const roll = rng();
  const value = Math.floor(min + roll * (max - min + 1));
  return Math.max(0, value);
}

function pickLootDefinition(
  category: LootCategory,
  rarity: LootRarity,
  floor: number,
  rng: () => number,
  minRarityIndex = 0
): ResolvedLootDefinition | null {
  const rarityIndex = LOOT_RARITIES.indexOf(rarity);
  if (rarityIndex === -1) return null;
  for (let i = rarityIndex; i >= minRarityIndex; i -= 1) {
    const targetRarity = LOOT_RARITIES[i];
    const pool = catalog[category].filter(def => {
      if (def.unique) return false;
      return (
        def.rarity === targetRarity &&
        floor >= def.minFloor &&
        floor <= def.maxFloor
      );
    });
    if (!pool.length) continue;
    const weights = pool.map(def => computeEntryWeight(def, floor));
    const total = weights.reduce((acc, value) => acc + value, 0);
    if (total <= 0) continue;
    let cursor = rng() * total;
    for (let idx = 0; idx < pool.length; idx += 1) {
      const weight = weights[idx];
      if (weight <= 0) continue;
      if (cursor < weight) {
        const quantity = resolveQuantity(undefined, pool[idx].quantity, floor, rng);
        return {
          ...pool[idx],
          quantity,
        };
      }
      cursor -= weight;
    }
  }
  return null;
}

function computeRollCount(rolls: number, rng: () => number): number {
  if (rolls <= 0) return 0;
  const base = Math.floor(rolls);
  const fractional = rolls - base;
  if (fractional > 0 && rng() < fractional) {
    return base + 1;
  }
  return base;
}

function formatDrop(def: ResolvedLootDefinition, source: string): LootDrop {
  return {
    id: def.id,
    name: def.name,
    rarity: def.rarity,
    category: def.category,
    quantity: Math.max(0, Math.floor(def.quantity)),
    description: def.description,
    source,
  };
}

export function generateEnemyLoot(ctx: LootContext): LootResult {
  const profile: LootProfile = getLootProfile(ctx.profileId ?? ctx.sourceId ?? "default");
  const seed = mixSeed(
    ctx.runSeed,
    ctx.floor,
    hashString(`enemy:${ctx.sourceId}`),
    ctx.encounterSerial ?? 0
  );
  const rng = createRNG(seed);

  const rarityWeights = applyMultipliers(
    weightsForFloor(curves.rarity, ctx.floor),
    profile.rarityMultipliers
  );
  const categoryWeights = applyMultipliers(
    weightsForFloor(curves.category, ctx.floor),
    profile.categoryMultipliers
  );

  const raritySampler = normalizeWeights(rarityWeights);
  const categorySampler = normalizeWeights(categoryWeights);

  const rollAttempts = computeRollCount(profile.rolls, rng);
  const drops: LootDrop[] = [];
  for (let i = 0; i < rollAttempts; i += 1) {
    const roll = rng();
    if (roll > profile.dropChance) {
      continue;
    }
    const rarity = sampleWeighted(raritySampler, rng) ?? "common";
    const category = sampleWeighted(categorySampler, rng);
    if (!category) continue;
    const def = pickLootDefinition(category, rarity, ctx.floor, rng);
    if (!def) continue;
    drops.push(formatDrop(def, `enemy:${ctx.sourceId}`));
  }

  const minimumRarityIndex = LOOT_RARITIES.indexOf("uncommon");
  if (minimumRarityIndex !== -1) {
    const hasUncommonOrBetter = drops.some(
      (drop) => LOOT_RARITIES.indexOf(drop.rarity) >= minimumRarityIndex
    );
    if (!hasUncommonOrBetter) {
      const preferredCategories: LootCategory[] = [];
      for (const drop of drops) {
        if (drop.category !== "uniques" && !preferredCategories.includes(drop.category as LootCategory)) {
          preferredCategories.push(drop.category as LootCategory);
        }
      }
      const weightedCategories = Object.entries(categoryWeights)
        .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
        .map(([key]) => key as LootCategory);
      for (const category of weightedCategories) {
        if (!preferredCategories.includes(category)) {
          preferredCategories.push(category);
        }
      }
      for (const category of Object.keys(catalog) as LootCategory[]) {
        if (!preferredCategories.includes(category)) {
          preferredCategories.push(category);
        }
      }

      let enforced = false;
      for (const category of preferredCategories) {
        for (let rarityIndex = LOOT_RARITIES.length - 1; rarityIndex >= minimumRarityIndex; rarityIndex -= 1) {
          const candidate = pickLootDefinition(
            category,
            LOOT_RARITIES[rarityIndex],
            ctx.floor,
            rng,
            minimumRarityIndex
          );
          if (candidate) {
            drops.push(formatDrop(candidate, `enemy:${ctx.sourceId}`));
            enforced = true;
            break;
          }
        }
        if (enforced) break;
      }
    }
  }

  return {
    source: { type: "enemy", id: ctx.sourceId, profileId: profile.id },
    floor: ctx.floor,
    seed,
    rolls: rollAttempts,
    drops,
  };
}

function resolveBossOption(
  option: BossLootOption,
  floor: number,
  rng: () => number
): ResolvedLootDefinition | null {
  const definition = getLootDefinition(option.lootId);
  if (!definition) return null;
  const quantity = resolveQuantity(option.quantity, definition.quantity, floor, rng);
  return {
    ...definition,
    quantity,
  };
}

export function generateBossLoot(ctx: BossLootContext): LootResult {
  const boss = bossTables[ctx.bossId];
  if (!boss) {
    throw new Error(`Unknown boss loot table: ${ctx.bossId}`);
  }
  const seed = mixSeed(
    ctx.runSeed,
    ctx.floor,
    hashString(`boss:${ctx.bossId}`),
    ctx.encounterSerial ?? 0
  );
  const rng = createRNG(seed);
  const drops: LootDrop[] = [];

  for (const guaranteed of boss.guaranteed ?? []) {
    const resolved = resolveBossOption(guaranteed, ctx.floor, rng);
    if (resolved) {
      drops.push(formatDrop(resolved, `boss:${ctx.bossId}`));
    }
  }

  for (const choice of boss.choices ?? []) {
    const pool = [...choice.options];
    const picks = Math.min(choice.choose, pool.length);
    for (let i = 0; i < picks; i += 1) {
      if (!pool.length) break;
      const index = Math.floor(rng() * pool.length);
      const option = pool.splice(index, 1)[0];
      const resolved = resolveBossOption(option, ctx.floor, rng);
      if (resolved) {
        drops.push(formatDrop(resolved, `boss:${ctx.bossId}`));
      }
    }
  }

  return {
    source: { type: "boss", id: ctx.bossId },
    floor: ctx.floor,
    seed,
    rolls: drops.length,
    drops,
  };
}
