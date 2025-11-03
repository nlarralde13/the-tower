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

interface CombatStoreState {
  encounter: Encounter | null;
  queue: PlayerDecision[];
  lastResolution: Resolution | null;
  initiative: Encounter["initiative"] | null;
  activeSide: "player" | "enemy";
  beginEncounter: (
    enemies: Array<string | EnemyContract>,
    state: StartEncounterState,
    seed: string
  ) => void;
  commitPlayerDecision: (decision: PlayerDecision) => void;
  advanceTurn: () => void;
  getActiveSide: () => "player" | "enemy";
  endEncounter: () => void;
}

export const useCombatStore = create<CombatStoreState>((set, get) => ({
  encounter: null,
  queue: [],
  lastResolution: null,
  initiative: null,
  activeSide: "player",
  beginEncounter: (enemies, state, seed) => {
    const encounter = startEncounter(state, enemies, seed);
    const nextSide = encounter.initiative.first;
    set({
      encounter,
      queue: [],
      lastResolution: null,
      initiative: encounter.initiative,
      activeSide: nextSide,
    });
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
  },
  advanceTurn: () => {
    const encounter = get().encounter;
    if (!encounter) return;
    const update = takeTurn(encounter);
    const nextSide: "player" | "enemy" =
      get().activeSide === "player" ? "enemy" : "player";
    set({
      encounter: update.encounter,
      lastResolution: update.resolution,
      initiative: update.encounter.initiative,
      activeSide: nextSide,
    });
  },
  getActiveSide: () => get().activeSide,
  endEncounter: () => {
    set({
      encounter: null,
      queue: [],
      lastResolution: null,
      initiative: null,
      activeSide: "player",
    });
  },
}));
