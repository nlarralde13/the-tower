"use client";

import type { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import clsx from "clsx";

import { PreferencesProvider, usePreferences } from "@/hooks/usePreferences";

function PreferenceEffects({ children }: { children: ReactNode }) {
  const { state } = usePreferences();
  const isScanlines = state.retro === "scanlines";
  const isFilter = state.retro === "filter";

  return (
    <>
      <div className={clsx("app-visual-root", isFilter && "app-visual-root--filter")}>{children}</div>
      <div
        aria-hidden
        className={clsx("retro-overlay", isScanlines && "retro-overlay--visible")}
      />
    </>
  );
}

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <PreferencesProvider>
        <PreferenceEffects>{children}</PreferenceEffects>
      </PreferencesProvider>
    </SessionProvider>
  );
}
