"use client";

import { create } from "zustand";
import type { FloorGrid, RoomType, FloorConfig, FloorSeed } from "@/types/tower";
import { buildFloorSeedFromTemplate } from "@/engine/runFactory";
import { generateFloorFromSeed } from "@/engine/generateFloor";
import { useCombatStore } from "@/state/combatStore";
import { getActionDefinition, getEnemyDefinition } from "@/content/index";
import type { StartEncounterState } from "@/engine/combat/engine";
import type { Encounter } from "@/engine/combat/types";
import { generateBossLoot, generateEnemyLoot } from "@/game/loot/system";
import type { LootDrop } from "@/game/loot/types";

type Point = { x: number; y: number };

type RunMode = "explore" | "combat";

type ScenePools = Record<string, { remaining: string[]; last?: string }>;

type JournalEntry = {
  t: number;
  floor: number;
  x: number;
  y: number;
  type: RoomType;
  scene: string | null;
  message?: string;
};

type CombatLogEntry = {
  id: string;
  t: number;
  encounterId: string;
  floor: number;
  location?: { x: number; y: number };
  message: string;
};

export type RunState = {
  runId: string | null;
  runSeed: number | null;
  currentFloor: number;
  floorSeeds: Record<number, number>; // floor -> seed
  grid: FloorGrid | null;
  playerPos: Point | null;
  mode: RunMode;
  sceneId: string | null; // last shown scene path
  pools: ScenePools; // per-roomType pools for non-repeating selection
  journal: JournalEntry[];
  completedRooms: Record<string, boolean>;
  combatLog: CombatLogEntry[];
  activeCombat: {
    floor: number;
    x: number;
    y: number;
    enemies: string[];
    encounterSerial: number;
  } | null;
  defeatOverlay: boolean;
  dev: {
    gridOverlay: boolean;
  };
};

type RunActions = {
  enterRun: () => Promise<void>;
  resumeFromStorage: () => void;
  move: (dir: "north" | "south" | "west" | "east") => void;
  roomTypeAt: (x: number, y: number) => RoomType | null;
  toggleGridOverlay: (on?: boolean) => void;
  _devSetRunFromSeed?: (floor: number, floorSeed: number) => Promise<void>;
  ascend?: () => Promise<void>;
  endRun?: () => void;
  completeCombat: (opts: { victory: boolean }) => void;
  logCombatEvents: (payload: {
    encounterId: string;
    floor: number;
    location?: { x: number; y: number };
    lines: string[];
  }) => void;
};

const STORAGE_KEY = "runState:v1";

function rand32(): number {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] >>> 0;
  }
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function idx(x: number, y: number, w: number) {
  return y * w + x;
}

function initialPools(): ScenePools {
  const empty = Array.from({ length: 10 }, (_, i) => `empty/empty_${String(i + 1).padStart(2, "0")}.png`);
  const def = (name: string) => [`${name}/${name}_default.png`];
  const init = (arr: string[]) => ({ remaining: [...arr] });
  return {
    empty: init(empty),
    combat: init(def("combat")),
    trap: init(def("trap")),
    loot: init(def("loot")),
    special: init(def("special")),
    out: init(def("out")),
    boss: init(def("boss")),
    entry: init(def("entry")),
    exit: init(def("exit")),
    blocked: init(def("blocked")),
  };
}

function drawFromPool(pools: ScenePools, type: RoomType): { path: string; pools: ScenePools } {
  const key = type;
  const defaultPath = `${key}/${key}_default.png`;
  const bucket = pools[key] ?? { remaining: [defaultPath] };
  let remaining = bucket.remaining;
  if (!remaining || remaining.length === 0) {
    // reset pool
    const reset = initialPools()[key]?.remaining ?? [defaultPath];
    remaining = [...reset];
  }
  const i = Math.floor(Math.random() * remaining.length);
  const choice = remaining[i];
  const next = remaining.filter((_, idx) => idx !== i);
  const updated: ScenePools = { ...pools, [key]: { remaining: next, last: choice } };
  // Log for debugging randomness
  if (typeof window !== "undefined") console.log(`[scene] ${key} -> ${choice}`);
  return { path: choice ?? defaultPath, pools: updated };
}

const ROOM_CLEAR_MESSAGE = "The enemy was defeated and the room is now clear to move on.";

const BUREAU_OFFICES = [
  "Office of Residual Heroics",
  "Department of Unsettling Inventory",
  "Clerks of Pernicious Gratitude",
  "Registry of Forgotten Victories",
  "Auditors of Ambient Dread",
];

const BUREAU_NOTES = [
  "initialled in burgundy ink",
  "sealed with three different waxes",
  "flagged for \"emotional contamination\" review",
  "accompanied by a whispered apology",
  "filed in duplicate and then misplaced on purpose",
  "stamped 'do not lick' by night shift archivists",
];

const NO_DROP_NOTES = [
  "No physical assets recovered; clerk issued a memo titled \"Heroic Austerity.\"",
  "Nothing salvageable beyond dust motes. Expect a survey about your effort.",
  "All loot requisitioned upstream before arrival. Paper trail pending.",
];

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (Math.imul(31, hash) + input.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

function pickFrom<T>(arr: readonly T[], seed: number): T {
  if (!arr.length) {
    throw new Error("Cannot pick from empty array");
  }
  const index = seed % arr.length;
  return arr[index < 0 ? index + arr.length : index];
}

function formatList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  const head = items.slice(0, -1).join(", ");
  const tail = items[items.length - 1];
  return `${head}, and ${tail}`;
}

function formatSourceBlurb(
  source: string | undefined,
  enemyNameMap: Record<string, string>
): string {
  if (!source) return "origin stamp smudged beyond legibility.";
  const [type, id] = source.split(":", 2);
  if (type === "enemy") {
    const name = enemyNameMap[id] ?? id;
    return `charged to ${name}'s incident report.`;
  }
  if (type === "boss") {
    return `logged by the Boss Oversight desk (${id}).`;
  }
  return `recorded as ${source}.`;
}

function buildLootSummary(params: {
  runSeed: number;
  floor: number;
  x: number;
  y: number;
  encounterSerial: number;
  enemyNameMap: Record<string, string>;
  drops: LootDrop[];
}): { headline: string; lines: string[] } {
  const docketId = `${String(params.floor).padStart(2, "0")}-${String(params.x).padStart(2, "0")}${String(params.y).padStart(2, "0")}`;
  const baseHash = hashString(
    `${params.runSeed}:${params.floor}:${params.x}:${params.y}:${params.encounterSerial}`
  );
  const office = pickFrom(BUREAU_OFFICES, baseHash % BUREAU_OFFICES.length);
  const headline = `After-action docket ${docketId} filed with the ${office}.`;
  const enemyNames = Object.values(params.enemyNameMap);
  const intro = enemyNames.length
    ? `Assets attributed to ${formatList(enemyNames)}.`
    : "Assets attributed to unidentified aggressors.";

  const items: string[] = [];
  if (params.drops.length === 0) {
    const note = pickFrom(NO_DROP_NOTES, baseHash % NO_DROP_NOTES.length);
    items.push(note);
  } else {
    params.drops.forEach((drop, idx) => {
      const dropHash = hashString(`${drop.id}:${baseHash}:${idx}`);
      const note = pickFrom(BUREAU_NOTES, dropHash % BUREAU_NOTES.length);
      const qty = drop.quantity > 1 ? `x${drop.quantity}` : "x1";
      const rarityTag = drop.rarity.charAt(0).toUpperCase() + drop.rarity.slice(1);
      const sourceBlurb = formatSourceBlurb(drop.source, params.enemyNameMap);
      items.push(
        `${drop.name} ${qty} - ${rarityTag} tier, ${note}; ${sourceBlurb}`
      );
    });
  }

  return {
    headline,
    lines: [intro, ...items],
  };
}

const DEFAULT_PLAYER_TEMPLATE: StartEncounterState["player"] = {
  id: "runner",
  name: "Runner",
  stats: {
    HP: 120,
    ATK: 24,
    DEF: 12,
    INT: 18,
    RES: 14,
    SPD: 16,
    LUCK: 10,
  },
  resources: { focus: 2, stamina: 3 },
  actions: ["defend"],
  items: ["starter-sword", "starter-staff", "buckler"],
};

function buildPlayerEncounterState(encounterIndex: number): StartEncounterState {
  return {
    player: {
      ...DEFAULT_PLAYER_TEMPLATE,
      stats: { ...DEFAULT_PLAYER_TEMPLATE.stats },
      resources: { ...DEFAULT_PLAYER_TEMPLATE.resources },
      actions: [...(DEFAULT_PLAYER_TEMPLATE.actions ?? [])],
      items: [...(DEFAULT_PLAYER_TEMPLATE.items ?? [])],
    },
    accessibility: { autoGood: false },
    encounterIndex,
  };
}

function selectEncounterEnemies(floor: number): string[] {
  if (floor >= 4) {
    return ["acolyte", "rat"];
  }
  if (floor >= 2) {
    return ["acolyte"];
  }
  return ["rat"];
}

function roomKey(floor: number, x: number, y: number) {
  return `${floor}:${x},${y}`;
}

function formatInitiativeJournal(encounter: Encounter | null): string | undefined {
  if (!encounter) return undefined;
  if (encounter.initiative.first === "player") {
    return "Initiative: You acted first.";
  }
  const firstEnemyId = encounter.order.find((id) => {
    const entity = encounter.entities[id];
    return entity?.faction === "enemy" && entity.alive;
  });
  if (!firstEnemyId) {
    return "Initiative: The enemy moved first.";
  }
  const enemyEntity = encounter.entities[firstEnemyId];
  if (!enemyEntity) {
    return "Initiative: The enemy moved first.";
  }
  const bestPlan = (enemyEntity.aiPlan ?? [])
    .slice()
    .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))[0];
  const fallbackAction =
    enemyEntity.actions.length > 0 ? enemyEntity.actions[0].contract.id : undefined;
  const actionId = bestPlan?.actionId ?? fallbackAction;
  const actionName = actionId ? getActionDefinition(actionId)?.name ?? actionId : "an attack";
  return `Initiative: ${enemyEntity.name} struck first with ${actionName}.`;
}

export const useRunStore = create<RunState & RunActions>((set, get) => ({
  runId: null,
  runSeed: null,
  currentFloor: 0,
  floorSeeds: {},
  grid: null,
  playerPos: null,
  mode: "explore",
  sceneId: null,
  pools: initialPools(),
  journal: [],
  completedRooms: {},
  combatLog: [],
  defeatOverlay: false,
  activeCombat: null,
  dev: { gridOverlay: false },

  resumeFromStorage: () => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<RunState>;
      set(() => ({
        runId: parsed.runId ?? null,
        runSeed: parsed.runSeed ?? null,
        currentFloor: parsed.currentFloor ?? 0,
        floorSeeds: parsed.floorSeeds ?? {},
        grid: parsed.grid ?? null,
        playerPos: parsed.playerPos ?? null,
        mode: parsed.mode === "combat" ? "explore" : parsed.mode ?? "explore",
      sceneId: parsed.sceneId ?? null,
      pools: parsed.pools ?? initialPools(),
      journal: parsed.journal ?? [],
      completedRooms: parsed.completedRooms ?? {},
      combatLog: parsed.combatLog ?? [],
      defeatOverlay: parsed.defeatOverlay ?? false,
      activeCombat: null,
      dev: parsed.dev ?? { gridOverlay: false },
      }));
      const combatState = useCombatStore.getState();
      if (combatState.endEncounter) {
        combatState.endEncounter();
      }
    } catch {
      // ignore
    }
  },

  enterRun: async () => {
    // Load ruleset and build floor 1
    const runSeed = rand32();
    const floor = 1;
    let floorConfig: FloorConfig | null = null;
    let floorSeedNum = rand32();
    try {
      const res = await fetch("/data/rulesetTemplate.json");
      if (res.ok) {
        const ruleset = await res.json();
        const cfg = ruleset.floors?.[String(floor)] as FloorConfig | undefined;
        if (cfg) floorConfig = cfg;
      }
    } catch {
      // fall through to defaults
    }
    if (!floorConfig) {
      // Minimal default if ruleset missing
      floorConfig = {
        difficulty: 1,
        room_ratios: { combat: 0.3, trap: 0.2, loot: 0.2, out: 0.15, special: 0.15, empty: 0.2 },
        boss_room: false,
      } as FloorConfig;
    }

    const floorTemplate: Pick<FloorSeed, "floor" | "options" | "roomRatios"> & { isFinalBossFloor?: boolean } = {
      floor,
      options: {
        minEmptyFraction: 0.6,
        pathEmptyBias: 0.75,
        wiggle: 0.35,
        riverWidth: 1,
      },
      roomRatios: {
        empty: floorConfig.room_ratios.empty ?? 0.2,
        combat: floorConfig.room_ratios.combat,
        trap: floorConfig.room_ratios.trap,
        loot: floorConfig.room_ratios.loot,
        out: floorConfig.room_ratios.out,
        special: floorConfig.room_ratios.special,
        boss: (floorConfig.room_ratios as any).boss ?? 0,
      },
    };

    const seed = buildFloorSeedFromTemplate(
      {
        floor,
        options: floorTemplate.options,
        room_ratios: floorConfig.room_ratios as any,
        isFinalBossFloor: !!floorConfig.boss_room,
      } as any,
      floorSeedNum
    );

    const grid = generateFloorFromSeed(seed, floorConfig);
    const playerPos = { x: grid.entry.x, y: grid.entry.y };
    // Entry scene is a special splash
    const path = "empty/empty_main.png";
    const pools = initialPools();

    const runId = `${Date.now().toString(36)}-${runSeed.toString(36)}`;

    const newState: RunState = {
      runId,
      runSeed,
      currentFloor: floor,
      floorSeeds: { [floor]: floorSeedNum },
      grid,
      playerPos,
      mode: "explore",
      sceneId: path,
      pools,
      journal: [
        {
          t: Date.now(),
          floor,
          x: playerPos.x,
          y: playerPos.y,
          type: "entry",
          scene: path,
          message: "Arrived on the floor.",
        },
      ],
      combatLog: [],
      completedRooms: {},
      defeatOverlay: false,
      activeCombat: null,
      dev: { gridOverlay: false },
    };
    set(() => newState);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
  },

  roomTypeAt: (x, y) => {
    const grid = get().grid;
    if (!grid) return null;
    const w = grid.width;
    if (x < 0 || y < 0 || x >= w || y >= grid.height) return null;
    return grid.cells[idx(x, y, w)].type;
  },

  move: (dir) => {
    const s = get();
    if (s.mode === "combat" || s.defeatOverlay) return;
    const grid = s.grid;
    const pos = s.playerPos;
    if (!grid || !pos) return;
    const W = grid.width;
    const H = grid.height;
    let nx = pos.x;
    let ny = pos.y;
    if (dir === "north") ny -= 1;
    else if (dir === "south") ny += 1;
    else if (dir === "west") nx -= 1;
    else if (dir === "east") nx += 1;
    nx = clamp(nx, 0, W - 1);
    ny = clamp(ny, 0, H - 1);

    // Must be neighbor
    if (Math.abs(nx - pos.x) + Math.abs(ny - pos.y) !== 1) return;
    const target = grid.cells[idx(nx, ny, W)];
    if (target.type === "blocked") return;

    const { path, pools } = drawFromPool(s.pools, target.type);
    const entry: JournalEntry = {
      t: Date.now(),
      floor: s.currentFloor,
      x: nx,
      y: ny,
      type: target.type,
      scene: path,
    };

    const key = roomKey(s.currentFloor, nx, ny);
    const alreadyCleared = !!s.completedRooms?.[key];
    entry.message = alreadyCleared
      ? `Revisited a cleared ${target.type} room.`
      : `Entered a ${target.type} room.`;

    let mode: RunMode = "explore";
    let activeCombat: RunState["activeCombat"] = null;

    if (target.type === "combat" && !alreadyCleared) {
      mode = "combat";
      const enemies = selectEncounterEnemies(s.currentFloor);
      const encounterSeed = `${s.runSeed ?? rand32()}:${key}:${s.journal.length}`;
      const combatState = useCombatStore.getState();
      if (combatState.endEncounter) {
        combatState.endEncounter();
      }
      const encounterSerial = s.journal.length;
      combatState.beginEncounter(
        enemies,
        buildPlayerEncounterState(s.journal.length),
        encounterSeed
      );
      const encounter = useCombatStore.getState().encounter;
      const initiativeLine = formatInitiativeJournal(encounter);
      if (initiativeLine) {
        entry.message = initiativeLine;
      }
      activeCombat = {
        floor: s.currentFloor,
        x: nx,
        y: ny,
        enemies,
        encounterSerial,
      };
    }
    if (alreadyCleared && !entry.message) {
      entry.message = ROOM_CLEAR_MESSAGE;
    }

    const nextState: Partial<RunState> = {
      playerPos: { x: nx, y: ny },
      sceneId: path,
      pools,
      mode,
      activeCombat,
      journal: [...(s.journal ?? []), entry],
    };
    set((prev) => ({ ...prev, ...nextState }));
    if (typeof window !== "undefined") {
      try {
        const snapshot = { ...get(), ...nextState } as RunState;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
        // Light haptic if supported (optional)
        if (navigator?.vibrate) navigator.vibrate(8);
      } catch {
        // ignore
      }
    }
  },

  toggleGridOverlay: (on) => set((s) => ({ dev: { gridOverlay: on ?? !s.dev.gridOverlay } })),

  completeCombat: ({ victory }) => {
    const s = get();
    const active = s.activeCombat;
    if (!active) return;
    const key = roomKey(active.floor, active.x, active.y);
    const grid = s.grid;
    const cellIndex = grid ? idx(active.x, active.y, grid.width) : -1;
    const originalType = grid && cellIndex >= 0 ? grid.cells[cellIndex]?.type ?? "combat" : "combat";
    const completedRooms = victory
      ? { ...s.completedRooms, [key]: true }
      : { ...s.completedRooms };

    let updatedGrid = s.grid;
    if (victory && updatedGrid) {
      const writableIndex = idx(active.x, active.y, updatedGrid.width);
      if (writableIndex >= 0 && writableIndex < updatedGrid.cells.length) {
        const cells = [...updatedGrid.cells];
        cells[writableIndex] = { ...cells[writableIndex], type: "empty" };
        updatedGrid = { ...updatedGrid, cells };
      }
    }

    const runSeed = s.runSeed ?? 0;
    const encounterSerial = active.encounterSerial ?? 0;
    const enemyNameMap: Record<string, string> = {};
    const drops: LootDrop[] = [];
    for (const enemyId of active.enemies) {
      const enemyDef = getEnemyDefinition(enemyId);
      if (enemyDef?.name) {
        enemyNameMap[enemyId] = enemyDef.name;
      } else if (!enemyNameMap[enemyId]) {
        enemyNameMap[enemyId] = enemyId;
      }
      const bossTableId = enemyDef?.loot?.bossTableId;
      if (bossTableId) {
        const result = generateBossLoot({
          runSeed,
          floor: active.floor,
          bossId: bossTableId,
          encounterSerial,
        });
        drops.push(...result.drops);
        continue;
      }
      const result = generateEnemyLoot({
        runSeed,
        floor: active.floor,
        sourceId: enemyId,
        // Adjust the per-NPC loot table by changing `loot.profileId` inside
        // the enemy definition in src/content/enemies/*.ts.
        profileId: enemyDef?.loot?.profileId ?? undefined,
        encounterSerial,
      });
      drops.push(...result.drops);
    }

    const timestamp = Date.now();
    const logEntries: JournalEntry[] = [];
    const enemyNames = Object.values(enemyNameMap);
    const location: { floor: number; x: number; y: number; type: RoomType; scene: string | null } = {
      floor: active.floor,
      x: active.x,
      y: active.y,
      type: originalType,
      scene: s.sceneId ?? null,
    };

    if (victory) {
      const opponentSummary = enemyNames.length ? formatList(enemyNames) : "unknown hostiles";
      logEntries.push({
        t: timestamp,
        ...location,
        message: `Victory over ${opponentSummary}. Room cleared.`,
      });
      const lootSummary = buildLootSummary({
        runSeed,
        floor: active.floor,
        x: active.x,
        y: active.y,
        encounterSerial,
        enemyNameMap,
        drops,
      });
      logEntries.push({
        t: timestamp,
        ...location,
        message: lootSummary.headline,
      });
      for (const line of lootSummary.lines) {
        logEntries.push({
          t: timestamp,
          ...location,
          message: line,
        });
      }
    } else {
      const opponentSummary = enemyNames.length ? formatList(enemyNames) : "unknown hostiles";
      logEntries.push({
        t: timestamp,
        ...location,
        message: `Defeated by ${opponentSummary}. Retreat required.`,
      });
    }

    const journal = [...(s.journal ?? []), ...logEntries];

    const nextState: Partial<RunState> = {
      grid: updatedGrid,
      completedRooms,
      mode: "explore",
      activeCombat: null,
      journal,
      defeatOverlay: victory ? false : true,
    };

    set((prev) => ({ ...prev, ...nextState }));

    if (typeof window !== "undefined") {
      try {
        const snapshot = { ...get(), ...nextState } as RunState;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      } catch {
        // ignore
      }
    }
  },

  logCombatEvents: ({ encounterId, floor, location, lines }) => {
    if (!lines || lines.length === 0) return;
    const timestamp = Date.now();
    const entries: CombatLogEntry[] = lines.map((line, index) => ({
      id: `${encounterId}:${timestamp}:${index}`,
      t: timestamp + index,
      encounterId,
      floor,
      location: location ? { ...location } : undefined,
      message: line,
    }));
    set((prev) => ({
      combatLog: [...prev.combatLog, ...entries],
    }));
  },

  _devSetRunFromSeed: async (floor: number, floorSeedNum: number) => {
    let floorConfig: FloorConfig | null = null;
    try {
      const res = await fetch("/data/rulesetTemplate.json");
      if (res.ok) {
        const ruleset = await res.json();
        const cfg = ruleset.floors?.[String(floor)] as FloorConfig | undefined;
        if (cfg) floorConfig = cfg;
      }
    } catch {}
    if (!floorConfig) return;
    const seed = buildFloorSeedFromTemplate(
      { floor, options: { minEmptyFraction: 0.6, pathEmptyBias: 0.75, wiggle: 0.35, riverWidth: 1 }, room_ratios: floorConfig.room_ratios as any },
      floorSeedNum
    );
    const grid = generateFloorFromSeed(seed, floorConfig);
    const playerPos = { x: grid.entry.x, y: grid.entry.y };
    const path = "empty/empty_main.png";
    const pools = initialPools();
    const runSeed = rand32();
    const runId = `${Date.now().toString(36)}-${runSeed.toString(36)}`;
    const newState: RunState = {
      runId,
      runSeed,
      currentFloor: floor,
      floorSeeds: { [floor]: floorSeedNum },
      grid,
      playerPos,
      mode: "explore",
      sceneId: path,
      pools,
      journal: [
        {
          t: Date.now(),
          floor,
          x: playerPos.x,
          y: playerPos.y,
          type: "entry",
          scene: path,
          message: "Arrived on the floor.",
        },
      ],
      combatLog: [],
      completedRooms: {},
      defeatOverlay: false,
      activeCombat: null,
      dev: { gridOverlay: get().dev.gridOverlay },
    };
    set(() => newState);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
  },

  ascend: async () => {
    // Ascend from exit to the next floor using fixed seeds
    const s = get();
    const grid = s.grid;
    const pos = s.playerPos;
    if (!grid || !pos) return;
    if (grid.cells[idx(pos.x, pos.y, grid.width)].type !== "exit") return;
    const nextFloor = s.currentFloor + 1;
    if (nextFloor > 5) return;

    // Load floor seed JSON (f1 reused for floors 1-4, custom f5)
    let seedJson: FloorSeed | null = null;
    try {
      const path = nextFloor <= 4 ? "/data/floor-seed-f1-s1130215123.json" : "/data/floor-seed-f5-s3707387099.json";
      const res = await fetch(path);
      if (res.ok) seedJson = (await res.json()) as FloorSeed;
    } catch {}
    if (!seedJson) return;

    // Build a new seed object with updated floor, reuse seed/options/ratios
    const floorSeed: FloorSeed = {
      floor: nextFloor,
      seed: seedJson.seed >>> 0,
      isFinalBossFloor: nextFloor === 5 ? true : !!seedJson.isFinalBossFloor,
      options: { ...seedJson.options },
      roomRatios: { ...seedJson.roomRatios },
    };

    // Load floor config (difficulty & base ratios)
    let floorConfig: FloorConfig | null = null;
    try {
      const res = await fetch("/data/rulesetTemplate.json");
      if (res.ok) {
        const ruleset = await res.json();
        const cfg = ruleset.floors?.[String(nextFloor)] as FloorConfig | undefined;
        if (cfg) floorConfig = cfg;
      }
    } catch {}
    if (!floorConfig) {
      floorConfig = {
        difficulty: Math.max(1, nextFloor),
        room_ratios: { combat: 0.3, trap: 0.2, loot: 0.2, out: 0.15, special: 0.15, empty: 0.2 },
        boss_room: nextFloor === 5,
      } as FloorConfig;
    }

    const newGrid = generateFloorFromSeed(floorSeed, floorConfig);
    const playerPos = { x: newGrid.entry.x, y: newGrid.entry.y };
    const path = "empty/empty_main.png";
    const pools = initialPools();

    const combatState = useCombatStore.getState();
    if (combatState.endEncounter) {
      combatState.endEncounter();
    }

    const newState: Partial<RunState> = {
      currentFloor: nextFloor,
      floorSeeds: { ...s.floorSeeds, [nextFloor]: floorSeed.seed >>> 0 },
      grid: newGrid,
      playerPos,
      mode: "explore",
      sceneId: path,
      pools,
      journal: [
        ...(s.journal ?? []),
        {
          t: Date.now(),
          floor: nextFloor,
          x: playerPos.x,
          y: playerPos.y,
          type: "entry",
          scene: path,
          message: "Arrived on the floor.",
        },
      ],
      activeCombat: null,
      defeatOverlay: false,
    };
    set((prev) => ({ ...prev, ...newState }));
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...get() }));
      if (navigator?.vibrate) navigator.vibrate(12);
    }
  },

  endRun: () => {
    const combatState = useCombatStore.getState();
    if (combatState.endEncounter) {
      combatState.endEncounter();
    }
    const cleared: RunState = {
      runId: null,
      runSeed: null,
      currentFloor: 0,
      floorSeeds: {},
      grid: null,
      playerPos: null,
      mode: "explore",
      sceneId: null,
      pools: initialPools(),
      journal: [],
      combatLog: [],
      completedRooms: {},
      defeatOverlay: false,
      activeCombat: null,
      dev: { gridOverlay: false },
    };
    set(() => cleared);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(cleared));
  },
}));



