"use client";

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type RetroMode = "off" | "scanlines" | "filter";

type PreferencesState = {
  retro: RetroMode;
  highContrast: boolean;
  textLarge: boolean;
  haptics: boolean;
  hapticsIntensity: number;
  // NEW: audio prefs
  musicEnabled: boolean;   // toggle background music
  musicVolume: number;     // 0..1 float
};

type PreferencesContextValue = {
  state: PreferencesState;
  hydrated: boolean;
  setRetro: (mode: RetroMode) => void;
  setHighContrast: (value: boolean) => void;
  setTextLarge: (value: boolean) => void;
  setHaptics: (value: boolean) => void;
  setHapticsIntensity: (value: number) => void;
  // NEW setters
  setMusicEnabled: (value: boolean) => void;
  setMusicVolume: (value: number) => void; // expects 0..1
};

const DEFAULT_STATE: PreferencesState = {
  retro: "off",
  highContrast: false,
  textLarge: false,
  haptics: false,
  hapticsIntensity: 0.7,
  // NEW defaults
  musicEnabled: true,
  musicVolume: 0.4,
};

const STORAGE_KEYS = {
  retro: "pref:retro",
  highContrast: "pref:hc",
  textLarge: "pref:textlg",
  haptics: "pref:haptics",
  hapticsIntensity: "pref:haptics:intensity",
  // NEW keys
  musicEnabled: "pref:music",
  musicVolume: "pref:musicVol",
} as const;

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function parseRetro(raw: string | null): RetroMode {
  if (raw === "scanlines" || raw === "filter" || raw === "off") return raw;
  return "off";
}

function parseFlag(raw: string | null): boolean {
  return raw === "on" || raw === "1" || raw === "true";
}

function parseVolume(raw: string | null, fallback = 0.4): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PreferencesState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;

    const nextState: PreferencesState = {
      retro: parseRetro(localStorage.getItem(STORAGE_KEYS.retro)),
      highContrast: parseFlag(localStorage.getItem(STORAGE_KEYS.highContrast)),
      textLarge: parseFlag(localStorage.getItem(STORAGE_KEYS.textLarge)),
      haptics: parseFlag(localStorage.getItem(STORAGE_KEYS.haptics)),
      hapticsIntensity: parseVolume(localStorage.getItem(STORAGE_KEYS.hapticsIntensity), DEFAULT_STATE.hapticsIntensity),
      musicEnabled: parseFlag(localStorage.getItem(STORAGE_KEYS.musicEnabled)) ?? DEFAULT_STATE.musicEnabled,
      musicVolume: parseVolume(localStorage.getItem(STORAGE_KEYS.musicVolume), DEFAULT_STATE.musicVolume),
    };

    startTransition(() => {
      setState(nextState);
      setHydrated(true);
    });
  }, []);

  // Persist to localStorage on change
  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;

    try {
      localStorage.setItem(STORAGE_KEYS.retro, state.retro);
      localStorage.setItem(STORAGE_KEYS.highContrast, state.highContrast ? "on" : "off");
      localStorage.setItem(STORAGE_KEYS.textLarge, state.textLarge ? "on" : "off");
      localStorage.setItem(STORAGE_KEYS.haptics, state.haptics ? "on" : "off");
      localStorage.setItem(STORAGE_KEYS.hapticsIntensity, String(state.hapticsIntensity));
      // NEW: audio prefs
      localStorage.setItem(STORAGE_KEYS.musicEnabled, state.musicEnabled ? "on" : "off");
      localStorage.setItem(STORAGE_KEYS.musicVolume, String(state.musicVolume));
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("Failed to persist preferences", error);
      }
    }
  }, [state, hydrated]);

  // Apply document-level flags (for CSS, etc.)
  useEffect(() => {
    if (!hydrated || typeof document === "undefined") return;
    const root = document.documentElement;

    if (state.highContrast) root.setAttribute("data-hc", "");
    else root.removeAttribute("data-hc");

    if (state.textLarge) root.setAttribute("data-bigtext", "");
    else root.removeAttribute("data-bigtext");

    // Optional: expose music state for theming (no-op if unused)
    if (!state.musicEnabled) root.setAttribute("data-music-off", "");
    else root.removeAttribute("data-music-off");
  }, [state.highContrast, state.textLarge, state.musicEnabled, hydrated]);

  // Setters
  const setRetro = useCallback((mode: RetroMode) => {
    setState((prev) => (prev.retro === mode ? prev : { ...prev, retro: mode }));
  }, []);

  const setHighContrast = useCallback((value: boolean) => {
    setState((prev) => (prev.highContrast === value ? prev : { ...prev, highContrast: value }));
  }, []);

  const setTextLarge = useCallback((value: boolean) => {
    setState((prev) => (prev.textLarge === value ? prev : { ...prev, textLarge: value }));
  }, []);

  const setHaptics = useCallback((value: boolean) => {
    setState((prev) => (prev.haptics === value ? prev : { ...prev, haptics: value }));
  }, []);

  const setHapticsIntensity = useCallback((value: number) => {
    const clamped = Math.max(0, Math.min(1, value));
    setState((prev) => (prev.hapticsIntensity === clamped ? prev : { ...prev, hapticsIntensity: clamped }));
  }, []);

  // NEW audio setters
  const setMusicEnabled = useCallback((value: boolean) => {
    setState((prev) => (prev.musicEnabled === value ? prev : { ...prev, musicEnabled: value }));
  }, []);

  const setMusicVolume = useCallback((value: number) => {
    const clamped = Math.max(0, Math.min(1, value));
    setState((prev) => (prev.musicVolume === clamped ? prev : { ...prev, musicVolume: clamped }));
  }, []);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      state,
      hydrated,
      setRetro,
      setHighContrast,
      setTextLarge,
      setHaptics,
      setHapticsIntensity,
      setMusicEnabled,
      setMusicVolume,
    }),
    [
      state,
      hydrated,
      setRetro,
      setHighContrast,
      setTextLarge,
      setHaptics,
      setHapticsIntensity,
      setMusicEnabled,
      setMusicVolume,
    ]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used within a PreferencesProvider");
  return ctx;
}

export type { RetroMode, PreferencesState };
