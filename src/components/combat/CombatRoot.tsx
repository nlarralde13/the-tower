"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useCombatStore } from "@/state/combatStore";
import { useRunStore } from "@/store/runStore";
import type {
  CombatEntity,
  Encounter,
  InitiativeResult,
  TelemetryRecord,
} from "@/engine/combat/types";

interface InitiativeLineArgs extends InitiativeResult {
  playerName: string;
  enemyNames: string;
}

const pickInitiativeLine = ({
  first,
  playerName,
  enemyNames,
  player,
  enemy,
}: InitiativeLineArgs) => {
  const winnerName = first === "player" ? playerName : enemyNames;
  const loserName = first === "player" ? enemyNames : playerName;
  const rollSpread = Math.abs(player - enemy);

  if (first === "player") {
    if (rollSpread >= 5) {
      return `${playerName} surges ahead (${player} vs ${enemy})!`;
    }
    return `${playerName} edges out ${loserName} (${player}-${enemy}).`;
  }

  if (rollSpread >= 5) {
    return `${winnerName} seizes the initiative (${enemy} vs ${player})!`;
  }
  return `${winnerName} gains the first strike (${enemy}-${player}).`;
};

interface CombatRootProps {
  children: ReactNode;
}

export default function CombatRoot({ children }: CombatRootProps) {
  const encounter = useCombatStore((state) => state.encounter);
  const telemetry: TelemetryRecord[] = encounter?.telemetry ?? [];
  const activeCombat = useRunStore((state) => state.activeCombat);
  const completeCombat = useRunStore((state) => state.completeCombat);
  const [bannerLine, setBannerLine] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<string>("");
  const encounterIdRef = useRef<string | null>(null);
  const telemetryIndexRef = useRef<number>(0);
  const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completionRef = useRef<{ id: string; outcome: "victory" | "defeat" } | null>(null);

  const playerEntity = useMemo(() => findEntity(encounter, "player"), [encounter]);
  const enemyNames = useMemo(() => listEnemies(encounter), [encounter]);

  useEffect(() => {
    if (!encounter) {
      telemetryIndexRef.current = 0;
      return;
    }

    if (encounter.id !== encounterIdRef.current) {
      encounterIdRef.current = encounter.id;
      telemetryIndexRef.current = 0;
    }

    if (telemetry.length <= telemetryIndexRef.current) {
      return;
    }

    const newEvents = telemetry.slice(telemetryIndexRef.current);
    telemetryIndexRef.current = telemetry.length;

    const initiativeEvent = newEvents.find((event) => event.type === "initiative");
    if (!initiativeEvent || !playerEntity) {
      return;
    }

    const payloadRecord = initiativeEvent.payload as Record<string, unknown>;
    const candidate: Partial<InitiativeResult> = {
      player:
        typeof payloadRecord.player === "number"
          ? payloadRecord.player
          : Number(payloadRecord.player),
      enemy:
        typeof payloadRecord.enemy === "number"
          ? payloadRecord.enemy
          : Number(payloadRecord.enemy),
      first: payloadRecord.first as InitiativeResult["first"] | undefined,
    };

    if (
      typeof candidate.player !== "number" ||
      Number.isNaN(candidate.player) ||
      typeof candidate.enemy !== "number" ||
      Number.isNaN(candidate.enemy) ||
      (candidate.first !== "player" && candidate.first !== "enemy")
    ) {
      return;
    }

    const line = pickInitiativeLine({
      player: candidate.player,
      enemy: candidate.enemy,
      first: candidate.first,
      playerName: playerEntity.name,
      enemyNames: enemyNames || "the opposition",
    });

    if (bannerTimeoutRef.current) {
      clearTimeout(bannerTimeoutRef.current);
    }

    setBannerLine(line);
    setAnnouncement(line);

    bannerTimeoutRef.current = setTimeout(() => {
      setBannerLine(null);
    }, 1500);
  }, [encounter, telemetry, playerEntity, enemyNames]);

  useEffect(() => {
    return () => {
      if (bannerTimeoutRef.current) {
        clearTimeout(bannerTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!encounter || !activeCombat) {
      completionRef.current = null;
      return;
    }
    const enemiesAlive = Object.values(encounter.entities).some(
      (entity) => entity.faction === "enemy" && entity.alive
    );
    const playerAlive = Object.values(encounter.entities).some(
      (entity) => entity.faction === "player" && entity.alive
    );

    let outcome: "victory" | "defeat" | null = null;
    if (!enemiesAlive) {
      outcome = "victory";
    } else if (!playerAlive) {
      outcome = "defeat";
    }

    if (!outcome) return;
    const last = completionRef.current;
    if (last && last.id === encounter.id && last.outcome === outcome) {
      return;
    }
    completionRef.current = { id: encounter.id, outcome };
    completeCombat({ victory: outcome === "victory" });
    const combatState = useCombatStore.getState();
    if (combatState.endEncounter) {
      combatState.endEncounter();
    }
  }, [encounter, activeCombat, completeCombat]);

  const inputsDisabled = bannerLine !== null;

  return (
    <div className="relative h-full w-full" aria-busy={inputsDisabled}>
      {bannerLine ? (
        <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center">
          <div className="rounded-md bg-black/80 px-6 py-3 text-sm font-semibold tracking-wide text-white shadow-lg backdrop-blur-md">
            {bannerLine}
          </div>
        </div>
      ) : null}
      <div
        aria-live="assertive"
        role="status"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        {announcement}
      </div>
      <div
        className={inputsDisabled ? "pointer-events-none opacity-70" : ""}
        style={{
          transition: "opacity 150ms ease",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function findEntity(encounter: Encounter | null, faction: CombatEntity["faction"]) {
  if (!encounter) return null;
  return Object.values(encounter.entities).find((entity) => entity.faction === faction) ?? null;
}

function listEnemies(encounter: Encounter | null) {
  if (!encounter) return "";
  const enemies = Object.values(encounter.entities).filter((entity) => entity.faction === "enemy");
  if (enemies.length === 0) {
    return "";
  }
  if (enemies.length === 1) {
    return enemies[0].name;
  }
  return enemies.map((enemy) => enemy.name).join(", ");
}
