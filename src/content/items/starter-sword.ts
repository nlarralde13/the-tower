import type { ItemContract } from "@/engine/combat/types";

const starterSword: ItemContract = {
  id: "starter-sword",
  name: "Starter Sword",
  tags: ["starter", "blade"],
  grants: ["slash"],
  modifiers: [
    {
      targetActionId: "slash",
      powerDelta: 3,
    },
  ],
};

export default starterSword;

