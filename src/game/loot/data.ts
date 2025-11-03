import catalogData from "@/game/content/loot/catalog.json";
import curvesData from "@/game/content/loot/globalCurves.json";
import profileData from "@/game/content/loot/enemyProfiles.json";
import bossData from "@/game/content/loot/bossTables.json";

import {
  LOOT_CATEGORIES,
  LOOT_RARITIES,
  type BossTables,
  type CatalogData,
  type LootCategory,
  type LootDefinition,
  type LootProfile,
  type LootProfiles,
  type LootRarity,
  type WeightedCurves,
} from "./types";

const catalogJson = catalogData as CatalogData;
const curvesJson = curvesData as WeightedCurves;
const profileJson = profileData as LootProfiles;
const bossJson = bossData as BossTables;

const catalogByCategory: Record<LootCategory | "uniques", LootDefinition[]> = {
  items: [],
  weapons: [],
  armor: [],
  potions: [],
  skills: [],
  currency: [],
  uniques: [],
};

const catalogById = new Map<string, LootDefinition>();

for (const category of [...LOOT_CATEGORIES, "uniques"] as const) {
  const entries = catalogJson[category] ?? [];
  for (const entry of entries) {
    const normalized: LootDefinition = {
      ...entry,
      category,
      weight: entry.weight ?? 1,
    };
    catalogByCategory[category].push(normalized);
    catalogById.set(normalized.id, normalized);
  }
}

const profileCache = new Map<string, LootProfile>();

function makeDefaultProfile(): LootProfile {
  const raw = profileJson.default ?? {
    name: "Default",
    dropChance: 0.5,
    rolls: 1,
  };
  return {
    id: "default",
    name: raw.name ?? "Default",
    dropChance: raw.dropChance ?? 0.5,
    rolls: raw.rolls ?? 1,
    rarityMultipliers: Object.fromEntries(
      LOOT_RARITIES.map(r => [r, raw.rarityMultipliers?.[r] ?? 1])
    ) as Record<LootRarity, number>,
    categoryMultipliers: Object.fromEntries(
      LOOT_CATEGORIES.map(c => [c, raw.categoryMultipliers?.[c] ?? 1])
    ) as Record<LootCategory, number>,
  };
}

const defaultProfile = makeDefaultProfile();
profileCache.set("default", defaultProfile);

function resolveProfile(id: string, stack: Set<string> = new Set()): LootProfile {
  if (profileCache.has(id)) return profileCache.get(id)!;
  const raw = profileJson[id];
  if (!raw) {
    profileCache.set(id, defaultProfile);
    return defaultProfile;
  }
  if (stack.has(id)) {
    throw new Error(`Circular loot profile inheritance detected: ${[...stack, id].join(" -> ")}`);
  }
  const parent = raw.inherits ? resolveProfile(raw.inherits, new Set(stack).add(id)) : defaultProfile;
  const resolved: LootProfile = {
    id,
    name: raw.name ?? parent.name,
    dropChance: raw.dropChance ?? parent.dropChance,
    rolls: raw.rolls ?? parent.rolls,
    rarityMultipliers: { ...parent.rarityMultipliers },
    categoryMultipliers: { ...parent.categoryMultipliers },
  };
  if (raw.rarityMultipliers) {
    for (const rarity of LOOT_RARITIES) {
      if (raw.rarityMultipliers[rarity] !== undefined) {
        resolved.rarityMultipliers[rarity] = raw.rarityMultipliers[rarity]!;
      }
    }
  }
  if (raw.categoryMultipliers) {
    for (const category of LOOT_CATEGORIES) {
      if (raw.categoryMultipliers[category] !== undefined) {
        resolved.categoryMultipliers[category] = raw.categoryMultipliers[category]!;
      }
    }
  }
  profileCache.set(id, resolved);
  return resolved;
}

export function getLootProfile(id?: string | null): LootProfile {
  if (!id) return defaultProfile;
  return resolveProfile(id);
}

export const catalog = catalogByCategory;
export const allLootDefinitions = Array.from(catalogById.values());
export const getLootDefinition = (id: string) => catalogById.get(id);
export const curves = curvesJson;
export const bossTables = bossJson;
