import { startEncounter } from "@/engine/combat/engine";

describe("item runtime", () => {
  it("grants actions and applies modifiers", () => {
    const encounter = startEncounter(
      {
        player: {
          id: "runner",
          name: "Runner",
          stats: {
            HP: 120,
            ATK: 25,
            DEF: 12,
            INT: 16,
            RES: 14,
            SPD: 18,
            LUCK: 8,
          },
          actions: ["defend"],
          items: ["starter-sword", "buckler"],
        },
        accessibility: {},
      },
      [],
      "item-test"
    );
    const player = encounter.entities.runner;
    const slash = player.actions.find((action) => action.contract.id === "slash");
    expect(slash).toBeDefined();
    expect(slash?.contract.power?.base).toBeGreaterThan(24);

    const defend = player.actions.find((action) => action.contract.id === "defend");
    expect(defend?.boosterTuning?.perfectWindow).toBeDefined();
  });
});

