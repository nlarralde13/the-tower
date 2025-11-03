import type { StatusContract } from "@/engine/combat/types";

const bleed: StatusContract = {
  id: "bleed",
  version: 1,
  type: "harmful",
  school: "physical",
  tags: ["dot", "bleed"],
  stacking: {
    mode: "stack",
    maxStacks: 5,
  },
  duration: {
    turns: 3,
    tickOn: ["turnEnd"],
  },
  effects: {
    turnEnd: [
      {
        type: "Damage",
        element: "physical",
        powerScale: 0.12,
        source: "status",
      },
    ],
  },
  cleansableBy: ["bleed-cleanse", "all"],
  caps: {
    onTick: 1,
  },
};

export default bleed;

