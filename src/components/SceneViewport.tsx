"use client";
import { useEffect, useRef } from "react";
import { getSnapshot } from "@/game/engine";

export default function SceneViewport() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let id = 0;

    function draw() {
      const snap = getSnapshot();
      if (!snap) { id = requestAnimationFrame(draw); return; }
      const room = snap.map.rooms[snap.player.pos.y * snap.map.width + snap.player.pos.x];
      const { width, height } = canvas;

      // background per room type (placeholder gradient)
      const grad = ctx.createLinearGradient(0, 0, width, height);
      switch (room.type) {
        case "void": grad.addColorStop(0, "#000"); grad.addColorStop(1, "#000"); break;
        case "empty": grad.addColorStop(0, "#0f172a"); grad.addColorStop(1, "#1f2937"); break;
        case "combat": grad.addColorStop(0, "#3b0a0a"); grad.addColorStop(1, "#7f1d1d"); break;
        case "treasure": grad.addColorStop(0, "#3b2f0a"); grad.addColorStop(1, "#a16207"); break;
        case "trap": grad.addColorStop(0, "#2e1065"); grad.addColorStop(1, "#6d28d9"); break;
        case "puzzle": grad.addColorStop(0, "#083344"); grad.addColorStop(1, "#0891b2"); break;
        case "exit": grad.addColorStop(0, "#064e3b"); grad.addColorStop(1, "#10b981"); break;
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // subtle “scene frame” decoration
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 4;
      ctx.strokeRect(8, 8, width - 16, height - 16);

      id = requestAnimationFrame(draw);
    }

    id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={450}
      className="w-full h-auto rounded-xl border border-zinc-800"
    />
  );
}
