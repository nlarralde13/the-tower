// src/app/api/floors/from-public/route.ts
import { NextResponse } from "next/server";
import { generateFloorFromPublicSeed } from "@/engine/seedIO";
import type { FloorConfig } from "@/types/tower";

type RequestBody = {
  relPath: string;          // e.g. "/data/floor-seed-f1-s1130215123.json"
  baseConfig?: Partial<FloorConfig>;
};

// Generator uses fixed 8x8; FloorConfig carries difficulty and ratios.
const DEFAULT_CONFIG: FloorConfig = {
  difficulty: 1,
  room_ratios: { combat: 0.3, trap: 0.2, loot: 0.2, out: 0.15, special: 0.15, empty: 0.2 },
  boss_room: false,
};

export async function POST(req: Request) {
  try {
    const { relPath, baseConfig }: RequestBody = await req.json();

    if (!relPath || typeof relPath !== "string") {
      return NextResponse.json(
        { error: "relPath is required (e.g. /data/my-seed.json)" },
        { status: 400 }
      );
    }

    const config: FloorConfig = { ...DEFAULT_CONFIG, ...(baseConfig || {}) } as FloorConfig;
    const grid = await generateFloorFromPublicSeed(relPath, config);

    return NextResponse.json({
      grid,
      meta: { relPath, width: grid.width, height: grid.height },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
