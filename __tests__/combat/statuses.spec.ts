import { startEncounter, takeTurn } from "@/engine/combat/engine";
import { applyStatus } from "@/engine/combat/statusRuntime";
import type { TelemetryRecord } from "@/engine/combat/types";

const createTelemetry = () => {
  const records: TelemetryRecord[] = [];
  return {
    bus: {
      push(record: TelemetryRecord) {
        records.push(record);
      },
    },
    records,
  };
};

describe("status runtime", () => {
  it("applies bleed damage on turn end", () => {
    let encounter = startEncounter(
      {
        player: {
          id: "runner",
          name: "Runner",
          stats: {
            HP: 100,
            ATK: 30,
            DEF: 12,
            INT: 10,
            RES: 10,
            SPD: 20,
            LUCK: 5,
          },
          actions: ["defend"],
        },
        accessibility: {},
      },
      [],
      "status-bleed"
    );
    const initialHP = encounter.entities.runner.stats.HP;
    const { bus } = createTelemetry();
    const applied = applyStatus(
      encounter,
      "runner",
      "bleed",
      encounter.rng,
      bus,
      { stacks: 2, duration: 2 }
    );
    encounter = applied.encounter;
    const update = takeTurn(encounter, {
      actionId: "defend",
      targetIds: ["runner"],
      boosterOutcome: "good",
    });
    const nextHP = update.encounter.entities.runner.stats.HP;
    expect(nextHP).toBeLessThan(initialHP);
    const statusDamage = update.resolution.events.filter(
      (event) => event.type === "damage" && event.source === "status"
    );
    expect(statusDamage.length).toBeGreaterThan(0);
  });

  it("burn ticks on turn start and detonates on expire", () => {
    let encounter = startEncounter(
      {
        player: {
          id: "runner",
          name: "Runner",
          stats: {
            HP: 100,
            ATK: 20,
            DEF: 12,
            INT: 12,
            RES: 12,
            SPD: 18,
            LUCK: 7,
          },
          actions: ["defend"],
        },
        accessibility: {},
      },
      [],
      "status-burn"
    );
    const initialHP = encounter.entities.runner.stats.HP;
    const { bus } = createTelemetry();
    const applied = applyStatus(
      encounter,
      "runner",
      "burn",
      encounter.rng,
      bus,
      { stacks: 1, duration: 1 }
    );
    encounter = applied.encounter;
    const update = takeTurn(encounter, {
      actionId: "defend",
      targetIds: ["runner"],
      boosterOutcome: "good",
    });
    const damageEvents = update.resolution.events.filter(
      (event) => event.type === "damage" && event.source === "status"
    );
    expect(damageEvents.length).toBeGreaterThanOrEqual(2);
    const nextHP = update.encounter.entities.runner.stats.HP;
    expect(nextHP).toBeLessThan(initialHP);
  });
});

