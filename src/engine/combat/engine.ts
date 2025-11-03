import {
  ActionInstance,
  ActionResolutionEvent,
  BoosterOutcome,
  CombatEntity,
  Encounter,
  EncounterUpdate,
  PlayerDecision,
  Resolution,
  TelemetryBus,
  TelemetryRecord,
  ActionContract,
  AccessibilitySettings,
  EnemyContract,
  EnemyActionPlan,
  ActionModifier,
  BoosterTuning,
  InitiativeResult,
} from "@/engine/combat/types";
import {
  getActionDefinition,
  getEnemyDefinition,
  getStatusDefinition,
} from "@/content/index";
import { runEffectPipeline } from "@/engine/combat/effects";
import { processStatusDurations } from "@/engine/combat/statusRuntime";
import { forkRng, SeededRNG } from "@/engine/rng";
import { rollInitiative, turnOrder } from "@/engine/combat/formulas";
import { resolveBooster } from "@/engine/combat/booster";
import { logAction, logInitiative } from "@/engine/combat/telemetry";
import { grantActionsFromItems } from "@/engine/items/itemRuntime";
import type { EffectBrick } from "@/engine/combat/types";

interface StartEncounterPlayerState {
  id: string;
  name: string;
  stats: CombatEntity["stats"];
  resources?: CombatEntity["resources"];
  actions?: string[];
  items?: string[];
}

interface StartEncounterState {
  player: StartEncounterPlayerState;
  accessibility?: AccessibilitySettings;
  encounterIndex?: number;
}

interface ActionContext {
  encounter: Encounter;
  rng: SeededRNG;
  telemetry: TelemetryBus;
  accessibility: AccessibilitySettings;
  boosterOverride?: BoosterOutcome;
}

const buildTelemetryBus = (buffer: TelemetryRecord[]): TelemetryBus => ({
  push(record) {
    buffer.push(record);
  },
});

const cloneEncounter = (encounter: Encounter): Encounter => ({
  ...encounter,
  entities: { ...encounter.entities },
  order: [...encounter.order],
  telemetry: [...encounter.telemetry],
  initiative: { ...encounter.initiative },
});

const cloneEntity = (entity: CombatEntity): CombatEntity => ({
  ...entity,
  statuses: [...entity.statuses],
  actions: [...entity.actions],
});

const applyModifiers = (
  contract: ActionContract,
  modifiers: ActionModifier[] | undefined
): { contract: ActionContract; boosterTuning?: Partial<BoosterTuning> } => {
  if (!modifiers || modifiers.length === 0) {
    return { contract };
  }
  let working: ActionContract = {
    ...contract,
    tags: [...contract.tags],
    effects: [...contract.effects],
    power: contract.power ? { ...contract.power } : contract.power,
  };
  const boosterTuning: Partial<BoosterTuning> = {};
  for (const modifier of modifiers) {
    if (modifier.tagsAdd) {
      for (const tag of modifier.tagsAdd) {
        if (!working.tags.includes(tag)) {
          working = { ...working, tags: [...working.tags, tag] };
        }
      }
    }
    if (typeof modifier.powerDelta === "number" && working.power) {
      working = {
        ...working,
        power: { ...working.power, base: working.power.base + modifier.powerDelta },
      };
    }
    if (modifier.effectsAppend && modifier.effectsAppend.length > 0) {
      working = {
        ...working,
        effects: [...working.effects, ...modifier.effectsAppend],
      };
    }
    if (modifier.boosterTweaks) {
      Object.assign(boosterTuning, modifier.boosterTweaks);
    }
  }
  return { contract: working, boosterTuning: Object.keys(boosterTuning).length ? boosterTuning : undefined };
};

const mergeActionInstances = (instances: ActionInstance[]): ActionInstance[] => {
  const map = new Map<
    string,
    { base: ActionInstance; modifiers: ActionModifier[]; sources: ActionInstance[] }
  >();
  for (const instance of instances) {
    const key = instance.contract.id;
    const record = map.get(key);
    if (!record) {
      map.set(key, {
        base: instance,
        modifiers: [...(instance.modifiers ?? [])],
        sources: [instance],
      });
    } else {
      if (instance.source === "base") {
        record.base = instance;
      }
      record.sources.push(instance);
      if (instance.modifiers) {
        record.modifiers.push(...instance.modifiers);
      }
    }
  }
  const merged: ActionInstance[] = [];
  for (const { base, modifiers } of map.values()) {
    const { contract, boosterTuning } = applyModifiers(base.contract, modifiers);
    merged.push({
      ...base,
      contract,
      modifiers,
      boosterTuning: boosterTuning ?? base.boosterTuning,
    });
  }
  return merged;
};

const hydrateAction = (actionId: string, source: ActionInstance["source"]): ActionInstance => {
  const contract = getActionDefinition(actionId);
  if (!contract) {
    throw new Error(`Action ${actionId} not found`);
  }
  return {
    id: contract.id,
    contract,
    source,
    modifiers: [],
  };
};

const buildPlayerEntity = (
  state: StartEncounterPlayerState
): CombatEntity => {
  const baseActions = (state.actions ?? []).map((id) =>
    hydrateAction(id, "base")
  );
  const itemIds = state.items ?? [];
  const itemGranted = grantActionsFromItems(itemIds);
  const actions = mergeActionInstances([...baseActions, ...itemGranted]);
  return {
    id: state.id,
    name: state.name,
    faction: "player",
    stats: { ...state.stats },
    resources: { ...(state.resources ?? {}) },
    statuses: [],
    actions,
    items: itemIds,
    guard: undefined,
    counter: undefined,
    alive: state.stats.HP > 0,
    initiative: state.stats.SPD,
    aiProfile: undefined,
    aiPlan: undefined,
  };
};

const buildEnemyEntity = (
  enemyRef: string | EnemyContract,
  index: number
): CombatEntity => {
  const contract =
    typeof enemyRef === "string" ? getEnemyDefinition(enemyRef) : enemyRef;
  if (!contract) {
    throw new Error(`Enemy ${typeof enemyRef === "string" ? enemyRef : enemyRef.id} not found`);
  }
  const actions = mergeActionInstances(
    contract.actionPlan.map((plan) =>
      hydrateAction(plan.actionId, "enemy")
    )
  );
  return {
    id: `${contract.id}-${index}`,
    name: contract.name,
    faction: "enemy",
    stats: { ...contract.stats },
    resources: { ...(contract.resources ?? {}) },
    statuses: [],
    actions,
    items: contract.items ?? [],
    guard: undefined,
    counter: undefined,
    alive: contract.stats.HP > 0,
    initiative: contract.stats.SPD,
    aiProfile: contract.archetype,
    aiPlan: contract.actionPlan,
  };
};

const makeEncounterId = (seed: string, index: number | undefined) =>
  `encounter-${seed}-${index ?? 0}`;

const resolveTargets = (
  action: ActionContract,
  actor: CombatEntity,
  encounter: Encounter,
  requested: string[] | undefined
): string[] => {
  switch (action.targeting.type) {
    case "self":
      return [actor.id];
    case "singleEnemy": {
      if (requested && requested.length) return requested;
      const enemies = Object.values(encounter.entities).filter(
        (entity) => entity.faction !== actor.faction && entity.alive
      );
      return enemies.length ? [enemies[0].id] : [];
    }
    case "allEnemies": {
      return Object.values(encounter.entities)
        .filter((entity) => entity.faction !== actor.faction && entity.alive)
        .map((entity) => entity.id);
    }
    default:
      return requested ?? [actor.id];
  }
};

const payActionCost = (
  encounter: Encounter,
  actorId: string,
  action: ActionContract
): Encounter => {
  if (!action.cost) return encounter;
  const cloned = cloneEncounter(encounter);
  const entity = cloneEntity(cloned.entities[actorId]);
  for (const [resource, amount] of Object.entries(action.cost)) {
    const current = entity.resources[resource as keyof typeof entity.resources] ?? 0;
    entity.resources = {
      ...entity.resources,
      [resource]: current - (amount ?? 0),
    };
  }
  cloned.entities[actorId] = entity;
  return cloned;
};

const decrementGuardDuration = (encounter: Encounter, actorId: string): Encounter => {
  const cloned = cloneEncounter(encounter);
  const entity = cloneEntity(cloned.entities[actorId]);
  if (entity.guard) {
    const next = entity.guard.remaining - 1;
    if (next <= 0) {
      entity.guard = undefined;
    } else {
      entity.guard = { ...entity.guard, remaining: next };
    }
  }
  cloned.entities[actorId] = entity;
  return cloned;
};

const cleanupEncounter = (encounter: Encounter): Encounter => {
  const cloned = cloneEncounter(encounter);
  cloned.order = cloned.order.filter((id) => cloned.entities[id]?.alive);
  return cloned;
};

const advanceTurnPointer = (encounter: Encounter): Encounter => {
  if (encounter.order.length === 0) return encounter;
  let nextIndex = (encounter.activeIndex + 1) % encounter.order.length;
  return { ...encounter, activeIndex: nextIndex, turn: encounter.turn + 1 };
};

const buildStatusAction = (
  statusId: string,
  phase: "turnStart" | "turnEnd",
  effects: EffectBrick[]
): ActionContract => ({
  id: `${statusId}-${phase}`,
  identity: statusId,
  version: 1,
  name: `${statusId}:${phase}`,
  category: "utility",
  tags: ["status"],
  targeting: { type: "self" },
  effects,
});

const runStatusPhase = (
  encounter: Encounter,
  entityId: string,
  phase: "turnStart" | "turnEnd",
  rng: SeededRNG,
  telemetry: TelemetryBus
): { encounter: Encounter; events: ActionResolutionEvent[] } => {
  let working = cloneEncounter(encounter);
  const entity = working.entities[entityId];
  if (!entity) return { encounter, events: [] };
  const events: ActionResolutionEvent[] = [];
  for (const status of [...entity.statuses]) {
    const definition = getStatusDefinition(status.statusId);
    if (!definition) continue;
    const effects = definition.effects[phase];
    if (!effects || effects.length === 0) continue;
    const action = buildStatusAction(status.statusId, phase, effects);
    const result = runEffectPipeline({
      encounter: working,
      actorId: entityId,
      targetIds: [entityId],
      action,
      booster: undefined,
      rng,
      effects,
      telemetry,
      statusInstance: status,
    });
    working = result.encounter;
    events.push(...result.events);
  }
  const processed = processStatusDurations(working, entityId, phase, telemetry);
  working = processed.encounter;
  for (const expired of processed.expired) {
    const definition = getStatusDefinition(expired.statusId);
    if (!definition) continue;
    const expireEffects = definition.effects.onExpire;
    if (!expireEffects || expireEffects.length === 0) continue;
    const action = buildStatusAction(expired.statusId, "turnEnd", expireEffects);
    const result = runEffectPipeline({
      encounter: working,
      actorId: entityId,
      targetIds: [entityId],
      action,
      booster: undefined,
      rng,
      effects: expireEffects,
      telemetry,
      statusInstance: expired,
    });
    working = result.encounter;
    events.push(...result.events);
  }
  return { encounter: working, events };
};

const selectEnemyAction = (
  actor: CombatEntity,
  encounter: Encounter,
  rng: SeededRNG
): { instance: ActionInstance; targets: string[]; boosterOverride?: BoosterOutcome } => {
  const plan = actor.aiPlan ?? [];
  const totalWeight = plan.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng.nextFloat() * totalWeight;
  let chosen: EnemyActionPlan | undefined;
  for (const entry of plan) {
    roll -= entry.weight;
    if (roll <= 0) {
      chosen = entry;
      break;
    }
  }
  chosen = chosen ?? plan[0];
  if (!chosen) {
    throw new Error(`Enemy ${actor.id} has no action plan`);
  }
  const instance = actor.actions.find(
    (action) => action.contract.id === chosen!.actionId
  );
  if (!instance) {
    throw new Error(`Enemy ${actor.id} missing action ${chosen.actionId}`);
  }
  const targets = resolveTargets(
    instance.contract,
    actor,
    encounter,
    chosen.targeting?.type === "self" ? [actor.id] : undefined
  );
  return {
    instance,
    targets,
    boosterOverride: chosen.boosterBias,
  };
};

export function startEncounter(
  state: StartEncounterState,
  enemies: Array<string | EnemyContract>,
  seed: string
): Encounter {
  const baseSeed = seed ?? "encounter";
  const encounterSeed = `${baseSeed}:${state.encounterIndex ?? 0}`;
  const rng = forkRng(encounterSeed, 0);
  const initiativeRng = forkRng(encounterSeed, "initiative");
  const player = buildPlayerEntity(state.player);
  const enemyEntities = enemies.map((enemy, index) =>
    buildEnemyEntity(enemy, index)
  );
  const initiativeRolls = rollInitiative(initiativeRng);
  let first: "player" | "enemy";
  if (enemyEntities.length === 0) {
    first = "player";
  } else if (initiativeRolls.player > initiativeRolls.enemy) {
    first = "player";
  } else if (initiativeRolls.enemy > initiativeRolls.player) {
    first = "enemy";
  } else {
    const playerSpd = player.stats.SPD;
    const enemyTopSpd = enemyEntities.reduce(
      (max, enemy) => Math.max(max, enemy.stats.SPD),
      0
    );
    if (playerSpd > enemyTopSpd) {
      first = "player";
    } else if (enemyTopSpd > playerSpd) {
      first = "enemy";
    } else {
      first = initiativeRng.nextBool() ? "player" : "enemy";
    }
  }
  const initiative: InitiativeResult = {
    player: initiativeRolls.player,
    enemy: initiativeRolls.enemy,
    first,
  };
  const telemetryRecords: TelemetryRecord[] = [];
  const telemetryBus = buildTelemetryBus(telemetryRecords);
  logInitiative(telemetryBus, initiative);
  const entities: Record<string, CombatEntity> = {
    [player.id]: player,
  };
  for (const enemy of enemyEntities) {
    entities[enemy.id] = enemy;
  }
  let order = turnOrder(Object.values(entities), rng.clone());
  const firstEntityId =
    first === "player"
      ? player.id
      : order.find((id) => entities[id]?.faction === "enemy");
  if (firstEntityId) {
    const index = order.indexOf(firstEntityId);
    if (index > 0) {
      order = [...order.slice(index), ...order.slice(0, index)];
    }
  }
  const encounter: Encounter = {
    id: makeEncounterId(seed, state.encounterIndex),
    seed: encounterSeed,
    turn: 0,
    round: 1,
    order,
    activeIndex: 0,
    entities,
    rng,
    accessibility: state.accessibility ?? {},
    initiative,
    telemetry: telemetryRecords,
  };
  return encounter;
}

export function resolveAction(
  ctx: ActionContext,
  actor: CombatEntity,
  actionId: string,
  targetRefs: string[]
): Resolution {
  const instance = actor.actions.find((action) => action.contract.id === actionId);
  if (!instance) {
    throw new Error(`Action ${actionId} not found for actor ${actor.id}`);
  }
  const contract = instance.contract;
  const targets = resolveTargets(contract, actor, ctx.encounter, targetRefs);
  const events: ActionResolutionEvent[] = [];
  const telemetryBuffer = ctx.telemetry;
  ctx.encounter = payActionCost(ctx.encounter, actor.id, contract);
  const booster = contract.booster
    ? resolveBooster(
        contract.booster,
        { rng: ctx.rng, requested: ctx.boosterOverride, tuning: instance.boosterTuning },
        ctx.accessibility
      )
    : undefined;
  logAction(telemetryBuffer, {
    actorId: actor.id,
    actionId: contract.id,
    targets,
    booster: booster?.outcome,
  });
  const result = runEffectPipeline({
    encounter: ctx.encounter,
    actorId: actor.id,
    targetIds: targets,
    action: contract,
    booster,
    rng: ctx.rng,
    effects: contract.effects,
    telemetry: telemetryBuffer,
  });
  ctx.encounter = result.encounter;
  events.push(...result.events);
  return {
    actorId: actor.id,
    actionId: contract.id,
    targetIds: targets,
    booster,
    events,
    telemetry: [],
  };
}

const removeDeadEntities = (encounter: Encounter): Encounter => {
  let working = encounter;
  for (const entity of Object.values(working.entities)) {
    if (entity.alive) continue;
    working = {
      ...working,
      order: working.order.filter((id) => id !== entity.id),
      entities: {
        ...working.entities,
        [entity.id]: entity,
      },
    };
  }
  return working;
};

export function takeTurn(
  encounter: Encounter,
  playerDecision?: PlayerDecision
): EncounterUpdate {
  let working = cloneEncounter(encounter);
  const existingTelemetry = [...working.telemetry];
  working.telemetry = existingTelemetry;
  const telemetryRecords: TelemetryRecord[] = [];
  const telemetry = buildTelemetryBus(telemetryRecords);
  if (working.order.length === 0) {
    return {
      encounter: working,
      resolution: {
        actorId: "",
        actionId: "",
        targetIds: [],
        events: [],
        telemetry: telemetryRecords,
      },
    };
  }
  const actorId = working.order[working.activeIndex];
  const actor = working.entities[actorId];
  if (!actor || !actor.alive) {
    working = advanceTurnPointer(working);
    return takeTurn(working, playerDecision);
  }
  const startPhase = runStatusPhase(working, actorId, "turnStart", working.rng, telemetry);
  working = startPhase.encounter;
  const actionContext: ActionContext = {
    encounter: working,
    rng: working.rng,
    telemetry,
    accessibility: working.accessibility,
    boosterOverride:
      actor.faction === "player" ? playerDecision?.boosterOutcome : undefined,
  };

  let actionInstance: ActionInstance;
  let targets: string[];
  if (actor.faction === "player") {
    if (!playerDecision) {
      throw new Error("Player decision required for player turn");
    }
    actionInstance = actor.actions.find(
      (instance) => instance.contract.id === playerDecision.actionId
    ) ?? hydrateAction(playerDecision.actionId, "base");
    targets = resolveTargets(
      actionInstance.contract,
      actor,
      working,
      playerDecision.targetIds
    );
  } else {
    const selection = selectEnemyAction(actor, working, working.rng);
    actionInstance = selection.instance;
    targets = selection.targets;
    actionContext.boosterOverride = selection.boosterOverride;
  }

  const resolution = resolveAction(
    actionContext,
    actor,
    actionInstance.contract.id,
    targets
  );

  working = actionContext.encounter;
  const endPhase = runStatusPhase(working, actorId, "turnEnd", working.rng, telemetry);
  working = endPhase.encounter;

  working = decrementGuardDuration(working, actorId);
  working = removeDeadEntities(working);
  working = cleanupEncounter(working);
  const advanced = advanceTurnPointer(working);

  resolution.events.push(...startPhase.events);
  resolution.events.push(...endPhase.events);
  resolution.telemetry = telemetryRecords;

  const combinedTelemetry = [...existingTelemetry, ...telemetryRecords];
  const advancedWithTelemetry = { ...advanced, telemetry: combinedTelemetry };

  return {
    encounter: advancedWithTelemetry,
    resolution,
  };
}

export type { StartEncounterState };
