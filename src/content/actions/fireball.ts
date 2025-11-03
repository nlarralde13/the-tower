import type { ActionContract } from "@/engine/combat/types";

const fireball: ActionContract = {
  id: "fireball",
  identity: "fireball",
  version: 1,
  name: "Fireball",
  category: "spell",
  tags: ["spell", "fire"],
  cost: { focus: 1 },
  targeting: { type: "singleEnemy" },
  booster: "focus",
  power: {
    base: 22,
    variance: 0.15,
    critMult: 1.6,
  },
  statUse: {
    attack: "INT",
    defense: "RES",
  },
  hitModel: {
    canMiss: true,
    base: 0.88,
  },
  effects: [
    {
      type: "HitCheck",
      canMiss: true,
    },
    {
      type: "Damage",
      element: "fire",
      powerScale: 1,
      allowCrit: true,
      variance: 0.15,
    },
    {
      type: "ApplyStatus",
      statusId: "burn",
      chance: 0.3,
      duration: 2,
      stacks: 1,
    },
  ],
  telemetry: {
    event: "action.fireball",
  },
};

export default fireball;

