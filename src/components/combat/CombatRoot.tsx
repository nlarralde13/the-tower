"use client";

// Renders just the combat control pad. Reads directly from the run store.
// Avoids unstable selector identities and avoids creating new function refs.

import { useCallback, useMemo } from "react";
import CombatConsole from "./CombatConsole";
import { useRunStore } from "@/store/runStore";
import { useCombatStore } from "@/state/combatStore";
import type { ActionInstance, CombatEntity, TargetingMode } from "@/engine/combat/types";

type EntityVM = {
  id: string;
  name: string;
  isPlayer?: boolean;
  hp: number;
  hpMax: number;
  mp?: number;
  mpMax?: number;
  st?: number;
  stMax?: number;
  status?: string[];
};

const noopAct = (() => {}) as (a: unknown) => void;

export default function CombatRoot() {
  // Read each field separately so React/Zustand can compare by identity.
  const mode = useRunStore((s) => s.mode);
  const onActSel = useRunStore(
    (s: any) => s.onAct || s.playerAct || s.enqueuePlayerAction || s.queueAction || s.combatAct
  );
  const lastResolution = useRunStore((s: any) => s.lastResolution);

  const encounter = useCombatStore((s) => s.encounter);
  const commitDecision = useCombatStore((s) => s.commitPlayerDecision);

  const inCombat = mode === "combat" && !!encounter;
  if (!inCombat) return null;

  const playerEntity = useMemo<CombatEntity | null>(() => {
    if (!encounter) return null;
    return (
      Object.values(encounter.entities).find((entity) => entity.faction === "player") ?? null
    );
  }, [encounter]);

  const fallbackAct = useCallback(
    (payload: { type: string; id?: string; targets?: string[] }) => {
      if (!encounter || !playerEntity) return;
      const actions = playerEntity.actions ?? [];
      const findByCategory = (category: string) =>
        actions.find((instance) => instance.contract.category === category)?.contract.id;
      const findById = (id?: string) =>
        id ? actions.find((instance) => instance.contract.id === id)?.contract.id : undefined;

      let actionId: string | undefined;
      switch (payload.type) {
        case "Skill":
        case "Item":
          actionId = findById(payload.id);
          break;
        case "Defend":
          actionId = findByCategory("defend") ?? findById(payload.id);
          break;
        case "Flee":
          actionId = findByCategory("support") ?? findById(payload.id);
          break;
        case "Attack":
        default:
          actionId = findByCategory("attack") ?? findById(payload.id);
          break;
      }
      if (!actionId) return;

      let targets = payload.targets?.filter(Boolean) ?? [];
      if (!targets.length) {
        if (payload.type === "Defend") {
          targets = [playerEntity.id];
        } else {
          const fallbackTarget =
            encounter.order.find((id) => {
              const entity = encounter.entities[id];
              return entity?.faction === "enemy" && entity.alive;
            }) ?? playerEntity.id;
          targets = [fallbackTarget];
        }
      }
      commitDecision({
        actionId,
        targetIds: targets,
      });
    },
    [commitDecision, encounter, playerEntity]
  );

  const act = onActSel || fallbackAct || noopAct;

  const vm = useMemo(() => {
    const enc = encounter || {};
    const entities: Record<string, EntityVM> = {};
    const raw = enc.entities ?? {};

    for (const [id, e] of Object.entries<any>(raw)) {
      const hp = Number(e?.stats?.HP ?? 0);
      const hpMax = Number(e?.stats?.HPMax ?? e?.stats?.HP ?? 1) || 1;
      const focus = e?.resources?.focus;
      const stamina = e?.resources?.stamina;

      entities[id] = {
        id,
        name: String(e?.name ?? id),
        isPlayer: e?.faction === "player",
        hp,
        hpMax,
        mp: typeof focus === "number" ? focus : undefined,
        mpMax: typeof focus === "number" ? focus : undefined,
        st: typeof stamina === "number" ? stamina : undefined,
        stMax: typeof stamina === "number" ? stamina : undefined,
        status: Array.isArray(e?.statuses)
          ? e.statuses.map((s: any) => s?.statusId).filter(Boolean)
          : [],
      };
    }

    const party = Object.keys(entities).filter((id) => entities[id].isPlayer);
    const enemies = Object.keys(entities).filter((id) => !entities[id].isPlayer);

    const order = Array.isArray(enc.order) && enc.order.length ? enc.order : [...party, ...enemies];

    const turnOwnerId =
      Array.isArray(enc.order) && enc.order.length
        ? String(enc.order[enc.activeIndex ?? 0] ?? "")
        : "";

    return {
      id: String(enc.id ?? "encounter"),
      order,
      turnOwnerId,
      entities,
      enemies,
      party,
    };
  }, [encounter]);

  const skillOptions = useMemo(() => {
    if (!playerEntity?.actions) return [];
    return playerEntity.actions
      .filter(
        (action: ActionInstance) =>
          action.source !== "item" && action.contract.category !== "attack"
      )
      .map((action) => ({
        id: action.contract.id,
        name: action.contract.name,
        tag: targetingToTag(action.contract.targeting),
      }));
  }, [playerEntity]);

  const itemOptions = useMemo(() => {
    if (!playerEntity?.actions) return [];
    return playerEntity.actions
      .filter((action: ActionInstance) => action.source === "item")
      .map((action) => ({
        id: action.contract.id,
        name: action.contract.name,
        tag: targetingToTag(action.contract.targeting),
      }));
  }, [playerEntity]);

  return (
    <div className="control-pad" data-mode="combat">
      <div className="control-pad__surface">
        <CombatConsole
          vm={vm}
          skills={skillOptions}
          items={itemOptions}
          onAct={(action) => act(action)}
          lastResolution={
            lastResolution
              ? {
                  text: String(lastResolution?.text ?? ""),
                  targetId:
                    lastResolution?.targetId ??
                    (Array.isArray(lastResolution?.targetIds)
                      ? lastResolution?.targetIds?.[0]
                      : undefined),
                  crit: Boolean(lastResolution?.crit),
                  dmg:
                    typeof lastResolution?.dmg === "number"
                      ? lastResolution?.dmg
                      : undefined,
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}

function targetingToTag(targeting?: TargetingMode): "single" | "multi" | "cleave" | "self" {
  const type = targeting?.type;
  switch (type) {
    case "self":
      return "self";
    case "row":
      return "cleave";
    case "allEnemies":
    case "allAllies":
      return "multi";
    default:
      return "single";
  }
}
