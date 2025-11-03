import type { ItemContract } from "@/engine/combat/types";

const buckler: ItemContract = {
  id: "buckler",
  name: "Training Buckler",
  tags: ["starter", "shield"],
  modifiers: [
    {
      targetActionId: "defend",
      boosterTweaks: {
        perfectWindow: 0.1,
      },
    },
  ],
};

export default buckler;

