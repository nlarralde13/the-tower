"use client";
import "./tower.css";

import { useEffect } from "react";
import { startRun } from "@/game/engine";

import GameViewer from "@/components/GameViewer";
import ConsolePanel from "@/components/ConsolePanel";
import LegendSheet from "@/components/LegendSheet";

export default function PlayClient({ towerId }: { towerId: string }) {
  useEffect(() => { startRun(Date.now(), towerId); }, [towerId]);

  return (
    <div className="tower-screen p-6">
      <main className="tower-vertical mx-auto">
        {/* Grid card (centered). Legend opens via button. */}
        <section className="neon-panel grid-frame p-4 scanlines">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-bold text-zinc-100">Developer Grid (full 8×8)</h2>
            <LegendSheet />
          </div>

          <div className="grid-inner mx-auto">
            <GameViewer />
          </div>

          <p className="mt-2 text-[10px] uppercase tracking-wide text-zinc-400 text-center">
            Dev Mode
          </p>
        </section>

        {/* Console under grid, boxed, ~5 lines visible */}
        <section className="tower-card neon-panel p-3">
          <ConsolePanel maxLines={5} />
        </section>
      </main>
    </div>
  );
}
