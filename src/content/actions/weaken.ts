import type { ActionContract } from "@/engine/combat/types";

const weaken: ActionContract = {
  id: "weaken",
  identity: "weaken",
  version: 1,
  name: "Weaken",
  category: "support",
  tags: ["debuff"],
  targeting: { type: "singleEnemy" },
  booster: "focus",
  hitModel: {
    canMiss: true,
    base: 0.92,
  },
  effects: [
    { type: "HitCheck", canMiss: true },
    {
      type: "BreakGuard",
      ratio: 0.3,
      duration: 1,
    },
    {
      type: "DelayTurn",
      percent: 0.15,
    },
  ],
  telemetry: {
    event: "action.weaken",
  },
};

export default weaken;
