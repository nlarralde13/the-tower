"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCombatStore } from "@/state/combatStore";
import { useUIStore } from "@/store/uiStore";
import type { CombatEntity, StatusInstance, TelemetryRecord } from "@/engine/combat/types";

import TurnStrip from "../console/HUD/TurnStrip";
import CompactLog from "../console/HUD/CompactLog";
import Floaters from "../console/HUD/Floaters";
import EntityPanel, { type EntityStatusChip } from "../console/HUD/EntityPanel";

import "./combat.css";

const EMPTY_ORDER: string[] = [];
const EMPTY_ROWS: TelemetryRecord[] = [];
const EMPTY_LINES: string[] = [];

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

  const [bannerText, setBannerText] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<string>("");

  const bannerTimerRef = useRef<number | null>(null);
  const initiativeKeyRef = useRef<string | null>(null);
  const statCeilingRef = useRef<Map<string, StatSnapshot>>(new Map());

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

  const playerPanel = useMemo(() => {
    if (!allies.length) return null;
    const primary = allies.find((entry) => entry.entity.faction === "player") ?? allies[0];
    if (!primary) return null;

    const focus = typeof primary.entity.resources?.focus === "number" ? primary.entity.resources.focus : undefined;
    const stamina =
      typeof primary.entity.resources?.stamina === "number" ? primary.entity.resources.stamina : undefined;

    return {
      side: "left" as const,
      name: primary.entity.name,
      hp: primary.entity.stats.HP,
      hpMax: primary.ceiling.hp,
      mp: focus,
      mpMax: typeof primary.ceiling.focus === "number" ? primary.ceiling.focus : focus,
      sta: stamina,
      staMax: typeof primary.ceiling.stamina === "number" ? primary.ceiling.stamina : stamina,
      statuses: mapStatusesForPanel(primary.entity.statuses),
      isKO: !primary.entity.alive,
      regionLabel: "Player status",
    };
  }, [allies]);

  const enemyPanel = useMemo(() => {
    if (!enemies.length) return null;
    const activeEntity = activeId ? entities?.[activeId] : undefined;
    const activeEnemyEntry =
      activeEntity?.faction === "enemy"
        ? enemies.find((entry) => entry.entity.id === activeEntity.id)
        : undefined;

    const firstAlive = enemies.find((entry) => entry.entity.alive);
    const target = activeEnemyEntry ?? firstAlive ?? enemies[0];
    if (!target) return null;

    const focus = typeof target.entity.resources?.focus === "number" ? target.entity.resources.focus : undefined;
    const stamina =
      typeof target.entity.resources?.stamina === "number" ? target.entity.resources.stamina : undefined;

    return {
      side: "right" as const,
      name: target.entity.name,
      hp: target.entity.stats.HP,
      hpMax: target.ceiling.hp,
      mp: focus,
      mpMax: typeof target.ceiling.focus === "number" ? target.ceiling.focus : focus,
      sta: stamina,
      staMax: typeof target.ceiling.stamina === "number" ? target.ceiling.stamina : stamina,
      statuses: mapStatusesForPanel(target.entity.statuses),
      isKO: !target.entity.alive,
      regionLabel: "Enemy status",
    };
  }, [activeId, enemies, entities]);

  const hasStatsPanels = Boolean(playerPanel || enemyPanel);
  const showStatsRail = (active || leaving) && hasStatsPanels;
  const statsRailClassName = `stats-rail${active ? " stats-rail--visible" : ""}${leaving ? " stats-rail--leaving" : ""}`;

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

  useEffect(() => {
    if (!active || !lastResolution) return;
    const actorLabel = labelFor(lastResolution.actorId);
    const actionId = lastResolution.actionId ?? "action";
    setAnnouncement(`${actorLabel} used ${actionId}.`);
  }, [active, lastResolution, labelFor]);

  if (!active && !leaving) {
    return null;
  }

  return (
    <div className={`combat-overlay ${leaving ? "combat-overlay--leaving" : ""}`}>
      <div className="visually-hidden" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      {bannerText ? (
        <div className="combat-banner" role="status" aria-live="assertive">
          {bannerText}
        </div>
      ) : null}

      <div className="combat-root">
        <div className="combat-hud">
          <div className="hud-card hud-left" id="hud-left">
            {allies.length ? (
              allies.map(({ entity, ceiling }) => (
                <HudEntityRow key={entity.id} entity={entity} ceiling={ceiling} />
              ))
            ) : (
              <p className="hud-empty" aria-live="polite">No allies present.</p>
            )}
          </div>
          <div className="hud-card hud-right" id="hud-right">
            {enemies.length ? (
              enemies.map(({ entity, ceiling }) => (
                <HudEntityRow key={entity.id} entity={entity} ceiling={ceiling} />
              ))
            ) : (
              <p className="hud-empty" aria-live="polite">No enemies detected.</p>
            )}
          </div>
        </div>

        <div className="combat-scene-overlay" id="scene-overlay">
          {showStatsRail ? (
            <div className={statsRailClassName}>
              {playerPanel ? <EntityPanel {...playerPanel} /> : null}
              {enemyPanel ? <EntityPanel {...enemyPanel} /> : null}
            </div>
          ) : null}
          <TurnStrip order={order} activeId={activeId} labelFor={labelFor} />
          <CompactLog lines={compactLines} />
          <Floaters trigger={floaterTrigger} />
        </div>
      </div>
    </div>
  );
}

type MeterVariant = "hp" | "mp" | "st";

function HudEntityRow({ entity, ceiling }: { entity: CombatEntity; ceiling: StatSnapshot }) {
  const focusCurrent = entity.resources?.focus;
  const staminaCurrent = entity.resources?.stamina;
  const statusList = normalizeStatuses(entity.statuses);

  return (
    <div className={`entity-row${entity.alive ? "" : " entity-row--down"}`}>
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
      const { displayLabel, fullLabel } = describeStatus(status);
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

function mapStatusesForPanel(statuses: StatusInstance[] | undefined): EntityStatusChip[] {
  if (!statuses?.length) return [];
  return statuses
    .filter((status) => status.remaining !== 0)
    .map((status) => {
      const { displayLabel } = describeStatus(status);
      return {
        id: status.id ?? status.statusId,
        label: displayLabel,
      };
    });
}

function describeStatus(status: StatusInstance) {
  const baseLabel = formatStatus(status.statusId);
  const displayLabel = status.stacks > 1 ? `${baseLabel} ×${status.stacks}` : baseLabel;
  const fullLabel = `${baseLabel}${status.stacks > 1 ? ` (${status.stacks} stacks)` : ""}`;
  return { displayLabel, fullLabel };
}
