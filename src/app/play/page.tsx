"use client";

/**
 * ============================================================
 *  /src/app/play/page.tsx
 *  "Play" screen — main gameplay surface (scene, controls, rails)
 *  - Left rail: Inventory + Character
 *  - Middle: Scene viewer with overlayed action pad + Combat overlay
 *  - Right rail: Map + Journal access (drawer on mobile)
 *  - Responsive: drawers for Character/Map/Journal on small screens
 * ============================================================
 */

import "./play.desktop.css";
import "./play.mobile.css";

import { useEffect, useMemo, useRef, useState } from "react";
import PageSurface from "@/components/PageSurface";
import SceneViewer from "@/components/SceneViewer";
import ThumbBar from "@/components/ThumbBar";
import CombatOverlay from "@/components/combat/CombatOverlay";
import CompactMeterGroup, { type GaugeValue } from "@/components/hud/CompactMeters";
import SlideDrawer from "@/components/drawers/SlideDrawer";
import { useUIStore, type PanelName } from "@/store/uiStore";
import { useRunStore } from "@/store/runStore";
import { useCombatStore } from "@/state/combatStore";
import { useHaptics } from "@/hooks/useHaptics";
import { chooseFlavor, exitsFlavor } from "@/game/flavor";
import { getEnemyDefinition } from "@/content/index";
import { useRouter, useSearchParams } from "next/navigation";
import { playMusic } from "@/utils/audioManager";

/* =================================================================
   PAGE COMPONENT
   -----------------------------------------------------------------
   Orchestrates run state, room captions, combat state, and renders
   the three-pane layout with drawers on mobile.
   ================================================================= */

export default function PlayPage() {
  /* --------------------------------------------------------------
   * Routing + query params
   * -------------------------------------------------------------- */
  const router = useRouter();
  const search = useSearchParams();

  /* --------------------------------------------------------------
   * RUN STORE — game/session state
   * -------------------------------------------------------------- */
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
  const mode = useRunStore((s) => s.mode); // "explore" | "combat"
  const activeCombat = useRunStore((s) => s.activeCombat);
  const defeatOverlay = useRunStore((s) => s.defeatOverlay);

  /* --------------------------------------------------------------
   * UI STORE — drawers & panels
   * -------------------------------------------------------------- */
  const characterOpen = useUIStore((state) => state.openPanels.character);
  const mapOpen = useUIStore((state) => state.openPanels.map);
  const journalOpen = useUIStore((state) => state.openPanels.journal);
  const combatDrawerOpen = useUIStore((state) => state.openPanels.combatActions);
  const togglePanel = useUIStore((state) => state.toggle);
  const closePanel = useUIStore((state) => state.close);
  const openPanel = useUIStore((state) => state.open);
  const handleToggleDrawer = (panel: PanelName) => () => togglePanel(panel);
  const handleCloseDrawer = (panel: PanelName) => () => closePanel(panel);

  /* --------------------------------------------------------------
   * System feedback (haptics + aria-live messages)
   * -------------------------------------------------------------- */
  const { trigger: triggerHaptic } = useHaptics();
  const [actionMsg, setActionMsg] = useState<string>("");
  const liveRef = useRef<HTMLDivElement | null>(null);

  /* --------------------------------------------------------------
   * Ambient audio (looped music)
   * -------------------------------------------------------------- */
  playMusic("/audio/tower_theme.mp3");

  /* --------------------------------------------------------------
   * Lifecycle: resume from storage, apply dev overlay, guard route
   * -------------------------------------------------------------- */
  useEffect(() => {
    resume();
  }, [resume]);

  // Allow dev overlay via ?overlay=1
  useEffect(() => {
    if (search?.get("overlay") === "1") toggleOverlay(true);
  }, [search, toggleOverlay]);

  // If no active run, redirect to /climb
  useEffect(() => {
    if (!runId) router.replace("/climb");
  }, [runId, router]);

  /* --------------------------------------------------------------
   * Derived room state: current type, caption / viewer text
   * -------------------------------------------------------------- */
  const currentType = useMemo(
    () => (pos && grid ? roomTypeAt(pos.x, pos.y) : null),
    [pos, grid, roomTypeAt]
  );

  const currentKey = pos ? `${currentFloor}:${pos.x},${pos.y}` : null;

  const caption = useMemo(() => {
    // Exploration caption: flavor + exits based on passable tiles
    if (!currentType || !grid || !pos) return undefined;
    const dirs: string[] = [];
    const passable = new Set(["entry", "exit", "boss", "combat", "trap", "loot", "out", "special", "empty"]);
    const W = grid.width, H = grid.height;
    const can = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < W && y < H && passable.has(grid.cells[y * W + x].type);
    if (can(pos.x, pos.y - 1)) dirs.push("north");
    if (can(pos.x, pos.y + 1)) dirs.push("south");
    if (can(pos.x - 1, pos.y)) dirs.push("west");
    if (can(pos.x + 1, pos.y)) dirs.push("east");
    return `${chooseFlavor(currentType)} ${exitsFlavor(dirs)}`.trim();
  }, [currentType, grid, pos]);

  const clearedRoomMessage =
    "The enemy was defeated and the room is now clear to move on.";

  // One-line combat caption based on current enemies
  const combatCaption = useMemo(() => {
    if (!activeCombat) return undefined;
    const names = activeCombat.enemies
      .map((id) => getEnemyDefinition(id)?.name ?? id)
      .join(", ");
    return names ? `You engage ${names}.` : "Combat engaged.";
  }, [activeCombat]);

  // Viewer caption priority:
  //   combat > cleared-room line > exploration flavor
  const viewerCaption = useMemo(() => {
    if (mode === "combat") return combatCaption ?? caption;
    if (currentKey && completedRooms?.[currentKey]) {
      const base = caption ?? "";
      return `${base} ${clearedRoomMessage}`.trim();
    }
    return caption;
  }, [mode, combatCaption, caption, currentKey, completedRooms]);

  /* --------------------------------------------------------------
   * Mode & meters
   * -------------------------------------------------------------- */
  const combatActive = mode === "combat";

  // Temporary HUD meters — wire to real player stats later
  const heroMeters = useMemo<GaugeValue[]>(
    () => [
      { label: "HP", icon: "❤", current: 32, max: 40, color: "#ec6d6d" },
      { label: "MP", icon: "🔮", current: 18, max: 28, color: "#6aa8ff" },
      { label: "STA", icon: "⚡", current: 54, max: 60, color: "#f7c96d" },
    ],
    []
  );

  // Open/close combat action sheet based on mode
  useEffect(() => {
    if (mode === "combat") openPanel("combatActions");
    else closePanel("combatActions");
  }, [mode, openPanel, closePanel]);

  /* --------------------------------------------------------------
   * Helpers — announce (aria-live), inspect, end run, back
   * -------------------------------------------------------------- */
  function announce(msg: string) {
    setActionMsg(msg);
    // Force SR re-read by briefly clearing then setting text content
    requestAnimationFrame(() => {
      if (liveRef.current) {
        (liveRef.current as HTMLDivElement).textContent = "";
        (liveRef.current as HTMLDivElement).textContent = msg;
      }
    });
  }

  useEffect(() => {
    if (defeatOverlay) announce("You have been defeated. A piece of your soul lingers.");
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

  // Haptics + announcer when mode flips
  const prevModeRef = useRef(mode);
  useEffect(() => {
    const previous = prevModeRef.current;
    if (previous !== mode) {
      if (mode === "combat") {
        announce("Combat initiated.");
        triggerHaptic("combat_start");
      } else if (previous === "combat" && mode === "explore") {
        announce("Combat resolved.");
      }
      prevModeRef.current = mode;
    }
  }, [mode, triggerHaptic]);

  function handleBack() {
    if (confirm("Leave the current run and return to the climb?")) {
      router.push("/climb");
    }
  }

  /* --------------------------------------------------------------
   * Floor gating (ascend/extract)
   * -------------------------------------------------------------- */
  const floorNow = useRunStore.getState().currentFloor ?? 0;
  const showAscend = currentType === "exit" && floorNow < 5;
  const atFinalExit = currentType === "exit" && floorNow === 5;

  /* ===============================================================
   * RENDER
   * =============================================================== */
  return (
    <PageSurface >
      {/* ============================================================
          MAIN GRID — left rail / middle console / right rail
          ============================================================ */}
      <div className="play-root">
        {/* Screen-reader live region for short announcements */}
        <div
          aria-live="polite"
          aria-atomic
          ref={liveRef}
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            overflow: "hidden",
            clip: "rect(0 0 0 0)",
          }}
        >
          {actionMsg}
        </div>

        {/* Defeat overlay (modal) */}
        {defeatOverlay ? <DefeatOverlay onEndRun={handleEndRun} /> : null}

        {/* ============================================================
            LEFT RAIL — Inventory + Character
            ============================================================ */}
        <aside className="play-left">
        </aside>

        {/* ============================================================
            MIDDLE — Scene viewer + overlayed action pad + combat layer
            ============================================================ */}
        <section className="play-middle">
          {/* The "console-frame" visually frames the scene area */}
          <div className={`console-frame ${combatActive ? "console-frame--combat" : ""}`}>
            {/* console-frame__content must be position:relative so the actions pad can overlay */}
            <div className="console-frame__content" aria-hidden={combatActive}>
              {/* SCENE SURFACE — the artwork / background stays visible under overlays */}
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
                            {/* ACTIONS PAD — overlayed controls inside the console */}
              <div className="actions-pad">
                <ThumbBar
                  variant="overlay"
                  onOpenJournal={() => openPanel("journal")}
                  onOpenMap={() => openPanel("map")}
                  onOpenCharacter={() => openPanel("character")}
                  onLookAround={handleInspect}

                  onMove={(d) => {
                    if (defeatOverlay) { announce("You cannot move while your soul lingers here."); return; }
                    if (!grid || !pos) return;
                    const passable = new Set(["entry","exit","boss","combat","trap","loot","out","special","empty"]);
                    const W = grid.width, H = grid.height;
                    let nx = pos.x, ny = pos.y;
                    if (d === "north") ny -= 1;
                    if (d === "south") ny += 1;
                    if (d === "west") nx -= 1;
                    if (d === "east") nx += 1;
                    if (nx < 0 || ny < 0 || nx >= W || ny >= H) { announce("Why are you running face first into that wall?"); return; }
                    const t = grid.cells[ny * W + nx];
                    if (!t || !passable.has(t.type)) { announce("Why are you running face first into that wall?"); return; }
                    move(d);
                  }}
                  onInteract={handleInspect}
                  onAttack={() => announce("Attack (stub)")}
                  onSkill={() => announce("Skill (stub)")}
                  onItem={() => announce("Item (stub)")}
                  onDefend={() => announce("Defend (stub)")}
                  onBack={handleBack}
                  onAscend={async () => { await ascend?.(); window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }); }}
                  showAscend={showAscend}
                  mode={mode}
                  disabled={defeatOverlay}
                />
              </div>
              </div> {/* closes .console-frame__content */}
              </div>   {/* closes .console-frame */}






            {/* COMBAT OVERLAY — sits above the scene when combat is active */}
            <CombatOverlay active={combatActive} />
        

          {/* ------------------------------------------------------------
             MOBILE TOGGLES — small floating buttons to open drawers
             ------------------------------------------------------------ */}
          <div className="hide-desktop" style={{ position: "relative" }}>
            <div className="mobile-side-buttons">
              <button data-drawer-toggle="character-drawer">Character</button>

              <button
                className="btn btn--ghost"
                onClick={handleToggleDrawer("map")}
                aria-label="Open map drawer"
              >
                Map
              </button>
              <button
                className="btn btn--ghost"
                onClick={handleToggleDrawer("journal")}
                aria-label="Open journal drawer"
              >
                Journal
              </button>
            </div>
          </div>
        </section>

        {/* ============================================================
            RIGHT RAIL — Map + Journal (button opens drawer)
            ============================================================ */}
        
        {/* ============================================================
            DRAWERS — responsive panels for mobile/smaller screens
            ============================================================ */}
        <SlideDrawer
          id="character-drawer"
          side="left"
          open={characterOpen}
          onClose={handleCloseDrawer("character")}
          labelledBy="character-drawer-title"
        >
          <CharacterPanel meters={heroMeters} titleId="character-drawer-title" />
          <InventoryPanel />
        </SlideDrawer>

        <SlideDrawer
          id="map-drawer"
          side="right"
          open={mapOpen}
          onClose={handleCloseDrawer("map")}
          labelledBy="map-drawer-title"
        >
          <MapPanel onClose={handleCloseDrawer("map")} titleId="map-drawer-title" />
        </SlideDrawer>

        {/* Journal: bottom sheet on mobile, right drawer on desktop */}
        <div className="hide-desktop">
          <SlideDrawer
            id="journal-drawer-mobile"
            side="bottom"
            variant="journal"
            open={journalOpen}
            onClose={handleCloseDrawer("journal")}
            labelledBy="journal-drawer-title"
          >
            <JournalPanel titleId="journal-drawer-title" />
          </SlideDrawer>
        </div>
        <div className="show-desktop">
          <SlideDrawer
            id="journal-drawer-desktop"
            side="right"
            open={journalOpen}
            onClose={handleCloseDrawer("journal")}
            labelledBy="journal-drawer-title"
          >
            <JournalPanel titleId="journal-drawer-title" />
          </SlideDrawer>
        </div>

        {/* Combat actions bottom sheet (auto-opens in combat) */}
        <SlideDrawer
          id="combat-sheet"
          side="bottom"
          open={combatDrawerOpen}
          onClose={handleCloseDrawer("combatActions")}
          labelledBy="combat-sheet-title"
        >
          <CombatActionSheet />
        </SlideDrawer>
      </div>
    </PageSurface>
  );
}

/* =================================================================
   UTILS
   ================================================================= */

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

function toTitle(str: string) {
  return str.replace(/[-_]/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

/* =================================================================
   OVERLAYS & PANELS (local components)
   ================================================================= */

/** Defeat modal shown when the run is lost. */
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

/** Inventory summary (placeholder content; wire to real items later). */
function InventoryPanel() {
  return (
    <div className="menu-panel" aria-label="Inventory" style={{ minHeight: 260 }}>
      <div className="panel-title">Inventory</div>
      <ul className="menu-list">
        <li>
          <div className="menu-link">
            <span className="menu-label">Sunsteel Longsword +3</span>
            <span className="menu-chev">×1</span>
            <span className="menu-sub">A blade that hums near magic</span>
          </div>
        </li>
        <li>
          <div className="menu-link">
            <span className="menu-label">Towerbread Rations</span>
            <span className="menu-chev">×4</span>
            <span className="menu-sub">Restores a little stamina</span>
          </div>
        </li>
        <li>
          <div className="menu-link">
            <span className="menu-label">Flask of Insight</span>
            <span className="menu-chev">×2</span>
            <span className="menu-sub">Reveals hidden runes</span>
          </div>
        </li>
        <li>
          <div className="menu-link">
            <span className="menu-label">Hookshot</span>
            <span className="menu-chev">?</span>
            <span className="menu-sub">Traverse chasms and traps</span>
          </div>
        </li>
      </ul>
    </div>
  );
}

/** Character summary with compact meters and a few stats. */
function CharacterPanel({ meters, titleId }: { meters: GaugeValue[]; titleId?: string }) {
  return (
    <div className="menu-panel" aria-label="Character Sheet">
      <div className="panel-title" id={titleId}>
        Character
      </div>
      <CompactMeterGroup meters={meters} />
      <div style={{ display: "grid", gap: 10 }}>
        <PanelRow label="Level" value="27" />
        <PanelRow label="XP" value="83,234 / 90,000" />
        <PanelRow label="Lifetime Climbs" value="42" />
        <PanelRow label="Highest Clear" value="Floor 7" />
        <div>
          <strong>Skills</strong>
          <div style={{ color: "var(--color-muted)" }}>
            Riposte III, Rune Sight II, Iron Will IV, Fleetfoot II
          </div>
        </div>
      </div>
    </div>
  );
}

function PanelRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <strong>{label}</strong>
      <span>{value}</span>
    </div>
  );
}

/** Bottom sheet used during combat for choosing actions. */
function CombatActionSheet() {
  const encounter = useCombatStore((state) => state.encounter);
  const commitDecision = useCombatStore((state) => state.commitPlayerDecision);
  const activeSide = useCombatStore((state) => state.getActiveSide());

  if (!encounter) {
    return (
      <div className="menu-panel" aria-live="polite">
        <div className="panel-title">Combat</div>
        <p style={{ color: "var(--color-muted)", margin: 0 }}>No active encounter.</p>
      </div>
    );
  }

  const entities = Object.values(encounter.entities);
  const player = entities.find((entity) => entity.faction === "player");
  const enemies = entities.filter((entity) => entity.faction === "enemy" && entity.alive);
  const targetId = enemies[0]?.id;
  const canAct = !!player && !!targetId && activeSide === "player";
  const actions = player?.actions ?? [];

  return (
    <div className="menu-panel" aria-live="polite">
      <div className="panel-title" id="combat-sheet-title">
        Combat Options
      </div>
      {actions.length === 0 ? (
        <p style={{ color: "var(--color-muted)", margin: 0 }}>Awaiting new tactics...</p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {actions.map((action) => (
            <button
              key={action.contract.id}
              className="btn btn--ghost"
              disabled={!canAct}
              onClick={() => {
                if (!canAct || !targetId) return;
                commitDecision({
                  actionId: action.contract.id,
                  targetIds: [targetId],
                  boosterOutcome: "good",
                });
              }}
            >
              <strong>{action.contract.name}</strong>
              <div style={{ fontSize: 12, opacity: 0.7 }}>{action.contract.category}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Final extraction panel shown when reaching the final exit. */
function FinalExtract({ onExtract }: { onExtract: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal={false}
      aria-label="Final extraction"
      style={{
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: 18,
        background: "rgba(18,14,28,0.58)",
        backdropFilter: "blur(16px)",
        padding: 16,
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

/** Journal panel with two tabs: Run Log and Combat Log. */
function JournalPanel({ titleId }: { titleId?: string }) {
  const runLog = useRunStore((s) => s.runLog);
  const combatLog = useRunStore((s) => s.combatLog);
  const combatBuffer = useRunStore((s) => s.combatLogBuffer);

  const [activeTab, setActiveTab] = useState<"run" | "combat">("run");
  const [runFilter, setRunFilter] = useState<"all" | "combat" | "loot" | "movement">("all");
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [expandedCombat, setExpandedCombat] = useState<string | null>(null);

  const sortedRunLog = useMemo(() => {
    return [...(runLog ?? [])].sort((a, b) => a.t - b.t);
  }, [runLog]);

  const filteredRunLog = useMemo(() => {
    if (runFilter === "all") return sortedRunLog;
    return sortedRunLog.filter((entry) => entry.category === runFilter);
  }, [sortedRunLog, runFilter]);

  const combinedCombatLog = useMemo(() => {
    const combined = [...(combatLog ?? []), ...(combatBuffer ?? [])];
    return combined.sort((a, b) => a.t - b.t);
  }, [combatLog, combatBuffer]);

  const renderMeta = (floor?: number, location?: { x: number; y: number }, tag?: string) => {
    const parts: string[] = [];
    if (typeof floor === "number" && floor > 0) parts.push(`Floor ${floor}`);
    if (location) parts.push(`(${location.x},${location.y})`);
    if (tag) parts.push(tag);
    return parts.join(" • ");
  };

  const filterOptions: { id: typeof runFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "combat", label: "Combat" },
    { id: "loot", label: "Loot" },
    { id: "movement", label: "Movement" },
  ];

  return (
    <div className="menu-panel" aria-label="Journal" style={{ minHeight: 260 }}>
      <div className="panel-title" id={titleId}>
        Journal
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          type="button"
          onClick={() => setActiveTab("run")}
          className="btn btn--ghost"
          style={{
            flex: 1,
            border: activeTab === "run" ? "1px solid rgba(255,255,255,0.4)" : undefined,
            background: activeTab === "run" ? "rgba(255,255,255,0.12)" : "transparent",
          }}
        >
          Run Log
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("combat")}
          className="btn btn--ghost"
          style={{
            flex: 1,
            border: activeTab === "combat" ? "1px solid rgba(255,255,255,0.4)" : undefined,
            background: activeTab === "combat" ? "rgba(255,255,255,0.12)" : "transparent",
          }}
        >
          Combat Log
        </button>
      </div>

      {/* Run log filter chips */}
      {activeTab === "run" && (
        <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
          {filterOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setRunFilter(opt.id)}
              className="btn btn--ghost"
              style={{
                flex: "1 1 auto",
                minWidth: 80,
                border:
                  runFilter === opt.id
                    ? "1px solid rgba(255,255,255,0.35)"
                    : "1px solid rgba(255,255,255,0.12)",
                background:
                  runFilter === opt.id ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Scroll area */}
      <div style={{ maxHeight: 320, overflowY: "auto", paddingRight: 4 }}>
        {activeTab === "run" ? (
          /* Run entries */
          filteredRunLog.length === 0 ? (
            <p style={{ color: "var(--color-muted)", margin: 0 }}>No run events recorded yet.</p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
              {filteredRunLog.map((entry) => {
                const expanded = expandedRun === entry.id;
                const meta = renderMeta(
                  entry.floor,
                  entry.location,
                  entry.category.charAt(0).toUpperCase() + entry.category.slice(1)
                );
                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => setExpandedRun(expanded ? null : entry.id)}
                      className="menu-link"
                      style={{
                        width: "100%",
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.12)",
                        background: expanded
                          ? "rgba(255,255,255,0.1)"
                          : "rgba(255,255,255,0.04)",
                        textAlign: "left",
                        padding: "10px 12px",
                        display: "grid",
                        gap: 4,
                      }}
                      aria-expanded={expanded}
                    >
                      <span
                        style={{
                          fontWeight: 600,
                          whiteSpace: expanded ? "normal" : "nowrap",
                          overflow: expanded ? "visible" : "hidden",
                          textOverflow: expanded ? "clip" : "ellipsis",
                        }}
                        title={entry.message}
                      >
                        {entry.message}
                      </span>
                      {meta && <span style={{ fontSize: 12, opacity: 0.7 }}>{meta}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )
        ) : /* Combat entries */ combinedCombatLog.length === 0 ? (
          <p style={{ color: "var(--color-muted)", margin: 0 }}>No combat events recorded yet.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
            {combinedCombatLog.map((entry) => {
              const expanded = expandedCombat === entry.id;
              const tagLabel = entry.tag ? entry.tag.charAt(0).toUpperCase() + entry.tag.slice(1) : undefined;
              const meta = renderMeta(entry.floor, entry.location, tagLabel);
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedCombat(expanded ? null : entry.id)}
                    className="menu-link"
                    style={{
                      width: "100%",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: expanded
                        ? "rgba(255,255,255,0.1)"
                        : "rgba(255,255,255,0.04)",
                      textAlign: "left",
                      padding: "10px 12px",
                      display: "grid",
                      gap: 4,
                    }}
                    aria-expanded={expanded}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        whiteSpace: expanded ? "normal" : "nowrap",
                        overflow: expanded ? "visible" : "hidden",
                        textOverflow: expanded ? "clip" : "ellipsis",
                      }}
                      title={entry.message}
                    >
                      {entry.message}
                    </span>
                    {meta && <span style={{ fontSize: 12, opacity: 0.7 }}>{meta}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Floor mini-map panel (8×8 by default). */
function MapPanel({ onClose, titleId }: { onClose?: () => void; titleId?: string }) {
  const grid = useRunStore((s) => s.grid);
  const visitedRooms = useRunStore((s) => s.visitedRooms);
  const pos = useRunStore((s) => s.playerPos);
  const currentFloor = useRunStore((s) => s.currentFloor);

  // Build a quick set of visited coords for the current floor
  const visited = new Set<string>();
  if (visitedRooms) {
    for (const key of Object.keys(visitedRooms)) {
      if (!visitedRooms[key]) continue;
      const [floorPart, coords] = key.split(":");
      if (Number(floorPart) === currentFloor && coords) visited.add(coords);
    }
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
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 18,
        background: "rgba(18,14,28,0.55)",
        backdropFilter: "blur(14px)",
        padding: 16,
      }}
    >
      {/* Header with optional close button for drawer mode */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <strong id={titleId}>Map</strong>
        {onClose && (
          <button
            className="hide-desktop"
            onClick={onClose}
            aria-label="Close map"
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.08)",
            }}
          >
            Close
          </button>
        )}
      </div>

      {/* Grid of tiles */}
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
