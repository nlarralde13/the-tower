"use client";

import "./play.desktop.css";
import "./play.mobile.css";
import "./combat.page.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageSurface from "@/components/PageSurface";
import SceneViewer from "@/components/SceneViewer";
import CombatOverlay from "@/components/combat/CombatOverlay";
import CombatRoot from "@/components/combat/CombatRoot";
import { useRunStore } from "@/store/runStore";
import { useUIStore } from "@/store/uiStore";
import { useCombatStore } from "@/state/combatStore";
import { enemies as enemyCatalog, items as itemCatalog, getEnemyDefinition } from "@/content";
import type { FloorGrid, RoomType } from "@/types/tower";
import type { StartEncounterState } from "@/engine/combat/engine";
import type { Resolution } from "@/engine/combat/types";

const PLAYER_POS = { x: 3, y: 3 };

const SANDBOX_GRID: FloorGrid = (() => {
  const width = 8;
  const height = 6;
  const cells = Array.from({ length: width * height }, (_, index) => {
    const x = index % width;
    const y = Math.floor(index / width);
    let type: RoomType = "empty";
    if (x === 0 && y === height - 1) type = "entry";
    if (x === width - 1 && y === 0) type = "exit";
    if (x === PLAYER_POS.x && y === PLAYER_POS.y) type = "combat";
    return { x, y, type };
  });
  return {
    width,
    height,
    cells,
    entry: { x: 0, y: height - 1 },
    exit: { x: width - 1, y: 0 },
  };
})();

const SCENE_PRESETS = [
  { id: "entry/entry_default.png", label: "Entry · Default" },
  { id: "entry/empty_main.png", label: "Entry · Empty" },
];

const ROOM_TYPES: RoomType[] = ["entry", "combat", "trap", "loot", "special", "empty", "out"];

type HeroStatsConfig = {
  HP: number;
  ATK: number;
  DEF: number;
  INT: number;
  RES: number;
  SPD: number;
  LUCK: number;
};

type HeroConfig = {
  name: string;
  stats: HeroStatsConfig;
  focus: number;
  stamina: number;
  autoGood: boolean;
  items: string[];
};

type SandboxConfig = {
  sceneId: string;
  roomType: RoomType;
  floor: number;
  showOverlay: boolean;
  firstStrike: "player" | "enemy";
  enemyIdsText: string;
  hero: HeroConfig;
};

const DEFAULT_HERO_STATS: HeroStatsConfig = {
  HP: 120,
  ATK: 22,
  DEF: 14,
  INT: 16,
  RES: 12,
  SPD: 18,
  LUCK: 10,
};

const DEFAULT_CONFIG: SandboxConfig = {
  sceneId: SCENE_PRESETS[0]?.id ?? "entry/entry_default.png",
  roomType: "combat",
  floor: 1,
  showOverlay: false,
  firstStrike: "player",
  enemyIdsText: "rat",
  hero: {
    name: "Sandbox Runner",
    stats: { ...DEFAULT_HERO_STATS },
    focus: 3,
    stamina: 3,
    autoGood: true,
    items: ["starter-sword", "buckler"],
  },
};

const ENEMY_LIBRARY = enemyCatalog.map((entry) => ({
  id: entry.id,
  name: entry.name,
}));

const ITEM_LIBRARY = itemCatalog.map((entry) => ({
  id: entry.id,
  name: entry.name,
}));

const RUN_SLICE_KEYS = [
  "runId",
  "currentFloor",
  "grid",
  "playerPos",
  "mode",
  "sceneId",
  "combatSession",
  "activeCombat",
  "defeatOverlay",
  "dev",
  "persistHydrated",
  "nextEncounterSerial",
] as const;

export default function CombatTestingPage() {
  const [config, setConfig] = useState<SandboxConfig>(DEFAULT_CONFIG);
  const [controlError, setControlError] = useState<string | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [snapshotReady, setSnapshotReady] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const snapshotRef = useRef<Record<string, unknown> | null>(null);
  const encounterIndexRef = useRef(1);

  const encounter = useCombatStore((state) => state.encounter);
  const lastResolution = useCombatStore((state) => state.lastResolution);
  const activeSide = useCombatStore((state) => state.getActiveSide());
  const forceEnemyAdvance = useCombatStore((state) => state.forceEnemyAdvance);
  const endEncounter = useCombatStore((state) => state.endEncounter);

  const enterCombatMode = useUIStore((s) => s.enterCombatMode);
  const exitCombatMode = useUIStore((s) => s.exitCombatMode);
  const setMode = useUIStore((s) => s.setMode);

  const parsedEnemies = useMemo(() => parseEnemyList(config.enemyIdsText), [config.enemyIdsText]);
  const invalidEnemies = useMemo(
    () => parsedEnemies.filter((id) => !getEnemyDefinition(id)),
    [parsedEnemies]
  );

  const sceneCaption = useMemo(() => {
    const names = parsedEnemies
      .map((id) => getEnemyDefinition(id)?.name ?? id)
      .filter(Boolean);
    if (!names.length) return "No enemies selected—use the sandbox panel to spawn an encounter.";
    return `Sandbox duel versus ${names.join(", ")}`;
  }, [parsedEnemies]);

  const encounterSummary = useMemo(() => {
    if (!encounter) return null;
    const entities = Object.values(encounter.entities);
    return {
      party: entities.filter((entity) => entity.faction === "player"),
      enemies: entities.filter((entity) => entity.faction === "enemy"),
    };
  }, [encounter]);

  const handleConsoleAct = useCallback((payload: { type: string; id?: string; targets?: string[] }) => {
    const api = useCombatStore.getState();
    const currentEncounter = api.encounter;
    if (!currentEncounter) return;
    const player =
      Object.values(currentEncounter.entities).find((entity) => entity.faction === "player") ??
      null;
    if (!player || !player.actions || !player.actions.length) return;

    const pickByCategory = (category: string) =>
      player.actions.find((instance) => instance.contract.category === category)?.contract.id;
    let actionId: string | undefined;
    switch (payload.type) {
      case "Attack":
        actionId = pickByCategory("attack") ?? payload.id ?? player.actions[0].contract.id;
        break;
      case "Defend":
        actionId = pickByCategory("defend") ?? payload.id ?? player.actions[0].contract.id;
        break;
      case "Skill":
      case "Item":
        actionId = payload.id ?? player.actions[0].contract.id;
        break;
      case "Flee":
        api.endEncounter();
        return;
      default:
        actionId = payload.id ?? player.actions[0].contract.id;
        break;
    }
    if (!actionId) return;

    let targetIds = payload.targets?.filter(Boolean) ?? [];
    if (!targetIds.length) {
      if (payload.type === "Defend") {
        targetIds = [player.id];
      } else {
        const firstEnemy =
          currentEncounter.order.find((id) => {
            const entity = currentEncounter.entities[id];
            return entity?.faction === "enemy" && entity.alive;
          }) ?? player.id;
        targetIds = [firstEnemy];
      }
    }
    api.commitPlayerDecision({
      actionId,
      targetIds,
    });
  }, []);

  const syncRunStore = useCallback(
    (overrides: Record<string, unknown>) => {
      useRunStore.setState((prev) => {
        const next: Record<string, unknown> = { ...prev, ...overrides };
        (next as any).onAct = handleConsoleAct;
        return next;
      });
    },
    [handleConsoleAct]
  );

  const spawnEncounter = useCallback(
    (overrides?: Partial<SandboxConfig>) => {
      const nextConfig = mergeSandboxConfig(config, overrides);
      setConfig(nextConfig);

      const enemyIds = parseEnemyList(nextConfig.enemyIdsText);
      const finalEnemies = enemyIds.length ? enemyIds : ["rat"];
      const missing = finalEnemies.filter((id) => !getEnemyDefinition(id));
      if (missing.length) {
        setControlError(`Unknown enemy ids: ${missing.join(", ")}`);
        return false;
      }

      setControlError(null);
      const playerState = buildPlayerState(nextConfig.hero, encounterIndexRef.current++);
      const combatApi = useCombatStore.getState();
      combatApi.endEncounter?.();
      combatApi.beginEncounter(
        finalEnemies,
        playerState,
        `${Date.now()}:${finalEnemies.join("-")}`,
        nextConfig.firstStrike === "enemy" ? { forceFirst: "enemy" } : undefined
      );

      enterCombatMode();
      setMode("combat");
      syncRunStore({
        runId: "dev-sandbox",
        currentFloor: nextConfig.floor,
        grid: SANDBOX_GRID,
        playerPos: PLAYER_POS,
        sceneId: nextConfig.sceneId,
        mode: "combat",
        combatSession: makeSandboxSession(nextConfig),
        activeCombat: {
          floor: nextConfig.floor,
          x: PLAYER_POS.x,
          y: PLAYER_POS.y,
          enemies: finalEnemies,
          encounterSerial: Date.now(),
        },
        defeatOverlay: false,
        persistHydrated: true,
        dev: { gridOverlay: nextConfig.showOverlay },
        lastResolution: null,
      });
      return true;
    },
    [config, enterCombatMode, setMode, syncRunStore]
  );

  useEffect(() => {
    snapshotRef.current = captureRunSnapshot();
    setSnapshotReady(true);
    return () => {
      const base = snapshotRef.current;
      if (base) {
        useRunStore.setState((prev) => ({ ...prev, ...base }));
      }
      useCombatStore.getState().endEncounter?.();
      exitCombatMode();
    };
  }, [exitCombatMode]);

  useEffect(() => {
    if (!snapshotReady || bootstrapped) return;
    if (spawnEncounter()) {
      setBootstrapped(true);
    }
  }, [snapshotReady, bootstrapped, spawnEncounter]);

  useEffect(() => {
    if (!lastResolution) return;
    const line = formatResolution(lastResolution);
    if (!line) return;
    setLogLines((prev) => [line, ...prev].slice(0, 8));
    useRunStore.setState((prev) => ({ ...(prev as any), lastResolution }));
  }, [lastResolution]);

  const handleStatChange = useCallback((key: keyof HeroStatsConfig, value: number) => {
    setConfig((prev) => ({
      ...prev,
      hero: {
        ...prev.hero,
        stats: {
          ...prev.hero.stats,
          [key]: Number.isFinite(value) ? value : prev.hero.stats[key],
        },
      },
    }));
  }, []);

  const handleHeroToggle = useCallback((itemId: string) => {
    setConfig((prev) => {
      const hasItem = prev.hero.items.includes(itemId);
      const nextItems = hasItem
        ? prev.hero.items.filter((id) => id !== itemId)
        : [...prev.hero.items, itemId];
      return {
        ...prev,
        hero: { ...prev.hero, items: nextItems.length ? nextItems : prev.hero.items },
      };
    });
  }, []);

  const handlePreset = useCallback(
    (enemyIdsText: string) => {
      spawnEncounter({ enemyIdsText });
    },
    [spawnEncounter]
  );

  const handleFormSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      spawnEncounter();
    },
    [spawnEncounter]
  );

  return (
    <PageSurface>
      <div className="play-root" data-combat-root>
        <aside className="play-left" aria-label="Encounter inspector">
          <div className="menu-panel" style={{ marginBottom: 16 }}>
            <div className="panel-title">Encounter status</div>
            {encounter ? (
              <div style={{ display: "grid", gap: 8, fontSize: 14 }}>
                <div>Active side: <strong>{activeSide}</strong></div>
                <div>Round: <strong>{encounter.round}</strong></div>
                <div>Seed: <code style={{ fontSize: 12 }}>{encounter.seed}</code></div>
                <div>Initiative: <strong>{encounter.initiative.first}</strong></div>
              </div>
            ) : (
              <p style={{ margin: 0 }}>No encounter running. Use the sandbox panel to spawn one.</p>
            )}
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button className="btn btn--ghost" onClick={() => forceEnemyAdvance?.(200)}>
                Force enemy turn
              </button>
              <button className="btn btn--ghost" onClick={() => endEncounter()}>
                End encounter
              </button>
            </div>
          </div>

          <div className="menu-panel" style={{ marginBottom: 16 }}>
            <div className="panel-title">Participants</div>
            {encounterSummary ? (
              <div style={{ display: "grid", gap: 12, fontSize: 14 }}>
                <div>
                  <strong>Party</strong>
                  <ul style={{ margin: 8, paddingLeft: 18 }}>
                    {encounterSummary.party.map((entity) => (
                      <li key={entity.id}>
                        {entity.name} · HP {entity.stats.HP}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <strong>Enemies</strong>
                  <ul style={{ margin: 8, paddingLeft: 18 }}>
                    {encounterSummary.enemies.map((entity) => (
                      <li key={entity.id}>
                        {entity.name} · HP {entity.stats.HP}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p style={{ margin: 0 }}>Spawn an encounter to inspect combatants.</p>
            )}
          </div>

          <div className="menu-panel">
            <div className="panel-title">Resolution log</div>
            {logLines.length ? (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                {logLines.map((line, index) => (
                  <li key={`${line}-${index}`}>{line}</li>
                ))}
              </ul>
            ) : (
              <p style={{ margin: 0 }}>Turn results will stream here.</p>
            )}
            {logLines.length ? (
              <button
                className="btn btn--ghost"
                style={{ marginTop: 12 }}
                onClick={() => setLogLines([])}
              >
                Clear log
              </button>
            ) : null}
          </div>
        </aside>

        <section className="play-middle combat-stage" data-combat-host>
          <div className="console-frame console-frame--combat combat-stage__frame">
            <div className="console-frame__content">
              <div className="scene-surface scene-surface--locked">
                <SceneViewer
                  className="scene-viewer scene-viewer--dimmed"
                  roomType={config.roomType}
                  sceneId={config.sceneId}
                  caption={sceneCaption}
                  grid={SANDBOX_GRID}
                  playerPos={PLAYER_POS}
                  showOverlay={config.showOverlay}
                  overlayCentered
                  floor={config.floor}
                />
              </div>

              <div className="actions-pad combat-pad">
                <CombatRoot />
              </div>
            </div>
          </div>

          <CombatOverlay active={Boolean(encounter)} leaving={false} />
        </section>

        <aside className="play-right" aria-label="Sandbox controls">
          <form className="menu-panel" onSubmit={handleFormSubmit} style={{ display: "grid", gap: 16 }}>
            <div className="panel-title">Combat sandbox</div>
            <label>
              <div className="h-subtle">Scene asset (relative to /images/scenes)</div>
              <input
                className="input"
                value={config.sceneId}
                onChange={(event) => setConfig((prev) => ({ ...prev, sceneId: event.target.value }))}
                placeholder="entry/entry_default.png"
              />
            </label>

            <label>
              <div className="h-subtle">Room type</div>
              <select
                className="input"
                value={config.roomType}
                onChange={(event) =>
                  setConfig((prev) => ({ ...prev, roomType: event.target.value as RoomType }))
                }
              >
                {ROOM_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <div className="h-subtle">Floor</div>
              <input
                className="input"
                type="number"
                min={1}
                max={99}
                value={config.floor}
                onChange={(event) => {
                  const nextValue = Number(event.target.value);
                  setConfig((prev) => ({
                    ...prev,
                    floor: Number.isFinite(nextValue) ? Math.max(1, nextValue) : prev.floor,
                  }));
                }}
              />
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={config.showOverlay}
                onChange={(event) => setConfig((prev) => ({ ...prev, showOverlay: event.target.checked }))}
              />
              Show dev grid overlay
            </label>

            <label>
              <div className="h-subtle">Enemy IDs (comma or space separated)</div>
              <textarea
                className="input"
                rows={3}
                value={config.enemyIdsText}
                onChange={(event) =>
                  setConfig((prev) => ({ ...prev, enemyIdsText: event.target.value }))
                }
              />
            </label>
            {invalidEnemies.length ? (
              <div style={{ color: "#f472b6", fontSize: 13 }}>
                Unknown enemies: {invalidEnemies.join(", ")}
              </div>
            ) : null}

            <div style={{ display: "grid", gap: 8 }}>
              <div className="h-subtle">Quick presets</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <button type="button" className="btn btn--ghost" onClick={() => handlePreset("rat")}>
                  Solo Rat
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => handlePreset("rat acolyte")}
                >
                  Rat + Acolyte
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => handlePreset("acolyte acolyte")}
                >
                  Acolyte x2
                </button>
              </div>
            </div>

            <label>
              <div className="h-subtle">First strike</div>
              <select
                className="input"
                value={config.firstStrike}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    firstStrike: event.target.value as "player" | "enemy",
                  }))
                }
              >
                <option value="player">Player goes first</option>
                <option value="enemy">Enemy opener</option>
              </select>
            </label>

            <fieldset style={{ border: 0, padding: 0 }}>
              <legend className="h-subtle" style={{ marginBottom: 8 }}>
                Hero loadout
              </legend>
              <label style={{ display: "grid", gap: 4 }}>
                <span>Name</span>
                <input
                  className="input"
                  value={config.hero.name}
                  onChange={(event) =>
                    setConfig((prev) => ({ ...prev, hero: { ...prev.hero, name: event.target.value } }))
                  }
                />
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(120px, 1fr))", gap: 8 }}>
                {Object.keys(config.hero.stats).map((key) => (
                  <label key={key}>
                    <div className="h-subtle">{key}</div>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      value={config.hero.stats[key as keyof HeroStatsConfig]}
                      onChange={(event) => {
                        const nextValue = Number(event.target.value);
                        handleStatChange(
                          key as keyof HeroStatsConfig,
                          Number.isFinite(nextValue)
                            ? nextValue
                            : config.hero.stats[key as keyof HeroStatsConfig]
                        );
                      }}
                    />
                  </label>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(120px, 1fr))", gap: 8 }}>
                <label>
                  <div className="h-subtle">Focus (MP)</div>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={config.hero.focus}
                    onChange={(event) => {
                      const nextValue = Number(event.target.value);
                      setConfig((prev) => ({
                        ...prev,
                        hero: {
                          ...prev.hero,
                          focus: Number.isFinite(nextValue) ? nextValue : prev.hero.focus,
                        },
                      }));
                    }}
                  />
                </label>
                <label>
                  <div className="h-subtle">Stamina</div>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={config.hero.stamina}
                    onChange={(event) => {
                      const nextValue = Number(event.target.value);
                      setConfig((prev) => ({
                        ...prev,
                        hero: {
                          ...prev.hero,
                          stamina: Number.isFinite(nextValue) ? nextValue : prev.hero.stamina,
                        },
                      }));
                    }}
                  />
                </label>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={config.hero.autoGood}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      hero: { ...prev.hero, autoGood: event.target.checked },
                    }))
                  }
                />
                Auto-good boosters (accessibility)
              </label>
              <div style={{ display: "grid", gap: 4 }}>
                <div className="h-subtle">Items</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {ITEM_LIBRARY.map((item) => (
                    <label key={item.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <input
                        type="checkbox"
                        checked={config.hero.items.includes(item.id)}
                        onChange={() => handleHeroToggle(item.id)}
                      />
                      {item.name}
                    </label>
                  ))}
                </div>
              </div>
            </fieldset>

            {controlError ? <div style={{ color: "#f472b6" }}>{controlError}</div> : null}

            <button className="btn btn--primary" type="submit">
              Respawn encounter
            </button>
          </form>

          <div className="menu-panel" style={{ marginTop: 16 }}>
            <div className="panel-title">Enemy reference</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {ENEMY_LIBRARY.map((entry) => (
                <li key={entry.id}>
                  <code>{entry.id}</code> · {entry.name}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </PageSurface>
  );
}

function parseEnemyList(value: string): string[] {
  return value
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function mergeSandboxConfig(base: SandboxConfig, overrides?: Partial<SandboxConfig>): SandboxConfig {
  if (!overrides) {
    return {
      ...base,
      hero: { ...base.hero, stats: { ...base.hero.stats }, items: [...base.hero.items] },
    };
  }
  return {
    ...base,
    ...overrides,
    hero: mergeHeroConfig(base.hero, overrides.hero),
  };
}

function mergeHeroConfig(base: HeroConfig, patch?: Partial<HeroConfig>): HeroConfig {
  if (!patch) {
    return { ...base, stats: { ...base.stats }, items: [...base.items] };
  }
  return {
    ...base,
    ...patch,
    stats: patch.stats ? { ...base.stats, ...patch.stats } : { ...base.stats },
    items: patch.items ? [...patch.items] : [...base.items],
  };
}

function buildPlayerState(hero: HeroConfig, encounterIndex: number): StartEncounterState {
  return {
    player: {
      id: "sandbox-runner",
      name: hero.name || "Sandbox Runner",
      stats: { ...hero.stats },
      resources: { focus: hero.focus, stamina: hero.stamina },
      actions: ["defend"],
      items: hero.items.length ? [...hero.items] : ["starter-sword"],
    },
    accessibility: { autoGood: hero.autoGood },
    encounterIndex,
  };
}

function makeSandboxSession(config: SandboxConfig) {
  const timestamp = Date.now();
  return {
    status: "ready",
    sourceRoom: {
      floor: config.floor,
      x: PLAYER_POS.x,
      y: PLAYER_POS.y,
      roomType: config.roomType,
      sceneId: config.sceneId,
    },
    enteredAt: timestamp,
    transitionId: `sandbox-${timestamp}`,
    firstStrike: config.firstStrike,
    startedAt: timestamp,
    readyAt: timestamp,
    outcome: null,
  };
}

function formatResolution(resolution: Resolution | null): string | null {
  if (!resolution) return null;
  const targets = resolution.targetIds?.length ? resolution.targetIds.join(", ") : "unknown";
  const damage = resolution.events
    ?.filter((event) => event.type === "damage")
    .reduce((sum, event) => sum + (event as any).amount, 0);
  const damagePart = damage ? ` (${damage} dmg)` : "";
  return `${resolution.actorId} used ${resolution.actionId} → ${targets}${damagePart}`;
}

function captureRunSnapshot(): Record<string, unknown> {
  const state: Record<string, unknown> = useRunStore.getState() as any;
  const snapshot: Record<string, unknown> = {};
  for (const key of RUN_SLICE_KEYS) {
    snapshot[key] = state[key];
  }
  if ("onAct" in state) snapshot.onAct = (state as any).onAct;
  if ("lastResolution" in state) snapshot.lastResolution = (state as any).lastResolution;
  return snapshot;
}
