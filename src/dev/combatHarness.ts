import { startEncounter, takeTurn } from "@/engine/combat/engine";
import type { PlayerDecision, ActionResolutionEvent } from "@/engine/combat/types";

const describeEvents = (events: ActionResolutionEvent[]) => {
  return events
    .map((event) => {
      switch (event.type) {
        case "damage":
          return `${event.targetId} -${event.amount}${event.crit ? " (CRIT)" : ""}${
            event.blocked ? " [GUARDED]" : ""
          }`;
        case "status-apply":
          return `${event.targetId} gained ${event.statusId} x${event.stacks}`;
        case "guard":
          return `${event.targetId} guard ${Math.round(event.ratio * 100)}%`;
        case "counter":
          return `${event.targetId} counter ${Math.round(event.chance * 100)}%`;
        case "status-expire":
          return `${event.targetId} cleared ${event.statusId}`;
        default:
          return "unknown";
      }
    })
    .join(" | ");
};

const hasVerboseFlag =
  typeof process !== "undefined" && process.argv.includes("--verbose");

const describeInitiative = (encounter: ReturnType<typeof startEncounter>) => {
  const entities = Object.values(encounter.entities);
  const enemies = entities.filter((entity) => entity.faction === "enemy");
  const playerEntity = entities.find((entity) => entity.faction === "player");
  const enemyNames = enemies.length
    ? enemies.map((enemy) => enemy.name).join(", ")
    : "Unknown";
  const { player, enemy, first } = encounter.initiative;
  console.log(`=== Encounter: Player vs ${enemyNames} ===`);
  console.log(`Initiative \u2192 ${first.toUpperCase()} (P:${player}, E:${enemy})`);
  if (hasVerboseFlag && player === enemy) {
    const playerSpd = playerEntity?.stats.SPD ?? 0;
    const topEnemySpd = enemies.reduce(
      (max, current) => Math.max(max, current.stats.SPD),
      0
    );
    if (playerSpd !== topEnemySpd) {
      console.log(
        `Tie-break (SPD): player SPD ${playerSpd} vs top enemy SPD ${topEnemySpd} \u2192 ${first.toUpperCase()}`
      );
    } else {
      console.log(
        `Tie-break (coin flip): deterministic RNG resolved to ${first.toUpperCase()}`
      );
    }
  }
};

export function runCombatHarness() {
  let encounter = startEncounter(
    {
      player: {
        id: "runner",
        name: "Runner",
        stats: {
          HP: 120,
          ATK: 24,
          DEF: 12,
          INT: 18,
          RES: 14,
          SPD: 16,
          LUCK: 10,
        },
        resources: { focus: 2 },
        actions: ["defend"],
        items: ["starter-sword", "starter-staff", "buckler"],
      },
      accessibility: { autoGood: false },
      encounterIndex: 0,
    },
    ["rat", "acolyte"],
    "dev-harness"
  );

  describeInitiative(encounter);

  const script: PlayerDecision[] = [
    {
      actionId: "slash",
      targetIds: [encounter.order.find((id) => id.startsWith("rat")) ?? "rat-0"],
      boosterOutcome: "perfect",
    },
    {
      actionId: "fireball",
      targetIds: [
        encounter.order.find((id) => id.startsWith("acolyte")) ?? "acolyte-1",
      ],
      boosterOutcome: "good",
    },
    {
      actionId: "defend",
      targetIds: ["runner"],
      boosterOutcome: "perfect",
    },
  ];

  console.log("=== Combat Harness Transcript ===");

  for (const decision of script) {
    const playerTurn = takeTurn(encounter, decision);
    const playerResolution = playerTurn.resolution;
    console.log(
      `Player -> ${playerResolution.actionId} (${playerResolution.booster?.outcome ?? "neutral"}): ${describeEvents(playerResolution.events)}`
    );
    encounter = playerTurn.encounter;

    const enemyTurn = takeTurn(encounter);
    const enemyResolution = enemyTurn.resolution;
    console.log(
      `Enemy -> ${enemyResolution.actorId} used ${enemyResolution.actionId}: ${describeEvents(enemyResolution.events)}`
    );
    encounter = enemyTurn.encounter;
  }
}

if (typeof process !== "undefined") {
  const moduleUrl = `file://${process.argv[1]}`;
  if (import.meta.url === moduleUrl) {
    runCombatHarness();
  }
}


