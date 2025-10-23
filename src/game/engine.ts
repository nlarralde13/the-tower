import type { GameSnapshot, Dir } from "@/game/types";
import { genFloorWithRules } from "./towerGen";
import { deadSpaceForFloor, getTowerById } from "./rulesets";
import { flavorFor } from "./content/flavor";

let snap: GameSnapshot;

export function startRun(seed: number, towerId: string) {
  const tower = getTowerById(towerId) ?? getTowerById("tower-1")!;
  const floor = 1;
  const deadPct = deadSpaceForFloor(tower.dead_space, floor);

  snap = {
    floor,
    rngSeed: seed,
    towerId: tower.id,
    map: genFloorWithRules(seed ^ floor, 8, 8, deadPct),
    player: { hp: 30, mp: 10, pos: { x: 0, y: 0 } },
    mode: "explore",
    log: [{ ts: Date.now(), text: "You arrive at Floor 1. Try 'look'." }],
  };
}

export function ascendFloor() {
  if (!snap) return;
  const tower = getTowerById(snap.towerId)!;
  const nextFloor = snap.floor + 1;
  const deadPct = deadSpaceForFloor(tower.dead_space, nextFloor);
  snap.floor = nextFloor;
  snap.map = genFloorWithRules(snap.rngSeed ^ nextFloor, 8, 8, deadPct);
  snap.player.pos = { x: 0, y: 0 };
  pushLog(`Floor ${nextFloor}. The air is 7% more judgmental.`);
}

export function getSnapshot() { return snap; }
export function tick(_dt: number) {}

export function describeCurrentRoom(): string {
  const r = currentRoom();
  const base = flavorFor(r.type);
  const exits = listExits();
  const exitsText = exits.length
    ? "Exits: " + exits.map(e => e.label).join(", ") + "."
    : "No obvious exits. How original.";
  return `${base} ${exitsText}`;
}

export function moveDir(dir: Dir): string {
  const { x, y } = snap.player.pos;
  const target = translateDir({ x, y }, dir, snap.map.width, snap.map.height);
  if (!target) return quip(`You attempt to move ${dir}, narrowly avoiding success.`);
  const idx = target.y * snap.map.width + target.x;
  const room = snap.map.rooms[idx];
  if (!room || room.type === "void") return quip("That direction is mostly theoretical.");
  snap.player.pos = target;
  room.visited = true;

  if (room.type === "exit") {
    pushLog("You found the exit. ‘Up’ is a strong choice.");
  }
  return describeCurrentRoom();
}
// Coordinate-based move, used by GameViewport debug grid.
// Ignores direction logic and allows absolute moves by grid click.
export function moveTo(x: number, y: number): string {
  if (!snap) return "The Tower blinks: no active run.";
  const idx = y * snap.map.width + x;
  const room = snap.map.rooms[idx];
  if (!room) return "That coordinate doesn’t exist.";
  if (room.type === "void") return "That spot is just… void. Try somewhere less nonexistent.";

  snap.player.pos = { x, y };
  room.visited = true;

  if (room.type === "exit") {
    pushLog("You’ve clicked directly onto the exit. Cheeky.");
    return "Exit found! The air smells of progress.";
  }

  const desc = describeCurrentRoom();
  pushLog(desc);
  return desc;
}


/* utils */

function currentRoom() {
  const { x, y } = snap.player.pos;
  return snap.map.rooms[y * snap.map.width + x];
}

function translateDir(
  p: { x: number; y: number },
  dir: Dir,
  w: number,
  h: number
) {
  const d = normalizeDir(dir); // → "left" | "right" | "up" | "down"
  const n = { x: p.x, y: p.y };

  if (d === "left")  n.x -= 1;
  if (d === "right") n.x += 1;
  if (d === "up")    n.y -= 1;
  if (d === "down")  n.y += 1;

  if (n.x < 0 || n.y < 0 || n.x >= w || n.y >= h) return null;
  return n;
}

function normalizeDir(d: Dir): "left" | "right" | "up" | "down" {
  if (d === "west")  return "left";
  if (d === "east")  return "right";
  if (d === "north") return "up";
  if (d === "south") return "down";
  return d; // already one of "left" | "right" | "up" | "down"
}


function listExits(): { dir: "left"|"right"|"up"|"down"; label: string }[] {
  const out: { dir: "left"|"right"|"up"|"down"; label: string }[] = [];
  const { x, y } = snap.player.pos;
  const w = snap.map.width, h = snap.map.height;
  const candidates = [
    { dir: "left" as const,  x: x-1, y, label: "left" },
    { dir: "right" as const, x: x+1, y, label: "right" },
    { dir: "up" as const,    x, y: y-1, label: "up" },
    { dir: "down" as const,  x, y: y+1, label: "down" },
  ];
  for (const c of candidates) {
    if (c.x < 0 || c.y < 0 || c.x >= w || c.y >= h) continue;
    const r = snap.map.rooms[c.y * w + c.x];
    if (r && r.type !== "void") out.push({ dir: c.dir, label: c.label });
  }
  return out;

  
}

function quip(s: string) { return s; }
function pushLog(text: string) { snap.log?.push({ ts: Date.now(), text }); }
