import type { TowerRuleset } from "./types";

export const TOWERS: TowerRuleset[] = [
  {
    id: "tower-1",
    name: "The Ministry of Silly Floors",
    tagline: "Beware of suspiciously silly corridors.",
    minFloors: 3,
    maxFloors: 7,
    dead_space: { base: 0.5, perFloorDelta: -0.04 }, // ~50% on floor 1, less each floor
  },
  {
    id: "tower-2",
    name: "The Knights Who Say ‘Ni!’",
    tagline: "Demanding shrubberies since time immemorial.",
    minFloors: 8,
    maxFloors: 12,
    dead_space: { base: 0.45, perFloorDelta: -0.03 },
  },
  {
    id: "tower-3",
    name: "The Dead Parrot Pavilion",
    tagline: "This dungeon’s not dead, it’s resting!",
    minFloors: 12,
    maxFloors: 20,
    dead_space: { base: 0.4, perFloorDelta: -0.025 },
  },
  {
    id: "tower-4",
    name: "Spam Spam Spire",
    tagline: "Every room serves… more rooms.",
    minFloors: 20,
    maxFloors: 35,
    dead_space: { base: 0.35, perFloorDelta: -0.02 },
  },
  {
    id: "tower-5",
    name: "The Lumberjack’s Lodge",
    tagline: "I’m okay; you’re okay; difficulty’s not okay.",
    minFloors: 35,
    maxFloors: 60,
    dead_space: { base: 0.3, perFloorDelta: -0.015 },
  },
  {
    id: "tower-6",
    name: "The Spanish Inquisition",
    tagline: "Nobody expects the… scaling curve.",
    minFloors: 60,
    maxFloors: 120,
    dead_space: { base: 0.25, perFloorDelta: -0.01 },
  },
  {
    id: "tower-7",
    name: "Camelot (It’s Only a Model)",
    tagline: "A mere flesh wound of 250 floors (placeholder).",
    minFloors: 120,
    maxFloors: 250,
    dead_space: { base: 0.2, perFloorDelta: -0.005 },
  },
];

export function getTowerById(id: string): TowerRuleset | undefined {
  return TOWERS.find(t => t.id === id);
}

export function deadSpaceForFloor(rule: TowerRuleset["dead_space"], floor: number) {
  if (typeof rule === "number") return clamp01(rule);
  const base = rule.base ?? 0.5;
  const delta = rule.perFloorDelta ?? 0;
  return clamp01(base + (floor - 1) * delta);
}

function clamp01(n: number) { return Math.max(0, Math.min(1, n)); }
