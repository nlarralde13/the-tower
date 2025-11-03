import type {
  ActionContract,
  BoosterResult,
  CombatEntity,
  CombatStats,
  StatKey,
} from "@/engine/combat/types";
import type { SeededRNG } from "@/engine/rng";

export const constants = {
  baseHit: 0.9,
  baseCrit: 0.05,
  critLuckScale: 0.0025,
  hitLuckScale: 0.0015,
  guardBaseReduction: 0.2,
  varianceFloor: 0.75,
  varianceCeil: 1.25,
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export function hitChance(
  actor: CombatEntity,
  target: CombatEntity,
  action: ActionContract,
  booster?: BoosterResult
): number {
  const hitModel = action.hitModel;
  if (!hitModel || hitModel.canMiss === false) {
    return 1;
  }
  const accuracy = hitModel.base ?? constants.baseHit;
  const luckDelta = (actor.stats.LUCK - target.stats.LUCK) * constants.hitLuckScale;
  const bonus = booster ? booster.damageMult - 1 : 0;
  return clamp(accuracy + luckDelta + bonus * 0.1, 0, 1);
}

export function critChance(
  actor: CombatEntity,
  target: CombatEntity,
  action: ActionContract,
  booster?: BoosterResult
): number {
  const base = action.power?.critMult ? constants.baseCrit : 0;
  const luckDelta =
    (actor.stats.LUCK - target.stats.LUCK) * constants.critLuckScale;
  const boosterBonus = booster ? booster.critBonus : 0;
  return clamp(base + luckDelta + boosterBonus, 0, 1);
}

function offensiveStat(stats: CombatStats, key: StatKey) {
  return stats[key];
}

function defensiveStat(stats: CombatStats, key: StatKey) {
  return stats[key];
}

export interface DamageResult {
  amount: number;
  crit: boolean;
  blocked: boolean;
}

export function damage(
  actor: CombatEntity,
  target: CombatEntity,
  action: ActionContract,
  booster: BoosterResult | undefined,
  rng: SeededRNG,
  opts?: { powerScale?: number; variance?: number; guardRatio?: number }
): DamageResult {
  const power = action.power ?? { base: 0, variance: 0, critMult: 1.5 };
  const variance = opts?.variance ?? power.variance ?? 0;
  const scale = opts?.powerScale ?? 1;
  const offenseKey = action.statUse?.attack ?? "ATK";
  const defenseKey = action.statUse?.defense ?? "DEF";
  const offense = offensiveStat(actor.stats, offenseKey);
  const defense = defensiveStat(target.stats, defenseKey);
  const basePower = power.base * scale;
  const varianceRoll =
    1 + (rng.nextFloat() * 2 - 1) * clamp(variance, 0, 1);
  const boosterMult = booster ? booster.damageMult : 1;
  let raw = (basePower + offense) * varianceRoll * boosterMult - defense;
  raw = Math.max(0, raw);
  const critRoll = rng.nextFloat();
  const critThreshold = critChance(actor, target, action, booster);
  const isCrit = critRoll < critThreshold;
  if (isCrit) {
    raw = raw * (action.power?.critMult ?? 1.5) + offense * 0.1;
  }
  let blocked = false;
  const guardRatio = opts?.guardRatio ?? 0;
  if (guardRatio > 0) {
    raw = raw * clamp(1 - guardRatio, 0, 1);
    blocked = true;
  }
  return { amount: Math.round(raw), crit: isCrit, blocked };
}

export function statusRoll(
  actionChance: number,
  booster: BoosterResult | undefined,
  rng: SeededRNG
): boolean {
  const bonus = booster ? booster.statusBonus : 0;
  const threshold = clamp(actionChance + bonus, 0, 1);
  return rng.nextFloat() <= threshold;
}

export function turnOrder(
  entities: CombatEntity[],
  rng: SeededRNG
): string[] {
  const order = [...entities];
  order.sort((a, b) => {
    if (!a.alive && !b.alive) return 0;
    if (!a.alive) return 1;
    if (!b.alive) return -1;
    if (a.stats.SPD === b.stats.SPD) {
      return rng.nextFloat() < 0.5 ? -1 : 1;
    }
    return b.stats.SPD - a.stats.SPD;
  });
  return order.map((entity) => entity.id);
}

export interface InitiativeRolls {
  player: number;
  enemy: number;
}

export function rollInitiative(rng: SeededRNG): InitiativeRolls {
  return {
    player: rng.nextInt(1, 20),
    enemy: rng.nextInt(1, 20),
  };
}
