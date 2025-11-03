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
  disabled?: boolean;
};

export default function ThumbBar({
  onMove,
  onInspect,
  onUse,
  onDefend,
  onFlee,
  onBack,
  onAscend,
  showAscend,
  disabled = false,
}: ThumbBarProps) {
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
        <BigButton
          label="Ascend"
          ariaLabel="Ascend to next floor"
          onClick={onAscend}
          disabled={disabled}
        />
      )}
      {/* D-Pad */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, alignItems: "center", justifyItems: "center" }}>
        <span />
        <BigButton
          label="North"
          ariaLabel="Move north"
          onClick={() => !disabled && onMove("north")}
          disabled={disabled}
        />
        <span />
        <BigButton
          label="West"
          ariaLabel="Move west"
          onClick={() => !disabled && onMove("west")}
          disabled={disabled}
        />
        <span />
        <BigButton
          label="East"
          ariaLabel="Move east"
          onClick={() => !disabled && onMove("east")}
          disabled={disabled}
        />
        <span />
        <BigButton
          label="South"
          ariaLabel="Move south"
          onClick={() => !disabled && onMove("south")}
          disabled={disabled}
        />
        <span />
      </div>

      {/* Actions Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
        <BigButton label="Inspect" ariaLabel="Inspect" onClick={onInspect} disabled={disabled} />
        <BigButton label="Use" ariaLabel="Use" onClick={onUse} disabled={disabled} />
        <BigButton label="Defend" ariaLabel="Defend" onClick={onDefend} disabled={disabled} />
        <BigButton label="Flee" ariaLabel="Flee" onClick={onFlee} disabled={disabled} />
        <BigButton label="Back" ariaLabel="Back" onClick={onBack} disabled={disabled} />
      </div>
    </div>
  );
}

function BigButton({
  label,
  icon,
  ariaLabel,
  onClick,
  disabled = false,
}: {
  label: string;
  icon?: string;
  ariaLabel: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      disabled={disabled}
      style={{
        width: "100%",
        minHeight: 56,
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.15)",
        background: "rgba(255,255,255,0.08)",
        color: "inherit",
        fontSize: 16,
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {icon && <span style={{ marginRight: 8 }}>{icon}</span>}
      {label}
    </button>
  );
}
