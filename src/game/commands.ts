import type { Dir } from "./types";

const DIR_SYNONYMS: Record<string, Dir> = {
  "l": "left", "left": "left", "west": "west",
  "r": "right", "right": "right", "east": "east",
  "u": "up", "up": "up", "north": "north",
  "d": "down", "down": "down", "south": "south",
};

export type Parsed =
  | { type: "look" }
  | { type: "move"; dir: Dir }
  | { type: "help" }
  | { type: "unknown"; raw: string };

export function parseCommand(input: string): Parsed {
  const raw = input.trim().toLowerCase();
  if (!raw) return { type: "unknown", raw };

  if (raw === "look" || raw === "look around" || raw === "l@@k") {
    return { type: "look" };
  }

  if (raw === "help" || raw === "?") return { type: "help" };

  // move / go / walk / run / step <dir>
  const moveRegex = /^(?:move|go|walk|run|step)\s+(.+)$/;
  const m = raw.match(moveRegex);
  if (m) {
    const word = m[1].trim();
    const dir = DIR_SYNONYMS[word];
    if (dir) return { type: "move", dir };
  }

  // bare direction
  if (DIR_SYNONYMS[raw]) return { type: "move", dir: DIR_SYNONYMS[raw] };

  return { type: "unknown", raw: input };
}
