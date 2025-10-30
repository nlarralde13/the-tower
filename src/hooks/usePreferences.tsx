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
};

type PreferencesContextValue = {
  state: PreferencesState;
  hydrated: boolean;
  setRetro: (mode: RetroMode) => void;
  setHighContrast: (value: boolean) => void;
  setTextLarge: (value: boolean) => void;
  setHaptics: (value: boolean) => void;
};

const DEFAULT_STATE: PreferencesState = {
  retro: "off",
  highContrast: false,
  textLarge: false,
  haptics: false,
};

const STORAGE_KEYS = {
  retro: "pref:retro",
  highContrast: "pref:hc",
  textLarge: "pref:textlg",
  haptics: "pref:haptics",
} as const;

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function parseRetro(raw: string | null): RetroMode {
  if (raw === "scanlines" || raw === "filter" || raw === "off") {
    return raw;
  }
  return "off";
}

function parseFlag(raw: string | null): boolean {
  return raw === "on" || raw === "1" || raw === "true";
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PreferencesState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const nextState: PreferencesState = {
      retro: parseRetro(localStorage.getItem(STORAGE_KEYS.retro)),
      highContrast: parseFlag(localStorage.getItem(STORAGE_KEYS.highContrast)),
      textLarge: parseFlag(localStorage.getItem(STORAGE_KEYS.textLarge)),
      haptics: parseFlag(localStorage.getItem(STORAGE_KEYS.haptics)),
    };

    startTransition(() => {
      setState(nextState);
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;

    try {
      localStorage.setItem(STORAGE_KEYS.retro, state.retro);
      localStorage.setItem(STORAGE_KEYS.highContrast, state.highContrast ? "on" : "off");
      localStorage.setItem(STORAGE_KEYS.textLarge, state.textLarge ? "on" : "off");
      localStorage.setItem(STORAGE_KEYS.haptics, state.haptics ? "on" : "off");
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("Failed to persist preferences", error);
      }
    }
  }, [state, hydrated]);

  useEffect(() => {
    if (!hydrated || typeof document === "undefined") return;
    const root = document.documentElement;

    if (state.highContrast) root.setAttribute("data-hc", "");
    else root.removeAttribute("data-hc");

    if (state.textLarge) root.setAttribute("data-bigtext", "");
    else root.removeAttribute("data-bigtext");
  }, [state.highContrast, state.textLarge, hydrated]);

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

  const value = useMemo<PreferencesContextValue>(() => ({
    state,
    hydrated,
    setRetro,
    setHighContrast,
    setTextLarge,
    setHaptics,
  }), [state, hydrated, setRetro, setHighContrast, setTextLarge, setHaptics]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error("usePreferences must be used within a PreferencesProvider");
  }
  return ctx;
}

export type { RetroMode, PreferencesState };
