"use client";


/**
 * /src/app/dev/combat-testing/page.tsx
 *
 * Minimal combat test harness:
 * - Renders SceneViewer for visual context
 * - Wires CombatConsole with a tiny in-page VM (no external stores)
 * - Implements a simple turn loop + console logging
 *
 * Safe to iterate: extend the VM or swap to your stores later.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import SceneViewer from "@/components/SceneViewer";
import CombatConsole from "@/components/combat/CombatConsole";

type Entity = {
  id: string;
  name: string;
  isPlayer?: boolean;
  hp: number;
  hpMax: number;
  mp?: number;
  mpMax?: number;
  st?: number;
  stMax?: number;
  status?: string[];
};

type VM = {
  id: string;
  order: string[];
  turnOwnerId: string;
  entities: Record<string, Entity>;
  enemies: string[];
  party: string[];
};

type Resolution = {
  text: string;
  targetId?: string;
  crit?: boolean;
  dmg?: number;
};

const log = (...args: any[]) => console.log("%c[CombatTest]", "color:#80ffea;font-weight:700", ...args);
const warn = (...args: any[]) => console.warn("[CombatTest]", ...args);

export default function CombatTestingPage() {
  log("mount");

  // --- Tiny local encounter state (player vs. rat)
  const [entities, setEntities] = useState<Record<string, Entity>>({
    P1: { id: "P1", name: "Runner", isPlayer: true, hp: 120, hpMax: 120, mp: 2, mpMax: 2, st: 3, stMax: 3, status: [] },
    R1: { id: "R1", name: "Dungeon Rat", hp: 25, hpMax: 25, st: 1, stMax: 1, status: [] },
  });
  const [order, setOrder] = useState<string[]>(["P1", "R1"]);
  const [idx, setIdx] = useState(0);
  const [lastResolution, setLastResolution] = useState<Resolution | undefined>(undefined);
  const [logLines, setLogLines] = useState<string[]>([]);

  const vm: VM = useMemo(
    () => ({
      id: "enc-dev-001",
      order,
      turnOwnerId: order[idx] ?? "",
      entities,
      party: ["P1"],
      enemies: ["R1"],
    }),
    [entities, order, idx]
  );

  // --- Helpers
  const appendLog = (line: string) => setLogLines((L) => [...L.slice(-19), line]);
  const alive = (id: string) => (entities[id]?.hp ?? 0) > 0;

  const endTurn = () => {
    const next = (idx + 1) % order.length;
    setIdx(next);
    log("endTurn → next owner:", order[next]);
  };

  const dealDamage = (targetId: string, dmg: number) => {
    setEntities((E) => {
      const t = E[targetId];
      if (!t) return E;
      const nextHP = Math.max(0, t.hp - dmg);
      return { ...E, [targetId]: { ...t, hp: nextHP } };
    });
  };

  const simpleEnemyAI = () => {
    // Rat just nibbles the player for 1d6
    const dmg = Math.max(1, Math.ceil(Math.random() * 6));
    appendLog(`Rat bites Runner for ${dmg}.`);
    setLastResolution({ text: "The rat bites!", targetId: "P1", dmg });
    dealDamage("P1", dmg);
  };

  // --- Drive enemy when it's their turn
  useEffect(() => {
    const owner = vm.turnOwnerId;
    if (!owner) return;

    log("turnOwner:", owner);
    if (owner === "R1") {
      const allDead = !alive("P1") || !alive("R1");
      if (allDead) return;
      const t = setTimeout(() => {
        simpleEnemyAI();
        endTurn();
      }, 600);
      return () => clearTimeout(t);
    }
    // player waits for input via CombatConsole → onAct
  }, [vm.turnOwnerId]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Detect end of battle
  useEffect(() => {
    if (!alive("R1")) {
      appendLog("Rat defeated! Victory.");
    } else if (!alive("P1")) {
      appendLog("You are defeated…");
    }
  }, [entities]);

  // --- Console action handler (supports generic shapes)
  const onAct = (action: any) => {
    log("onAct()", action);
    if (!alive("P1") || !alive("R1")) {
      appendLog("Action ignored — combat already resolved.");
      return;
    }

    // Normalize intent
    const kind: string =
      action?.kind || action?.type || (typeof action === "string" ? action : "attack");
    let targetId: string = action?.targetId || action?.target || vm.enemies[0] || "R1";

    // Basic verbs
    if (kind === "attack") {
      const crit = Math.random() < 0.1;
      const base = Math.max(1, Math.ceil(Math.random() * 8));
      const dmg = crit ? base * 2 : base;
      appendLog(`Runner attacks ${entities[targetId]?.name ?? targetId} for ${dmg}${crit ? " (CRIT!)" : ""}.`);
      setLastResolution({ text: "You attack.", targetId, dmg, crit });
      dealDamage(targetId, dmg);
      endTurn();
      return;
    }

    if (kind === "defend" || kind === "guard") {
      appendLog("Runner defends (reduced damage next hit).");
      setLastResolution({ text: "You defend." });
      endTurn();
      return;
    }

    if (kind === "flee") {
      const ok = Math.random() < 0.5;
      appendLog(ok ? "You fled successfully." : "Flee failed!");
      setLastResolution({ text: ok ? "Flee success." : "Flee failed." });
      if (ok) {
        // End encounter: zero out enemy HP to mark victory path
        setEntities((E) => ({ ...E, R1: { ...E.R1, hp: 0 } }));
      } else {
        endTurn();
      }
      return;
    }

    // Skills / items fall back to a harmless poke
    appendLog(`Runner uses ${kind}. It tickles.`);
    setLastResolution({ text: `You use ${kind}.` });
    endTurn();
  };

  // --- SceneViewer props (kept minimal)
  const sceneCaption = useMemo(() => {
    const p = entities.P1?.hp ?? 0;
    const r = entities.R1?.hp ?? 0;
    return `Test fight — Runner HP ${p}/${entities.P1.hpMax} vs Rat HP ${r}/${entities.R1.hpMax}`;
  }, [entities]);

  // --- Dev hooks on window
  useEffect(() => {
    (window as any).__combatTest = {
      get vm() {
        return vm;
      },
      dump() {
        log("dump", { vm, entities, order, idx, lastResolution });
      },
      killRat() {
        dealDamage("R1", 999);
      },
      healPlayer() {
        setEntities((E) => ({ ...E, P1: { ...E.P1, hp: E.P1.hpMax } }));
      },
    };
    log("window.__combatTest attached (helpers: dump(), killRat(), healPlayer())");
  }, [vm, entities, order, idx, lastResolution]);

  // --- UI
  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: "16px" }}>
      <h1 style={{ marginBottom: 12 }}>Combat Test Harness</h1>

      {/* Scene viewer for context */}
      <div style={{ borderRadius: 16, overflow: "hidden", marginBottom: 16 }}>
        <SceneViewer
          className="scene-viewer"
          roomType={"combat" as any}
          sceneId={undefined}
          caption={sceneCaption}
          grid={undefined}
          playerPos={undefined}
          showOverlay={false}
          overlayCentered
          floor={1}
        />
      </div>

      {/* Console: uses a tiny VM and calls onAct */}
      <div className="control-pad" data-mode="combat" style={{ marginTop: 8 }}>
        <div className="control-pad__surface">
          <CombatConsole
            vm={vm}
            skills={[]}
            items={[]}
            onAct={onAct}
            lastResolution={lastResolution}
          />
        </div>
      </div>

      {/* Minimal dev log under the pad */}
      <div style={{ marginTop: 12, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" }}>
        <strong>Log</strong>
        <div
          style={{
            marginTop: 8,
            padding: 12,
            borderRadius: 12,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            maxHeight: 180,
            overflow: "auto",
          }}
        >
          {logLines.length === 0 ? <em>(no events yet)</em> : null}
          {logLines.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      </div>
    </main>
  );
}
