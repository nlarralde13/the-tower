import type { ActionContract } from "@/engine/combat/types";

const scratch: ActionContract = {
  id: "scratch",
  identity: "scratch",
  version: 1,
  name: "Scratch",
  category: "attack",
  tags: ["physical", "bleed"],
  targeting: { type: "singleEnemy" },
  booster: "precision",
  power: {
    base: 12,
    variance: 0.05,
    critMult: 1.3,
  },
  statUse: {
    attack: "ATK",
    defense: "DEF",
  },
  hitModel: {
    canMiss: true,
    base: 0.88,
  },
  effects: [
    { type: "HitCheck", canMiss: true },
    { type: "Damage", element: "physical", variance: 0.05, allowCrit: true },
    {
      type: "ApplyStatus",
      statusId: "bleed",
      chance: 0.25,
      duration: 3,
      stacks: 1,
    },
  ],
  telemetry: {
    event: "action.scratch",
  },
};

export default scratch;

