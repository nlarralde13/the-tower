import type { ItemContract } from "@/engine/combat/types";

const starterStaff: ItemContract = {
  id: "starter-staff",
  name: "Starter Staff",
  tags: ["starter", "focus"],
  grants: ["fireball"],
  modifiers: [
    {
      targetActionId: "fireball",
      powerDelta: 2,
    },
  ],
};

export default starterStaff;

