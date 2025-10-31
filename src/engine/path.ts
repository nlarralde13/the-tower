import type { RNG } from "./rng";
import { randInt, shuffleInPlace } from "./rng";

export interface Point { x: number; y: number; }

export function neighbors4(p: Point, w: number, h: number): Point[] {
  const n: Point[] = [];
  if (p.y > 0) n.push({ x: p.x, y: p.y - 1 });
  if (p.y < h - 1) n.push({ x: p.x, y: p.y + 1 });
  if (p.x > 0) n.push({ x: p.x - 1, y: p.y });
  if (p.x < w - 1) n.push({ x: p.x + 1, y: p.y });
  return n;
}

/**
 * Carves a simple random walk path from start -> goal using DFS-style wandering.
 * Always returns a connected route.
 */
export function carvePath(rng: RNG, w: number, h: number, start: Point, goal: Point): Point[] {
  // Simple randomized DFS from start to goal
  const stack: Point[] = [start];
  const visited = new Set<string>();
  const parent = new Map<string, string>();
  const key = (p: Point) => `${p.x},${p.y}`;

  while (stack.length) {
    const cur = stack.pop()!;
    if (key(cur) === key(goal)) break;
    if (visited.has(key(cur))) continue;
    visited.add(key(cur));

    const neigh = neighbors4(cur, w, h);
    shuffleInPlace(rng, neigh);
    for (const nb of neigh) {
      if (!visited.has(key(nb))) {
        parent.set(key(nb), key(cur));
        stack.push(nb);
      }
    }
  }

  // Reconstruct path
  const path: Point[] = [];
  let curKey = key(goal);
  if (!parent.has(curKey) && curKey !== key(start)) {
    // If goal wasn’t reached (very rare in 4-neigh grid DFS), force a straight line fallback
    const straight: Point[] = [];
    const dx = Math.sign(goal.x - start.x);
    const dy = Math.sign(goal.y - start.y);
    let x = start.x, y = start.y;
    while (x !== goal.x || y !== goal.y) {
      if (x !== goal.x) x += dx;
      else if (y !== goal.y) y += dy;
      straight.push({ x, y });
    }
    return [start, ...straight];
  }

  // Backtrack
  while (curKey !== key(start)) {
    const [x, y] = curKey.split(",").map(Number);
    path.push({ x, y });
    curKey = parent.get(curKey)!;
  }
  path.push(start);
  path.reverse();
  return path;
}

/** Pick a random border cell for entry/exit variety. */
export function randomBorderCell(rng: RNG, w: number, h: number): Point {
  const side = randInt(rng, 0, 3); // 0 top,1 bottom,2 left,3 right
  switch (side) {
    case 0: return { x: randInt(rng, 0, w - 1), y: 0 };
    case 1: return { x: randInt(rng, 0, w - 1), y: h - 1 };
    case 2: return { x: 0, y: randInt(rng, 0, h - 1) };
    default: return { x: w - 1, y: randInt(rng, 0, h - 1) };
  }
}
