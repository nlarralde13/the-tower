"use client";

import React, { useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { useRunStore } from "@/store/runStore";
import { useUIStore } from "@/store/uiStore";

// Lazy-load the shared thumb bar to avoid SSR issues.
const ThumbBar = dynamic(() => import("@/components/ThumbBar"), { ssr: false });

type Direction = "north" | "south" | "west" | "east";

const NOOP = () => {};
const DIR_TO_LETTER: Record<Direction, "N" | "S" | "E" | "W"> = {
  north: "N",
  south: "S",
  east: "E",
  west: "W",
};

function ExplorePadInner() {
  const move = useRunStore((s) => s.move);
  const ascend = useRunStore((s) => s.ascend);
  const roomTypeAt = useRunStore((s) => s.roomTypeAt);
  const pos = useRunStore((s) => s.playerPos);
  const defeatOverlay = useRunStore((s) => s.defeatOverlay);
  const openPanel = useUIStore((s) => s.open);

  const canAscend = useMemo(() => {
    if (!pos || typeof roomTypeAt !== "function") return false;
    return roomTypeAt(pos.x, pos.y) === "exit";
  }, [pos, roomTypeAt]);

  const handleMove = useCallback(
    (dir: Direction) => {
      if (typeof move === "function") {
        move(DIR_TO_LETTER[dir]);
      }
    },
    [move]
  );

  const handleAscend = useCallback(() => {
    if (canAscend && typeof ascend === "function") {
      ascend();
    }
  }, [ascend, canAscend]);

  const handleOpenJournal = useCallback(() => {
    openPanel("journal");
  }, [openPanel]);

  const handleOpenMap = useCallback(() => {
    openPanel("map");
  }, [openPanel]);

  const handleOpenCharacter = useCallback(() => {
    openPanel("character");
  }, [openPanel]);

  return (
    <div className="pad-surface" aria-disabled={defeatOverlay || undefined}>
      <ThumbBar
        variant="overlay"
        mode="explore"
        disabled={defeatOverlay}
        onMove={handleMove}
        onAscend={handleAscend}
        showAscend={canAscend}
        onInteract={NOOP}
        onBack={NOOP}
        onOpenJournal={handleOpenJournal}
        onOpenMap={handleOpenMap}
        onOpenCharacter={handleOpenCharacter}
        onLookAround={handleOpenMap}
      />
    </div>
  );
}

export default React.memo(ExplorePadInner);


