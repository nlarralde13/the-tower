"use client";

// /src/app/play/combat/page.tsx
import "../play.desktop.css";
import "../play.mobile.css";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import PageSurface from "@/components/PageSurface";
import SceneViewer from "@/components/SceneViewer";
import CombatOverlay from "@/components/combat/CombatOverlay";
import CombatRoot from "@/components/combat/CombatRoot";
import { useRunStore } from "@/store/runStore";
import { useUIStore } from "@/store/uiStore";
import { getEnemyDefinition } from "@/content";
import { DefeatOverlay } from "@/components/run/DefeatOverlay";
import { useHaptics } from "@/hooks/useHaptics";

export default function PlayCombatPage() {
  const router = useRouter();
  const { trigger: triggerHaptic } = useHaptics();

  // Select each field directly to avoid creating new objects every render.
  const runId = useRunStore((s) => s.runId);
  const mode = useRunStore((s) => s.mode);
  const activeCombat = useRunStore((s) => s.activeCombat);
  const grid = useRunStore((s) => s.grid);
  const playerPos = useRunStore((s) => s.playerPos);
  const roomTypeAt = useRunStore((s) => s.roomTypeAt);
  const sceneId = useRunStore((s) => s.sceneId);
  const currentFloor = useRunStore((s) => s.currentFloor ?? 0);
  const showOverlay = useRunStore((s) => s.dev?.gridOverlay ?? false);
  const defeatOverlay = useRunStore((s) => s.defeatOverlay);
  const combatSession = useRunStore((s) => s.combatSession);
  const persistHydrated = useRunStore((s) => s.persistHydrated);
  const endRun = useRunStore((s) => s.endRun);

  const setUIMode = useUIStore((s) => s.setMode);

  // Guard: if run missing, go to /climb
  useEffect(() => {
    if (runId === null || runId === undefined) return; // wait until known
    if (!runId) router.replace("/climb");
  }, [runId, router]);

  // Guard: if we somehow arrive here without combat, return to /play
  useEffect(() => {
    if (!persistHydrated) {
      router.replace("/play");
      return;
    }
    if (combatSession.status === "resolving") return;
    const ready = mode === "combat" && combatSession.status === "ready" && !!activeCombat;
    if (!ready) router.replace("/play");
  }, [mode, activeCombat, combatSession.status, persistHydrated, router]);

  useEffect(() => {
    if (combatSession.status !== "resolving") return;
    const timer = setTimeout(() => router.replace("/play"), 650);
    return () => clearTimeout(timer);
  }, [combatSession.status, router]);

  // Keep UI mode in sync (no-op if already "combat")
  useEffect(() => {
    setUIMode(mode === "combat" ? "combat" : "explore");
  }, [mode, setUIMode]);

  // Haptic on initial arrival to combat
  useEffect(() => {
    if (mode === "combat" && combatSession.status === "ready" && activeCombat) triggerHaptic?.("combat_start");
  }, [mode, combatSession.status, activeCombat, triggerHaptic]);

  const currentType = useMemo(() => {
    if (!playerPos || !grid || !roomTypeAt) return "combat";
    try {
      return (roomTypeAt(playerPos.x, playerPos.y) as any) ?? "combat";
    } catch {
      return "combat";
    }
  }, [grid, playerPos, roomTypeAt]);

  const combatCaption = useMemo(() => {
    if (!activeCombat) return "Combat engaged.";
    const names = activeCombat.enemies
      ?.map((id: string) => getEnemyDefinition(id)?.name ?? id)
      .filter(Boolean)
      .join(", ");
    return names ? `You engage ${names}.` : "Combat engaged.";
  }, [activeCombat]);

  const handleEndRun = () => {
    endRun?.();
    router.push("/");
  };

  return (
    <PageSurface>
      <div className="play-root" data-combat-root>
        <aside className="play-left" aria-label="Hero overview" />

        <section className="play-middle combat-stage" data-combat-host>
          {defeatOverlay ? <DefeatOverlay onEndRun={handleEndRun} /> : null}

          <div className="console-frame console-frame--combat combat-stage__frame">
            <div className="console-frame__content">
              <div className="scene-surface scene-surface--locked">
                <SceneViewer
                  className="scene-viewer scene-viewer--dimmed"
                  roomType={currentType as any}
                  sceneId={sceneId}
                  caption={combatCaption}
                  grid={grid}
                  playerPos={playerPos}
                  showOverlay={showOverlay}
                  overlayCentered
                  floor={currentFloor}
                />
              </div>

              {/* Combat control pad */}
              <div className="actions-pad combat-pad">
                <CombatRoot />
              </div>
            </div>
          </div>

          {/* HUD/turn strip/floaters */}
          <CombatOverlay active={mode === "combat"} leaving={combatSession.status === "resolving"} />
        </section>

        <aside className="play-right" aria-label="Run intel" />
      </div>
    </PageSurface>
  );
}
