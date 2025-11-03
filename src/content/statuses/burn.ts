import type { StatusContract } from "@/engine/combat/types";

const burn: StatusContract = {
  id: "burn",
  version: 1,
  type: "harmful",
  school: "fire",
  tags: ["dot", "fire"],
  stacking: {
    mode: "stack",
    maxStacks: 3,
  },
  duration: {
    turns: 3,
    tickOn: ["turnEnd"],
  },
  effects: {
    turnStart: [
      {
        type: "Damage",
        element: "fire",
        powerScale: 0.14,
        source: "status",
      },
    ],
    onExpire: [
      {
        type: "Detonate",
        statusId: "burn",
        powerScale: 0.2,
        removeStacks: true,
      },
    ],
  },
  cleansableBy: ["water"],
  caps: {
    onTick: 1,
    onExpire: 1,
  },
};

export default burn;
