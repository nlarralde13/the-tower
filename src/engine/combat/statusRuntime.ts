import { getStatusDefinition } from "@/content/index";
import {
  Encounter,
  StatusContract,
  StatusInstance,
  TelemetryBus,
} from "@/engine/combat/types";
import type { SeededRNG } from "@/engine/rng";
import { logExpire, logStatusApply } from "@/engine/combat/telemetry";

interface ApplyArgs {
  stacks?: number;
  duration?: number;
  sourceId?: string;
  maxStacksOverride?: number;
}

const cloneEncounter = (encounter: Encounter): Encounter => ({
  ...encounter,
  entities: { ...encounter.entities },
});

const cloneEntity = (encounter: Encounter, entityId: string) => {
  const entity = encounter.entities[entityId];
  if (!entity) {
    throw new Error(`Entity ${entityId} not found`);
  }
  return { ...entity, statuses: [...entity.statuses] };
};

const ensureStackLimit = (
  stacks: number,
  contract: StatusContract,
  override?: number
) => Math.min(stacks, override ?? contract.stacking.maxStacks);

export function applyStatus(
  encounter: Encounter,
  entityId: string,
  statusId: string,
  rng: SeededRNG,
  bus: TelemetryBus,
  args: ApplyArgs = {}
): { encounter: Encounter; instance: StatusInstance | null } {
  const contract = getStatusDefinition(statusId);
  if (!contract) {
    return { encounter, instance: null };
  }
  const cloned = cloneEncounter(encounter);
  const entity = cloneEntity(cloned, entityId);
  const stacksToAdd = args.stacks ?? 1;
  const duration = args.duration ?? contract.duration.turns;
  const targetIndex = entity.statuses.findIndex(
    (status) => status.statusId === statusId
  );
  let instance: StatusInstance;

  if (targetIndex >= 0) {
    instance = { ...entity.statuses[targetIndex] };
    switch (contract.stacking.mode) {
      case "stack":
        instance.stacks = ensureStackLimit(
          instance.stacks + stacksToAdd,
          contract,
          args.maxStacksOverride
        );
        instance.remaining = Math.max(instance.remaining, duration);
        break;
      case "refresh":
        instance.remaining = duration;
        instance.stacks = ensureStackLimit(
          Math.max(instance.stacks, stacksToAdd),
          contract,
          args.maxStacksOverride
        );
        break;
      case "replace":
      default:
        instance = createInstance(
          contract,
          statusId,
          duration,
          stacksToAdd,
          args.sourceId,
          encounter.turn,
          rng
        );
        break;
    }
    entity.statuses[targetIndex] = instance;
  } else {
    instance = createInstance(
      contract,
      statusId,
      duration,
      stacksToAdd,
      args.sourceId,
      encounter.turn,
      rng
    );
    entity.statuses.push(instance);
  }

  cloned.entities[entityId] = entity;
  logStatusApply(bus, {
    entityId,
    statusId,
    stacks: instance.stacks,
    duration: instance.remaining,
  });

  return { encounter: cloned, instance };
}

function createInstance(
  contract: StatusContract,
  statusId: string,
  duration: number,
  stacks: number,
  sourceId: string | undefined,
  turn: number,
  rng: SeededRNG
): StatusInstance {
  return {
    id: `${statusId}-${Math.floor(rng.nextFloat() * 1e8)}`,
    statusId,
    stacks,
    remaining: Math.max(0, duration),
    sourceId,
    appliedAtTurn: turn,
    metadata: contract.duration.maxDurationPerFight
      ? { lifetime: 0 }
      : undefined,
  };
}

export function expireStatus(
  encounter: Encounter,
  entityId: string,
  instanceId: string,
  bus: TelemetryBus
): { encounter: Encounter; expired: StatusInstance | null } {
  const cloned = cloneEncounter(encounter);
  const entity = cloneEntity(cloned, entityId);
  const index = entity.statuses.findIndex((s) => s.id === instanceId);
  if (index === -1) {
    return { encounter, expired: null };
  }
  const [expired] = entity.statuses.splice(index, 1);
  cloned.entities[entityId] = entity;
  logExpire(bus, expired, { entityId });
  return { encounter: cloned, expired };
}

export function processStatusDurations(
  encounter: Encounter,
  entityId: string,
  phase: "turnStart" | "turnEnd",
  bus: TelemetryBus
): { encounter: Encounter; expired: StatusInstance[] } {
  const cloned = cloneEncounter(encounter);
  const entity = cloneEntity(cloned, entityId);
  const expired: StatusInstance[] = [];
  for (let i = entity.statuses.length - 1; i >= 0; i--) {
    const instance = { ...entity.statuses[i] };
    const contract = getStatusDefinition(instance.statusId);
    if (!contract) continue;
    if (contract.duration.tickOn.includes(phase)) {
      instance.remaining = Math.max(0, instance.remaining - 1);
      if (instance.metadata && typeof instance.metadata.lifetime === "number") {
        instance.metadata.lifetime += 1;
        if (
          contract.duration.maxDurationPerFight !== undefined &&
          instance.metadata.lifetime >= contract.duration.maxDurationPerFight
        ) {
          instance.remaining = 0;
        }
      }
      if (instance.remaining <= 0) {
        expired.push(instance);
        entity.statuses.splice(i, 1);
        logExpire(bus, instance, { entityId });
        continue;
      }
    }
    entity.statuses[i] = instance;
  }
  cloned.entities[entityId] = entity;
  return { encounter: cloned, expired };
}
