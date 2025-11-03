"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCombatStore } from "@/state/combatStore";
import { useRunStore } from "@/store/runStore";
import type { CombatEntity, Encounter, Resolution } from "@/engine/combat/types";
import { getActionDefinition } from "@/content/index";
import { useHaptics } from "@/hooks/useHaptics";

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
  const activeCombat = useRunStore((state) => state.activeCombat);
  const logCombatEvents = useRunStore((state) => state.logCombatEvents);
  const { trigger: triggerHaptic } = useHaptics();

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
    if (lastResolution.events) {
      for (const event of lastResolution.events) {
        if (event.type !== "damage") continue;
        const target = getEntity(encounter, event.targetId);
        if (target?.faction === "enemy") {
          triggerHaptic("attack_hit");
        } else if (target?.faction === "player") {
          triggerHaptic("attack_taken");
        }
      }
    }
    logCombatEvents({
      encounterId: encounter.id,
      floor: activeCombat?.floor ?? 0,
      location: activeCombat
        ? { x: activeCombat.x, y: activeCombat.y }
        : undefined,
      lines: entries,
    });
  }, [lastResolution, encounter, logCombatEvents, activeCombat, triggerHaptic]);

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
      <section
        className="combat-console combat-console--empty"
        role="region"
        aria-label="Combat interface"
      >
        <p>No active encounter.</p>
      </section>
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
    <section
      className="combat-console"
      role="region"
      aria-label="Combat controls"
    >
      <header className="combat-console__header">
        <div className="combat-console__initiative">
          <div className="combat-console__label">Initiative</div>
          <div className="combat-console__value">
            {encounter.initiative.first === "player" ? "You act first" : "Enemies act first"}
          </div>
        </div>
        <div
          className={`combat-console__turn ${pending ? "is-pending" : ""}`}
          aria-live="polite"
        >
          {activeSide === "player"
            ? pending
              ? "Resolving..."
              : "Your turn"
            : "Enemy turn"}
        </div>
      </header>

      <div className="combat-console__panels">
        <div className="combat-console__panel combat-console__panel--player">
          <div className="combat-console__panel-heading">
            <span className="combat-console__panel-title">{player.name}</span>
            <span className="combat-console__panel-meta">HP: {player.stats.HP}</span>
          </div>
          <div className="combat-console__panel-meta">
            Focus: {player.resources?.focus ?? 0}
          </div>
          <div className="combat-console__section-label">Actions</div>
          <div className="combat-console__actions">
            {playerActions.map((action) => (
              <button
                key={action.contract.id}
                className="combat-console__action"
                onClick={() => handleAction(action.contract.id)}
                disabled={!canAct}
              >
                <span className="combat-console__action-name">{action.contract.name}</span>
                <span className="combat-console__action-meta">
                  {action.contract.category.toUpperCase()}
                </span>
              </button>
            ))}
            {playerActions.length === 0 && (
              <div className="combat-console__empty">No actions available.</div>
            )}
          </div>
        </div>

        <div className="combat-console__panel combat-console__panel--enemies">
          <div className="combat-console__panel-title">Opponents</div>
          {enemies.length === 0 && (
            <div className="combat-console__empty">No enemies detected.</div>
          )}
          {enemies.map((enemy) => (
            <div
              key={enemy.id}
              className={`combat-console__enemy ${enemy.alive ? "" : "is-defeated"}`}
            >
              <div className="combat-console__enemy-row">
                <span className="combat-console__enemy-name">{enemy.name}</span>
                <span className="combat-console__enemy-meta">HP: {Math.max(0, enemy.stats.HP)}</span>
              </div>
              <div className="combat-console__enemy-status">
                {enemy.alive ? "Active" : "Defeated"}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="combat-console__log">
        <div className="combat-console__section-label">Combat Log</div>
        <div className="combat-console__log-scroll" aria-live="polite">
          {log.length === 0 && (
            <div className="combat-console__empty">Awaiting actions...</div>
          )}
          {log.map((line, index) => (
            <div
              key={`${index}-${line}`}
              className="combat-console__log-line"
            >
              {line}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
