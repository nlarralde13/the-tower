"use client";

import React, { useCallback, useEffect, useMemo } from "react";
import { useCombatStore } from "@/state/combatStore";
import { useUIStore } from "@/store/uiStore";
import type { ActionInstance, CombatEntity } from "@/engine/combat/types";

const SKILL_CATEGORIES = new Set(["skill", "magic", "ability", "support"]);
const ITEM_CATEGORIES = new Set(["item", "consumable", "potion"]);
const DEFEND_CATEGORIES = new Set(["defend", "guard", "shield"]);
const FLEE_CATEGORIES = new Set(["flee", "escape"]);
const EMPTY_ACTIONS: ActionInstance[] = [];
const EMPTY_ENTITIES: CombatEntity[] = [];

type TargetTag = "single" | "multi" | "cleave" | "self";

function deriveTag(action: ActionInstance | null): TargetTag {
  if (!action) return "single";
  const targeting = action.contract.targeting?.type ?? "singleEnemy";
  switch (targeting) {
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

function deriveTargets(
  action: ActionInstance | null,
  player: CombatEntity | null,
  livingEnemies: CombatEntity[],
  allies: CombatEntity[]
): CombatEntity[] {
  if (!action) return EMPTY_ENTITIES;
  const targeting = action.contract.targeting?.type ?? "singleEnemy";
  switch (targeting) {
    case "self":
      return player ? [player] : EMPTY_ENTITIES;
    case "singleAlly":
    case "allAllies":
      return allies.length ? allies : player ? [player] : EMPTY_ENTITIES;
    case "singleEnemy":
    case "allEnemies":
    case "row":
    default:
      return livingEnemies;
  }
}

function pickAction(
  actions: ActionInstance[],
  predicate: (action: ActionInstance) => boolean
): ActionInstance | null {
  for (const action of actions) {
    if (predicate(action)) return action;
  }
  return null;
}

function ActionButton({
  label,
  onClick,
  disabled,
  badge,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  badge?: string | null;
}) {
  return (
    <button className="btn cmd" onClick={onClick} disabled={disabled}>
      <span>{label}</span>
      {badge ? <span className="cmd-badge">{badge}</span> : null}
    </button>
  );
}

function CombatPadInner() {
  const encounter = useCombatStore((state) => state.encounter);
  const commitDecision = useCombatStore((state) => state.commitPlayerDecision);
  const activeSide = useCombatStore((state) => state.getActiveSide());

  const inputsDisabled = useUIStore((s) => s.inputsDisabled);
  const menuDepth = useUIStore((s) => s.menuDepth);
  const menuPath = useUIStore((s) => s.menuPath);
  const selectedSkillId = useUIStore((s) => s.selectedSkillId);
  const selectedItemId = useUIStore((s) => s.selectedItemId);
  const selectedTargets = useUIStore((s) => s.selectedTargets);
  const pushMenu = useUIStore((s) => s.pushMenu);
  const popMenu = useUIStore((s) => s.popMenu);
  const resetMenus = useUIStore((s) => s.resetMenus);
  const setSelectedSkill = useUIStore((s) => s.setSelectedSkill);
  const setSelectedItem = useUIStore((s) => s.setSelectedItem);
  const toggleTarget = useUIStore((s) => s.toggleTarget);
  const clearTargets = useUIStore((s) => s.clearTargets);

  const player = useMemo<CombatEntity | null>(() => {
    if (!encounter) return null;
    return (
      Object.values(encounter.entities).find((entity) => entity.faction === "player") ?? null
    );
  }, [encounter]);

  const livingEnemies = useMemo<CombatEntity[]>(() => {
    if (!encounter) return EMPTY_ENTITIES;
    return Object.values(encounter.entities).filter(
      (entity) => entity.faction === "enemy" && entity.alive
    );
  }, [encounter]);

  const allies = useMemo<CombatEntity[]>(() => {
    if (!encounter) return player ? [player] : EMPTY_ENTITIES;
    const allyEntities = Object.values(encounter.entities).filter(
      (entity) => entity.faction === "player"
    );
    return allyEntities.length ? allyEntities : player ? [player] : EMPTY_ENTITIES;
  }, [encounter, player]);

  const playerActions = useMemo<ActionInstance[]>(() => player?.actions ?? EMPTY_ACTIONS, [player]);

  const attackAction = useMemo(
    () =>
      pickAction(playerActions, (a) => a.contract.category === "attack") ?? playerActions[0] ?? null,
    [playerActions]
  );

  const skillActions = useMemo(
    () => playerActions.filter((action) => SKILL_CATEGORIES.has(action.contract.category)),
    [playerActions]
  );

  const itemActions = useMemo(
    () => playerActions.filter((action) => ITEM_CATEGORIES.has(action.contract.category)),
    [playerActions]
  );

  const defendAction = useMemo(
    () => pickAction(playerActions, (action) => DEFEND_CATEGORIES.has(action.contract.category)),
    [playerActions]
  );

  const fleeAction = useMemo(
    () => pickAction(playerActions, (action) => FLEE_CATEGORIES.has(action.contract.category)),
    [playerActions]
  );

  const root = menuPath[0] ?? null;
  const atRoot = menuDepth === 0;
  const inSkills = root === "Skills" && menuDepth >= 1 && !menuPath.includes("Targets");
  const inItems = root === "Items" && menuDepth >= 1 && !menuPath.includes("Targets");
  const inTargets = menuPath.includes("Targets");

  const selectedSkill = useMemo(
    () => (selectedSkillId ? skillActions.find((action) => action.contract.id === selectedSkillId) ?? null : null),
    [skillActions, selectedSkillId]
  );

  const selectedItem = useMemo(
    () => (selectedItemId ? itemActions.find((action) => action.contract.id === selectedItemId) ?? null : null),
    [itemActions, selectedItemId]
  );

  const currentAction = useMemo<ActionInstance | null>(() => {
    if (root === "Attack") return attackAction;
    if (root === "Skills") return selectedSkill;
    if (root === "Items") return selectedItem;
    return null;
  }, [attackAction, root, selectedItem, selectedSkill]);

  const currentTag = useMemo(() => deriveTag(currentAction), [currentAction]);
  const availableTargets = useMemo(
    () => deriveTargets(currentAction, player, livingEnemies, allies),
    [currentAction, player, livingEnemies, allies]
  );

  useEffect(() => {
    if (!currentAction) return;
    if (currentTag !== "self") return;
    const selfId = player?.id;
    if (!selfId) return;
    if (selectedTargets.length === 1 && selectedTargets[0] === selfId) return;
    clearTargets();
    toggleTarget(selfId);
  }, [clearTargets, currentAction, currentTag, player, selectedTargets, toggleTarget]);

  const isPlayerTurn = activeSide === "player" && !inputsDisabled;

  const handleEnterAttack = useCallback(() => {
    if (!isPlayerTurn) return;
    resetMenus();
    setSelectedSkill(null);
    setSelectedItem(null);
    clearTargets();
    pushMenu("Attack");
    pushMenu("Targets");
  }, [clearTargets, isPlayerTurn, pushMenu, resetMenus, setSelectedItem, setSelectedSkill]);

  const handleEnterSkills = useCallback(() => {
    if (!isPlayerTurn) return;
    resetMenus();
    setSelectedItem(null);
    setSelectedSkill(null);
    clearTargets();
    pushMenu("Skills");
  }, [clearTargets, isPlayerTurn, pushMenu, resetMenus, setSelectedItem, setSelectedSkill]);

  const handleEnterItems = useCallback(() => {
    if (!isPlayerTurn) return;
    resetMenus();
    setSelectedSkill(null);
    setSelectedItem(null);
    clearTargets();
    pushMenu("Items");
  }, [clearTargets, isPlayerTurn, pushMenu, resetMenus, setSelectedItem, setSelectedSkill]);

  const executeAction = useCallback(
    (action: ActionInstance | null) => {
      if (!action || !commitDecision) return;
      const targeting = action.contract.targeting?.type ?? "singleEnemy";
      let targets: string[] = [];
      if (targeting === "self") {
        if (player?.id) targets = [player.id];
      } else if (selectedTargets.length) {
        targets = [...selectedTargets];
      } else if (livingEnemies.length) {
        targets = [livingEnemies[0].id];
      }
      if (!targets.length) return;
      commitDecision({
        actionId: action.contract.id,
        targetIds: targets,
        boosterOutcome: "good",
      });
      resetMenus();
      clearTargets();
      setSelectedSkill(null);
      setSelectedItem(null);
    },
    [
      clearTargets,
      commitDecision,
      livingEnemies,
      player,
      resetMenus,
      selectedTargets,
      setSelectedItem,
      setSelectedSkill,
    ]
  );

  const handleDefend = useCallback(() => {
    if (!isPlayerTurn || inputsDisabled) return;
    executeAction(defendAction);
  }, [defendAction, executeAction, inputsDisabled, isPlayerTurn]);

  const handleFlee = useCallback(() => {
    if (!isPlayerTurn || inputsDisabled) return;
    executeAction(fleeAction);
  }, [executeAction, fleeAction, inputsDisabled, isPlayerTurn]);

  const handleSkillSelect = useCallback(
    (action: ActionInstance) => {
      if (!isPlayerTurn) return;
      setSelectedItem(null);
      setSelectedSkill(action.contract.id);
      clearTargets();
      if (!menuPath.includes("Targets")) pushMenu("Targets");
    },
    [clearTargets, isPlayerTurn, menuPath, pushMenu, setSelectedItem, setSelectedSkill]
  );

  const handleItemSelect = useCallback(
    (action: ActionInstance) => {
      if (!isPlayerTurn) return;
      setSelectedSkill(null);
      setSelectedItem(action.contract.id);
      clearTargets();
      if (!menuPath.includes("Targets")) pushMenu("Targets");
    },
    [clearTargets, isPlayerTurn, menuPath, pushMenu, setSelectedItem, setSelectedSkill]
  );

  const handleTargetToggle = useCallback(
    (id: string) => {
      if (!isPlayerTurn) return;
      if (currentTag === "single" || currentTag === "self") {
        clearTargets();
        toggleTarget(id);
        return;
      }
      toggleTarget(id);
    },
    [clearTargets, currentTag, isPlayerTurn, toggleTarget]
  );

  const handleConfirmTargets = useCallback(() => {
    if (!isPlayerTurn || inputsDisabled) return;
    executeAction(currentAction);
  }, [currentAction, executeAction, inputsDisabled, isPlayerTurn]);

  const handleBackMenu = useCallback(() => {
    if (menuDepth === 0) return;
    popMenu();
    if (menuDepth <= 1) {
      clearTargets();
      setSelectedSkill(null);
      setSelectedItem(null);
    }
  }, [clearTargets, menuDepth, popMenu, setSelectedItem, setSelectedSkill]);

  const cooldownFor = useCallback((action: ActionInstance) => {
    const remaining = (action as any).cooldownRemaining as number | undefined;
    if (typeof remaining === "number" && remaining > 0) {
      return `${remaining.toFixed(0)}s`;
    }
    const base = action.contract.limits?.cooldown;
    if (typeof base === "number" && base > 0) {
      return `${base}s`;
    }
    return null;
  }, []);

  const canConfirm =
    !!currentAction &&
    (currentTag === "self" ? selectedTargets.length === 1 : selectedTargets.length > 0);

  return (
    <div className="pad-surface control-pad__surface" aria-disabled={!isPlayerTurn || inputsDisabled || undefined}>
      {atRoot && (
        <div className="cmd-row" role="group" aria-label="Combat commands">
          <ActionButton label="Attack" onClick={handleEnterAttack} disabled={!isPlayerTurn} />
          <ActionButton label="Skills" onClick={handleEnterSkills} disabled={!isPlayerTurn || !skillActions.length} />
          <ActionButton label="Items" onClick={handleEnterItems} disabled={!isPlayerTurn || !itemActions.length} />
          <ActionButton label="Defend" onClick={handleDefend} disabled={!isPlayerTurn || !defendAction} />
          <ActionButton label="Flee" onClick={handleFlee} disabled={!isPlayerTurn || !fleeAction} />
        </div>
      )}

      {inSkills && (
        <div className="submenu" role="menu" aria-label="Skills menu">
          {skillActions.length === 0 ? (
            <div className="h-subtle">No skills available.</div>
          ) : (
            skillActions.map((action) => (
              <button
                key={action.contract.id}
                className="btn"
                disabled={!isPlayerTurn}
                onClick={() => handleSkillSelect(action)}
              >
                <span>{action.contract.name}</span>
                {cooldownFor(action) ? <span className="cmd-badge">{cooldownFor(action)}</span> : null}
              </button>
            ))
          )}
          <button className="btn" onClick={handleBackMenu} disabled={!isPlayerTurn}>
            Back
          </button>
        </div>
      )}

      {inItems && (
        <div className="submenu" role="menu" aria-label="Items menu">
          {itemActions.length === 0 ? (
            <div className="h-subtle">No combat items available.</div>
          ) : (
            itemActions.map((action) => (
              <button
                key={action.contract.id}
                className="btn"
                disabled={!isPlayerTurn}
                onClick={() => handleItemSelect(action)}
              >
                <span>{action.contract.name}</span>
                {cooldownFor(action) ? <span className="cmd-badge">{cooldownFor(action)}</span> : null}
              </button>
            ))
          )}
          <button className="btn" onClick={handleBackMenu} disabled={!isPlayerTurn}>
            Back
          </button>
        </div>
      )}

      {inTargets && (
        <div className="submenu" aria-label="Target selection">
          <div className="targets" role="group" aria-label="Targets">
            {availableTargets.length === 0 ? (
              <div className="h-subtle">No valid targets.</div>
            ) : (
              availableTargets.map((entity) => {
                const selected = selectedTargets.includes(entity.id);
                return (
              <button
                key={entity.id}
                className={`btn target-chip${selected ? " is-selected" : ""}`}
                disabled={!isPlayerTurn}
                aria-pressed={selected}
                aria-selected={selected}
                onClick={() => handleTargetToggle(entity.id)}
              >
                    <span>{entity.name}</span>
                    <span className="target-meta">HP {entity.stats.HP}</span>
                  </button>
                );
              })
            )}
          </div>
          <div className="cmd-row" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <button className="btn btn--primary" onClick={handleConfirmTargets} disabled={!canConfirm || !isPlayerTurn}>
              Confirm
            </button>
            <button className="btn" onClick={handleBackMenu} disabled={!isPlayerTurn}>
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(CombatPadInner);

