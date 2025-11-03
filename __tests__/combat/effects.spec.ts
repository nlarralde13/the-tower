import { runEffectPipeline } from "@/engine/combat/effects";
import {
  type ActionContract,
  type ActionResolutionEvent,
  type CombatEntity,
  type Encounter,
  type TelemetryRecord,
} from "@/engine/combat/types";
import { createSeededRNG } from "@/engine/rng";

const buildEntity = (overrides: Partial<CombatEntity>): CombatEntity => ({
  id: "entity",
  name: "Entity",
  faction: "player",
  stats: {
    HP: 100,
    ATK: 20,
    DEF: 10,
    INT: 10,
    RES: 10,
    SPD: 10,
    LUCK: 5,
  },
  resources: {},
  statuses: [],
  actions: [],
  items: [],
  guard: undefined,
  counter: undefined,
  alive: true,
  initiative: 10,
  aiProfile: undefined,
  aiPlan: undefined,
  ...overrides,
});

const buildEncounter = (actor: CombatEntity, target: CombatEntity): Encounter => {
  const rng = createSeededRNG("effects-test");
  return {
    id: "enc",
    seed: "enc",
    turn: 0,
    round: 1,
    order: [actor.id, target.id],
    activeIndex: 0,
    entities: {
      [actor.id]: actor,
      [target.id]: target,
    },
    rng,
    accessibility: {},
    initiative: { player: 10, enemy: 10, first: "player" },
    telemetry: [],
  };
};

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

describe("effect pipeline", () => {
  it("prevents damage when HitCheck fails", () => {
    const actor = buildEntity({ id: "attacker", faction: "player" });
    const target = buildEntity({ id: "target", faction: "enemy" });
    const encounter = buildEncounter(actor, target);
    const action: ActionContract = {
      id: "test-hitcheck",
      identity: "test-hitcheck",
      version: 1,
      name: "Test Hit",
      category: "attack",
      tags: [],
      targeting: { type: "singleEnemy" },
      effects: [
        { type: "HitCheck", canMiss: true, accuracy: 0 },
        { type: "Damage", element: "physical", flat: 25 },
      ],
    };
    const { bus } = createTelemetry();
    const result = runEffectPipeline({
      encounter,
      actorId: actor.id,
      targetIds: [target.id],
      action,
      booster: undefined,
      rng: encounter.rng,
      effects: action.effects,
      telemetry: bus,
    });
    expect(result.events.filter((event) => event.type === "damage")).toHaveLength(0);
    expect(result.encounter.entities[target.id].stats.HP).toBe(target.stats.HP);
  });

  it("applies OnBooster injected effects", () => {
    const actor = buildEntity({ id: "attacker", faction: "player" });
    const target = buildEntity({
      id: "target",
      faction: "enemy",
      guard: { ratio: 0.2, remaining: 1, breakOnHit: false },
    });
    const encounter = buildEncounter(actor, target);
    const action: ActionContract = {
      id: "test-onbooster",
      identity: "test-onbooster",
      version: 1,
      name: "Test Booster",
      category: "attack",
      tags: [],
      targeting: { type: "singleEnemy" },
      booster: "precision",
      effects: [
        { type: "OnBooster", outcomes: ["perfect"], effects: [{ type: "BreakGuard", ratio: 0.2, duration: 1 }] },
      ],
    };
    const { bus } = createTelemetry();
    const result = runEffectPipeline({
      encounter,
      actorId: actor.id,
      targetIds: [target.id],
      action,
      booster: {
        type: "precision",
        outcome: "perfect",
        roll: 0.99,
        damageMult: 1.3,
        critBonus: 0.2,
        statusBonus: 0.1,
        guardBonus: 0,
        reflectRatio: 0,
        comboHits: 1,
        counterChance: 0,
        metadata: { breakGuardChance: 0.2 },
      },
      rng: encounter.rng,
      effects: action.effects,
      telemetry: bus,
    });
    expect(result.encounter.entities[target.id].guard).toBeUndefined();
  });
});
