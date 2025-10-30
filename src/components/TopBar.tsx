"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import clsx from "clsx";
import { useMemo } from "react";

import styles from "./TopBar.module.css";

export default function TopBar() {
  const { data: session, status } = useSession();

  const displayName = useMemo(() => {
    if (!session?.user) return "Guest";
    return session.user.name ?? session.user.email ?? "Adventurer";
  }, [session?.user]);

  const initial = (session?.user?.name ?? session?.user?.email ?? "?").slice(0, 1).toUpperCase();

  return (
    <header className={styles.bar} role="banner">
      <div className={styles.left}>
        <Link href="/" className={styles.brand} aria-label="Return to landing">
          <span aria-hidden className={styles.rune}>
            ⟟
          </span>
          <span className={styles.brandText}>
            <span className={styles.brandTitle}>The Tower</span>
            <span className={styles.brandSubtitle}>Pocket Run Edition</span>
          </span>
        </Link>
      </div>

      <div className={styles.center}>
        <div className={styles.identity} title={`Signed in as ${displayName}`}>
          <div className={styles.avatar} aria-hidden>
            {session?.user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={session.user.image} alt="" referrerPolicy="no-referrer" />
            ) : (
              <span aria-hidden>{initial}</span>
            )}
          </div>
          <div className={styles.idCopy} aria-live="polite">
            <span className={styles.idLabel}>Signed in as</span>
            <span className={styles.idName}>{status === "loading" ? "Loading…" : displayName}</span>
          </div>
        </div>
      </div>

      <nav className={styles.right} aria-label="Primary actions">
        <Link href="/settings" className={clsx("btn", "btn--ghost", styles.action)}>
          <span aria-hidden className={styles.actionIcon}>
            ⚙
          </span>
          <span>Settings</span>
        </Link>

        {status === "authenticated" ? (
          <button
            type="button"
            className={clsx("btn", "btn--primary", styles.action)}
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            Sign out
          </button>
        ) : (
          <button
            type="button"
            className={clsx("btn", "btn--primary", styles.action)}
            onClick={() => signIn("google")}
          >
            Sign in
          </button>
        )}
      </nav>
    </header>
  );
}
