"use client";

// Renders just the combat control pad. Reads directly from the run store.
// Avoids unstable selector identities and avoids creating new function refs.

import { useMemo } from "react";
import CombatConsole from "./CombatConsole";
import { useRunStore } from "@/store/runStore";

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
  const encounter = useRunStore((s) => s.activeCombat as any);
  const onActSel = useRunStore((s: any) => s.onAct || s.playerAct || s.enqueuePlayerAction || s.queueAction || s.combatAct);
  const lastResolution = useRunStore((s: any) => s.lastResolution);

  // Stable function reference (do not create a new one every render)
  const act = onActSel || noopAct;

  const inCombat = mode === "combat" && !!encounter;
  if (!inCombat) return null;

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

    const party = Array.isArray(enc.party)
      ? enc.party
      : Object.keys(entities).filter((id) => entities[id].isPlayer);
    const enemies = Array.isArray(enc.enemies)
      ? enc.enemies
      : Object.keys(entities).filter((id) => !entities[id].isPlayer);

    const order =
      Array.isArray(enc.order) && enc.order.length ? enc.order : [...party, ...enemies];

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

  return (
    <div className="control-pad" data-mode="combat">
      <div className="control-pad__surface">
        <CombatConsole
          vm={vm}
          skills={[]}
          items={[]}
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
