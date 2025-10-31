// /src/types/tower.ts
// Core structural types for The Tower game logic

export interface RoomRatios {
  combat: number;
  trap: number;
  loot: number;
  out: number;
  special: number;
}

export interface FloorConfig {
  difficulty: number;
  room_ratios: RoomRatios;
  boss_room?: boolean;
}

export interface ScalingRules {
  enemy_level_base: number;
  enemy_level_step: number;
  loot_quality_step: number;
}

export interface TowerRules {
  requires_valid_path: boolean;
  exit_requires_boss_clear: boolean;
  allow_random_exits: boolean;
}

export interface Ruleset {
  tower_id: string;
  display_name: string;
  description: string;
  floor_count: number;
  floors: Record<string, FloorConfig>;
  mutators: any[];
  scaling: ScalingRules;
  rules: TowerRules;
}
// --- Grid & generation types ---

export type RoomType = "entry" | "exit" | "boss" | "combat" | "trap" | "loot" | "out" | "special" | "empty";

export interface Cell {
  x: number;
  y: number;
  type: RoomType;
}

export interface FloorGrid {
  width: number;   // always 8
  height: number;  // always 8
  cells: Cell[];   // flat list, index = y * width + x
  entry: { x: number; y: number };
  exit: { x: number; y: number };
  boss?: { x: number; y: number }; // only on last floor
}
