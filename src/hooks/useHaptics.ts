"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePreferences } from "./usePreferences";

export type HapticPattern = "combat_start" | "attack_hit" | "attack_taken";

const VIBRATION_PATTERNS: Record<HapticPattern, number[]> = {
  combat_start: [20, 40, 20],
  attack_hit: [40],
  attack_taken: [10, 30],
};

export function useHaptics() {
  const { state } = usePreferences();
  const [supportsVibration, setSupportsVibration] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    setSupportsVibration(typeof navigator !== "undefined" && typeof navigator.vibrate === "function");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(media.matches);
    update();
    if (media.addEventListener) media.addEventListener("change", update);
    else media.addListener(update);
    return () => {
      if (media.removeEventListener) media.removeEventListener("change", update);
      else media.removeListener(update);
    };
  }, []);

  const ensureAudioContext = useCallback(() => {
    if (typeof window === "undefined") return null;
    if (audioCtxRef.current) return audioCtxRef.current;
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audioCtxRef.current = new Ctor();
    return audioCtxRef.current;
  }, []);

  const playTick = useCallback(
    async (strength: number) => {
      const ctx = ensureAudioContext();
      if (!ctx) return;
      try {
        if (ctx.state === "suspended") await ctx.resume();
      } catch {
        // ignore resume failures (user gesture requirement)
      }
      const now = ctx.currentTime;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const baseVolume = Math.max(0.1, Math.min(0.9, state.musicVolume ?? 0.4));
      const loudness = Math.min(1, baseVolume * (0.4 + strength * 0.8));
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(260, now);
      gain.gain.setValueAtTime(loudness, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.1);
    },
    [ensureAudioContext, state.musicVolume]
  );

  const intensity = useMemo(() => {
    const raw = state.hapticsIntensity ?? 0.7;
    return Math.max(0, Math.min(1, raw));
  }, [state.hapticsIntensity]);

  const trigger = useCallback(
    (pattern: HapticPattern) => {
      if (!state.haptics || reduceMotion) return;
      const sequence = VIBRATION_PATTERNS[pattern];
      if (!sequence) return;

      if (supportsVibration && navigator?.vibrate) {
        const scaled = sequence.map((value, index) => {
          if (index % 2 === 0) {
            return Math.max(8, Math.round(value * (0.5 + intensity * 0.9)));
          }
          return value;
        });
        navigator.vibrate(scaled);
        return;
      }

      void playTick(intensity);
    },
    [intensity, playTick, reduceMotion, state.haptics, supportsVibration]
  );

  return { trigger, enabled: state.haptics && !reduceMotion };
}
