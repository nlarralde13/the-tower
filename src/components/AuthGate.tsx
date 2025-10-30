"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import clsx from "clsx";
import { signIn, useSession } from "next-auth/react";

const PROVIDERS = [
  { id: "google", label: "Continue with Google" },
  { id: "github", label: "Continue with GitHub" },
  { id: "discord", label: "Continue with Discord" },
] as const;

type ProviderId = (typeof PROVIDERS)[number]["id"];

export default function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const [pending, setPending] = useState<ProviderId | null>(null);
  const [statusMessage, setStatusMessage] = useState("Choose a sign-in option to continue.");

  if (status === "loading") {
    return (
      <div className="screen center" role="status" aria-live="polite">
        <div className="auth-card" aria-busy>
          <h1 className="auth-card__title">The Tower</h1>
          <p className="auth-card__subtitle">Checking your session…</p>
        </div>
      </div>
    );
  }

  if (status !== "authenticated") {
    const handleSignIn = (provider: ProviderId) => {
      setPending(provider);
      const providerLabel = PROVIDERS.find((entry) => entry.id === provider)?.label ?? "provider";
      setStatusMessage(`Opening ${providerLabel}…`);
      void signIn(provider);
    };

    return (
      <div className="screen center">
        <div className="auth-card" aria-busy={pending !== null}>
          <div>
            <h1 className="auth-card__title">The Tower</h1>
            <p className="auth-card__subtitle">Pocket Run Edition</p>
          </div>

          <p className="settings-hint">
            Sign in to sync your climb, keep traders honest, and remember your feats.
          </p>

          <div className="auth-card__providers">
            {PROVIDERS.map((provider) => {
              const isPending = pending === provider.id;
              const defaultStyle = provider.id === "google" ? "btn--primary" : "btn--ghost";
              return (
                <button
                  key={provider.id}
                  type="button"
                  className={clsx(
                    "btn",
                    isPending ? "btn--primary" : defaultStyle,
                    isPending && "is-loading"
                  )}
                  onClick={() => handleSignIn(provider.id)}
                  disabled={pending !== null}
                >
                  {isPending ? "Connecting…" : provider.label}
                </button>
              );
            })}
          </div>

          <p className="auth-card__status" role="status" aria-live="polite">
            {statusMessage}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
