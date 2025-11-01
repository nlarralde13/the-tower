"use client";

import { create } from "zustand";
import type { FloorGrid, RoomType, FloorConfig, FloorSeed } from "@/types/tower";
import { buildFloorSeedFromTemplate } from "@/engine/runFactory";
import { generateFloorFromSeed } from "@/engine/generateFloor";

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
  dev: { gridOverlay: false },

  resumeFromStorage: () => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as RunState;
      set(() => ({ ...parsed }));
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
        { t: Date.now(), floor, x: playerPos.x, y: playerPos.y, type: "entry", scene: path },
      ],
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

    // Update position and scene
    const { path, pools } = drawFromPool(s.pools, target.type);
    const entry: JournalEntry = { t: Date.now(), floor: s.currentFloor, x: nx, y: ny, type: target.type, scene: path };
    const nextState: Partial<RunState> = {
      playerPos: { x: nx, y: ny },
      sceneId: path,
      pools,
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
        { t: Date.now(), floor, x: playerPos.x, y: playerPos.y, type: "entry", scene: path },
      ],
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

    const newState: Partial<RunState> = {
      currentFloor: nextFloor,
      floorSeeds: { ...s.floorSeeds, [nextFloor]: floorSeed.seed >>> 0 },
      grid: newGrid,
      playerPos,
      mode: "explore",
      sceneId: path,
      pools,
      journal: [...(s.journal ?? []), { t: Date.now(), floor: nextFloor, x: playerPos.x, y: playerPos.y, type: "entry", scene: path }],
    };
    set((prev) => ({ ...prev, ...newState }));
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...get() }));
      if (navigator?.vibrate) navigator.vibrate(12);
    }
  },

  endRun: () => {
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
      dev: { gridOverlay: false },
    };
    set(() => cleared);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(cleared));
  },
}));
