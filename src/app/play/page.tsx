
﻿"use client";

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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageSurface from "@/components/PageSurface";
import SceneViewer from "@/components/SceneViewer";
import CompactMeterGroup, { type GaugeValue } from "@/components/hud/CompactMeters";
import SlideDrawer from "@/components/drawers/SlideDrawer";
import { useUIStore } from "@/store/uiStore";
import type { PanelName } from "@/store/uiStore";
import { useRunStore } from "@/store/runStore";
import { useHaptics } from "@/hooks/useHaptics";
import { chooseFlavor, exitsFlavor } from "@/game/flavor";
import { getEnemyDefinition } from "@/content/index";
import { useRouter, useSearchParams } from "next/navigation";
import { playMusic } from "@/utils/audioManager";
import ControlPad from "@/components/console/ControlPad";
import { DefeatOverlay } from "@/components/run/DefeatOverlay";

const PASSABLE_ROOM_TYPES = new Set(["entry", "exit", "boss", "combat", "trap", "loot", "out", "special", "empty"]);

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
  const combatSession = useRunStore((s) => s.combatSession);
  const engageCombat = useRunStore((s) => s.engageCombat);
  const attemptCombatFlee = useRunStore((s) => s.attemptCombatFlee);
  const resolveCombatExit = useRunStore((s) => s.resolveCombatExit);

  //Run+UI store updates
  const runMode = useRunStore((s) => s.mode); // existing: "explore" | "combat"
  const setMode = useUIStore((s) => s.setMode);

  /* --------------------------------------------------------------
   * UI STORE — drawers & panels
   * -------------------------------------------------------------- */
  const characterOpen = useUIStore((state) => state.openPanels.character);
  const inventoryOpen = useUIStore((state) => state.openPanels.inventory);
  const mapOpen = useUIStore((state) => state.openPanels.map);
  const journalOpen = useUIStore((state) => state.openPanels.journal);
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
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  /* --------------------------------------------------------------
   * Ambient audio (looped music)
   * -------------------------------------------------------------- */
  useEffect(() => {
    playMusic("/audio/tower_theme.mp3");
  }, [runId]);

  /* --------------------------------------------------------------
   * Lifecycle: resume from storage, apply dev overlay, guard route
   * -------------------------------------------------------------- */
  useEffect(() => {
    resume();
  }, [resume]);

  //Sync Modes
  useEffect(() => {
    setMode(runMode === "combat" ? "combat" : "explore");
  }, [runMode, setMode]);

  // Allow dev overlay via ?overlay=1
  useEffect(() => {
    if (search?.get("overlay") === "1") toggleOverlay(true);
  }, [search, toggleOverlay]);

  // If no active run, redirect to /climb
  useEffect(() => {
    if (!runId) router.replace("/climb");
  }, [runId, router]);

  // When combat starts, move to the dedicated combat surface
  useEffect(() => {
    if (mode === "combat" && combatSession.status === "ready") router.replace("/play/combat");
  }, [mode, combatSession.status, router]);

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
    const passable = PASSABLE_ROOM_TYPES;
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
    if (combatSession.status === "prompt") return "You have entered a combat room.";
    if (combatSession.status === "loading") return "Preparing the encounter...";
    if (combatSession.status === "resolving" && combatSession.outcome === "victory") {
      return "Combat resolved. Choose your exit.";
    }
    if (mode === "combat") return combatCaption;
    if (currentKey && completedRooms?.[currentKey]) {
      const base = caption ?? "";
      return `${base} ${clearedRoomMessage}`.trim();
    }
    return caption;
  }, [combatSession.status, combatSession.outcome, mode, combatCaption, caption, currentKey, completedRooms]);

  const exitOptions = useMemo(() => {
    if (!grid || !pos) return [];
    const W = grid.width;
    const H = grid.height;
    const probes: Array<{ dir: "north" | "south" | "east" | "west"; x: number; y: number }> = [
      { dir: "north", x: pos.x, y: pos.y - 1 },
      { dir: "south", x: pos.x, y: pos.y + 1 },
      { dir: "west", x: pos.x - 1, y: pos.y },
      { dir: "east", x: pos.x + 1, y: pos.y },
    ];
    return probes.map((option) => {
      const inBounds = option.x >= 0 && option.y >= 0 && option.x < W && option.y < H;
      const cell = inBounds ? grid.cells[option.y * W + option.x] : null;
      const available = Boolean(inBounds && cell && PASSABLE_ROOM_TYPES.has(cell.type));
      return { ...option, available };
    });
  }, [grid, pos]);

  const showPrompt = combatSession.status === "prompt" && !defeatOverlay;
  const showLoading = combatSession.status === "loading" && !defeatOverlay;
  const showExitPicker = combatSession.status === "resolving" && combatSession.outcome === "victory" && !defeatOverlay;

  /* --------------------------------------------------------------
   * Mode & meters
   * -------------------------------------------------------------- */
  const combatActive = mode === "combat" && combatSession.status === "ready";

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
 

  /* --------------------------------------------------------------
   * Helpers — announce (aria-live), inspect, end run, back
   * -------------------------------------------------------------- */
  const announce = useCallback(
    (msg: string) => {
      setActionMsg(msg);
      // Force SR re-read by briefly clearing then setting text content
      requestAnimationFrame(() => {
        if (liveRef.current) {
          (liveRef.current as HTMLDivElement).textContent = "";
          (liveRef.current as HTMLDivElement).textContent = msg;
        }
      });
    },
    [liveRef]
  );

  useEffect(() => {
    if (defeatOverlay) announce("You have been defeated. A piece of your soul lingers.");
  }, [defeatOverlay, announce]);

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

  const handleEngage = useCallback(() => {
    void engageCombat();
  }, [engageCombat]);

  const handleAttemptFlee = useCallback(async () => {
    const result = await attemptCombatFlee();
    if (result === "unavailable") return;
    if (result === "escaped") {
      announce("You slam the door and escape!");
      triggerHaptic("attack_hit");
    } else if (result === "failed") {
      announce("Escape failed! Prepare to fight.");
      triggerHaptic("attack_taken");
    }
  }, [attemptCombatFlee, announce, triggerHaptic]);

  const handleExitChoice = useCallback(
    (dir: "north" | "south" | "east" | "west") => {
      resolveCombatExit(dir);
    },
    [resolveCombatExit]
  );

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
  }, [mode, triggerHaptic, announce]);

  useEffect(() => {
    if (combatSession.status === "prompt") {
      announce("You have entered a combat room. Engage or attempt to flee.");
    } else if (combatSession.status === "loading") {
      announce("Preparing the encounter.");
    } else if (combatSession.status === "resolving" && combatSession.outcome === "victory") {
      announce("Combat resolved. Choose your exit.");
    }
  }, [combatSession.status, combatSession.outcome, announce]);

  function handleBack() {
    if (confirm("Leave the current run and return to the climb?")) {
      router.push("/");
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
    <PageSurface>
      {/* ============================================================
          MAIN GRID — left rail / middle console / right rail
          ============================================================ */}
      <div className="play-root" data-combat-root>
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
        <aside className="play-left" aria-label="Hero overview" />

        {/* ============================================================
            MIDDLE — Scene viewer + overlayed action pad + combat layer
            ============================================================ */}
        <section className="play-middle" data-combat-host style={{ position: "relative" }}>
          
          {(showPrompt || showLoading || showExitPicker) && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 30,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {showPrompt ? (
                <CombatPromptOverlay onEngage={handleEngage} onFlee={handleAttemptFlee} />
              ) : null}
              {showLoading ? <CombatLoadingOverlay /> : null}
              {showExitPicker ? (
                <CombatExitPicker exits={exitOptions} onSelect={handleExitChoice} />
              ) : null}
            </div>
          )}

          <div className={`console-frame ${combatActive ? "console-frame--combat" : ""}`}>
            <div className="console-frame__content" aria-hidden={combatActive}>
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
                  floor={currentFloor}
                />
              </div>
             </div>
          </div>

          {/* ⬇️ new glass overlay pad positioned over the scene ⬇️ */}
          <div className="actions-pad actions-pad--overlay">
            <ControlPad />
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
          <CharacterPanel
            meters={heroMeters}
            titleId="character-drawer-title"
            onClose={handleCloseDrawer("character")}
          />
        </SlideDrawer>

        <SlideDrawer
          id="inventory-drawer"
          side="left"
          open={inventoryOpen}
          onClose={handleCloseDrawer("inventory")}
          labelledBy="inventory-drawer-title"
        >
          <InventoryPanel
            titleId="inventory-drawer-title"
            onClose={handleCloseDrawer("inventory")}
          />
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
        {isDesktop ? (
          <SlideDrawer
            id="journal-drawer-desktop"
            side="right"
            open={journalOpen}
            onClose={handleCloseDrawer("journal")}
            labelledBy="journal-drawer-title"
          >
            <JournalPanel titleId="journal-drawer-title" onClose={handleCloseDrawer("journal")} />
          </SlideDrawer>
        ) : (
          <SlideDrawer
            id="journal-drawer-mobile"
            side="bottom"
            variant="journal"
            open={journalOpen}
            onClose={handleCloseDrawer("journal")}
            labelledBy="journal-drawer-title"
          >
            <JournalPanel titleId="journal-drawer-title" onClose={handleCloseDrawer("journal")} />
          </SlideDrawer>
        )}

        {/* Combat actions bottom sheet (auto-opens in combat) */}
        
      </div>
    </PageSurface>
  );
}
/* =================================================================
   OVERLAYS & PANELS (local components)
   ================================================================= */

/** Inventory summary (placeholder content; wire to real items later). */
function CombatPromptOverlay({
  onEngage,
  onFlee,
}: {
  onEngage: () => void;
  onFlee: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Combat prompt"
      style={{
        pointerEvents: "auto",
        minWidth: 320,
        maxWidth: 420,
        padding: 24,
        borderRadius: 20,
        border: "1px solid rgba(255,255,255,0.25)",
        background: "rgba(7,5,15,0.9)",
        boxShadow: "0 24px 50px rgba(0,0,0,0.45)",
        display: "grid",
        gap: 16,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 700 }}>Hostile presence detected.</div>
      <p style={{ margin: 0, color: "rgba(255,255,255,0.85)" }}>
        You have entered a combat room. Engage now or attempt to flee.
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
        <button onClick={onEngage} className="btn btn--primary" style={{ flex: 1, minWidth: 120 }}>
          Engage
        </button>
        <button onClick={onFlee} className="btn btn--ghost" style={{ flex: 1, minWidth: 120 }}>
          Attempt to Flee
        </button>
      </div>
    </div>
  );
}

function CombatLoadingOverlay() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        pointerEvents: "auto",
        minWidth: 280,
        padding: 24,
        borderRadius: 20,
        border: "1px solid rgba(255,255,255,0.18)",
        background: "rgba(6,4,12,0.85)",
        boxShadow: "0 20px 40px rgba(0,0,0,0.45)",
        textAlign: "center",
        color: "rgba(255,255,255,0.9)",
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Preparing encounter...</div>
      <p style={{ margin: 0, fontSize: 13, opacity: 0.85 }}>Synchronizing enemy dossiers and initiative.</p>
    </div>
  );
}

type ExitOption = { dir: "north" | "south" | "east" | "west"; x: number; y: number; available: boolean };

function CombatExitPicker({
  exits,
  onSelect,
}: {
  exits: ExitOption[];
  onSelect: (dir: ExitOption["dir"]) => void;
}) {
  return (
    <div
      role="dialog"
      aria-label="Choose exit"
      aria-live="polite"
      style={{
        pointerEvents: "auto",
        minWidth: 360,
        padding: 24,
        borderRadius: 20,
        border: "1px solid rgba(255,255,255,0.25)",
        background: "rgba(5,8,18,0.92)",
        boxShadow: "0 30px 60px rgba(0,0,0,0.5)",
        display: "grid",
        gap: 16,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 700 }}>Combat resolved.</div>
      <p style={{ margin: 0, color: "rgba(255,255,255,0.8)" }}>Choose your exit to continue the run.</p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(120px, 1fr))",
          gap: 12,
        }}
      >
        {exits.map((exit) => (
          <button
            key={exit.dir}
            onClick={() => onSelect(exit.dir)}
            className="btn btn--ghost"
            disabled={!exit.available}
            style={{
              minHeight: 48,
              borderColor: exit.available ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.15)",
              opacity: exit.available ? 1 : 0.55,
            }}
          >
            {exit.dir.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}

function InventoryPanel({ onClose, titleId }: { onClose?: () => void; titleId?: string }) {
  return (
    <div
      className="menu-panel"
      id="inventory-panel"
      aria-label="Inventory"
      style={{ minHeight: 260 }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <div className="panel-title" id={titleId}>
          Inventory
        </div>
        <DrawerCloseButton onClick={onClose} label="Close inventory" />
      </div>
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
function CharacterPanel({
  meters,
  titleId,
  onClose,
}: {
  meters: GaugeValue[];
  titleId?: string;
  onClose?: () => void;
}) {
  return (
    <div className="menu-panel" id="character-panel" aria-label="Character Sheet">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <div className="panel-title" id={titleId}>
          Character
        </div>
        <DrawerCloseButton onClick={onClose} label="Close character drawer" />
      </div>
      <CompactMeterGroup meters={meters} />
      <div style={{ display: "grid", gap: 10 }}>
        <PanelRow label="Level" value="1" />
        <PanelRow label="XP" value="0 / 1000" />
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

function DrawerCloseButton({ onClick, label }: { onClick?: () => void; label: string }) {
  if (!onClick) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        padding: "6px 12px",
        borderRadius: 8,
        border: "1px solid rgba(255,255,255,0.2)",
        background: "rgba(255,255,255,0.08)",
        color: "inherit",
        fontWeight: 600,
      }}
    >
      Close
    </button>
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
function JournalPanel({ titleId, onClose }: { titleId?: string; onClose?: () => void }) {
  const runLog = useRunStore((s) => s.runLog);
  const combatLog = useRunStore((s) => s.combatLog);
  const combatBuffer = useRunStore((s) => s.combatLogBuffer);

  const [activeTab, setActiveTab] = useState<"run" | "combat">("run");
  const [runFilter, setRunFilter] = useState<"all" | "combat" | "loot" | "movement">("all");
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [expandedCombat, setExpandedCombat] = useState<string | null>(null);

  const sortedRunLog = useMemo(() => {
    return [...runLog].sort((a, b) => a.t - b.t);
  }, [runLog]);

  const filteredRunLog = useMemo(() => {
    if (runFilter === "all") return sortedRunLog;
    return sortedRunLog.filter((entry) => entry.category === runFilter);
  }, [sortedRunLog, runFilter]);

  const combinedCombatLog = useMemo(() => {
    const combined = [...combatLog, ...combatBuffer];
    combined.sort((a, b) => a.t - b.t);
    return combined;
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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <div className="panel-title" id={titleId}>
          Journal
        </div>
        <DrawerCloseButton onClick={onClose} label="Close journal" />
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
        <DrawerCloseButton onClick={onClose} label="Close map" />
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
