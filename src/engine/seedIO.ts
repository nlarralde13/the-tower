// src/engine/seedIO.ts
import { promises as fs } from "fs";
import path from "path";
import type { FloorSeed } from "@/types/tower";
import { generateFloorFromSeed } from "@/engine/generateFloor";

export async function loadSeedFromPublic(relPath: string): Promise<FloorSeed> {
  const filePath = path.join(process.cwd(), "public", relPath.replace(/^\/+/, ""));
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as FloorSeed;
}

export async function generateFloorFromPublicSeed(
  relPath: string,
  baseConfig: Parameters<typeof generateFloorFromSeed>[1]
) {
  const seed = await loadSeedFromPublic(relPath);
  return generateFloorFromSeed(seed, baseConfig);
}
