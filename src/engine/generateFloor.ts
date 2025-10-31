// /src/engine/generateFloor.ts
import type { FloorConfig, FloorGrid, RoomType, FloorSeed } from "@/types/tower";
import type { RNG } from "./rng";
import { mulberry32, shuffleInPlace } from "./rng";
import { neighbors4, randomBorderCell, type Point } from "./path";

const W = 8;
const H = 8;

function idx(x: number, y: number) {
  return y * W + x;
}

function key(x: number, y: number) {
  return `${x},${y}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function md(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function safeWeight(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) return 0;
  return value;
}

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
  const used = quotas.reduce((a, q) => a + q.floor, 0);
  const need = Math.max(0, total - used);
  quotas.sort((a, b) => b.remainder - a.remainder || String(a.k).localeCompare(String(b.k)));
  for (let i = 0; i < need; i++) quotas[i].floor += 1;
  const out = {} as Record<K, number>;
  quotas.forEach((q) => {
    out[q.k] = q.floor;
  });
  return out;
}

// Fill cells from counts; bag is shuffled for salt-and-pepper distribution
function fillByCounts(
  rng: RNG,
  cells: { x: number; y: number; type: RoomType }[],
  counts: Record<RoomType, number>
) {
  const bag: RoomType[] = [];
  (Object.keys(counts) as RoomType[]).forEach((k) => {
    for (let i = 0; i < (counts[k] || 0); i++) bag.push(k);
  });
  shuffleInPlace(rng, bag);
  for (let i = 0; i < cells.length && i < bag.length; i++) cells[i].type = bag[i];
}

type RoomRatioOverride = Partial<
  Pick<Record<RoomType, number>, "combat" | "trap" | "loot" | "out" | "special" | "empty">
>;

type CameFrom = { prev: string; dir: Point };

type RiverCandidate = {
  key: string;
  cell: Point;
  score: number;
  side: "left" | "right" | "center";
};

function bfsDistanceField(sources: Point[], w: number, h: number) {
  const dist = new Array(w * h).fill(Infinity) as number[];
  const q: Point[] = [];
  for (const s of sources) {
    const i = idx(s.x, s.y);
    if (dist[i] !== 0) {
      dist[i] = 0;
      q.push({ x: s.x, y: s.y });
    }
  }
  let head = 0;
  while (head < q.length) {
    const cur = q[head++];
    const base = dist[idx(cur.x, cur.y)];
    for (const nb of neighbors4(cur, w, h)) {
      const ni = idx(nb.x, nb.y);
      if (dist[ni] > base + 1) {
        dist[ni] = base + 1;
        q.push(nb);
      }
    }
  }
  return dist;
}

function buildRiverPath(rng: RNG, start: Point, goal: Point, wiggle: number): Point[] {
  const startKey = key(start.x, start.y);
  const goalKey = key(goal.x, goal.y);
  const open: Array<{ key: string; point: Point; g: number; f: number }> = [
    { key: startKey, point: start, g: 0, f: md(start, goal) },
  ];
  const gScore = new Map<string, number>([[startKey, 0]]);
  const cameFrom = new Map<string, CameFrom>();
  const noiseCache = new Map<string, number>();

  const noiseFor = (k: string) => {
    if (!noiseCache.has(k)) noiseCache.set(k, rng());
    return noiseCache.get(k)!;
  };

  while (open.length) {
    open.sort((a, b) => a.f - b.f);
    const current = open.shift()!;
    if (current.key === goalKey) break;
    if (current.g > (gScore.get(current.key) ?? Infinity)) continue;

    const prevDir = cameFrom.get(current.key)?.dir;

    for (const nb of neighbors4(current.point, W, H)) {
      const nKey = key(nb.x, nb.y);
      const dir = { x: nb.x - current.point.x, y: nb.y - current.point.y };
      const turnPenalty = prevDir && (dir.x !== prevDir.x || dir.y !== prevDir.y) ? wiggle * 0.45 + 0.05 : 0;
      const distToGoal = md(nb, goal);
      const distFromCurrent = md(current.point, goal);
      const backtrackPenalty = distToGoal > distFromCurrent ? 0.35 : 0;
      const edgeDist = Math.min(nb.x, W - 1 - nb.x, nb.y, H - 1 - nb.y);
      const edgePenalty = edgeDist <= 0 ? 0.6 : 0.2 / (edgeDist + 1);
      const stepCost = 1 + noiseFor(nKey) * wiggle + turnPenalty + edgePenalty + backtrackPenalty;
      const tentative = current.g + stepCost;

      if (tentative + 1e-6 < (gScore.get(nKey) ?? Infinity)) {
        gScore.set(nKey, tentative);
        cameFrom.set(nKey, { prev: current.key, dir });
        const priority = tentative + md(nb, goal);
        open.push({ key: nKey, point: nb, g: tentative, f: priority });
      }
    }
  }

  if (startKey !== goalKey && !cameFrom.has(goalKey)) {
    return straightFallback(start, goal);
  }

  const path: Point[] = [];
  let curKey = goalKey;
  while (true) {
    const [x, y] = curKey.split(",").map(Number);
    path.push({ x, y });
    if (curKey === startKey) break;
    const info = cameFrom.get(curKey);
    if (!info) {
      return straightFallback(start, goal);
    }
    curKey = info.prev;
  }
  path.reverse();
  return path;
}

function straightFallback(start: Point, goal: Point): Point[] {
  const path: Point[] = [{ x: start.x, y: start.y }];
  let x = start.x;
  let y = start.y;
  while (x !== goal.x || y !== goal.y) {
    if (x < goal.x) x += 1;
    else if (x > goal.x) x -= 1;
    else if (y < goal.y) y += 1;
    else if (y > goal.y) y -= 1;
    path.push({ x, y });
  }
  return path;
}

function expandRiver(path: Point[], radius: number): { set: Set<string>; cells: Point[] } {
  const set = new Set<string>();
  const cells: Point[] = [];

  for (const p of path) {
    const k = key(p.x, p.y);
    if (!set.has(k)) {
      set.add(k);
      cells.push({ x: p.x, y: p.y });
    }
  }

  if (radius <= 0) {
    return { set, cells };
  }

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = key(x, y);
      if (set.has(k)) continue;
      const d = distanceToPath({ x, y }, path);
      if (d <= radius) {
        set.add(k);
        cells.push({ x, y });
      }
    }
  }

  return { set, cells };
}

function distanceToPath(point: Point, path: Point[]): number {
  let best = Infinity;
  for (const p of path) {
    const d = md(point, p);
    if (d < best) best = d;
    if (best === 0) break;
  }
  return best;
}

function distanceToSet(point: Point, set: Point[]): number {
  let best = Infinity;
  for (const p of set) {
    const d = md(point, p);
    if (d < best) best = d;
    if (best === 0) break;
  }
  return best;
}

function classifySide(entry: Point, exit: Point, cell: Point): "left" | "right" | "center" {
  const vx = exit.x - entry.x;
  const vy = exit.y - entry.y;
  const wx = cell.x - entry.x;
  const wy = cell.y - entry.y;
  const cross = vx * wy - vy * wx;
  if (cross > 0) return "left";
  if (cross < 0) return "right";
  return "center";
}

function isExitReachable(cells: { x: number; y: number; type: RoomType }[], entry: Point, exit: Point) {
  const passable = new Set<RoomType>([
    "entry",
    "exit",
    "boss",
    "combat",
    "trap",
    "loot",
    "out",
    "special",
    "empty",
  ]);
  const seen = new Set<string>();
  const queue: Point[] = [{ ...entry }];

  while (queue.length) {
    const cur = queue.shift()!;
    const k = key(cur.x, cur.y);
    if (seen.has(k)) continue;
    seen.add(k);
    if (cur.x === exit.x && cur.y === exit.y) return true;
    for (const nb of neighbors4(cur, W, H)) {
      const nk = key(nb.x, nb.y);
      if (seen.has(nk)) continue;
      const cell = cells[idx(nb.x, nb.y)];
      if (passable.has(cell.type)) {
        queue.push(nb);
      }
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
    minEmptyFraction?: number;
    pathEmptyBias?: number;
    openFraction?: number;
    blockedFraction?: number; // backwards compat: if provided, overrides openFraction as 1 - blocked
    wiggle?: number;
    riverWidth?: number; // base corridor thickness (tiles beyond path)
    bandPadding?: number; // additive control for corridor width (positive=wider, negative=tighter)
    mazeMode?: string | boolean; // accepted for compatibility; currently unused
    roomRatiosOverride?: RoomRatioOverride;
  }
): FloorGrid {
  const minEmptyFraction = clamp(opts?.minEmptyFraction ?? 0.5, 0, 0.95);
  const pathEmptyBias = clamp(opts?.pathEmptyBias ?? 0.7, 0, 1);
  const openFracOpt =
    typeof opts?.openFraction === "number"
      ? opts.openFraction
      : typeof opts?.blockedFraction === "number"
      ? 1 - opts.blockedFraction
      : 0.58;
  const openFraction = clamp(openFracOpt, 0.3, 0.95);
  const wiggle = clamp(opts?.wiggle ?? 0.35, 0, 1);
  const baseWidth = Math.round(opts?.riverWidth ?? 1);
  const padding = Math.round(opts?.bandPadding ?? 0);
  const riverRadius = Math.max(0, baseWidth + padding);

  const desiredRatios = {
    combat: safeWeight(opts?.roomRatiosOverride?.combat ?? config.room_ratios.combat),
    trap: safeWeight(opts?.roomRatiosOverride?.trap ?? config.room_ratios.trap),
    loot: safeWeight(opts?.roomRatiosOverride?.loot ?? config.room_ratios.loot),
    out: safeWeight(opts?.roomRatiosOverride?.out ?? config.room_ratios.out),
    special: safeWeight(opts?.roomRatiosOverride?.special ?? config.room_ratios.special),
    boss: safeWeight(opts?.roomRatiosOverride?.boss ?? (config.room_ratios as any).boss),
    empty: safeWeight(opts?.roomRatiosOverride?.empty ?? config.room_ratios.empty),
  };

  const ratioTotal =
    desiredRatios.combat +
    desiredRatios.trap +
    desiredRatios.loot +
    desiredRatios.out +
    desiredRatios.special +
    desiredRatios.empty;
  const desiredEmptyFraction = ratioTotal > 0 ? desiredRatios.empty / ratioTotal : 0;
  const minEmptyTargetFraction = Math.max(minEmptyFraction, desiredEmptyFraction);

  const cells = new Array(W * H).fill(null).map((_, i) => {
    const x = i % W;
    const y = Math.floor(i / W);
    return { x, y, type: "empty" as RoomType };
  });

  // Entry/Exit rules: special handling for floor 1; otherwise random borders with reasonable separation
  let entry: Point;
  let exit: Point;
  if (floorNumber === 1) {
    // Entrance fixed near bottom center; Exit anywhere on top two rows
    const startX = rng() < 0.5 ? 3 : 4;
    entry = { x: startX, y: H - 1 };
    exit = { x: Math.floor(rng() * W), y: Math.floor(rng() * Math.min(2, H)) };
  } else {
    entry = randomBorderCell(rng, W, H);
    exit = randomBorderCell(rng, W, H);
    let safety = 0;
    while ((exit.x === entry.x && exit.y === entry.y) || md(entry, exit) < 6) {
      exit = randomBorderCell(rng, W, H);
      if (++safety > 12) break;
    }
  }

  cells[idx(entry.x, entry.y)].type = "entry";
  cells[idx(exit.x, exit.y)].type = "exit";

  // Carve a guaranteed entry->exit path, then compute distance field from it
  const riverPath = buildRiverPath(rng, entry, exit, wiggle);
  const distField = bfsDistanceField(riverPath, W, H);
  // Base corridor: bands within riverRadius of the path
  const corridor: { set: Set<string>; cells: Point[] } = (() => {
    const set = new Set<string>();
    const cells: Point[] = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const d = distField[idx(x, y)];
        if (d <= riverRadius) {
          const k = key(x, y);
          if (!set.has(k)) {
            set.add(k);
            cells.push({ x, y });
          }
        }
      }
    }
    return { set, cells };
  })();

  let bossPos: Point | undefined;
  if (isFinalBossFloor) {
    const candidate = [...riverPath]
      .slice(0, -1)
      .reverse()
      .find((p) => !(p.x === entry.x && p.y === entry.y));
    if (candidate) {
      bossPos = candidate;
      cells[idx(candidate.x, candidate.y)].type = "boss";
    }
  }

  const reservedKeys = new Set<string>([key(entry.x, entry.y), key(exit.x, exit.y)]);
  if (bossPos) reservedKeys.add(key(bossPos.x, bossPos.y));

  const totalTiles = W * H;
  const baseOpen = corridor.set.size;
  const targetOpen = Math.max(baseOpen, Math.round(totalTiles * openFraction));

  // Pre-open: path + corridor bands already in 'corridor.set'. We'll add more open tiles outward by distance.
  // Gather remaining candidates (excluding reserved).
  const candidates: Array<{ x: number; y: number; d: number; noise: number }> = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = key(x, y);
      if (reservedKeys.has(k)) continue;
      if (corridor.set.has(k)) continue; // already open base corridor
      const d = distField[idx(x, y)];
      const noise = rng(); // deterministic given seed; used for stable tie-breaks inside bands
      candidates.push({ x, y, d, noise });
    }
  }
  // Sort by distance from path ascending; tie-break with small noise to avoid axial bias
  candidates.sort((a, b) => a.d - b.d || a.noise - b.noise);

  const needToOpen = Math.max(0, targetOpen - baseOpen);
  for (let i = 0; i < needToOpen && i < candidates.length; i++) {
    const c = candidates[i];
    const k = key(c.x, c.y);
    corridor.set.add(k);
    corridor.cells.push({ x: c.x, y: c.y });
  }

  // All non-corridor, non-reserved tiles become blocked
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = key(x, y);
      if (reservedKeys.has(k)) continue;
      if (!corridor.set.has(k)) {
        cells[idx(x, y)].type = "blocked";
      }
    }
  }

  const openCells = cells.filter(
    (c) => c.type !== "blocked" && c.type !== "entry" && c.type !== "exit" && c.type !== "boss"
  );
  const totalOpen = openCells.length;

  const corridorOpenCells = openCells.filter((c) => corridor.set.has(key(c.x, c.y)));
  shuffleInPlace(rng, corridorOpenCells);
  const lockedEmptyCount = Math.floor(corridorOpenCells.length * pathEmptyBias);
  const lockedEmpty = new Set<string>();
  for (let i = 0; i < lockedEmptyCount; i++) lockedEmpty.add(key(corridorOpenCells[i].x, corridorOpenCells[i].y));

  const weightsForDistribution: Record<RoomType, number> = {
    combat: desiredRatios.combat,
    trap: desiredRatios.trap,
    loot: desiredRatios.loot,
    out: desiredRatios.out,
    special: desiredRatios.special,
    boss: desiredRatios.boss,
    empty: desiredRatios.empty,
    entry: 0,
    exit: 0,
    blocked: 0,
  };

  const targetCounts = apportion(openCells.length, weightsForDistribution);
  const countsForFill: Record<RoomType, number> = {
    combat: targetCounts.combat ?? 0,
    trap: targetCounts.trap ?? 0,
    loot: targetCounts.loot ?? 0,
    out: targetCounts.out ?? 0,
    special: targetCounts.special ?? 0,
    boss: Math.max(0, (targetCounts.boss ?? 0) - (bossPos ? 1 : 0)),
    empty: Math.max(0, (targetCounts.empty ?? 0) - lockedEmpty.size),
    entry: 0,
    exit: 0,
    blocked: 0,
  };

  const fillable = openCells.filter((c) => !lockedEmpty.has(key(c.x, c.y)));
  shuffleInPlace(rng, fillable);
  fillByCounts(rng, fillable, countsForFill);

  const minEmptyCount = Math.floor(totalOpen * minEmptyTargetFraction);
  let currentEmpty = cells.filter((c) => c.type === "empty").length;
  if (currentEmpty < minEmptyCount) {
    const candidates = cells.filter((c) => {
      if (c.type === "entry" || c.type === "exit" || c.type === "boss" || c.type === "blocked") return false;
      return !lockedEmpty.has(key(c.x, c.y));
    });
    shuffleInPlace(rng, candidates);
    for (const cell of candidates) {
      if (currentEmpty >= minEmptyCount) break;
      cell.type = "empty";
      currentEmpty += 1;
    }
  }

  if (!isExitReachable(cells, entry, exit)) {
    for (const p of riverPath) {
      const c = cells[idx(p.x, p.y)];
      if (c.type === "blocked") c.type = "empty";
    }
  }

  return { width: W, height: H, cells, entry, exit, boss: bossPos };
}

export function generateFloorFromSeed(seed: FloorSeed, baseConfig: FloorConfig): FloorGrid {
  const rng = mulberry32(seed.seed >>> 0);
  const opts = {
    minEmptyFraction: seed.options.minEmptyFraction,
    pathEmptyBias: seed.options.pathEmptyBias,
    openFraction: seed.options.openFraction,
    blockedFraction: seed.options.blockedFraction,
    wiggle: seed.options.wiggle,
    riverWidth: seed.options.riverWidth,
    bandPadding: seed.options.bandPadding,
    roomRatiosOverride: seed.roomRatios,
  } as const;
  return generateFloor(rng, seed.floor, baseConfig, !!seed.isFinalBossFloor, opts);
}
