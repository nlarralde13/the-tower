import { create } from "zustand";
import {
  startEncounter,
  takeTurn,
  type StartEncounterState,
} from "@/engine/combat/engine";
import type {
  Encounter,
  EncounterUpdate,
  PlayerDecision,
  Resolution,
  EnemyContract,
} from "@/engine/combat/types";

const ENEMY_TURN_DELAY_MS = 900;

interface CombatStoreState {
  encounter: Encounter | null;
  queue: PlayerDecision[];
  lastResolution: Resolution | null;
  initiative: Encounter["initiative"] | null;
  activeSide: "player" | "enemy";
  beginEncounter: (
    enemies: Array<string | EnemyContract>,
    state: StartEncounterState,
    seed: string,
    options?: { forceFirst?: "player" | "enemy" }
  ) => void;
  commitPlayerDecision: (decision: PlayerDecision) => void;
  advanceTurn: () => void;
  getActiveSide: () => "player" | "enemy";
  forceEnemyAdvance: (delayMs?: number) => void;
  endEncounter: () => void;
}

export const useCombatStore = create<CombatStoreState>((set, get) => {
  let enemyTurnTimer: ReturnType<typeof setTimeout> | null = null;

  const clearEnemyTimer = () => {
    if (enemyTurnTimer) {
      clearTimeout(enemyTurnTimer);
      enemyTurnTimer = null;
    }
  };

  const scheduleEnemyTurn = (delay: number = ENEMY_TURN_DELAY_MS) => {
    clearEnemyTimer();
    const state = get();
    if (!state.encounter || state.activeSide !== "enemy") return;
    const actorId = state.encounter.order[state.encounter.activeIndex];
    const actor = actorId ? state.encounter.entities[actorId] : undefined;
    if (!actor || actor.faction !== "enemy") {
      // No enemy is queued to act; flip control back to the player and skip scheduling.
      set({ activeSide: "player" });
      return;
    }
    enemyTurnTimer = setTimeout(() => {
      enemyTurnTimer = null;
      const latest = get();
      if (!latest.encounter || latest.activeSide !== "enemy") {
        return;
      }
      latest.advanceTurn();
    }, delay);
  };

  const rotateOrderToFaction = (encounter: Encounter, faction: "player" | "enemy"): Encounter => {
    const targetId =
      faction === "player"
        ? encounter.order.find((id) => encounter.entities[id]?.faction === "player")
        : encounter.order.find((id) => {
            const entity = encounter.entities[id];
            return entity?.faction === "enemy" && entity.alive;
          });
    if (!targetId) {
      return {
        ...encounter,
        initiative: { ...encounter.initiative, first: faction },
      };
    }
    if (encounter.order[0] === targetId) {
      return {
        ...encounter,
        activeIndex: 0,
        initiative: { ...encounter.initiative, first: faction },
      };
    }
    const index = encounter.order.indexOf(targetId);
    if (index < 0) return encounter;
    const newOrder = [...encounter.order.slice(index), ...encounter.order.slice(0, index)];
    return {
      ...encounter,
      order: newOrder,
      activeIndex: 0,
      initiative: { ...encounter.initiative, first: faction },
    };
  };

  return {
    encounter: null,
    queue: [],
    lastResolution: null,
    initiative: null,
    activeSide: "player",
    beginEncounter: (enemies, state, seed, options) => {
      let encounter = startEncounter(state, enemies, seed);
      if (options?.forceFirst) {
        encounter = rotateOrderToFaction(encounter, options.forceFirst);
      }
      const nextSide = encounter.initiative.first;
      set({
        encounter,
        queue: [],
        lastResolution: null,
        initiative: encounter.initiative,
        activeSide: nextSide,
      });
      if (nextSide === "enemy") {
        scheduleEnemyTurn();
      } else {
        clearEnemyTimer();
      }
    },
    commitPlayerDecision: (decision) => {
      const encounter = get().encounter;
      if (!encounter) return;
      if (get().activeSide !== "player") return;
      const update: EncounterUpdate = takeTurn(encounter, decision);
      const nextSide: "player" | "enemy" =
        get().activeSide === "player" ? "enemy" : "player";
      set((current) => ({
        encounter: update.encounter,
        queue: [...current.queue, decision],
        lastResolution: update.resolution,
        initiative: update.encounter.initiative,
        activeSide: nextSide,
      }));
      if (nextSide === "enemy") {
        scheduleEnemyTurn();
      } else {
        clearEnemyTimer();
      }
    },
    advanceTurn: () => {
      const encounter = get().encounter;
      if (!encounter) return;
      const actorId = encounter.order[encounter.activeIndex];
      const actor = actorId ? encounter.entities[actorId] : undefined;
      if (!actor || actor.faction !== "enemy") {
        // Defensive guard: if an enemy turn was queued but no enemy is ready, stop the loop.
        clearEnemyTimer();
        set({ activeSide: "player" });
        return;
      }
      const update = takeTurn(encounter);
      const nextSide: "player" | "enemy" =
        get().activeSide === "player" ? "enemy" : "player";
      set({
        encounter: update.encounter,
        lastResolution: update.resolution,
        initiative: update.encounter.initiative,
        activeSide: nextSide,
      });
      if (nextSide === "enemy") {
        scheduleEnemyTurn();
      } else {
        clearEnemyTimer();
      }
    },
    getActiveSide: () => get().activeSide,
    forceEnemyAdvance: (delayMs = ENEMY_TURN_DELAY_MS) => {
      scheduleEnemyTurn(delayMs);
    },
    endEncounter: () => {
      clearEnemyTimer();
      set({
        encounter: null,
        queue: [],
        lastResolution: null,
        initiative: null,
        activeSide: "player",
      });
    },
  };
});
