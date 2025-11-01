"use client";

import React from "react";

type ThumbBarProps = {
  onMove: (dir: "north" | "south" | "west" | "east") => void;
  onInspect?: () => void;
  onUse?: () => void;
  onDefend?: () => void;
  onFlee?: () => void;
  onBack?: () => void;
  onAscend?: () => void;
  showAscend?: boolean;
};

export default function ThumbBar({ onMove, onInspect, onUse, onDefend, onFlee, onBack, onAscend, showAscend }: ThumbBarProps) {
  return (
    <div
      style={{
        position: "sticky",
        bottom: 0,
        left: 0,
        right: 0,
        padding: 12,
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: 12,
        background: "linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,0.6))",
        backdropFilter: "blur(2px)",
      }}
    >
      {showAscend && (
        <BigButton label="Ascend" ariaLabel="Ascend to next floor" onClick={onAscend} />
      )}
      {/* D-Pad */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, alignItems: "center", justifyItems: "center" }}>
        <span />
        <BigButton label="North" icon="↑" ariaLabel="Move north" onClick={() => onMove("north")} />
        <span />
        <BigButton label="West" icon="←" ariaLabel="Move west" onClick={() => onMove("west")} />
        <span />
        <BigButton label="East" icon="→" ariaLabel="Move east" onClick={() => onMove("east")} />
        <span />
        <BigButton label="South" icon="↓" ariaLabel="Move south" onClick={() => onMove("south")} />
        <span />
      </div>

      {/* Actions Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
        <BigButton label="Inspect" ariaLabel="Inspect" onClick={onInspect} />
        <BigButton label="Use" ariaLabel="Use" onClick={onUse} />
        <BigButton label="Defend" ariaLabel="Defend" onClick={onDefend} />
        <BigButton label="Flee" ariaLabel="Flee" onClick={onFlee} />
        <BigButton label="Back" ariaLabel="Back" onClick={onBack} />
      </div>
    </div>
  );
}

function BigButton({ label, icon, ariaLabel, onClick }: { label: string; icon?: string; ariaLabel: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        width: "100%",
        minHeight: 56,
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.15)",
        background: "rgba(255,255,255,0.08)",
        color: "inherit",
        fontSize: 16,
      }}
    >
      {icon && <span style={{ marginRight: 8 }}>{icon}</span>}
      {label}
    </button>
  );
}
