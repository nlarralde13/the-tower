import type { RNG } from "@/game/rng";

export type LootRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export const LOOT_RARITIES: LootRarity[] = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
];

export type LootCategory =
  | "items"
  | "weapons"
  | "armor"
  | "potions"
  | "skills"
  | "currency";

export const LOOT_CATEGORIES: LootCategory[] = [
  "items",
  "weapons",
  "armor",
  "potions",
  "skills",
  "currency",
];

export type QuantitySpec =
  | number
  | { min: number; max: number; perFloor?: number };

export type LootDefinition = {
  id: string;
  name: string;
  category: LootCategory | "uniques";
  rarity: LootRarity;
  minFloor: number;
  maxFloor: number;
  weight: number;
  description?: string;
  quantity?: QuantitySpec;
  unique?: boolean;
};

export type CatalogData = {
  [K in LootCategory | "uniques"]: Omit<LootDefinition, "category">[];
};

export type WeightedCurveNode<T extends string> = {
  floor: number;
  weights: Record<T, number>;
};

export type WeightedCurves = {
  rarity: WeightedCurveNode<LootRarity>[];
  category: WeightedCurveNode<LootCategory>[];
};

export type LootProfileData = {
  inherits?: string;
  name: string;
  dropChance?: number;
  rolls?: number;
  rarityMultipliers?: Partial<Record<LootRarity, number>>;
  categoryMultipliers?: Partial<Record<LootCategory, number>>;
};

export type LootProfiles = Record<string, LootProfileData>;

export type LootProfile = {
  id: string;
  name: string;
  dropChance: number;
  rolls: number;
  rarityMultipliers: Record<LootRarity, number>;
  categoryMultipliers: Record<LootCategory, number>;
};

export type BossChoice = {
  choose: number;
  options: BossLootOption[];
};

export type BossLootOption = {
  lootId: string;
  quantity?: QuantitySpec;
};

export type BossTable = {
  name: string;
  floorHint?: number;
  guaranteed: BossLootOption[];
  choices?: BossChoice[];
};

export type BossTables = Record<string, BossTable>;

export type ResolvedLootDefinition = LootDefinition & {
  quantity: number;
};

export type LootDrop = {
  id: string;
  name: string;
  rarity: LootRarity;
  category: LootCategory | "uniques";
  quantity: number;
  description?: string;
  source?: string;
};

export type LootResult = {
  source: { type: "enemy" | "boss"; id: string; profileId?: string };
  floor: number;
  seed: number;
  rolls: number;
  drops: LootDrop[];
  debug?: Record<string, unknown>;
};

export type LootContext = {
  runSeed: number;
  floor: number;
  sourceId: string;
  profileId?: string;
  encounterSerial?: number;
};

export type BossLootContext = {
  runSeed: number;
  floor: number;
  bossId: string;
  encounterSerial?: number;
};

export type WeightMap<T extends string> = Record<T, number>;

export type WeightSampler<T extends string> = (
  weights: WeightMap<T>,
  rng: RNG
) => T | null;
