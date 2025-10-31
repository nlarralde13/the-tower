import type { Ruleset, FloorGrid } from "@/types/tower";
import { mulberry32 } from "./rng";
import { generateFloor } from "./generateFloor";

/** Build a tower from a seed + ruleset object (already loaded/validated). */
export function generateTowerFromRuleset(seed: number, ruleset: Ruleset): { seed: number; floors: FloorGrid[] } {
  const rng = mulberry32(seed);
  const floors: FloorGrid[] = [];
  for (let i = 1; i <= ruleset.floor_count; i++) {
    const cfg = ruleset.floors[String(i)];
    const isFinal = i === ruleset.floor_count && !!ruleset.floors[String(i)]?.boss_room;
    const floor = generateFloor(rng, i, cfg, isFinal);
    floors.push(floor);
  }
  return { seed, floors };
}
