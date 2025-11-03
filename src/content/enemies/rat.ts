import type { EnemyContract } from "@/engine/combat/types";

const rat: EnemyContract = {
  id: "rat",
  name: "Dungeon Rat",
  archetype: "Aggressive",
  stats: {
    HP: 25,
    ATK: 2,
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
  loot: {
    // Point this profileId at a different loot table to change rat drops.
    profileId: "slug",
  },
};

export default rat;

