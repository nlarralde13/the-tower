import type {
  AccessibilitySettings,
  BoosterOutcome,
  BoosterResolveParams,
  BoosterResult,
  BoosterType,
  BoosterTuning,
} from "@/engine/combat/types";

type Thresholds = [BoosterOutcome, number][];

const precisionThresholds: Thresholds = [
  ["miss", 0.05],
  ["poor", 0.35],
  ["good", 0.75],
  ["perfect", 1],
];

const focusThresholds: Thresholds = [
  ["miss", 0.07],
  ["poor", 0.4],
  ["good", 0.82],
  ["perfect", 1],
];

const reactionThresholds: Thresholds = [
  ["miss", 0.1],
  ["poor", 0.5],
  ["good", 0.85],
  ["perfect", 1],
];

const tuningReducer = (
  thresholds: Thresholds,
  tuning?: Partial<BoosterTuning>
): Thresholds => {
  if (!tuning) return thresholds;
  const { missWindow, poorWindow, goodWindow, perfectWindow } = tuning;
  const normalized: Record<BoosterOutcome, number> = {
    miss: thresholds[0][1],
    poor: thresholds[1][1],
    good: thresholds[2][1],
    perfect: thresholds[3][1],
  };
  if (typeof missWindow === "number") {
    normalized.miss = missWindow;
  }
  if (typeof poorWindow === "number") {
    normalized.poor = normalized.miss + Math.max(0, poorWindow);
  }
  if (typeof goodWindow === "number") {
    normalized.good = normalized.poor + Math.max(0, goodWindow);
  }
  if (typeof perfectWindow === "number") {
    normalized.perfect = normalized.good + Math.max(0, perfectWindow);
  }
  const total = normalized.perfect;
  return (["miss", "poor", "good", "perfect"] as BoosterOutcome[]).map(
    (key) => [key, normalized[key] / total] as [BoosterOutcome, number]
  );
};

function resolveFromThresholds(
  thresholds: Thresholds,
  roll: number
): BoosterOutcome {
  for (const [outcome, limit] of thresholds) {
    if (roll <= limit) {
      return outcome;
    }
  }
  return "perfect";
}

function buildResult(
  type: BoosterType,
  outcome: BoosterOutcome,
  roll: number
): BoosterResult {
  switch (type) {
    case "precision": {
      const table: Record<BoosterOutcome, BoosterResult> = {
        miss: {
          type,
          outcome,
          roll,
          damageMult: 0,
          critBonus: 0,
          statusBonus: -0.5,
          guardBonus: 0,
          reflectRatio: 0,
          comboHits: 0,
          counterChance: 0,
        },
        poor: {
          type,
          outcome,
          roll,
          damageMult: 0.85,
          critBonus: 0,
          statusBonus: -0.1,
          guardBonus: 0,
          reflectRatio: 0,
          comboHits: 0,
          counterChance: 0,
        },
        good: {
          type,
          outcome,
          roll,
          damageMult: 1.15,
          critBonus: 0.1,
          statusBonus: 0,
          guardBonus: 0,
          reflectRatio: 0,
          comboHits: 0,
          counterChance: 0,
        },
        perfect: {
          type,
          outcome,
          roll,
          damageMult: 1.3,
          critBonus: 0.2,
          statusBonus: 0.1,
          guardBonus: 0,
          reflectRatio: 0,
          comboHits: 1,
          counterChance: 0,
          metadata: { breakGuardChance: 0.2 },
        },
      };
      return table[outcome];
    }
    case "focus": {
      const table: Record<BoosterOutcome, BoosterResult> = {
        miss: {
          type,
          outcome,
          roll,
          damageMult: 0.75,
          critBonus: -0.05,
          statusBonus: -0.25,
          guardBonus: 0,
          reflectRatio: 0,
          comboHits: 0,
          counterChance: 0,
        },
        poor: {
          type,
          outcome,
          roll,
          damageMult: 0.9,
          critBonus: 0,
          statusBonus: -0.1,
          guardBonus: 0,
          reflectRatio: 0,
          comboHits: 0,
          counterChance: 0,
        },
        good: {
          type,
          outcome,
          roll,
          damageMult: 1,
          critBonus: 0.05,
          statusBonus: 0.1,
          guardBonus: 0,
          reflectRatio: 0,
          comboHits: 0,
          counterChance: 0,
        },
        perfect: {
          type,
          outcome,
          roll,
          damageMult: 1.1,
          critBonus: 0.1,
          statusBonus: 0.25,
          guardBonus: 0,
          reflectRatio: 0,
          comboHits: 0,
          counterChance: 0,
        },
      };
      return table[outcome];
    }
    case "reaction": {
      const table: Record<BoosterOutcome, BoosterResult> = {
        miss: {
          type,
          outcome,
          roll,
          damageMult: 0,
          critBonus: 0,
          statusBonus: 0,
          guardBonus: 0,
          reflectRatio: 0.05,
          comboHits: 0,
          counterChance: 0.05,
        },
        poor: {
          type,
          outcome,
          roll,
          damageMult: 0.5,
          critBonus: 0,
          statusBonus: 0,
          guardBonus: 0.1,
          reflectRatio: 0.1,
          comboHits: 0,
          counterChance: 0.1,
        },
        good: {
          type,
          outcome,
          roll,
          damageMult: 0.75,
          critBonus: 0,
          statusBonus: 0,
          guardBonus: 0.2,
          reflectRatio: 0.15,
          comboHits: 0,
          counterChance: 0.2,
        },
        perfect: {
          type,
          outcome,
          roll,
          damageMult: 1,
          critBonus: 0,
          statusBonus: 0,
          guardBonus: 0.4,
          reflectRatio: 0.2,
          comboHits: 0,
          counterChance: 0.3,
        },
      };
      return table[outcome];
    }
    default:
      return {
        type,
        outcome,
        roll,
        damageMult: 1,
        critBonus: 0,
        statusBonus: 0,
        guardBonus: 0,
        reflectRatio: 0,
        comboHits: 0,
        counterChance: 0,
      };
  }
}

function applyAccessibility(
  requested: BoosterOutcome | undefined,
  accessibility: AccessibilitySettings
): BoosterOutcome | undefined {
  if (requested) return requested;
  if (accessibility.autoGood) {
    return "good";
  }
  return undefined;
}

export function resolveBooster(
  type: BoosterType,
  params: BoosterResolveParams,
  accessibility: AccessibilitySettings
): BoosterResult {
  const forcedOutcome = applyAccessibility(params.requested, accessibility);
  if (forcedOutcome) {
    return buildResult(type, forcedOutcome, 1);
  }
  const roll = params.rng.nextFloat();
  let thresholds: Thresholds;
  switch (type) {
    case "precision":
      thresholds = tuningReducer(precisionThresholds, params.tuning);
      break;
    case "focus":
      thresholds = tuningReducer(focusThresholds, params.tuning);
      break;
    case "reaction":
      thresholds = tuningReducer(reactionThresholds, params.tuning);
      break;
    default:
      thresholds = precisionThresholds;
      break;
  }
  const outcome = resolveFromThresholds(thresholds, roll);
  return buildResult(type, outcome, roll);
}

export const boosterRegistry: Record<
  BoosterType,
  (params: BoosterResolveParams, accessibility: AccessibilitySettings) => BoosterResult
> = {
  precision: (params, accessibility) => resolveBooster("precision", params, accessibility),
  focus: (params, accessibility) => resolveBooster("focus", params, accessibility),
  reaction: (params, accessibility) => resolveBooster("reaction", params, accessibility),
};

