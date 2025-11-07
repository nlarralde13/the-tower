// components/TopBar.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRunStore } from "@/store/runStore";
import { useUIStore } from "@/store/uiStore"; // ⬅️ Option A: call drawers directly from the store
import type { PanelName } from "@/store/uiStore";
import styles from "./TopBar.module.css";

type TopBarProps = {
  signedIn?: boolean;
  displayName?: string;
};

export default function TopBar({ signedIn, displayName }: TopBarProps) {
  const [open, setOpen] = useState(false);
  const currentFloor = useRunStore((s) => s.currentFloor ?? 0);

  // UI store actions (single generic opener keeps this simple)
  const openPanel = useUIStore((s) => s.open);

  const openDrawer = (panel: PanelName, sectionId?: string) => {
    openPanel(panel);
    if (!sectionId || typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      document
        .getElementById(sectionId)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  // Close drawer on hash change
  useEffect(() => {
    const onHash = () => setOpen(false);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <div className={styles.bar}>
        <button
          className={`${styles.burger} ${open ? styles.burgerOpen : ""}`}
          aria-label="Toggle menu"
          aria-expanded={open}
          aria-controls="nav-drawer"
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>

        <div className={styles.floorBadge} role="status" aria-live="polite">
          <span className={styles.floorLabel}>Floor</span>
          <span className={styles.floorValue}>
            {currentFloor.toString().padStart(2, "0")}
          </span>
        </div>

        {/* NEW: quick actions cluster */}
        <nav className={styles.quickActions} aria-label="Quick actions">
          <button
            className={styles.topButton}
            onClick={() => openDrawer("map")}
            aria-label="Open map"
          >
            Map
          </button>
          <button
            className={styles.topButton}
            onClick={() => openDrawer("character", "character-panel")}
            aria-label="Open character"
          >
            Character
          </button>
          <button
            className={styles.topButton}
            onClick={() => openDrawer("inventory", "inventory-panel")}
            aria-label="Open inventory"
          >
            Inventory
          </button>
          <button
            className={styles.topButton}
            onClick={() => openDrawer("journal")}
            aria-label="Open journal"
          >
            Journal
          </button>
        </nav>

        <div aria-hidden="true" className={styles.rightSpacer} />
      </div>

      <button
        className={`${styles.scrim} ${open ? styles.scrimVisible : ""}`}
        aria-label="Close menu"
        onClick={() => setOpen(false)}
      />

      <nav
        id="nav-drawer"
        className={`${styles.drawer} ${open ? styles.drawerOpen : ""}`}
        aria-hidden={!open}
      >
        <div className={styles.drawerHeader}>
          <div className={styles.brandDot} aria-hidden="true">
            TT
          </div>
          <div className={styles.brandCopy}>
            <div className={styles.brandTitle}>The Tower</div>
            <div className={styles.brandSubtitle}>
              {signedIn ? `Signed in${displayName ? ` – ${displayName}` : ""}` : "Guest"}
            </div>
          </div>
        </div>

        <ul className={styles.menuList}>
          <li>
            <Link href="/" className={styles.menuLink} onClick={() => setOpen(false)}>
              🏠 Home
            </Link>
          </li>
          <li>
            <Link href="/climb" className={styles.menuLink} onClick={() => setOpen(false)}>
              🗼 Climb the Tower
            </Link>
          </li>
          <li>
            <Link href="/traders" className={styles.menuLink} onClick={() => setOpen(false)}>
              💰 Traders’ Guild
            </Link>
          </li>
          <li>
            <Link href="/crafters" className={styles.menuLink} onClick={() => setOpen(false)}>
              🛠 Crafters’ Guild
            </Link>
          </li>
          <li>
            <Link href="/inn" className={styles.menuLink} onClick={() => setOpen(false)}>
              🛏 The Inn
            </Link>
          </li>
          <li>
            <Link href="/training" className={styles.menuLink} onClick={() => setOpen(false)}>
              🗡 Training Grounds
            </Link>
          </li>
          <li className={styles.rule} aria-hidden="true" />
          <li>
            <Link href="/settings" className={styles.menuLink} onClick={() => setOpen(false)}>
              ⚙️ Settings
            </Link>
          </li>
          <li>
            <Link
              href={signedIn ? "/api/auth/signout" : "/api/auth/signin"}
              className={styles.menuLink}
              onClick={() => setOpen(false)}
            >
              {signedIn ? "Sign out" : "Sign in"}
            </Link>
          </li>
        </ul>
      </nav>
    </>
  );
}
