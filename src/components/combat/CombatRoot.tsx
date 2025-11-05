"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CombatConsole from "./CombatConsole";

/**
 * Wire these selectors to your store:
 * - encounter: the active encounter object (must have stable .id while combat lasts)
 * - activeCombat: boolean flag indicating combat is running
 * - telemetry: array/queue that includes an "initiative" entry at combat start
 * - markTelemetryRead: advance your telemetry cursor when we've consumed items
 * - completeEncounter: finalize the encounter (victory/defeat/escape)
 *
 * Replace the import below with your actual store path.
 */
// import { useRunStore } from "@/stores/runStore";

type TelemetryItem = {
  type: string;
  payload?: any;
};

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

type EncounterVM = {
  id: string;
  order: string[];                 // initiative order (entity ids)
  turnOwnerId: string;             // whose turn is it now
  entities: Record<string, Entity>;
  enemies: string[];               // ids
  party: string[];                 // ids
};

export default function CombatRoot() {
  /** -------------------- Store wiring (replace with your own) -------------------- */
  // const {
  //   encounter,          // EncounterVM or similar
  //   activeCombat,       // boolean
  //   telemetry,          // TelemetryItem[]
  //   markTelemetryRead,  // (count: number) => void
  //   completeEncounter,  // (result: "victory"|"defeat"|"escape") => void
  // } = useRunStore(s => ({
  //   encounter: s.encounter,
  //   activeCombat: s.activeCombat,
  //   telemetry: s.telemetryUnread, // or however you expose unread entries
  //   markTelemetryRead: s.markTelemetryRead,
  //   completeEncounter: s.completeEncounter,
  // }));

  // Temporary no-op stand-ins so this file compiles if you paste before wiring:
  const encounter = useMemo<EncounterVM | null>(() => null, []);
  const activeCombat = true;
  const telemetry: TelemetryItem[] = [];
  const markTelemetryRead = (_n: number) => {};
  const completeEncounter = (_r: "victory" | "defeat" | "escape") => {};

  /** -------------------- Local state & refs -------------------- */
  const [bannerLine, setBannerLine] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<string>(""); // aria-live

  // Disable inputs while the initiative banner is visible
  const inputsDisabled = bannerLine !== null;

  // Guard completion double-fire
  const completionRef = useRef<string | null>(null);

  // Timer for initiative banner
  const bannerTimerRef = useRef<number | null>(null);

  // Last resolution (optional feed from your engine; useful for compact log / floaters)
  const [lastResolution, setLastResolution] = useState<
    { text: string; targetId?: string; crit?: boolean; dmg?: number } | undefined
  >(undefined);

  /** -------------------- Body flag to hide room flavor during combat -------------------- */
  useEffect(() => {
    document.body.dataset.combat = "1";
    return () => {
      delete document.body.dataset.combat;
    };
  }, []);

  /** -------------------- Initiative banner from telemetry -------------------- */
  useEffect(() => {
    if (!activeCombat || !encounter?.id) return;

    // Find first unread initiative item (shape is up to your engine)
    const idx = telemetry.findIndex(t => t.type === "initiative");
    if (idx === -1) return;

    const item = telemetry[idx];
    // Example payload we’ll try to read; adjust if yours differs:
    // payload = { first: "enemy"|"player", playerRoll: number, enemyRoll: number, who: string }
    const p = item.payload ?? {};
    const who = p.who ?? (p.first === "player" ? "You" : "Enemy");
    const pr = Number(p.playerRoll);
    const er = Number(p.enemyRoll);

    const line =
      isFinite(pr) && isFinite(er)
        ? `${who} take the initiative (${isNaN(pr) ? "?" : pr} vs ${isNaN(er) ? "?" : er}).`
        : `${who} take the initiative.`;

    setBannerLine(line);
    setAnnouncement(line);

    // consume the initiative item (and anything before it)
    markTelemetryRead(idx + 1);

    // banner visible ~1.5s, then clear
    if (bannerTimerRef.current) window.clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = window.setTimeout(() => {
      setBannerLine(null);
      bannerTimerRef.current = null;
    }, 1500);

    return () => {
      if (bannerTimerRef.current) {
        window.clearTimeout(bannerTimerRef.current);
        bannerTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCombat, encounter?.id, telemetry]);

  /** -------------------- Completion guard (victory / defeat / escape) -------------------- */
  useEffect(() => {
    if (!activeCombat || !encounter?.id) {
      completionRef.current = null;
      return;
    }

    // Derive basic completion conditions from the encounter VM
    const enemiesAlive =
      encounter.enemies.some(id => (encounter.entities[id]?.hp ?? 0) > 0);
    const partyAlive =
      encounter.party.some(id => (encounter.entities[id]?.hp ?? 0) > 0);

    // Don’t fire more than once per encounter id
    if (!enemiesAlive && partyAlive && completionRef.current !== encounter.id) {
      completionRef.current = encounter.id;
      completeEncounter("victory");
    } else if (!partyAlive && completionRef.current !== encounter.id) {
      completionRef.current = encounter.id;
      completeEncounter("defeat");
    }
  }, [activeCombat, encounter, completeEncounter]);

  /** -------------------- Layout -------------------- */
  return (
    <>
      {/* SR-only live region for initiative or other combat announcements */}
      <div aria-live="polite" className="visually-hidden">
        {announcement}
      </div>

      {/* Initiative banner (brief lockout) */}
      {bannerLine && (
        <div
          className="menu-panel"
          style={{
            position: "absolute",
            left: "50%",
            top: "10px",
            transform: "translateX(-50%)",
            zIndex: 2,
            padding: "10px 14px",
            textAlign: "center",
          }}
          role="status"
          aria-live="polite"
        >
          {bannerLine}
        </div>
      )}

      {/* TOP HUD: player (left) / enemies (right) */}
      <div className="combat-hud">
        <div className="hud-card hud-left" id="hud-left" />
        <div className="hud-card hud-right" id="hud-right" />
      </div>

      {/* SCENE OVERLAY: turn order strip, compact log, damage/crit floaters */}
      <div className="combat-scene-overlay" id="scene-overlay" />

      {/* CONTROLLER / MENUS (JRPG pad) */}
      <div className="combat-pad" aria-disabled={inputsDisabled}>
        <CombatConsole
          // Feed your VM, skills, items, actions here (these are placeholders)
          vm={
            (encounter as unknown as EncounterVM) || {
              id: "pending",
              order: [],
              turnOwnerId: "",
              entities: {},
              enemies: [],
              party: [],
            }
          }
          skills={[]}
          items={[]}
          onAct={() => {}}
          lastResolution={lastResolution}
          // new prop you should handle in CombatConsole to disable buttons
          // during the initiative banner:
          // @ts-ignore optional until you add it on the console
          inputsDisabled={inputsDisabled}
        />
      </div>
    </>
  );
}
