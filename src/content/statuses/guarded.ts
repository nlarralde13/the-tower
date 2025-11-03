import type { StatusContract } from "@/engine/combat/types";

const guarded: StatusContract = {
  id: "guarded",
  version: 1,
  type: "beneficial",
  school: "protection",
  tags: ["guard"],
  stacking: {
    mode: "refresh",
    maxStacks: 1,
  },
  duration: {
    turns: 1,
    tickOn: ["turnEnd"],
  },
  effects: {},
  caps: {
    turnEnd: 1,
  },
};

export default guarded;

