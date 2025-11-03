"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCombatStore } from "@/state/combatStore";
import type { CombatEntity, Encounter, Resolution } from "@/engine/combat/types";
import { getActionDefinition } from "@/content/index";

function getEntity(encounter: Encounter | null, id: string) {
  if (!encounter) return null;
  return encounter.entities[id] ?? null;
}

function describeResolution(resolution: Resolution, encounter: Encounter | null): string[] {
  const lines: string[] = [];
  const actor = getEntity(encounter, resolution.actorId);
  const actorName = actor?.name ?? resolution.actorId;
  const actionName =
    getActionDefinition(resolution.actionId)?.name ?? resolution.actionId;
  const opener = resolution.booster
    ? `${actorName} used ${actionName} (${resolution.booster.outcome.toUpperCase()}).`
    : `${actorName} used ${actionName}.`;
  lines.push(opener);

  for (const event of resolution.events) {
    if (event.type === "damage") {
      const target = getEntity(encounter, event.targetId);
      const targetName = target?.name ?? event.targetId;
      const crit = event.crit ? " Critical hit!" : "";
      const blocked = event.blocked ? " (Guarded)" : "";
      lines.push(`${targetName} took ${event.amount} damage.${crit}${blocked}`);
    } else if (event.type === "status-apply") {
      const target = getEntity(encounter, event.targetId);
      const targetName = target?.name ?? event.targetId;
      lines.push(
        `${targetName} is affected by ${event.statusId} (${event.stacks} stack${
          event.stacks !== 1 ? "s" : ""
        }).`
      );
    } else if (event.type === "guard") {
      const target = getEntity(encounter, event.targetId);
      const targetName = target?.name ?? event.targetId;
      lines.push(
        `${targetName} gains ${Math.round(event.ratio * 100)}% guard for ${event.duration} turn${
          event.duration !== 1 ? "s" : ""
        }.`
      );
    } else if (event.type === "counter") {
      const target = getEntity(encounter, event.targetId);
      const targetName = target?.name ?? event.targetId;
      lines.push(
        `${targetName} prepares to counter ${Math.round(event.chance * 100)}% (${event.duration} turn${
          event.duration !== 1 ? "s" : ""
        }).`
      );
    } else if (event.type === "status-expire") {
      const target = getEntity(encounter, event.targetId);
      const targetName = target?.name ?? event.targetId;
      lines.push(`${event.statusId} expired on ${targetName}.`);
    }
  }

  return lines;
}

export default function CombatConsole() {
  const encounter = useCombatStore((state) => state.encounter);
  const lastResolution = useCombatStore((state) => state.lastResolution);
  const commitDecision = useCombatStore((state) => state.commitPlayerDecision);
  const advanceTurn = useCombatStore((state) => state.advanceTurn);
  const activeSide = useCombatStore((state) => state.getActiveSide());

  const [log, setLog] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const scheduledRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolutionKeyRef = useRef<string | null>(null);

  const player = useMemo<CombatEntity | null>(() => {
    if (!encounter) return null;
    return (
      Object.values(encounter.entities).find((entity) => entity.faction === "player") ??
      null
    );
  }, [encounter]);

  const enemies = useMemo<CombatEntity[]>(() => {
    if (!encounter) return [];
    return Object.values(encounter.entities).filter(
      (entity) => entity.faction === "enemy"
    );
  }, [encounter]);

  const encounterId = encounter?.id ?? null;

  useEffect(() => {
    resolutionKeyRef.current = null;
    setLog([]);
    setPending(false);
    if (scheduledRef.current) {
      clearTimeout(scheduledRef.current);
      scheduledRef.current = null;
    }
  }, [encounterId]);

  useEffect(() => {
    if (!lastResolution || !encounter) return;
    const key = `${lastResolution.actorId}:${lastResolution.actionId}:${lastResolution.events.length}:${lastResolution.telemetry.length}`;
    if (resolutionKeyRef.current === key) return;
    resolutionKeyRef.current = key;
    const entries = describeResolution(lastResolution, encounter);
    if (entries.length === 0) return;
    setLog((prev) => [...prev, ...entries].slice(-12));
  }, [lastResolution, encounter]);

    useEffect(() => {
    if (!encounter) {
      setPending(false);
      if (scheduledRef.current) {
        clearTimeout(scheduledRef.current);
        scheduledRef.current = null;
      }
      return;
    }

    const enemiesAlive = enemies.some((enemy) => enemy.alive);
    if (!enemiesAlive) {
      if (pending) setPending(false);
      if (scheduledRef.current) {
        clearTimeout(scheduledRef.current);
        scheduledRef.current = null;
      }
      return;
    }

    if (activeSide === "enemy") {
      if (!scheduledRef.current) {
        setPending(true);
        scheduledRef.current = setTimeout(() => {
          advanceTurn();
          scheduledRef.current = null;
        }, 500);
      }
    } else {
      if (scheduledRef.current) {
        clearTimeout(scheduledRef.current);
        scheduledRef.current = null;
      }
      if (pending) setPending(false);
    }

    return () => {
      if (scheduledRef.current && activeSide !== "enemy") {
        clearTimeout(scheduledRef.current);
        scheduledRef.current = null;
      }
    };
  }, [activeSide, advanceTurn, encounter, enemies, pending]);

  useEffect(() => {
    return () => {
      if (scheduledRef.current) {
        clearTimeout(scheduledRef.current);
        scheduledRef.current = null;
      }
    };
  }, []);

  if (!encounter || !player) {
    return (
      <div
        className="rounded-md border border-white/10 bg-black/60 p-4 text-sm text-white/80"
        role="group"
        aria-label="Combat console"
      >
        <p>No active encounter.</p>
      </div>
    );
  }

  const playerActions = player.actions ?? [];
  const livingEnemies = enemies.filter((enemy) => enemy.alive);
  const targetId = livingEnemies[0]?.id;
  const canAct = activeSide === "player" && !pending && !!targetId;

  const handleAction = (actionId: string) => {
    if (!canAct || !targetId) return;
    commitDecision({
      actionId,
      targetIds: [targetId],
      boosterOutcome: "good",
    });
    setPending(true);
  };

  return (
    <div
      className="rounded-md border border-white/10 bg-black/70 p-4 text-sm text-white"
      role="group"
      aria-label="Combat controls"
      style={{ display: "grid", gap: 16 }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.08, opacity: 0.8 }}>
            Initiative
          </div>
          <div style={{ fontWeight: 600 }}>
            {encounter.initiative.first === "player" ? "You act first" : "Enemies act first"}
          </div>
        </div>
        <div
          style={{
            padding: "4px 10px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.08)",
            fontSize: 12,
          }}
          aria-live="polite"
        >
          {activeSide === "player"
            ? pending
              ? "Resolving..."
              : "Your turn"
            : "Enemy turn"}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        }}
      >
        <div
          style={{
            background: "rgba(34,197,94,0.12)",
            borderRadius: 12,
            padding: 14,
            border: "1px solid rgba(34,197,94,0.35)",
            display: "grid",
            gap: 8,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 16 }}>{player.name}</div>
          <div style={{ fontSize: 13, opacity: 0.85 }}>HP: {player.stats.HP}</div>
          <div style={{ fontSize: 13, opacity: 0.85 }}>
            Focus: {player.resources?.focus ?? 0}
          </div>
          <div style={{ marginTop: 4, fontSize: 12, textTransform: "uppercase", opacity: 0.7 }}>
            Actions
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {playerActions.map((action) => (
              <button
                key={action.contract.id}
                onClick={() => handleAction(action.contract.id)}
                disabled={!canAct}
                style={{
                  borderRadius: 8,
                  padding: "8px 10px",
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: canAct ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.04)",
                  color: "inherit",
                  textAlign: "left",
                  cursor: canAct ? "pointer" : "not-allowed",
                }}
              >
                <div style={{ fontWeight: 600 }}>{action.contract.name}</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  {action.contract.category.toUpperCase()}
                </div>
              </button>
            ))}
            {playerActions.length === 0 && (
              <div style={{ fontSize: 12, opacity: 0.7 }}>No actions available.</div>
            )}
          </div>
        </div>

        <div
          style={{
            background: "rgba(239,68,68,0.1)",
            borderRadius: 12,
            padding: 14,
            border: "1px solid rgba(239,68,68,0.3)",
            display: "grid",
            gap: 8,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 16 }}>Opponents</div>
          {enemies.length === 0 && (
            <div style={{ fontSize: 12, opacity: 0.75 }}>No enemies detected.</div>
          )}
          {enemies.map((enemy) => (
            <div
              key={enemy.id}
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.1)",
                background: enemy.alive ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.5)",
                opacity: enemy.alive ? 1 : 0.6,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 600 }}>{enemy.name}</span>
                <span style={{ fontSize: 12 }}>
                  HP: {Math.max(0, enemy.stats.HP)}
                </span>
              </div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>
                {enemy.alive ? "Active" : "Defeated"}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.08)",
          paddingTop: 10,
          display: "grid",
          gap: 6,
        }}
      >
        <div style={{ fontSize: 12, textTransform: "uppercase", opacity: 0.7 }}>Combat Log</div>
        <div
          style={{
            maxHeight: 140,
            overflowY: "auto",
            display: "grid",
            gap: 4,
          }}
          aria-live="polite"
        >
          {log.length === 0 && (
            <div style={{ fontSize: 12, opacity: 0.6 }}>Awaiting actions...</div>
          )}
          {log.map((line, index) => (
            <div
              key={`${index}-${line}`}
              style={{
                fontSize: 12,
                lineHeight: 1.4,
                background: "rgba(255,255,255,0.05)",
                padding: "6px 8px",
                borderRadius: 6,
              }}
            >
              {line}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

