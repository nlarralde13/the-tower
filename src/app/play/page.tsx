﻿"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PageSurface from "@/components/PageSurface";
import SceneViewer from "@/components/SceneViewer";
import ThumbBar from "@/components/ThumbBar";
import { useRunStore } from "@/store/runStore";
import { chooseFlavor, exitsFlavor } from "@/game/flavor";
import { useRouter, useSearchParams } from "next/navigation";

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

  const [actionMsg, setActionMsg] = useState<string>("");
  // Mobile slide-in drawers
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const liveRef = useRef<HTMLDivElement | null>(null);

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
  const caption = useMemo(() => {
    if (!currentType || !grid || !pos) return undefined;
    const dirs: string[] = [];
    const passable = new Set(["entry","exit","boss","combat","trap","loot","out","special","empty"]);
    const W = grid.width, H = grid.height;
    const can = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && passable.has(grid.cells[y*W + x].type);
    if (can(pos.x, pos.y - 1)) dirs.push("north");
    if (can(pos.x, pos.y + 1)) dirs.push("south");
    if (can(pos.x - 1, pos.y)) dirs.push("west");
    if (can(pos.x + 1, pos.y)) dirs.push("east");
    return `${chooseFlavor(currentType)} ${exitsFlavor(dirs)}`.trim();
  }, [currentType, grid, pos]);

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
          <div className="console-frame">
            <SceneViewer
              roomType={(currentType ?? "empty") as any}
              sceneId={sceneId}
              caption={caption}
              grid={grid}
              playerPos={pos}
              showOverlay={showOverlay}
              overlayCentered
              floor={useRunStore.getState().currentFloor}
            />
            <ThumbBar
              onMove={(d) => {
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
              onInspect={() => announce("Inspect (stub)")}
              onUse={() => announce("Use (stub)")}
              onDefend={() => announce("Defend (stub)")}
              onFlee={() => announce("Flee (stub)")}
              onBack={handleBack}
              onAscend={async () => { await ascend?.(); window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }); }}
              showAscend={showAscend}
            />
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
          {!atFinalExit && (
            <div className="menu-panel" aria-label="Journal">
              <div className="panel-title">Journal</div>
              <ul className="menu-list">
                <li><div className="menu-link"><span className="menu-label">Objective: Reach Floor 5</span><span className="menu-chev">•</span><span className="menu-sub">The guild awaits your report</span></div></li>
                <li><div className="menu-link"><span className="menu-label">Rumor: Hidden Librarium</span><span className="menu-chev">•</span><span className="menu-sub">A tome on Runic Binding exists</span></div></li>
                <li><div className="menu-link"><span className="menu-label">Lore: The Brass Wardens</span><span className="menu-chev">•</span><span className="menu-sub">Order that guards the 5th ascent</span></div></li>
              </ul>
            </div>
          )}
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