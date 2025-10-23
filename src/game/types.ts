// /src/game/types.ts

// ---- Core room/tile types ----
export type RoomType =
  | "void"
  | "empty"
  | "combat"
  | "treasure"
  | "trap"
  | "puzzle"
  | "exit";

export type Room = {
  x: number;
  y: number;
  type: RoomType;
  visited: boolean;
};

export type FloorMap = {
  width: number;
  height: number;
  rooms: Room[];
};

// ---- Player & game mode ----
export type Player = {
  hp: number;
  mp: number;
  pos: { x: number; y: number };
};

export type GameMode = "explore" | "combat";

// ---- Snapshot the engine exposes ----
export type GameSnapshot = {
  floor: number;
  rngSeed: number;
  map: FloorMap;
  player: Player;
  mode: GameMode;
  towerId: string;
  log?: { ts: number; text: string }[];
};

// ---- Towers / rulesets ----
export type DeadSpaceRule =
  | number
  | { base: number; perFloorDelta?: number };

export type TowerRuleset = {
  id: string;
  name: string;
  tagline: string;
  minFloors: number;
  maxFloors: number;
  dead_space: DeadSpaceRule;
};

// ---- Directions (for text commands) ----
export type Dir =
  | "left" | "right" | "up" | "down"
  | "north" | "south" | "east" | "west";
