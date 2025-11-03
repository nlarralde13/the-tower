"use client";

import { useEffect, useMemo, useState } from "react";
import type { FloorGrid, RoomType } from "@/types/tower";

export default function SceneViewer({
  roomType,
  sceneId,
  caption,
  grid,
  playerPos,
  showOverlay = false,
  overlayCentered = false,
  floor,
  className,
}: {
  roomType: RoomType;
  sceneId: string | null;
  caption?: string;
  grid: FloorGrid | null;
  playerPos: { x: number; y: number } | null;
  showOverlay?: boolean;
  overlayCentered?: boolean;
  floor?: number;
  className?: string;
}) {
  const [imgError, setImgError] = useState(false);
  const [usedFallback, setUsedFallback] = useState(false);
  const [allowMotion, setAllowMotion] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setAllowMotion(!mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    setImgError(false);
    setUsedFallback(false);
  }, [sceneId, roomType]);

  const defaultSrc = `/images/scenes/${roomType}/${roomType}_default.png`;
  const chosenSrc = sceneId ? `/images/scenes/${sceneId}` : null;
  const src = usedFallback ? defaultSrc : chosenSrc;
  const label = useMemo(() => caption ?? prettyType(roomType), [caption, roomType]);

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: "100%",
        flex: 1,
        minHeight: 220,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "linear-gradient(180deg, rgba(10,10,14,0.8), rgba(3,3,6,0.9))",
      }}
      aria-label={label}
    >
      {src && !imgError ? (
        <img
          key={src}
          src={src}
          alt={label}
          onError={() => {
            if (!usedFallback) {
              setUsedFallback(true);
              setImgError(false);
            } else {
              setImgError(true);
            }
          }}
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
            transition: allowMotion ? "opacity 180ms ease-in" : undefined,
            opacity: 1,
          }}
        />
      ) : (
        <div
          role="img"
          aria-label={`${label} (placeholder)`}
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#cbd5e1",
            background: "repeating-linear-gradient(45deg, rgba(255,255,255,0.03), rgba(255,255,255,0.03) 8px, transparent 8px, transparent 16px)",
          }}
        >
          <div style={{
            padding: 16,
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 12,
            background: "rgba(0,0,0,0.35)",
            fontSize: 18,
            textAlign: "center",
          }}>
            {prettyType(roomType)}
          </div>
        </div>
      )}

      {caption && !overlayCentered && (
        <div aria-live="polite" style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "10px 12px", fontSize: 14, color: "#e5e7eb", background: "linear-gradient(0deg, rgba(0,0,0,0.5), rgba(0,0,0,0))", textShadow: "0 1px 1px rgba(0,0,0,0.6)" }}>{caption}</div>
      )}

      {caption && overlayCentered && (
        <div
          aria-live="polite"
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            maxWidth: "min(640px, 92%)",
            padding: "14px 16px",
            borderRadius: 14,
            border: "1px solid rgba(231,215,167,0.28)",
            background: "rgba(16,13,24,0.72)",
            boxShadow: "var(--shadow-soft, 0 24px 40px rgba(0,0,0,0.45))",
            textAlign: "center",
            fontSize: 16,
            lineHeight: 1.4,
          }}
        >
          {caption}
        </div>
      )}

      {typeof floor === "number" && (
        <div
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid rgba(231,215,167,0.28)",
            background: "rgba(26,22,37,0.6)",
            fontSize: 12,
            letterSpacing: 0.02,
          }}
          aria-label={`Floor ${floor}`}
        >
          Floor {floor}
        </div>
      )}

      {showOverlay && grid && (
        <GridOverlay grid={grid} playerPos={playerPos} />
      )}
    </div>
  );
}

function prettyType(t: RoomType) {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function GridOverlay({ grid, playerPos }: { grid: FloorGrid; playerPos: { x: number; y: number } | null }) {
  const size = 8; // tiles across
  return (
    <div
      style={{
        position: "absolute",
        inset: 8,
        borderRadius: 8,
        pointerEvents: "none",
        display: "grid",
        gridTemplateColumns: `repeat(${grid.width}, 1fr)`,
        gridTemplateRows: `repeat(${grid.height}, 1fr)`,
        gap: 1,
        opacity: 0.9,
      }}
      aria-hidden
    >
      {grid.cells.map((c, i) => (
        <div
          key={i}
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            background: tileColor(c.type),
            outline: playerPos && c.x === playerPos.x && c.y === playerPos.y ? "2px solid #f0abfc" : undefined,
          }}
          title={`${c.x},${c.y} - ${c.type}`}
        />
      ))}
    </div>
  );
}

function tileColor(t: RoomType) {
  switch (t) {
    case "entry":
      return "#064e3b";
    case "exit":
      return "#0e7490";
    case "boss":
      return "#7f1d1d";
    case "combat":
      return "#4c1d95";
    case "trap":
      return "#7c2d12";
    case "loot":
      return "#065f46";
    case "out":
      return "#713f12";
    case "special":
      return "#6b21a8";
    case "empty":
      return "#111827";
    case "blocked":
      return "#0b0b0b";
    default:
      return "#0b0b0b";
  }
}
