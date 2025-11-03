import type { ActionContract } from "@/engine/combat/types";

const cringe: ActionContract = {
  id: "cringe",
  identity: "cringe",
  version: 1,
  name: "Cringe",
  category: "defend",
  tags: ["defensive"],
  targeting: { type: "self" },
  booster: "reaction",
  effects: [
    {
      type: "Guard",
      ratio: 0.15,
      duration: 1,
      breakOnHit: true,
    },
  ],
  telemetry: {
    event: "action.cringe",
  },
};

export default cringe;

