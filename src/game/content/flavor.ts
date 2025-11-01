import type { RoomType } from "@/types/tower";
import { chooseFlavor } from "@/game/flavor";

// Compatibility wrapper for legacy engine import path
export function flavorFor(type: RoomType) {
  if ((type as any) === "void" || (type as any) === "blocked") {
    return "Why are you running face first into that wall?";
  }
  return chooseFlavor(type);
}

