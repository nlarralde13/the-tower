"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PageSurface from "@/components/PageSurface";
import SceneViewer from "@/components/SceneViewer";
import ThumbBar from "@/components/ThumbBar";
import CombatOverlay from "@/components/combat/CombatOverlay";
import { useRunStore } from "@/store/runStore";
import { chooseFlavor, exitsFlavor } from "@/game/flavor";
import { getEnemyDefinition } from "@/content/index";
import { useRouter, useSearchParams } from "next/navigation";
import { playMusic } from "@/utils/audioManager";

export default function PlayPage() {
  const router = useRouter();
  const search = useSearchParams();
  const resume = useRunStore((s) => s.resumeFromStorage);
  const runId = useRunStore((s) => s.runId);
  const grid = useRunStore((s) => s.grid);
  const pos = useRunStore((s) => s.playerPos);
  const sceneId = useRunStore((s) => s.sceneId);
  const move = useRunStore((s) => s.move);
  const roomTypeAt = useRunStore((s) => s.roomTypeAt);
  const toggleOverlay = useRunStore((s) => s.toggleGridOverlay);
  const ascend = useRunStore((s) => s.ascend);
  const endRun = useRunStore((s) => s.endRun);
  const showOverlay = useRunStore((s) => s.dev.gridOverlay);
  const currentFloor = useRunStore((s) => s.currentFloor ?? 0);
  const completedRooms = useRunStore((s) => s.completedRooms);
  const mode = useRunStore((s) => s.mode);
  const activeCombat = useRunStore((s) => s.activeCombat);
  const defeatOverlay = useRunStore((s) => s.defeatOverlay);

  const [actionMsg, setActionMsg] = useState<string>("");
  // Mobile slide-in drawers
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const liveRef = useRef<HTMLDivElement | null>(null);

  //AUDIO
  playMusic("/audio/tower_theme.mp3")


  useEffect(() => {
    resume();
  }, [resume]);

  // Dev overlay via query ?overlay=1
  useEffect(() => {
    if (search?.get("overlay") === "1") toggleOverlay(true);
  }, [search, toggleOverlay]);

  useEffect(() => {
    if (!runId) {
      // No run; bounce to climb
      router.replace("/climb");
    }
  }, [runId, router]);

  const currentType = useMemo(() => (pos && grid ? roomTypeAt(pos.x, pos.y) : null), [pos, grid, roomTypeAt]);
  const currentKey = pos ? `${currentFloor}:${pos.x},${pos.y}` : null;
  const caption = useMemo(() => {
    if (!currentType || !grid || !pos) return undefined;
    const dirs: string[] = [];
    const passable = new Set(["entry","exit","boss","combat","trap","loot","out","special","empty"]);
    const W = grid.width, H = grid.height;
    const can = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && passable.has(grid.cells[y * W + x].type);
    if (can(pos.x, pos.y - 1)) dirs.push("north");
    if (can(pos.x, pos.y + 1)) dirs.push("south");
    if (can(pos.x - 1, pos.y)) dirs.push("west");
    if (can(pos.x + 1, pos.y)) dirs.push("east");
    return `${chooseFlavor(currentType)} ${exitsFlavor(dirs)}`.trim();
  }, [currentType, grid, pos]);

  const clearedRoomMessage = "The enemy was defeated and the room is now clear to move on.";

  const combatCaption = useMemo(() => {
    if (!activeCombat) return undefined;
    const names = activeCombat.enemies
      .map((id) => getEnemyDefinition(id)?.name ?? id)
      .join(", ");
    return names ? `You engage ${names}.` : "Combat engaged.";
  }, [activeCombat]);

  const viewerCaption = useMemo(() => {
    if (mode === "combat") {
      return combatCaption ?? caption;
    }
    if (
      currentKey &&
      completedRooms?.[currentKey]
    ) {
      const base = caption ?? "";
      return `${base} ${clearedRoomMessage}`.trim();
    }
    return caption;
  }, [mode, combatCaption, caption, currentKey, completedRooms]);

  const combatActive = mode === "combat";

  function announce(msg: string) {
    setActionMsg(msg);
    // trigger SR re-read
    requestAnimationFrame(() => {
      if (liveRef.current) {
        (liveRef.current as HTMLDivElement).textContent = "";
        (liveRef.current as HTMLDivElement).textContent = msg;
      }
    });
  }

  useEffect(() => {
    if (defeatOverlay) {
      announce("You have been defeated. A piece of your soul lingers.");
    }
  }, [defeatOverlay]);

  const handleInspect = () => {
    if (defeatOverlay) {
      announce("Your strength is gone. End the run to move on.");
      return;
    }
    if (mode === "combat") {
      announce("No time to inspect during combat.");
      return;
    }
    announce("Review the journal for the latest after-action docket.");
  };

  const handleEndRun = () => {
    endRun?.();
    announce("Run ended. Returning home.");
    router.push("/");
  };

  const prevModeRef = useRef(mode);
  useEffect(() => {
    const previous = prevModeRef.current;
    if (previous !== mode) {
      if (mode === "combat") {
        announce("Combat initiated.");
      } else if (previous === "combat" && mode === "explore") {
        announce("Combat resolved.");
      }
      prevModeRef.current = mode;
    }
  }, [mode]);

  function handleBack() {
    if (confirm("Leave the current run and return to the climb?") === true) {
      router.push("/climb");
    }
  }

  const floorNow = useRunStore.getState().currentFloor ?? 0;
  const showAscend = currentType === "exit" && floorNow < 5;
  const atFinalExit = currentType === "exit" && floorNow === 5;

  return (
    <PageSurface backgroundImage="/backgrounds/tower-bg.png">
      <div className="play-grid">
        <div aria-live="polite" aria-atomic ref={liveRef} style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
          {actionMsg}
        </div>

        {defeatOverlay ? <DefeatOverlay onEndRun={handleEndRun} /> : null}

        {/* Left column (desktop): Inventory + Character */}
        <aside className="play-left">
          <div className="menu-panel" aria-label="Inventory" style={{ minHeight: 260 }}>
            <div className="panel-title">Inventory</div>
            <ul className="menu-list">
              <li><div className="menu-link"><span className="menu-label">Sunsteel Longsword +3</span><span className="menu-chev">×1</span><span className="menu-sub">A blade that hums near magic</span></div></li>
              <li><div className="menu-link"><span className="menu-label">Towerbread Rations</span><span className="menu-chev">×4</span><span className="menu-sub">Restores a little stamina</span></div></li>
              <li><div className="menu-link"><span className="menu-label">Flask of Insight</span><span className="menu-chev">×2</span><span className="menu-sub">Reveals hidden runes</span></div></li>
              <li><div className="menu-link"><span className="menu-label">Hookshot</span><span className="menu-chev">?</span><span className="menu-sub">Traverse chasms and traps</span></div></li>
            </ul>
          </div>
          <div className="menu-panel" aria-label="Character Sheet">
            <div className="panel-title">Character</div>
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>Level</strong><span>27</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>XP</strong><span>83,234 / 90,000</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>Lifetime Climbs</strong><span>42</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>Highest Clear</strong><span>Floor 7</span>
              </div>
              <div>
                <strong>Skills</strong>
                <div style={{ color: "var(--color-muted)" }}>Riposte III, Rune Sight II, Iron Will IV, Fleetfoot II</div>
              </div>
            </div>
          </div>
        </aside>

        {/* Middle: scene + controls in a console frame */}
        <section className="play-middle">
          <div className={`console-frame ${combatActive ? "console-frame--combat" : ""}`}>
            <div
              className="console-frame__content"
              aria-hidden={combatActive}
            >
              <div className={`scene-surface ${combatActive ? "scene-surface--locked" : ""}`}>
                <SceneViewer
                  className={`scene-viewer${combatActive ? " scene-viewer--dimmed" : ""}`}
                  roomType={(currentType ?? "empty") as any}
                  sceneId={sceneId}
                  caption={viewerCaption}
                  grid={grid}
                  playerPos={pos}
                  showOverlay={showOverlay}
                  overlayCentered
                  floor={useRunStore.getState().currentFloor}
                />
              </div>
              {!combatActive ? (
                <ThumbBar
                  onMove={(d) => {
                    if (defeatOverlay) {
                      announce("You cannot move while your soul lingers here.");
                      return;
                    }
                    if (!grid || !pos) return;
                    const passable = new Set(["entry","exit","boss","combat","trap","loot","out","special","empty"]);
                    const W = grid.width, H = grid.height;
                    let nx = pos.x, ny = pos.y;
                    if (d === "north") ny -= 1;
                    if (d === "south") ny += 1;
                    if (d === "west") nx -= 1;
                    if (d === "east") nx += 1;
                    if (nx < 0 || ny < 0 || nx >= W || ny >= H) {
                      announce("Why are you running face first into that wall?");
                      return;
                    }
                    const t = grid.cells[ny * W + nx];
                    if (!t || !passable.has(t.type)) {
                      announce("Why are you running face first into that wall?");
                      return;
                    }
                    move(d);
                  }}
                  onInspect={handleInspect}
                  onUse={() => announce("Use (stub)")}
                  onDefend={() => announce("Defend (stub)")}
                  onFlee={() => announce("Flee (stub)")}
                  onBack={handleBack}
                  onAscend={async () => {
                    await ascend?.();
                    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
                  }}
                  showAscend={showAscend}
                  disabled={defeatOverlay}
                />
              ) : null}
            </div>
            <CombatOverlay active={combatActive} />
          </div>

          {/* Mobile: floating toggles for side drawers */}
          <div className="hide-desktop" style={{ position: "relative" }}>
            <div className="mobile-side-buttons">
              <button className="btn btn--ghost" onClick={() => setLeftOpen(true)} aria-label="Open inventory and character">Inventory</button>
              <button className="btn btn--ghost" onClick={() => setRightOpen(true)} aria-label="Open map and journal">Map</button>
            </div>
          </div>
        </section>

        {/* Right column (desktop): Map + Journal */}
        <div className="play-right" style={{ display: "grid", gap: 12 }}>
          {!atFinalExit && (
            <div className="show-desktop">
              <MapPanel onClose={() => { /* no-op on desktop */ }} />
            </div>
          )}
          {atFinalExit && (
            <FinalExtract onExtract={() => { endRun?.(); router.push("/climb"); }} />
          )}
          {!atFinalExit && <JournalPanel />}
        </div>

        {/* Mobile slide-in drawers */}
        <button
          className={`side-drawer-scrim ${leftOpen || rightOpen ? 'is-visible' : ''} hide-desktop`}
          aria-label="Close panels"
          onClick={() => { setLeftOpen(false); setRightOpen(false); }}
        />
        <div className={`side-drawer side-drawer--left hide-desktop ${leftOpen ? 'is-open' : ''}`} role="dialog" aria-label="Inventory and Character" aria-modal={leftOpen}>
          <div className="menu-panel" style={{ minHeight: 260 }}>
            <div className="panel-title">Inventory</div>
            <ul className="menu-list">
              <li><div className="menu-link"><span className="menu-label">Sunsteel Longsword +3</span><span className="menu-chev">×1</span><span className="menu-sub">A blade that hums near magic</span></div></li>
              <li><div className="menu-link"><span className="menu-label">Towerbread Rations</span><span className="menu-chev">×4</span><span className="menu-sub">Restores a little stamina</span></div></li>
              <li><div className="menu-link"><span className="menu-label">Flask of Insight</span><span className="menu-chev">×2</span><span className="menu-sub">Reveals hidden runes</span></div></li>
              <li><div className="menu-link"><span className="menu-label">Hookshot</span><span className="menu-chev">?</span><span className="menu-sub">Traverse chasms and traps</span></div></li>
            </ul>
          </div>
          <div className="menu-panel">
            <div className="panel-title">Character</div>
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>Level</strong><span>27</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>XP</strong><span>83,234 / 90,000</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>Lifetime Climbs</strong><span>42</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>Highest Clear</strong><span>Floor 7</span>
              </div>
              <div>
                <strong>Skills</strong>
                <div style={{ color: "var(--color-muted)" }}>Riposte III, Rune Sight II, Iron Will IV, Fleetfoot II</div>
              </div>
            </div>
          </div>
          <div style={{ padding: 8 }}>
            <button className="btn btn--ghost" onClick={() => setLeftOpen(false)} aria-label="Close left panel" style={{ width: "100%" }}>Close</button>
          </div>
        </div>
        <div className={`side-drawer side-drawer--right hide-desktop ${rightOpen ? 'is-open' : ''}`} role="dialog" aria-label="Map and Journal" aria-modal={rightOpen}>
          <div className="menu-panel" style={{ minHeight: 260 }}>
            <div className="panel-title">Map</div>
            <MapPanel onClose={() => setRightOpen(false)} />
          </div>
          <div className="menu-panel" aria-label="Journal">
            <div className="panel-title">Journal</div>
            <ul className="menu-list">
              <li><div className="menu-link"><span className="menu-label">Objective: Reach Floor 5</span><span className="menu-chev">•</span><span className="menu-sub">The guild awaits your report</span></div></li>
              <li><div className="menu-link"><span className="menu-label">Rumor: Hidden Librarium</span><span className="menu-chev">•</span><span className="menu-sub">A tome on Runic Binding exists</span></div></li>
              <li><div className="menu-link"><span className="menu-label">Lore: The Brass Wardens</span><span className="menu-chev">•</span><span className="menu-sub">Order that guards the 5th ascent</span></div></li>
            </ul>
          </div>
          <div style={{ padding: 8 }}>
            <button className="btn btn--ghost" onClick={() => setRightOpen(false)} aria-label="Close right panel" style={{ width: "100%" }}>Close</button>
          </div>
        </div>
      </div>
    </PageSurface>
  );
}


function formatDropSource(source?: string | null): string | null {
  if (!source) return null;
  if (source.startsWith("boss:")) {
    const bossId = source.split(":", 2)[1] ?? "boss";
    return `Filed under boss dossier ${toTitle(bossId)}`;
  }
  if (source.startsWith("enemy:")) {
    const enemyId = source.split(":", 2)[1] ?? "enemy";
    return `Recovered from ${toTitle(enemyId)}.`;
  }
  return `Logged source: ${source}`;
}


function DefeatOverlay({ onEndRun }: { onEndRun: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Defeat summary"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10,4,18,0.85)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        zIndex: 40,
      }}
    >
      <div
        style={{
          width: "min(420px, 100%)",
          borderRadius: 20,
          border: "1px solid rgba(244,114,182,0.35)",
          background: "linear-gradient(180deg, rgba(45,9,30,0.95), rgba(18,8,24,0.92))",
          boxShadow: "0 36px 80px rgba(0,0,0,0.55)",
          padding: "28px 32px",
          display: "grid",
          gap: 18,
          textAlign: "center",
          color: "#fdf4ff",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 0.4 }}>
          You have been defeated.
        </div>
        <div style={{ fontSize: 15, color: "rgba(255,241,242,0.85)", lineHeight: 1.5 }}>
          A piece of your soul lingers.
        </div>
        <button
          onClick={onEndRun}
          className="btn btn--primary"
          style={{
            minHeight: 48,
            borderRadius: 999,
            fontSize: 15,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: 0.12,
          }}
          aria-label="End run and return home"
        >
          End Run
        </button>
      </div>
    </div>
  );
}


function FinalExtract({ onExtract }: { onExtract: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal={false}
      aria-label="Final extraction"
      style={{
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: 12,
        background: "rgba(0,0,0,0.5)",
        padding: 14,
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ fontWeight: 700 }}>Floor 5 Clear</div>
      <div style={{ opacity: 0.9 }}>You may extract now to end the run.</div>
      <button
        onClick={onExtract}
        className="btn btn--primary"
        style={{ minHeight: 44 }}
        aria-label="Extract Now"
      >
        Extract Now
      </button>
    </div>
  );
}

function MapPanel({ onClose }: { onClose: () => void }) {
  const grid = useRunStore((s) => s.grid);
  const journal = useRunStore((s) => s.journal);
  const pos = useRunStore((s) => s.playerPos);
  const currentFloor = useRunStore((s) => s.currentFloor);
  const visited = new Set<string>();
  for (const e of journal ?? []) {
    if (e.floor === currentFloor) visited.add(`${e.x},${e.y}`);
  }
  const W = grid?.width ?? 8;
  const H = grid?.height ?? 8;
  const total = W * H;

  return (
    <div
      role="dialog"
      aria-label="Floor map"
      aria-modal={false}
      style={{
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: 12,
        background: "rgba(0,0,0,0.45)",
        padding: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <strong>Map</strong>
        <button className="hide-desktop" onClick={onClose} aria-label="Close map" style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.08)" }}>Close</button>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${W}, 32px)`,
          gridAutoRows: "32px",
          gap: 2,
          width: "fit-content",
          maxWidth: "100%",
          overflow: "auto",
          background: "#1a1a1a",
          padding: 4,
          borderRadius: 8,
        }}
      >
        {Array.from({ length: total }, (_, i) => {
          const x = i % W;
          const y = Math.floor(i / W);
          const isVisited = visited.has(`${x},${y}`);
          const isCurrent = pos && pos.x === x && pos.y === y;
          return (
            <div
              key={`${x}-${y}`}
              title={`(${x},${y})`}
              style={{
                width: "100%",
                height: "100%",
                position: "relative",
                background: isVisited ? "#ffffff" : "#2b2b2b",
                border: isCurrent ? "2px solid #e9d9a7" : "1px solid rgba(255,255,255,0.08)",
                borderRadius: 4,
              }}
            >
              {isCurrent && (
                <span
                  aria-label="Player position"
                  title="You are here"
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: "#2b1f0d",
                    boxShadow: "0 0 0 2px #e9d9a7",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 8, opacity: 0.85, fontSize: 12 }}>
        White = rooms you have entered. Dark = unknown.
      </div>
    </div>
  );
}
