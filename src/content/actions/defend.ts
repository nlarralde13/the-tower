import type { ActionContract } from "@/engine/combat/types";

const defend: ActionContract = {
  id: "defend",
  identity: "defend",
  version: 1,
  name: "Defend",
  category: "defend",
  tags: ["defensive"],
  targeting: { type: "self" },
  booster: "reaction",
  effects: [
    {
      type: "Guard",
      ratio: 0.2,
      duration: 1,
      breakOnHit: false,
    },
    {
      type: "OnBooster",
      outcomes: ["perfect"],
      effects: [
        {
          type: "Counter",
          actionId: "slash",
          chance: 0.3,
          duration: 1,
        },
      ],
    },
  ],
  telemetry: {
    event: "action.defend",
  },
};

export default defend;

