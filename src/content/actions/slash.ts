import type { ActionContract } from "@/engine/combat/types";

const slash: ActionContract = {
  id: "slash",
  identity: "slash",
  version: 1,
  name: "Slash",
  category: "attack",
  tags: ["physical", "melee"],
  targeting: { type: "singleEnemy" },
  booster: "precision",
  power: {
    base: 2,
    variance: 0.1,
    critMult: 1.5,
  },
  statUse: {
    attack: "ATK",
    defense: "DEF",
  },
  hitModel: {
    canMiss: true,
    base: 0.9,
  },
  effects: [
    {
      type: "HitCheck",
      canMiss: true,
    },
    {
      type: "Damage",
      element: "physical",
      powerScale: 1,
      allowCrit: true,
      variance: 0.1,
    },
    {
      type: "OnBooster",
      outcomes: ["perfect"],
      effects: [
        {
          type: "BreakGuard",
          ratio: 0.2,
          duration: 1,
        },
      ],
    },
  ],
  telemetry: {
    event: "action.slash",
  },
};

export default slash;

