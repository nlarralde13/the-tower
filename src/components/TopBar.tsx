// components/TopBar.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";
import styles from "./TopBar.module.css";

function useCRT() {
  const [crtEnabled, setCRT] = useState<boolean>(false);

  // Load persisted preference on mount
  useEffect(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem("pref:crt") : null;
    setCRT(raw === "1");
  }, []);

  // Apply to <html> as a data-attribute for CSS hooks
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (crtEnabled) root.setAttribute("data-crt", "on");
    else root.removeAttribute("data-crt");
    try {
      localStorage.setItem("pref:crt", crtEnabled ? "1" : "0");
    } catch {}
  }, [crtEnabled]);

  return { crtEnabled, setCRT };
}

export default function TopBar() {
  const { data: session, status } = useSession();
  const { crtEnabled, setCRT } = useCRT();

  const displayName = useMemo(() => {
    if (!session?.user) return "Guest";
    return session.user.name ?? session.user.email ?? "Adventurer";
  }, [session?.user]);

  const initial = (session?.user?.name ?? session?.user?.email ?? "?").slice(0, 1).toUpperCase();

  return (
    <header className={styles.bar} role="navigation" aria-label="Top">
      <div className={styles.left}>
        <Link href="/" className={styles.brand}>
          <span className={styles.rune}>⟟</span>
          <span className={styles.brandText}>The Tower</span>
        </Link>
      </div>

      <div className={styles.center}>
        <div className={styles.identity} title={`Signed in as ${displayName}`}>
          <div className={styles.avatar} aria-hidden="true">
            {session?.user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={session.user.image} alt="" referrerPolicy="no-referrer" />
            ) : (
              <span>{initial}</span>
            )}
          </div>
          <div className={styles.idText}>
            <span className={styles.idLabel}>Signed in as</span>
            <span className={styles.idName}>{displayName}</span>
          </div>
        </div>
      </div>

      <div className={styles.right}>
        <Link href="/settings" className={styles.ghostBtn} aria-label="Settings">
          <span className={styles.icon}>⚙</span>
          <span className={styles.btnText}>Settings</span>
        </Link>

        <button
          className={styles.switch}
          onClick={() => setCRT(!crtEnabled)}
          aria-pressed={crtEnabled}
          aria-label="Toggle CRT filter"
        >
          <span className={styles.switchKnob} />
          <span className={styles.switchLabel}>{crtEnabled ? "CRT" : "Clean"}</span>
        </button>

        {status === "authenticated" ? (
          <button className={styles.primaryBtn} onClick={() => signOut({ callbackUrl: "/" })}>
            Sign out
          </button>
        ) : (
          <button className={styles.primaryBtn} onClick={() => signIn("google")}>
            Sign in
          </button>
        )}
      </div>
    </header>
  );
}
