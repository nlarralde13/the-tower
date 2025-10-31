import type { FloorConfig, FloorGrid, RoomType } from "@/types/tower";
import type { RNG } from "./rng";
import { choice, shuffleInPlace } from "./rng";
import { carvePath, randomBorderCell } from "./path";

const W = 8, H = 8;

function idx(x: number, y: number) { return y * W + x; }

function buildBagFromRatios(count: number, ratios: Record<RoomType, number>): RoomType[] {
  // Build a multiset (bag) with integer counts from ratios
  const keys = Object.keys(ratios) as RoomType[];
  const raw = keys.map(k => ({ k, n: Math.max(0, Math.round(count * (ratios[k] ?? 0))) }));
  let total = raw.reduce((a, r) => a + r.n, 0);
  // Trim or pad to match exactly
  while (total > count) { const r = raw.find(v => v.n > 0)!; r.n--; total--; }
  while (total < count) { const r = raw[Math.floor(Math.random() * raw.length)]; r.n++; total++; }
  const bag: RoomType[] = [];
  raw.forEach(r => { for (let i = 0; i < r.n; i++) bag.push(r.k); });
  return bag;
}

export function generateFloor(
  rng: RNG,
  floorNumber: number,
  config: FloorConfig,
  isFinalBossFloor: boolean
): FloorGrid {
  // Start with all empty cells
  const cells = new Array(W * H).fill(null).map((_, i) => {
    const x = i % W, y = Math.floor(i / W);
    return { x, y, type: "empty" as RoomType };
  });

  // Entry & Exit on borders for clarity
  const entry = randomBorderCell(rng, W, H);
  let exit = randomBorderCell(rng, W, H);
  // Ensure exit not equal to entry
  if (exit.x === entry.x && exit.y === entry.y) {
    exit = { x: (exit.x + 1) % W, y: (exit.y + 1) % H };
  }

  cells[idx(entry.x, entry.y)].type = "entry";
  cells[idx(exit.x, exit.y)].type = "exit";

  // Carve a guaranteed path
  const path = carvePath(rng, W, H, entry, exit);

  // If this is the final floor, place a boss adjacent to exit and on the path
  let bossPos: { x: number; y: number } | undefined = undefined;
  if (isFinalBossFloor) {
    // try to pick a tile on the path that is directly next to exit
    const adjacent = path.filter(p =>
      Math.abs(p.x - exit.x) + Math.abs(p.y - exit.y) === 1 && !(p.x === entry.x && p.y === entry.y)
    );
    const pick = adjacent.length ? adjacent[0] : path[path.length - 2]; // fallback to penultimate
    if (pick && !(pick.x === exit.x && pick.y === exit.y)) {
      bossPos = { x: pick.x, y: pick.y };
      cells[idx(bossPos.x, bossPos.y)].type = "boss";
      // make sure exit stays exit
      cells[idx(exit.x, exit.y)].type = "exit";
    }
  }

  // Build a bag of remaining room types from ratios (excluding reserved types)
  const availableCells = cells.filter(c => c.type === "empty");
  const baseRatios = {
    combat: config.room_ratios.combat ?? 0,
    trap: config.room_ratios.trap ?? 0,
    loot: config.room_ratios.loot ?? 0,
    out: config.room_ratios.out ?? 0,
    special: config.room_ratios.special ?? 0,
  } as Record<RoomType, number>;
  // @ts-ignore ensure keys exist
  baseRatios.entry = 0; baseRatios.exit = 0; baseRatios.boss = 0; baseRatios.empty = 0;

  const bag = buildBagFromRatios(availableCells.length, baseRatios);
  shuffleInPlace(rng, bag);

  // Fill remaining cells
  for (let i = 0; i < availableCells.length; i++) {
    availableCells[i].type = bag[i] as RoomType;
  }

  return {
    width: W,
    height: H,
    cells,
    entry,
    exit,
    boss: isFinalBossFloor ? bossPos : undefined
  };
}
