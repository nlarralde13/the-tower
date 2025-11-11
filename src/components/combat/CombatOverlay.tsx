"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useCombatStore } from "@/state/combatStore";
import { useUIStore } from "@/store/uiStore";
import { useRunStore } from "@/store/runStore";
import type { CombatEntity, StatusInstance, TelemetryRecord } from "@/engine/combat/types";

import CompactLog from "../console/HUD/CompactLog";
import Floaters from "../console/HUD/Floaters";
import "./combat.css";

const EMPTY_ORDER: string[] = [];
const EMPTY_ROWS: TelemetryRecord[] = [];
const EMPTY_LINES: string[] = [];
const PASSABLE_ROOM_TYPES = new Set(["entry","exit","boss","combat","trap","loot","out","special","empty"]);
type ExitDirection = "north" | "south" | "east" | "west";

interface CombatOverlayProps {
  active?: boolean;
  leaving?: boolean;
}

type StatSnapshot = {
  hp: number;
  focus?: number;
  stamina?: number;
};

export default function CombatOverlay({ active = false, leaving }: CombatOverlayProps) {
  const encounterOrder = useCombatStore((state) => state.encounter?.order);
  const activeIndex = useCombatStore((state) => state.encounter?.activeIndex ?? 0);
  const entities = useCombatStore((state) => state.encounter?.entities);
  const telemetry = useCombatStore((state) => state.encounter?.telemetry);
  const encounterId = useCombatStore((state) => state.encounter?.id ?? null);
  const initiative = useCombatStore((state) => state.initiative);
  const lastResolution = useCombatStore((state) => state.lastResolution);

  const setInputsDisabled = useUIStore((state) => state.setInputsDisabled);
  const combatSession = useRunStore((s) => s.combatSession);
  const completeCombat = useRunStore((s) => s.completeCombat);
  const resolveCombatExit = useRunStore((s) => s.resolveCombatExit);
  const grid = useRunStore((s) => s.grid);
  const playerPos = useRunStore((s) => s.playerPos);
  const activeCombat = useRunStore((s) => s.activeCombat);

  const [bannerText, setBannerText] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<string>("");
  const [lootCollected, setLootCollected] = useState(false);
  const [roomSearched, setRoomSearched] = useState(false);

  const bannerTimerRef = useRef<number | null>(null);
  const initiativeKeyRef = useRef<string | null>(null);
  const statCeilingRef = useRef<Map<string, StatSnapshot>>(new Map());
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const hudRef = useRef<HTMLDivElement | null>(null);
  const completionGuardRef = useRef(false);

  const getCeiling = useCallback(
    (entity: CombatEntity): StatSnapshot => {
      const cache = statCeilingRef.current;
      const previous = cache.get(entity.id);

      const hp = typeof previous?.hp === "number"
        ? Math.max(previous.hp, entity.stats.HP)
        : Math.max(1, entity.stats.HP);

      const focusCurrent = entity.resources?.focus;
      const focus =
        typeof focusCurrent === "number"
          ? typeof previous?.focus === "number"
            ? Math.max(previous.focus, focusCurrent)
            : focusCurrent
          : previous?.focus;

      const staminaCurrent = entity.resources?.stamina;
      const stamina =
        typeof staminaCurrent === "number"
          ? typeof previous?.stamina === "number"
            ? Math.max(previous.stamina, staminaCurrent)
            : staminaCurrent
          : previous?.stamina;

      const snapshot: StatSnapshot = { hp, focus, stamina };
      cache.set(entity.id, snapshot);
      return snapshot;
    },
    []
  );

  useEffect(() => {
    if (!active) return;
    document.body.dataset.combat = "1";
    return () => {
      delete document.body.dataset.combat;
    };
  }, [active]);

  useEffect(() => {
    if (!active) {
      if (bannerTimerRef.current) {
        window.clearTimeout(bannerTimerRef.current);
        bannerTimerRef.current = null;
      }
      setInputsDisabled(false);
      setBannerText(null);
      return;
    }
    return () => {
      if (bannerTimerRef.current) {
        window.clearTimeout(bannerTimerRef.current);
        bannerTimerRef.current = null;
      }
      setInputsDisabled(false);
    };
  }, [active, setInputsDisabled]);

  useEffect(() => {
    if (!active || !initiative || !encounterId) return;
    const key = `${encounterId}:${initiative.player}:${initiative.enemy}:${initiative.first}`;
    if (initiativeKeyRef.current === key) return;
    initiativeKeyRef.current = key;

    const actor = initiative.first === "player" ? "You" : "The enemy";
    const playerRoll = Number(initiative.player);
    const enemyRoll = Number(initiative.enemy);
    const message =
      Number.isFinite(playerRoll) && Number.isFinite(enemyRoll)
        ? `${actor} act first (${playerRoll} vs ${enemyRoll}).`
        : `${actor} act first.`;

    if (bannerTimerRef.current) {
      window.clearTimeout(bannerTimerRef.current);
    }

    setBannerText(message);
    setAnnouncement(message);
    setInputsDisabled(true);

    bannerTimerRef.current = window.setTimeout(() => {
      setBannerText(null);
      setInputsDisabled(false);
      bannerTimerRef.current = null;
    }, 1350);
  }, [active, encounterId, initiative, setInputsDisabled]);

  const order = useMemo(() => (active ? encounterOrder ?? EMPTY_ORDER : EMPTY_ORDER), [active, encounterOrder]);
  const entityMap = active && entities ? entities : {};
  const rows = active && telemetry ? telemetry : EMPTY_ROWS;

  useEffect(() => {
    if (!active || combatSession.status !== "ready" || !entities) {
      completionGuardRef.current = false;
      return;
    }
    const values = Object.values(entities);
    const enemiesAlive = values.some((entity) => entity.faction === "enemy" && entity.alive);
    const playersAlive = values.some((entity) => entity.faction === "player" && entity.alive);
    if (!enemiesAlive && playersAlive && !completionGuardRef.current) {
      completionGuardRef.current = true;
      completeCombat({ victory: true });
    } else if (!playersAlive && enemiesAlive && !completionGuardRef.current) {
      completionGuardRef.current = true;
      completeCombat({ victory: false });
    }
  }, [active, combatSession.status, completeCombat, entities]);

  const { allies, enemies } = useMemo(() => {
    if (!entities) {
      return { allies: [] as Array<{ entity: CombatEntity; ceiling: StatSnapshot }>, enemies: [] as Array<{ entity: CombatEntity; ceiling: StatSnapshot }> };
    }

    const ids = order.length ? order : Object.keys(entities);
    const seen = new Set<string>();
    const alliesList: Array<{ entity: CombatEntity; ceiling: StatSnapshot }> = [];
    const enemiesList: Array<{ entity: CombatEntity; ceiling: StatSnapshot }> = [];

    const pushEntity = (entity: CombatEntity) => {
      const entry = { entity, ceiling: getCeiling(entity) };
      if (entity.faction === "player") alliesList.push(entry);
      else enemiesList.push(entry);
    };

    for (const id of ids) {
      const entity = entities[id];
      if (!entity || seen.has(id)) continue;
      seen.add(id);
      pushEntity(entity);
    }

    for (const entity of Object.values(entities)) {
      if (seen.has(entity.id)) continue;
      pushEntity(entity);
    }

    return { allies: alliesList, enemies: enemiesList };
  }, [entities, getCeiling, order]);

  const activeId =
    order.length > 0 ? order[((activeIndex % order.length) + order.length) % order.length] : "";

  const labelFor = useCallback(
    (id: string) => {
      const entity: CombatEntity | undefined = entityMap[id];
      if (!entity) return id;
      return entity.faction === "player" ? `Player · ${entity.name}` : `Enemy · ${entity.name}`;
    },
    [entityMap]
  );

  const compactLines = useMemo(() => {
    if (!rows.length) return EMPTY_LINES;
    const next: string[] = [];
    for (const entry of rows as any[]) {
      if (entry && typeof entry.text === "string") {
        next.push(String(entry.text));
      }
    }
    return next.length ? next : EMPTY_LINES;
  }, [rows]);

  const combatActive = active || Boolean(leaving);
  const victoryPanelVisible =
    combatSession.status === "resolving" && combatSession.outcome === "victory";

  const exitAnchor = activeCombat
    ? { x: activeCombat.x, y: activeCombat.y }
    : playerPos
    ? { x: playerPos.x, y: playerPos.y }
    : null;

  const exitOptions = useMemo(() => {
    if (!grid || !exitAnchor) return [];
    const { width: W, height: H, cells } = grid;
    const probes: Array<{ dir: ExitDirection; x: number; y: number }> = [
      { dir: "north", x: exitAnchor.x, y: exitAnchor.y - 1 },
      { dir: "south", x: exitAnchor.x, y: exitAnchor.y + 1 },
      { dir: "west", x: exitAnchor.x - 1, y: exitAnchor.y },
      { dir: "east", x: exitAnchor.x + 1, y: exitAnchor.y },
    ];
    return probes.map((option) => {
      const inBounds = option.x >= 0 && option.y >= 0 && option.x < W && option.y < H;
      const cell = inBounds ? cells[option.y * W + option.x] : null;
      const available = Boolean(inBounds && cell && PASSABLE_ROOM_TYPES.has(cell.type));
      return { dir: option.dir, available };
    });
  }, [exitAnchor?.x, exitAnchor?.y, grid]);

  useEffect(() => {
    if (!victoryPanelVisible) {
      setLootCollected(false);
      setRoomSearched(false);
    }
  }, [victoryPanelVisible]);

  const handleLootCorpses = useCallback(() => {
    if (lootCollected) return;
    setLootCollected(true);
    setAnnouncement("You gather what valuables you can from the fallen.");
  }, [lootCollected]);

  const handleSearchRoom = useCallback(() => {
    if (roomSearched) return;
    setRoomSearched(true);
    setAnnouncement("You search the chamber. (Search effects coming soon.)");
  }, [roomSearched]);

  const handleExitSelection = useCallback(
    (dir: ExitDirection) => {
      resolveCombatExit(dir);
    },
    [resolveCombatExit]
  );

  const floaterTrigger = useMemo(() => {
    if (!rows.length) return undefined;
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      const event: any = rows[i];
      if (event && typeof event.dmg === "number") {
        const key = String(
          event.id ??
            event.key ??
            `${event.type ?? "hit"}:${event.actorId ?? "?"}:${(event.targetIds ?? []).join(",")}:${
              event.dmg
            }`
        );
        return {
          key,
          text: event.crit ? `★ ${event.dmg}` : `${event.dmg}`,
          crit: Boolean(event.crit),
          x: 0.5,
          y: 0.55,
        };
      }
    }
    return undefined;
  }, [rows]);

  useLayoutEffect(() => {
    const overlayNode = overlayRef.current;
    if (!overlayNode) return;

    const combatHost =
      (overlayNode.closest("[data-combat-host]") as HTMLElement | null) ??
      (overlayNode.closest(".play-middle") as HTMLElement | null);
    const combatRoot =
      (combatHost?.closest("[data-combat-root]") as HTMLElement | null) ??
      (overlayNode.closest(".play-root") as HTMLElement | null);
    if (!combatHost) return;

    let animationFrame = 0;

    const setMetrics = () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const railHeight = hudRef.current?.offsetHeight ?? 0;
        const padContainer = combatHost.querySelector(".actions-pad") as HTMLElement | null;
        const controlPad = combatHost.querySelector(".control-pad") as HTMLElement | null;
        const padHeight = Math.max(padContainer?.offsetHeight ?? 0, controlPad?.offsetHeight ?? 0);

        overlayNode.style.setProperty("--combat-rail-height", `${railHeight}px`);
        combatHost.style.setProperty("--combat-rail-height", `${railHeight}px`);
        if (combatRoot) {
          combatRoot.style.setProperty("--combat-rail-height", `${railHeight}px`);
        }

        overlayNode.style.setProperty("--controlpad-h", `${padHeight}px`);
        combatHost.style.setProperty("--controlpad-h", `${padHeight}px`);
        if (combatRoot) {
          combatRoot.style.setProperty("--controlpad-h", `${padHeight}px`);
        }
      });
    };

    setMetrics();

    if (typeof ResizeObserver === "undefined") {
      return () => {
        if (animationFrame) window.cancelAnimationFrame(animationFrame);
        overlayNode.style.removeProperty("--combat-rail-height");
        combatHost.style.removeProperty("--combat-rail-height");
        if (combatRoot) {
          combatRoot.style.removeProperty("--combat-rail-height");
        }
        overlayNode.style.removeProperty("--controlpad-h");
        combatHost.style.removeProperty("--controlpad-h");
        if (combatRoot) {
          combatRoot.style.removeProperty("--controlpad-h");
        }
      };
    }

    const resizeObserver = new ResizeObserver(() => {
      setMetrics();
    });

    resizeObserver.observe(combatHost);
    if (hudRef.current) resizeObserver.observe(hudRef.current);
    const padContainer = combatHost.querySelector(".actions-pad");
    if (padContainer) resizeObserver.observe(padContainer);

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      overlayNode.style.removeProperty("--combat-rail-height");
      combatHost.style.removeProperty("--combat-rail-height");
      if (combatRoot) {
        combatRoot.style.removeProperty("--combat-rail-height");
      }
      overlayNode.style.removeProperty("--controlpad-h");
      combatHost.style.removeProperty("--controlpad-h");
      if (combatRoot) {
        combatRoot.style.removeProperty("--controlpad-h");
      }
    };
  }, [combatActive]);

  useEffect(() => {
    if (!active || !lastResolution) return;
    const actorLabel = labelFor(lastResolution.actorId);
    const actionId = lastResolution.actionId ?? "action";
    setAnnouncement(`${actorLabel} used ${actionId}.`);
  }, [active, lastResolution, labelFor]);

  if (!combatActive) {
    return null;
  }

  return (
    <div
      ref={overlayRef}
      className={`combat-overlay${leaving ? " combat-overlay--leaving" : ""}`}
      data-active={combatActive ? "1" : undefined}
    >
      <div className="visually-hidden" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      {bannerText ? (
        <div className="combat-banner" role="status" aria-live="assertive">
          {bannerText}
        </div>
      ) : null}

      {victoryPanelVisible ? (
        <VictoryPanel
          lootCollected={lootCollected}
          roomSearched={roomSearched}
          exitOptions={exitOptions}
          onLoot={handleLootCorpses}
          onSearch={handleSearchRoom}
          onExit={handleExitSelection}
        />
      ) : null}

      <div className="combat-rail" data-active={combatActive ? "1" : undefined}>
        <div ref={hudRef} className="combat-hud">
          <div className="hud-card hud-left" id="hud-left">
            {allies.length ? (
              allies.map(({ entity, ceiling }) => (
                <HudEntityRow
                  key={entity.id}
                  entity={entity}
                  ceiling={ceiling}
                  isActive={entity.id === activeId}
                />
              ))
            ) : (
              <p className="hud-empty" aria-live="polite">No allies present.</p>
            )}
          </div>
          <div className="hud-card hud-right" id="hud-right">
            {enemies.length ? (
              enemies.map(({ entity, ceiling }) => (
                <HudEntityRow
                  key={entity.id}
                  entity={entity}
                  ceiling={ceiling}
                  isActive={entity.id === activeId}
                />
              ))
            ) : (
              <p className="hud-empty" aria-live="polite">No enemies detected.</p>
            )}
          </div>
        </div>
      </div>

      <div className="combat-root">
        <div className="combat-scene-overlay" id="scene-overlay">
          <CompactLog lines={compactLines} />
          <Floaters trigger={floaterTrigger} />
        </div>
      </div>
    </div>
  );
}

type MeterVariant = "hp" | "mp" | "st";

function HudEntityRow({
  entity,
  ceiling,
  isActive,
}: {
  entity: CombatEntity;
  ceiling: StatSnapshot;
  isActive?: boolean;
}) {
  const focusCurrent = entity.resources?.focus;
  const staminaCurrent = entity.resources?.stamina;
  const statusList = normalizeStatuses(entity.statuses);

  return (
    <div
      className={`entity-row${entity.alive ? "" : " entity-row--down"}`}
      data-active={isActive ? "true" : undefined}
    >
      <div className="entity-name">
        {entity.name}
        {!entity.alive ? <span className="entity-tag" aria-label="Knocked out">KO</span> : null}
      </div>
      <div className="meters" role="group" aria-label={`${entity.name} resources`}>
        <MeterRow label="HP" variant="hp" current={entity.stats.HP} max={ceiling.hp} />
        {typeof focusCurrent === "number" ? (
          <MeterRow label="MP" variant="mp" current={focusCurrent} max={ceiling.focus ?? focusCurrent} />
        ) : null}
        {typeof staminaCurrent === "number" ? (
          <MeterRow label="STA" variant="st" current={staminaCurrent} max={ceiling.stamina ?? staminaCurrent} />
        ) : null}
      </div>
      <div className="entity-status">
        {statusList.length ? (
          statusList.map((status) => (
            <span key={status.key} className="status-chip" title={status.fullLabel}>
              {status.label}
            </span>
          ))
        ) : (
          <span className="status-chip status-chip--empty">Ready</span>
        )}
      </div>
    </div>
  );
}

function MeterRow({ label, variant, current, max }: { label: string; variant: MeterVariant; current: number; max?: number }) {
  const safeMax = Math.max(1, Math.round(max ?? current ?? 0));
  const boundedCurrent = Math.max(0, Math.min(Math.round(current ?? 0), safeMax));
  const percent = Math.min(100, Math.max(0, Math.round((boundedCurrent / safeMax) * 100)));

  return (
    <div className="meter-row">
      <span className="meter-label" aria-hidden="true">{label}</span>
      <div
        className={`meter ${variant}`}
        role="progressbar"
        aria-valuenow={boundedCurrent}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-label={`${label} ${boundedCurrent} of ${safeMax}`}
      >
        <i style={{ width: `${percent}%` }} />
      </div>
      <span className="meter-value" aria-hidden="true">
        {boundedCurrent}/{safeMax}
      </span>
    </div>
  );
}

function normalizeStatuses(statuses: StatusInstance[] | undefined) {
  if (!statuses?.length) return [] as Array<{ key: string; label: string; fullLabel: string }>;
  return statuses
    .filter((status) => status.remaining !== 0)
    .slice(0, 4)
    .map((status) => {
      const baseLabel = formatStatus(status.statusId);
      const displayLabel = status.stacks > 1 ? `${baseLabel} ×${status.stacks}` : baseLabel;
      const fullLabel = `${baseLabel}${status.stacks > 1 ? ` (${status.stacks} stacks)` : ""}`;
      return {
        key: `${status.statusId}:${status.id ?? ""}`,
        label: displayLabel,
        fullLabel,
      };
    });
}

function formatStatus(statusId: string) {
  const cleaned = statusId.replace(/[_:-]+/g, " ").trim();
  return cleaned.replace(/\b\w/g, (m) => m.toUpperCase());
}

type VictoryExitOption = { dir: ExitDirection; available: boolean };

function VictoryPanel({
  lootCollected,
  roomSearched,
  exitOptions,
  onLoot,
  onSearch,
  onExit,
}: {
  lootCollected: boolean;
  roomSearched: boolean;
  exitOptions: VictoryExitOption[];
  onLoot: () => void;
  onSearch: () => void;
  onExit: (dir: ExitDirection) => void;
}) {
  return (
    <div className="victory-panel" role="dialog" aria-live="polite">
      <div>
        <div className="victory-panel__title">Room secured</div>
        <p className="victory-panel__subtitle">Collect spoils or move to your next target.</p>
      </div>

      <div className="victory-panel__primary">
        <button
          className={`btn ${lootCollected ? "btn--ghost" : "btn--primary"}`}
          type="button"
          onClick={onLoot}
          disabled={lootCollected}
        >
          {lootCollected ? "Loot collected" : "Loot the corpses"}
        </button>
        <button
          className="btn btn--ghost"
          type="button"
          onClick={onSearch}
          disabled={roomSearched}
        >
          {roomSearched ? "Room searched" : "Search the room"}
        </button>
      </div>

      <div>
        <div className="victory-panel__subtitle">Travel to another room</div>
        {exitOptions.length ? (
          <div className="victory-panel__exits">
            {exitOptions.map((option) => (
              <button
                key={option.dir}
                className="btn btn--ghost victory-panel__exit-btn"
                type="button"
                disabled={!option.available}
                onClick={() => onExit(option.dir)}
              >
                {option.dir.toUpperCase()}
              </button>
            ))}
          </div>
        ) : (
          <p className="victory-panel__empty">No exits available here.</p>
        )}
      </div>
    </div>
  );
}
