// /src/engine/generateFloor.ts
import type { FloorConfig, FloorGrid, RoomType } from "@/types/tower";
import type { RNG } from "./rng";
import { shuffleInPlace } from "./rng";
import { carvePath, randomBorderCell } from "./path";

const W = 8, H = 8;
function idx(x: number, y: number) { return y * W + x; }
function k(x:number,y:number){ return `${x},${y}`; }

// Normalize weights so they sum to 1.0
function normalizeWeights<K extends string>(weights: Record<K, number>): Record<K, number> {
  const entries = Object.entries(weights) as [K, number][];
  const sum = entries.reduce((a, [, v]) => a + (v || 0), 0);
  if (sum <= 0) return Object.fromEntries(entries.map(([k]) => [k, 0])) as Record<K, number>;
  return Object.fromEntries(entries.map(([k, v]) => [k, (v || 0) / sum])) as Record<K, number>;
}

// Largest Remainder Method to convert fractional shares into integers
function apportion<K extends string>(total: number, weights: Record<K, number>): Record<K, number> {
  const norm = normalizeWeights(weights);
  const quotas = Object.entries(norm).map(([k, w]) => {
    const exact = w * total;
    return { k: k as K, floor: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let used = quotas.reduce((a, q) => a + q.floor, 0);
  const need = Math.max(0, total - used);
  quotas.sort((a, b) => (b.remainder - a.remainder) || String(a.k).localeCompare(String(b.k)));
  for (let i = 0; i < need; i++) quotas[i].floor += 1;
  const out: Record<K, number> = {} as any;
  quotas.forEach(q => { out[q.k] = q.floor; });
  return out;
}

// Fill cells from counts; bag is shuffled for salt-and-pepper distribution
function fillByCounts(
  rng: RNG,
  cells: { x: number; y: number; type: RoomType }[],
  counts: Record<RoomType, number>
) {
  const bag: RoomType[] = [];
  (Object.keys(counts) as RoomType[]).forEach(k => {
    for (let i = 0; i < (counts[k] || 0); i++) bag.push(k);
  });
  shuffleInPlace(rng, bag);
  for (let i = 0; i < cells.length && i < bag.length; i++) cells[i].type = bag[i];
}

/** Manhattan distance */
function md(a:{x:number;y:number}, b:{x:number;y:number}) { return Math.abs(a.x-b.x) + Math.abs(a.y-b.y); }

/**
 * Corridor carver: builds ONE connected "river" of open cells starting at `start`,
 * gently biased toward `goal`, until `targetOpen` cells are open.
 * Returns a Set of keys "x,y" for open cells.
 */
function carveCorridor(
  rng: RNG,
  start: {x:number;y:number},
  goal: {x:number;y:number},
  targetOpen: number,
  wiggle: number // 0 = straight to goal, 1 = extremely wiggly
): Set<string> {
  const open = new Set<string>();
  const stack: {x:number;y:number}[] = [start];
  open.add(k(start.x,start.y));

  // neighbor dirs
  const dirs = [
    {x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}
  ];

  while (open.size < targetOpen && stack.length) {
    const cur = stack[stack.length - 1];

    // Rank neighbors by bias toward goal; shuffle a bit using wiggle
    const neigh = dirs
      .map(d => ({x: cur.x + d.x, y: cur.y + d.y}))
      .filter(n => n.x>=0 && n.x<W && n.y>=0 && n.y<H && !open.has(k(n.x,n.y)));

    if (!neigh.length) { stack.pop(); continue; }

    // Score: lower distance is better; add noise
    neigh.forEach(n => (n as any)._score = md(n, goal) + (rng() * wiggle * 2 - wiggle));
    neigh.sort((a:any,b:any) => a._score - b._score);

    // pick the best few with some randomness
    const take = Math.min(2, neigh.length);
    const candidate = neigh[Math.floor(rng() * take)];

    open.add(k(candidate.x, candidate.y));
    stack.push(candidate);
  }

  // if we still didn't reach targetOpen (could happen with backtracking), expand around open edge
  if (open.size < targetOpen) {
    const all: {x:number;y:number}[] = [];
    for (let y=0;y<H;y++) for (let x=0;x<W;x++) all.push({x,y});
    // grow ring outward from existing open cells
    const frontier = all.filter(p =>
      !open.has(k(p.x,p.y)) &&
      [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}]
        .some(d => open.has(k(p.x+d.x,p.y+d.y)))
    );
    shuffleInPlace(rng, frontier);
    for (const p of frontier) {
      if (open.size >= targetOpen) break;
      open.add(k(p.x,p.y));
    }
  }

  return open;
}

// Simple connectivity (BFS) over passable cells
function isExitReachable(cells: { x: number; y: number; type: RoomType }[], entry: {x:number;y:number}, exit:{x:number;y:number}) {
  const passable = new Set<RoomType>(["entry","exit","boss","combat","trap","loot","out","special","empty"]);
  const seen = new Set<string>();
  const q: Array<{x:number;y:number}> = [{...entry}];

  while (q.length) {
    const {x,y} = q.shift()!;
    const key = k(x,y);
    if (seen.has(key)) continue;
    seen.add(key);
    if (x === exit.x && y === exit.y) return true;
    const neigh = [{x,y:y-1},{x,y:y+1},{x:x-1,y},{x:x+1,y}]
      .filter(p => p.x>=0 && p.x<W && p.y>=0 && p.y<H);
    for (const n of neigh) {
      const c = cells[idx(n.x,n.y)];
      if (passable.has(c.type) && !seen.has(k(n.x,n.y))) q.push(n);
    }
  }
  return false;
}

export function generateFloor(
  rng: RNG,
  floorNumber: number,
  config: FloorConfig,
  isFinalBossFloor: boolean,
  opts?: {
    minEmptyFraction?: number; // ≥ share of open tiles that should remain 'empty'
    pathEmptyBias?: number;    // keep path tiles empty with this probability
    blockedFraction?: number;  // overall share of tiles to block (ignored if mazeMode=true)
    mazeMode?: boolean;        // NEW: carve a single corridor region first (river), then fill
    openFraction?: number;     // when mazeMode, fraction of total tiles to keep open
    wiggle?: number;           // 0..1: how wiggly the corridor is toward goal
  }
): FloorGrid {
  const minEmptyFraction = opts?.minEmptyFraction ?? 0.50;
  const pathEmptyBias     = opts?.pathEmptyBias ?? 0.70;
  const blockedFraction   = opts?.blockedFraction ?? 0.15;
  const mazeMode          = opts?.mazeMode ?? false;
  const openFraction      = opts?.openFraction ?? (1 - blockedFraction);
  const wiggle            = Math.max(0, Math.min(1, opts?.wiggle ?? 0.35));

  // Start all empty
  const cells = new Array(W * H).fill(null).map((_, i) => {
    const x = i % W, y = Math.floor(i / W);
    return { x, y, type: "empty" as RoomType };
  });

  // Entry & Exit on borders
  const entry = randomBorderCell(rng, W, H);
  let exit = randomBorderCell(rng, W, H);
  if (exit.x === entry.x && exit.y === entry.y) exit = { x: (exit.x + 1) % W, y: (exit.y + 1) % H };
  cells[idx(entry.x, entry.y)].type = "entry";
  cells[idx(exit.x, exit.y)].type = "exit";

  // Guaranteed path (for labeling + later biases)
  const path = carvePath(rng, W, H, entry, exit);

  // Boss adjacent to exit on final floor
  let bossPos: { x: number; y: number } | undefined;
  if (isFinalBossFloor) {
    const adj = path.filter(p => Math.abs(p.x - exit.x) + Math.abs(p.y - exit.y) === 1
                              && !(p.x === entry.x && p.y === entry.y));
    const pick = adj[0] ?? path[path.length - 2];
    if (pick && !(pick.x === exit.x && pick.y === exit.y)) {
      bossPos = { x: pick.x, y: pick.y };
      cells[idx(bossPos.x, bossPos.y)].type = "boss";
    }
  }

  // -------- Maze mode: carve a single connected open region (“river”) ----------
  if (mazeMode) {
    const targetOpen = Math.max(2, Math.round(W * H * openFraction));
    const open = carveCorridor(rng, entry, exit, targetOpen, wiggle);
    // Everything not in the river becomes blocked (except reserved)
    for (let y=0;y<H;y++) for (let x=0;x<W;x++) {
      const c = cells[idx(x,y)];
      if ((x===entry.x && y===entry.y) || (x===exit.x && y===exit.y) || (bossPos && x===bossPos.x && y===bossPos.y)) continue;
      if (!open.has(k(x,y))) c.type = "blocked";
    }
    // sanity: if someone managed to wall off exit, fallback by unblocking straight line
    if (!isExitReachable(cells, entry, exit)) {
      // carve a straight shot
      let cx = entry.x, cy = entry.y;
      while (cx !== exit.x || cy !== exit.y) {
        if (cx < exit.x) cx++; else if (cx > exit.x) cx--;
        else if (cy < exit.y) cy++; else if (cy > exit.y) cy--;
        if (cells[idx(cx,cy)].type === "blocked") cells[idx(cx,cy)].type = "empty";
      }
    }
  }

  // --- Density-aware filling over OPEN tiles only ---
  const pathSet = new Set(path.map(p => k(p.x,p.y)));

  const openCells = cells.filter(c => c.type !== "blocked" && c.type !== "entry" && c.type !== "exit" && c.type !== "boss");
  const totalOpen = openCells.length;

  const desired = {
    combat:  config.room_ratios.combat ?? 0,
    trap:    config.room_ratios.trap ?? 0,
    loot:    config.room_ratios.loot ?? 0,
    out:     config.room_ratios.out ?? 0,
    special: config.room_ratios.special ?? 0,
    empty:   config.room_ratios.empty ?? 0
  };

  // Path bias: lock a portion of path tiles (that are currently empty) to remain empty
  const biasablePathCells = openCells.filter(c => pathSet.has(k(c.x,c.y)));
  shuffleInPlace(rng, biasablePathCells);
  const keepEmptyCount = Math.floor(biasablePathCells.length * pathEmptyBias);
  const lockedEmpty = new Set<string>();
  for (let i = 0; i < keepEmptyCount; i++) lockedEmpty.add(k(biasablePathCells[i].x,biasablePathCells[i].y));

  // Non-empty categories (entry/exit/boss/blocked excluded)
  const nonEmptyWeights: Record<RoomType, number> = {
    combat: desired.combat,
    trap: desired.trap,
    loot: desired.loot,
    out: desired.out,
    special: desired.special,
    entry: 0, exit: 0, boss: 0, empty: 0, blocked: 0
  };

  const fillable = openCells.filter(c => !lockedEmpty.has(k(c.x,c.y)));
  const countsNonEmpty = apportion(fillable.length, nonEmptyWeights);

  shuffleInPlace(rng, fillable);
  fillByCounts(rng, fillable, countsNonEmpty);

  // Enforce minimum empties over OPEN cells
  const minEmptyCount = Math.floor(totalOpen * (mazeMode ? Math.max(minEmptyFraction, 0.4) : minEmptyFraction));
  let currentEmpty = cells.filter(c => c.type === "empty").length; // counts entry/exit/boss as non-empty
  if (currentEmpty < minEmptyCount) {
    const candidates = cells.filter(c =>
      c.type !== "entry" && c.type !== "exit" && c.type !== "boss" && c.type !== "blocked" && !pathSet.has(k(c.x,c.y))
    );
    shuffleInPlace(rng, candidates);
    for (let i = 0; i < candidates.length && currentEmpty < minEmptyCount; i++) {
      candidates[i].type = "empty";
      currentEmpty++;
    }
  }

  // If not in mazeMode, optionally sprinkle a few random blocked cells without breaking the route
  if (!mazeMode) {
    const targetBlocked = Math.floor(W * H * (blockedFraction));
    const candidatesForBlock = cells.filter(c => c.type !== "entry" && c.type !== "exit" && c.type !== "boss" && c.type !== "blocked" && !pathSet.has(k(c.x,c.y)));
    shuffleInPlace(rng, candidatesForBlock);
    let placed = cells.filter(c => c.type === "blocked").length;
    for (const c of candidatesForBlock) {
      if (placed >= targetBlocked) break;
      const prev = c.type;
      c.type = "blocked";
      if (!isExitReachable(cells, entry, exit)) c.type = prev;
      else placed++;
    }
  }

  return { width: W, height: H, cells, entry, exit, boss: bossPos };
}
