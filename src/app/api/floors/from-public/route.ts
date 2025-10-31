// src/app/api/floors/from-public/route.ts
import { NextResponse } from "next/server";
import { generateFloorFromPublicSeed } from "@/engine/seedIO";
import type { FloorConfig } from "@/types/tower";

type RequestBody = {
  relPath: string;          // e.g. "/data/floor-seed-f1-s1130215123.json"
  baseConfig?: Partial<FloorConfig>;
};

const DEFAULT_CONFIG: FloorConfig = {
  width: 8,
  height: 8,
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

    const config: FloorConfig = { ...DEFAULT_CONFIG, ...(baseConfig || {}) };
    const grid = await generateFloorFromPublicSeed(relPath, config);

    return NextResponse.json({
      grid,
      meta: { relPath, width: config.width, height: config.height },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
