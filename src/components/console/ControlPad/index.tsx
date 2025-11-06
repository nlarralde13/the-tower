"use client";
import React from "react";
import { useUIStore } from "@/store/uiStore";
import ExplorePad from "./ExplorePad";
import CombatPad from "./CombatPad";

/** Swaps the bottom console between Explore and Combat. */
function ControlPadInner() {
  const uiMode = useUIStore((s) => s.uiMode);
  return (
    <div className="control-pad" data-mode={uiMode}>
      {uiMode === "combat" ? <CombatPad /> : <ExplorePad />}
    </div>
  );
}

// ✅ Memoized so unrelated parent updates don’t remount the pad
const ControlPad = React.memo(ControlPadInner);
ControlPad.displayName = "ControlPad";
export default ControlPad;
