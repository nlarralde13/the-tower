"use client";

import { useEffect, useState } from "react";
import CombatRoot from "./CombatRoot";
import CombatConsole from "./CombatConsole";

interface CombatOverlayProps {
  active: boolean;
}

export default function CombatOverlay({ active }: CombatOverlayProps) {
  const [shouldRender, setShouldRender] = useState(active);

  useEffect(() => {
    if (active) {
      setShouldRender(true);
      return;
    }
    const timeout = setTimeout(() => setShouldRender(false), 450);
    return () => clearTimeout(timeout);
  }, [active]);

  if (!shouldRender) {
    return null;
  }

  const stateClass = active ? "combat-overlay--visible" : "combat-overlay--leaving";

  return (
    <div
      className={`combat-overlay ${stateClass}`}
      role="dialog"
      aria-modal="true"
      aria-label="Combat encounter"
    >
      <div className="combat-overlay__surface">
        <CombatRoot>
          <CombatConsole />
        </CombatRoot>
      </div>
    </div>
  );
}
