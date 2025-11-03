import type { ActionContract } from "@/engine/combat/types";

const bite: ActionContract = {
  id: "bite",
  identity: "bite",
  version: 1,
  name: "Bite",
  category: "attack",
  tags: ["physical", "melee"],
  targeting: { type: "singleEnemy" },
  booster: "precision",
  power: {
    base: 16,
    variance: 0.1,
    critMult: 1.4,
  },
  statUse: {
    attack: "ATK",
    defense: "DEF",
  },
  hitModel: {
    canMiss: true,
    base: 0.85,
  },
  effects: [
    { type: "HitCheck", canMiss: true },
    { type: "Damage", element: "physical", variance: 0.1, allowCrit: true },
  ],
  telemetry: {
    event: "action.bite",
  },
};

export default bite;

