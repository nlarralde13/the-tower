/* eslint-disable no-bitwise */
import type { FloorMap, Room, RoomType } from "./types";
import { createRNG, mixSeed } from "./rng";

type Vec = { x: number; y: number };

const NON_VOID_POOL: RoomType[] = [
  "empty",
  "combat",
  "treasure",
  "trap",
  "puzzle",
];

/**
 * Generates a floor map for a given seed and dead-space percentage.
 * Ensures a valid connected path from (0,0) → exit.
 */
export function genFloorWithRules(
  seed: number,
  w: number,
  h: number,
  deadSpacePct: number
): FloorMap {
  const rand = createRNG(mixSeed(seed, (w << 8) ^ h));

  // --- 1. Initialize all rooms as void ---
  const rooms: Room[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      rooms.push({ x, y, type: "void", visited: false });
    }
  }

  // --- 2. Start carving from (0,0) ---
  const start: Vec = { x: 0, y: 0 };
  let openCount = 0;

  function setOpen(v: Vec, type: RoomType = "empty") {
    const idx = v.y * w + v.x;
    const r = rooms[idx];
    if (r && r.type === "void") {
      r.type = type;
      openCount++;
    }
  }

  setOpen(start, "empty");

  // --- 3. Random walk carve until target open count reached ---
  const targetOpen = Math.max(2, Math.round(w * h * (1 - deadSpacePct)));
  const stack: Vec[] = [start];
  const dirs: Vec[] = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];

  while (stack.length && openCount < targetOpen) {
    const cur = stack[stack.length - 1];
    const neighbors = shuffle(dirs.slice(), rand)
      .map((d) => ({ x: cur.x + d.x, y: cur.y + d.y }))
      .filter(
        (n) =>
          n.x >= 0 &&
          n.y >= 0 &&
          n.x < w &&
          n.y < h &&
          rooms[n.y * w + n.x].type === "void"
      );

    if (neighbors.length === 0) {
      stack.pop();
      continue;
    }

    const next = neighbors[0];
    setOpen(next, pickRoomType(rand));
    stack.push(next);
  }

  // --- 4. Pick exit as farthest reachable open cell ---
  const openCells = rooms.filter((r) => r.type !== "void");
  const exitCell = farthestFrom(start, openCells, w, h);
  if (exitCell) {
    rooms[exitCell.y * w + exitCell.x].type = "exit";
  } else {
    rooms[start.y * w + start.x].type = "exit";
  }

  return { width: w, height: h, rooms };
}

// --- Utilities ------------------------------------------------------------

function shuffle<T>(arr: T[], rand: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickRoomType(rand: () => number): RoomType {
  return NON_VOID_POOL[Math.floor(rand() * NON_VOID_POOL.length)];
}

function farthestFrom(start: Vec, openCells: Room[], w: number, h: number): Vec | null {
  const queue: Vec[] = [start];
  const seen = new Set<string>([key(start)]);
  let last = start;

  while (queue.length) {
    const cur = queue.shift()!;
    last = cur;

    for (const d of [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ]) {
      const n = { x: cur.x + d.x, y: cur.y + d.y };
      if (n.x < 0 || n.y < 0 || n.x >= w || n.y >= h) continue;
      const k = key(n);
      if (seen.has(k)) continue;
      const r = openCells.find((r) => r.x === n.x && r.y === n.y);
      if (!r) continue;
      seen.add(k);
      queue.push(n);
    }
  }

  return last || null;
}

function key(v: Vec) {
  return `${v.x},${v.y}`;
}
