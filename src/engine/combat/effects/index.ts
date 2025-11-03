import {
  ActionContract,
  ActionResolutionEvent,
  ApplyStatusEffect,
  BoosterResult,
  CombatEntity,
  Encounter,
  EffectBrick,
  GuardState,
  HitCheckEffect,
  TelemetryBus,
  StatusInstance,
} from "@/engine/combat/types";
import { getStatusDefinition } from "@/content/index";
import { damage as computeDamage, hitChance, statusRoll } from "@/engine/combat/formulas";
import { applyStatus, expireStatus } from "@/engine/combat/statusRuntime";
import type { SeededRNG } from "@/engine/rng";

interface EffectContext {
  encounter: Encounter;
  actorId: string;
  targetIds: string[];
  action: ActionContract;
  booster?: BoosterResult;
  rng: SeededRNG;
  events: ActionResolutionEvent[];
  telemetry: TelemetryBus;
  queue: EffectBrick[];
  flags: {
    hitMap: Record<string, boolean>;
  };
  statusInstance?: StatusInstance;
}

const cloneEncounter = (encounter: Encounter): Encounter => ({
  ...encounter,
  entities: { ...encounter.entities },
});

const cloneEntity = (entity: CombatEntity): CombatEntity => ({
  ...entity,
  statuses: [...entity.statuses],
});

const getEntity = (encounter: Encounter, id: string): CombatEntity => {
  const entity = encounter.entities[id];
  if (!entity) {
    throw new Error(`Entity ${id} not found in encounter`);
  }
  return entity;
};

const updateEntity = (
  encounter: Encounter,
  entityId: string,
  updater: (entity: CombatEntity) => CombatEntity
): Encounter => {
  const cloned = cloneEncounter(encounter);
  const current = getEntity(cloned, entityId);
  cloned.entities[entityId] = updater(cloneEntity(current));
  return cloned;
};

const mergeEvents = (
  events: ActionResolutionEvent[],
  added: ActionResolutionEvent[]
): ActionResolutionEvent[] => [...events, ...added];

const ensureHitMap = (context: EffectContext, defaultValue: boolean) => {
  const hitMap = { ...context.flags.hitMap };
  for (const targetId of context.targetIds) {
    if (!(targetId in hitMap)) {
      hitMap[targetId] = defaultValue;
    }
  }
  return hitMap;
};

const handleHitCheck = (
  context: EffectContext,
  effect: HitCheckEffect
): EffectContext => {
  let hitMap = { ...context.flags.hitMap };
  const actor = getEntity(context.encounter, context.actorId);
  for (const targetId of context.targetIds) {
    const target = getEntity(context.encounter, targetId);
    if (effect.enforceHit) {
      hitMap[targetId] = true;
      continue;
    }
    if (effect.allowMissStatuses && target.statuses.length === 0) {
      hitMap[targetId] = true;
      continue;
    }
    const chance = hitChance(actor, target, context.action, context.booster);
    if (effect.accuracy !== undefined) {
      hitMap[targetId] = context.rng.nextFloat() <= effect.accuracy;
    } else {
      hitMap[targetId] = context.rng.nextFloat() <= chance;
    }
  }
  return { ...context, flags: { ...context.flags, hitMap } };
};

const handleDamage = (
  context: EffectContext,
  effect: EffectBrick & { type: "Damage" }
): EffectContext => {
  const actor = getEntity(context.encounter, context.actorId);
  const events: ActionResolutionEvent[] = [];
  let encounter = context.encounter;

  for (const targetId of context.targetIds) {
    const hitMap = ensureHitMap(context, true);
    if (
      hitMap[targetId] === false &&
      (context.action.hitModel?.canMiss ?? false) &&
      !context.statusInstance
    ) {
      continue;
    }
    const target = getEntity(encounter, targetId);
    const guardRatio = target.guard?.ratio ?? 0;
    let result;

    if (context.statusInstance) {
      const source =
        context.statusInstance.sourceId &&
        context.statusInstance.sourceId in encounter.entities
          ? encounter.entities[context.statusInstance.sourceId]
          : actor;
      const stacks = context.statusInstance.stacks || 1;
      const scale =
        effect.powerScale ??
        (effect.element === "fire" ? 0.12 : 0.1);
      const baseStat = source?.stats.ATK ?? actor.stats.ATK;
      const amount = Math.round(baseStat * scale * stacks);
      result = {
        amount,
        crit: false,
        blocked: guardRatio > 0,
      };
    } else if (typeof effect.flat === "number") {
      result = {
        amount: effect.flat,
        crit: false,
        blocked: guardRatio > 0,
      };
    } else {
      result = computeDamage(
        actor,
        target,
        context.action,
        context.booster,
        context.rng,
        {
          powerScale: effect.powerScale,
          variance: effect.variance,
          guardRatio,
        }
      );
    }
    let updatedEncounter = updateEntity(encounter, targetId, (entity) => {
      const nextHP = Math.max(0, entity.stats.HP - result.amount);
      const alive = nextHP > 0;
      const nextGuard =
        entity.guard && effect.guardBreak
          ? {
              ...entity.guard,
              ratio: Math.max(0, entity.guard.ratio - effect.guardBreak),
            }
          : entity.guard;
      return {
        ...entity,
        stats: { ...entity.stats, HP: nextHP },
        alive,
        guard: result.blocked && entity.guard?.breakOnHit ? undefined : nextGuard,
      };
    });
    encounter = updatedEncounter;

    events.push({
      type: "damage",
      targetId,
      amount: result.amount,
      crit: result.crit,
      blocked: result.blocked,
      source: context.statusInstance ? "status" : effect.source ?? "action",
    });
  }

  return {
    ...context,
    encounter,
    events: mergeEvents(context.events, events),
  };
};

const handleApplyStatus = (
  context: EffectContext,
  effect: ApplyStatusEffect
): EffectContext => {
  let encounter = context.encounter;
  const events: ActionResolutionEvent[] = [];

  for (const targetId of context.targetIds) {
    const hitMap = ensureHitMap(context, true);
    if (hitMap[targetId] === false && !context.statusInstance) {
      continue;
    }
    const success = statusRoll(
      effect.chance,
      context.booster,
      context.rng
    );
    if (!success) continue;
    const applied = applyStatus(
      encounter,
      targetId,
      effect.statusId,
      context.rng,
      context.telemetry,
      {
        stacks: effect.stacks,
        duration: effect.duration,
        sourceId: context.actorId,
        maxStacksOverride: effect.maxStacksOverride,
      }
    );
    encounter = applied.encounter;
    if (applied.instance) {
      events.push({
        type: "status-apply",
        targetId,
        statusId: effect.statusId,
        stacks: applied.instance.stacks,
        duration: applied.instance.remaining,
      });
    }
  }

  return { ...context, encounter, events: mergeEvents(context.events, events) };
};

const handleCleanse = (
  context: EffectContext,
  effect: EffectBrick & { type: "Cleanse" }
): EffectContext => {
  let encounter = context.encounter;
  const events: ActionResolutionEvent[] = [];

  for (const targetId of context.targetIds) {
    encounter = updateEntity(encounter, targetId, (entity) => {
      const filtered = entity.statuses.filter((status) => {
        if (effect.types && effect.types.length > 0) {
          const definition = getStatusDefinitionSafe(status.statusId);
          if (definition && !effect.types.includes(definition.type)) {
            return true;
          }
        }
        if (effect.tags && effect.tags.length > 0) {
          const definition = getStatusDefinitionSafe(status.statusId);
          if (
            definition &&
            definition.tags.some((tag) => effect.tags?.includes(tag))
          ) {
            return false;
          }
        }
        return true;
      });
      const removed = entity.statuses.length - filtered.length;
      if (removed > 0) {
        events.push({
          type: "status-expire",
          targetId,
          statusId: "cleanse",
          remaining: 0,
        });
      }
      return { ...entity, statuses: filtered };
    });
  }

  return { ...context, encounter, events: mergeEvents(context.events, events) };
};

const handleGuard = (
  context: EffectContext,
  effect: EffectBrick & { type: "Guard" }
): EffectContext => {
  let encounter = context.encounter;
  const events: ActionResolutionEvent[] = [];

  for (const targetId of context.targetIds) {
    encounter = updateEntity(encounter, targetId, (entity) => {
      const guard: GuardState = {
        ratio: Math.max(
          0,
          effect.ratio + (context.booster?.guardBonus ?? 0)
        ),
        remaining: effect.duration,
        breakOnHit: effect.breakOnHit ?? false,
      };
      events.push({
        type: "guard",
        targetId,
        ratio: guard.ratio,
        duration: guard.remaining,
      });
      return { ...entity, guard };
    });
  }

  return { ...context, encounter, events: mergeEvents(context.events, events) };
};

const handleCounter = (
  context: EffectContext,
  effect: EffectBrick & { type: "Counter" }
): EffectContext => {
  let encounter = context.encounter;
  const events: ActionResolutionEvent[] = [];

  for (const targetId of context.targetIds) {
    encounter = updateEntity(encounter, targetId, (entity) => {
      const counter = {
        chance: effect.chance,
        actionId: effect.actionId,
        remaining: effect.duration,
      };
      events.push({
        type: "counter",
        targetId,
        actionId: effect.actionId,
        chance: effect.chance,
        duration: effect.duration,
      });
      return { ...entity, counter };
    });
  }

  return { ...context, encounter, events: mergeEvents(context.events, events) };
};

const handleBreakGuard = (
  context: EffectContext,
  effect: EffectBrick & { type: "BreakGuard" }
): EffectContext => {
  let encounter = context.encounter;

  for (const targetId of context.targetIds) {
    encounter = updateEntity(encounter, targetId, (entity) => {
      if (!entity.guard) return entity;
      const next = Math.max(0, entity.guard.ratio - effect.ratio);
      if (next <= 0) {
        return { ...entity, guard: undefined };
      }
      return { ...entity, guard: { ...entity.guard, ratio: next } };
    });
  }

  return { ...context, encounter };
};

const handleDelayTurn = (
  context: EffectContext,
  effect: EffectBrick & { type: "DelayTurn" }
): EffectContext => {
  let encounter = context.encounter;
  for (const targetId of context.targetIds) {
    encounter = updateEntity(encounter, targetId, (entity) => ({
      ...entity,
      initiative: (entity.initiative ?? entity.stats.SPD) * (1 - effect.percent),
    }));
  }
  return { ...context, encounter };
};

const handleResourceChange = (
  context: EffectContext,
  effect: EffectBrick & { type: "ResourceChange" }
): EffectContext => {
  let encounter = context.encounter;
  for (const targetId of context.targetIds) {
    encounter = updateEntity(encounter, targetId, (entity) => ({
      ...entity,
      resources: {
        ...entity.resources,
        [effect.resource]: (entity.resources[effect.resource] ?? 0) + effect.amount,
      },
    }));
  }
  return { ...context, encounter };
};

const handleOnBooster = (
  context: EffectContext,
  effect: EffectBrick & { type: "OnBooster" }
): EffectContext => {
  const outcome = context.booster?.outcome;
  if (!outcome) {
    return context;
  }
  const matches = effect.outcomes.includes(outcome);
  if (!matches) {
    return context;
  }
  return {
    ...context,
    queue: [...effect.effects, ...context.queue],
  };
};

const handleDetonate = (
  context: EffectContext,
  effect: EffectBrick & { type: "Detonate" }
): EffectContext => {
  let encounter = context.encounter;
  const events: ActionResolutionEvent[] = [];

  for (const targetId of context.targetIds) {
    const target = getEntity(encounter, targetId);
    const contextStacks =
      context.statusInstance?.statusId === effect.statusId
        ? context.statusInstance.stacks
        : 0;
    const instances = target.statuses.filter(
      (status) => status.statusId === effect.statusId
    );
    const stacks =
      contextStacks > 0
        ? contextStacks
        : instances.reduce((sum, status) => sum + status.stacks, 0);
    if (stacks === 0) continue;
    const amount = Math.round((effect.powerScale ?? 0.2) * stacks * 12);
    encounter = updateEntity(encounter, targetId, (entity) => ({
      ...entity,
      stats: { ...entity.stats, HP: Math.max(0, entity.stats.HP - amount) },
      alive: entity.stats.HP - amount > 0,
    }));
    events.push({
      type: "damage",
      targetId,
      amount,
      crit: false,
      blocked: false,
      source: "status",
    });
    for (const instance of instances) {
      const expired = expireStatus(encounter, targetId, instance.id, context.telemetry);
      encounter = expired.encounter;
    }
  }

  return { ...context, encounter, events: mergeEvents(context.events, events) };
};

const handleAOESpread = (
  context: EffectContext,
  effect: EffectBrick & { type: "AOESpread" }
): EffectContext => {
  let encounter = context.encounter;
  const allTargets =
    effect.includeAllies === true
      ? Object.values(encounter.entities)
      : Object.values(encounter.entities).filter(
          (entity) => entity.faction !== getEntity(encounter, context.actorId).faction
        );

  for (const victim of allTargets) {
    if (context.targetIds.includes(victim.id)) continue;
    if (!victim.alive) continue;
    if (effect.statusId) {
      const applied = applyStatus(
        encounter,
        victim.id,
        effect.statusId,
        context.rng,
        context.telemetry,
        { stacks: 1, duration: 1, sourceId: context.actorId }
      );
      encounter = applied.encounter;
    }
  }
  return { ...context, encounter };
};

const handlers: Record<
  EffectBrick["type"],
  (context: EffectContext, effect: EffectBrick) => EffectContext
> = {
  HitCheck: handleHitCheck,
  Damage: handleDamage,
  ApplyStatus: handleApplyStatus,
  Cleanse: handleCleanse,
  Guard: handleGuard,
  Counter: handleCounter,
  BreakGuard: handleBreakGuard,
  DelayTurn: handleDelayTurn,
  ResourceChange: handleResourceChange,
  OnBooster: handleOnBooster,
  Detonate: handleDetonate,
  AOESpread: handleAOESpread,
};

const getStatusDefinitionSafe = (statusId: string) => {
  try {
    return getStatusDefinition(statusId);
  } catch {
    return null;
  }
};

export interface EffectPipelineInput {
  encounter: Encounter;
  actorId: string;
  targetIds: string[];
  action: ActionContract;
  booster?: BoosterResult;
  rng: SeededRNG;
  effects: EffectBrick[];
  telemetry: TelemetryBus;
  statusInstance?: StatusInstance;
}

export function runEffectPipeline(
  input: EffectPipelineInput
): { encounter: Encounter; events: ActionResolutionEvent[] } {
  let context: EffectContext = {
    encounter: input.encounter,
    actorId: input.actorId,
    targetIds: input.targetIds,
    action: input.action,
    booster: input.booster,
    rng: input.rng,
    events: [],
    telemetry: input.telemetry,
    queue: [...input.effects],
    flags: { hitMap: {} },
    statusInstance: input.statusInstance,
  };

  while (context.queue.length) {
    const effect = context.queue.shift();
    if (!effect) continue;
    const handler = handlers[effect.type];
    if (!handler) {
      continue;
    }
    context = handler(context, effect as never);
  }

  return { encounter: context.encounter, events: context.events };
}
