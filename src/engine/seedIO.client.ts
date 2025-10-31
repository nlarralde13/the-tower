// src/engine/seedIO.client.ts
import type { FloorSeed } from "@/types/tower";
import { generateFloorFromSeed } from "@/engine/generateFloor";

export async function loadSeedViaFetch(url: string): Promise<FloorSeed> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch seed: ${res.status}`);
  return (await res.json()) as FloorSeed;
}

export async function generateFloorFromSeedUrl(
  url: string,
  baseConfig: Parameters<typeof generateFloorFromSeed>[1]
) {
  const seed = await loadSeedViaFetch(url);
  return generateFloorFromSeed(seed, baseConfig);
}
