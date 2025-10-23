"use client";
import { useEffect, useRef } from "react";

export function useGameLoop(enabled: boolean, step: (dt: number) => void) {
  const last = useRef<number>(0);
  useEffect(() => {
    if (!enabled) return;
    let id = 0;
    const loop = (t: number) => {
      const dt = last.current ? (t - last.current) / 1000 : 0;
      last.current = t;
      step(dt);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [enabled, step]);
}
