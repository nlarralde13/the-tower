import type { RoomType } from "@/types/tower";
import entry from "@/game/flavor/entry";
import exitLines from "@/game/flavor/exit";
import empty from "@/game/flavor/empty";
import combat from "@/game/flavor/combat";
import trap from "@/game/flavor/trap";
import loot from "@/game/flavor/loot";
import out from "@/game/flavor/out";
import special from "@/game/flavor/special";
import boss from "@/game/flavor/boss";

export const ROOM_FLAVOR: Record<Exclude<RoomType, "blocked">, string[]> = {
  entry,
  exit: exitLines,
  empty,
  combat,
  trap,
  loot,
  special,
  out,
  boss,
};

export function chooseFlavor(type: RoomType): string {
  if (type === "blocked") return "A wall denies your path.";
  const arr = ROOM_FLAVOR[type] ?? ["The room defies description."];
  return arr[Math.floor(Math.random() * arr.length)] ?? "";
}

export function exitsFlavor(dirs: string[]): string {
  if (!dirs.length) return "No exits are apparent.";
  const pretty = dirs.map(capDir);
  if (pretty.length === 1) return `You see a door ${pretty[0]}.`;
  if (pretty.length === 2) return `You see doors ${pretty[0]} and ${pretty[1]}.`;
  const last = pretty.pop();
  return `You see doors ${pretty.join(", ")}, and ${last}.`;
}

function capDir(s: string) {
  switch (s) {
    case "north": return "North";
    case "south": return "South";
    case "east": return "East";
    case "west": return "West";
    default: return s.charAt(0).toUpperCase() + s.slice(1);
  }
}

