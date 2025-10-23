"use client";

import { useEffect } from "react";
import { startRun } from "@/game/engine";

import ConsolePanel from "@/components/ConsolePanel";
import GameViewer from "@/components/GameViewer";

export default function PlayClient({ towerId }: { towerId: string }) {
  useEffect(() => { startRun(Date.now(), towerId); }, [towerId]);

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      {/* Centered row: grid + legend */}
      <section className="flex w-full justify-center">
        <div className="flex items-start gap-6">
          {/* Grid card (fixed 256×256) */}
          <div className="rounded-lg border border-zinc-800 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="font-semibold">Developer Grid (full 8×8)</h2>
              <span className="text-[10px] uppercase tracking-wide text-zinc-400">Dev Mode</span>
            </div>
            <div className="mx-auto" style={{ width: 256, height: 256 }}>
              <GameViewer />
            </div>
          </div>

          {/* Legend to the RIGHT of the grid */}
          <aside className="rounded-lg border border-zinc-800 p-3 w-[240px]">
            <h3 className="font-semibold mb-2">Legend</h3>
            <ul className="space-y-2 text-sm">
              <LegendItem color="#000000" label="Void (dead space)" />
              <LegendItem color="#3f3f46" label="Empty" />
              <LegendItem color="#e11d48" label="Combat" />
              <LegendItem color="#eab308" label="Treasure" />
              <LegendItem color="#a855f7" label="Trap" />
              <LegendItem color="#06b6d4" label="Puzzle" />
              <LegendItem color="#22c55e" label="Exit" />
              <LegendItem color="#ffffff" label="You (player)" dot />
            </ul>
          </aside>
        </div>
      </section>

      {/* Console UNDER the grid, centered, boxed, 5 visible lines */}
      <section className="flex w-full justify-center">
        <div className="w-full max-w-3xl rounded-lg border border-zinc-800 p-3">
          {/* 5-line viewport handled inside ConsolePanel */}
          <ConsolePanel maxLines={5} />
        </div>
      </section>
    </main>
  );
}

function LegendItem({
  color, label, dot = false,
}: { color: string; label: string; dot?: boolean }) {
  return (
    <li className="flex items-center gap-3">
      <span
        className="inline-block rounded"
        style={{
          width: dot ? 14 : 18,
          height: dot ? 14 : 18,
          background: dot ? "transparent" : color,
          border: dot ? `3px solid ${color}` : "1px solid rgba(255,255,255,0.08)",
          borderRadius: dot ? "9999px" : "0.5rem",
        }}
      />
      <span className="text-zinc-300">{label}</span>
    </li>
  );
}
