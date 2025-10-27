"use client";

import { useEffect, useRef } from "react";
import { getSnapshot, tick, moveTo } from "@/game/engine";
import { useGameLoop } from "@/hooks/useGameLoop";

/**
 * Fixed-size dev grid:
 * - 8×8 tiles, each 32px → 256×256.
 * - HiDPI crisp via devicePixelRatio.
 * - White dot for player; click-to-move stays for testing.
 */
export default function GameViewer() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useGameLoop(true, tick);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const TILE = 32;
    const N = 8;

    // CSS size is fixed by parent (256×256). Make the drawing buffer HiDPI.
    function resizeForHiDPI() {
      const pr = window.devicePixelRatio || 1;
      const cssW = TILE * N; // 256
      const cssH = TILE * N; // 256
      canvas.width = Math.floor(cssW * pr);
      canvas.height = Math.floor(cssH * pr);
      canvas.style.width = cssW + "px";
      canvas.style.height = cssH + "px";
      ctx.setTransform(pr, 0, 0, pr, 0, 0); // draw in CSS pixels
    }

    resizeForHiDPI();

    let raf = 0;
    const render = () => {
      const snap = getSnapshot?.();
      ctx.clearRect(0, 0, TILE * N, TILE * N);

      if (snap) {
        const { map, player } = snap;

        // tiles
        for (let y = 0; y < N; y++) {
          for (let x = 0; x < N; x++) {
            const r = map.rooms[y * N + x];
            const color =
              r.type === "void" ? "#000000" :
              r.type === "exit" ? "#22c55e" :
              r.type === "combat" ? "#e11d48" :
              r.type === "treasure" ? "#eab308" :
              r.type === "trap" ? "#a855f7" :
              r.type === "puzzle" ? "#06b6d4" :
              "#1414bdff";
            ctx.fillStyle = color;
            ctx.fillRect(x * TILE, y * TILE, TILE - 2, TILE - 2);
          }
        }

        // subtle grid lines
        ctx.strokeStyle = "rgba(255,255,255,0.06)";
        for (let i = 0; i <= N; i++) {
          const p = i * TILE;
          ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(N * TILE, p); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, N * TILE); ctx.stroke();
        }

        // player dot
        ctx.fillStyle = "#ffffff";
        const px = player.pos.x * TILE + TILE / 2;
        const py = player.pos.y * TILE + TILE / 2;
        ctx.beginPath();
        ctx.arc(px, py, Math.max(4, TILE * 0.25), 0, Math.PI * 2);
        ctx.fill();

        // watermark
        ctx.save();
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = "#ffffff";
        ctx.font = "12px ui-sans-serif, system-ui";
        ctx.textAlign = "right";
        ctx.fillText("DEV MODE", N * TILE - 6, N * TILE - 6);
        ctx.restore();
      }

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, []);

  function onClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const TILE = 32;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const gx = Math.min(7, Math.max(0, Math.floor(x / TILE)));
    const gy = Math.min(7, Math.max(0, Math.floor(y / TILE)));
    moveTo(gx, gy);
  }

  return (
    <canvas
      ref={canvasRef}
      className="block rounded-md border border-zinc-800 bg-zinc-900"
      width={256}
      height={256}
      onClick={onClick}
    />
  );
}
