"use client";
import { useEffect, useRef } from "react";
import "./combat.css"; // NEW

type Props = {
  children: React.ReactNode; // your CombatRoot/Console lives here
  leaving?: boolean;         // whatever you already use
};

export default function CombatOverlay({ children, leaving }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Flag body during combat -> hides room flavor
  useEffect(() => {
    document.body.dataset.combat = "1";
    return () => { delete document.body.dataset.combat; };
  }, []);

  return (
    <div
      ref={ref}
      className={`combat-overlay ${leaving ? "combat-overlay--leaving" : ""}`}
      aria-live="polite"
    >
      <div className="combat-root">
        {/* Top HUD + Scene overlay + Pad are provided by nested children */}
        {children}
      </div>
    </div>
  );
}
