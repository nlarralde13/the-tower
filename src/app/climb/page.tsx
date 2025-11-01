"use client";

import AuthGate from "@/components/AuthGate";
import PageSurface from "@/components/PageSurface";
import { useRunStore } from "@/store/runStore";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export default function Page() {
  const enterRun = useRunStore((s) => s.enterRun);
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleEnter() {
    if (busy) return;
    setBusy(true);
    try {
      await enterRun();
      router.push("/play");
    } finally {
      setBusy(false);
    }
  }

  const flavor = useMemo(() => {
    const lines = [
      "You stand before the Tower. A sign reads: ‘No singing.’ The sign is wrong.",
      "Some say the Tower was built by a very tall rabbit. Others were eaten by it.",
      "Brave Sir You, who bravely ran here, now bravely ascends.",
      "A peasant hollers: ‘Strange women in ponds handing out swords is no basis for ascension!’ You nod, then ascend anyway.",
      "Coconuts clack behind you. The horse is imaginary. The peril is not.",
    ];
    return lines[Math.floor(Math.random() * lines.length)];
  }, []);

  return (
    <PageSurface
      backgroundImage="/backgrounds/tower-bg.png"
      overlay="linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.7))"
    >
      <AuthGate>
        <main className="tower-shell">
          <div className="menu-panel">
            <h2 className="panel-title">Climb the Tower</h2>
            <p className="panel-sub">{flavor}</p>

            <div style={{ display: "grid", gap: 12, marginTop: 8 }}>
              <button
                onClick={handleEnter}
                aria-label="Enter the Tower"
                aria-busy={busy}
                className={`btn btn--primary${busy ? " is-loading" : ""}`}
              >
                {busy ? "Entering…" : "Enter the Tower"}
              </button>
              <button
                onClick={() => router.push("/")}
                aria-label="Return to Village"
                className="btn btn--ghost"
              >
                Return to Village
              </button>
            </div>
          </div>
        </main>
      </AuthGate>
    </PageSurface>
  );
}

