import type { StatusContract } from "@/engine/combat/types";

const freeze: StatusContract = {
  id: "freeze",
  version: 1,
  type: "harmful",
  school: "ice",
  tags: ["control"],
  stacking: {
    mode: "replace",
    maxStacks: 1,
  },
  duration: {
    turns: 1,
    tickOn: ["turnEnd"],
    maxDurationPerFight: 2,
  },
  effects: {
    turnStart: [
      {
        type: "DelayTurn",
        percent: 0.3,
      },
    ],
    turnEnd: [
      {
        type: "BreakGuard",
        ratio: 0.2,
        duration: 1,
      },
    ],
  },
  caps: {
    onTick: 1,
  },
};

export default freeze;

