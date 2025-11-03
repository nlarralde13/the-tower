import type { EnemyContract } from "@/engine/combat/types";

const acolyte: EnemyContract = {
  id: "acolyte",
  name: "Cult Acolyte",
  archetype: "Cunning",
  stats: {
    HP: 95,
    ATK: 12,
    DEF: 10,
    INT: 22,
    RES: 16,
    SPD: 12,
    LUCK: 12,
  },
  resources: {
    focus: 3,
  },
  items: [],
  actionPlan: [
    {
      actionId: "firebolt",
      weight: 0.5,
    },
    {
      actionId: "weaken",
      weight: 0.3,
    },
    {
      actionId: "defend",
      weight: 0.2,
      targeting: { type: "self" },
      boosterBias: "good",
    },
  ],
  tags: ["cultist"],
  loot: {
    profileId: "cultist",
  },
};

export default acolyte;

