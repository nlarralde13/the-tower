import type { ActionContract } from "@/engine/combat/types";

const firebolt: ActionContract = {
  id: "firebolt",
  identity: "firebolt",
  version: 1,
  name: "Firebolt",
  category: "spell",
  tags: ["spell", "fire"],
  targeting: { type: "singleEnemy" },
  booster: "focus",
  power: {
    base: 18,
    variance: 0.1,
    critMult: 1.5,
  },
  statUse: {
    attack: "INT",
    defense: "RES",
  },
  hitModel: {
    canMiss: true,
    base: 0.86,
  },
  effects: [
    { type: "HitCheck", canMiss: true },
    { type: "Damage", element: "fire", variance: 0.1, allowCrit: true },
    {
      type: "ApplyStatus",
      statusId: "burn",
      chance: 0.2,
      duration: 2,
      stacks: 1,
    },
  ],
  telemetry: {
    event: "action.firebolt",
  },
};

export default firebolt;

