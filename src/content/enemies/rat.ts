import type { EnemyContract } from "@/engine/combat/types";

const rat: EnemyContract = {
  id: "rat",
  name: "Dungeon Rat",
  archetype: "Aggressive",
  stats: {
    HP: 80,
    ATK: 18,
    DEF: 8,
    INT: 6,
    RES: 6,
    SPD: 14,
    LUCK: 6,
  },
  resources: {
    stamina: 0,
  },
  items: [],
  actionPlan: [
    {
      actionId: "scratch",
      weight: 0.4,
    },
    {
      actionId: "bite",
      weight: 0.4,
    },
    {
      actionId: "cringe",
      weight: 0.2,
      targeting: { type: "self" },
    },
  ],
  tags: ["beast"],
};

export default rat;

