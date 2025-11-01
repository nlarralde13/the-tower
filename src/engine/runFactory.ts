// src/engine/runFactory.ts
import type { FloorSeed, FloorConfig, RoomRatios } from "@/types/tower";

// quick 32-bit RNG seed (or pass one in)
function randomSeed32() {
  // Using crypto if available; fallback is fine for dev.
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] >>> 0;
  }
  return Math.floor(Math.random() * 0xFFFFFFFF) >>> 0;
}

type RulesetFloor = {
  floor: number;
  options?: Partial<FloorSeed["options"]>;
  room_ratios: RoomRatios; // includes optional boss
  isFinalBossFloor?: boolean;
};

export function buildFloorSeedFromTemplate(
  floorTemplate: RulesetFloor,
  seed?: number
): FloorSeed {
  const {
    floor,
    options = {},
    room_ratios,
    isFinalBossFloor = false,
  } = floorTemplate;

  // Normalize open vs blocked if a caller prefers blockedFraction
  const opt = { ...options };
  if (opt["blockedFraction"] != null && opt["openFraction"] == null) {
    opt["openFraction"] = 1 - (opt["blockedFraction"] as number);
    delete (opt as any)["blockedFraction"];
  }

  return {
    floor,
    seed: seed ?? randomSeed32(),
    isFinalBossFloor,
    options: {
      // sensible fallbacks; keep your engine’s defaults minimal
      minEmptyFraction: 0.6,
      pathEmptyBias: 0.75,
      wiggle: 0.35,
      riverWidth: 1,
      ...opt,
    },
    roomRatios: {
      // include empty if your ruleset omits it; engine should tolerate missing keys
      empty: 0.0,
      ...room_ratios,
    },
  };
}

export function generateFloorForRun(
  floorTemplate: RulesetFloor,
  baseConfig: FloorConfig,
  generateFloorFromSeedImpl: (s: FloorSeed, c: FloorConfig) => any,
  seed?: number,
) {
  const floorSeed = buildFloorSeedFromTemplate(floorTemplate, seed);
  return generateFloorFromSeedImpl(floorSeed, baseConfig);
}
