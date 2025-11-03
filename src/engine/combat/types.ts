import type { SeededRNG } from "@/engine/rng";

export type StatKey = "HP" | "ATK" | "DEF" | "INT" | "RES" | "SPD" | "LUCK";

export interface CombatStats {
  HP: number;
  ATK: number;
  DEF: number;
  INT: number;
  RES: number;
  SPD: number;
  LUCK: number;
}

export type ResourceType = "focus" | "stamina";

export interface CombatResources {
  focus?: number;
  stamina?: number;
}

export type ActionCategory =
  | "attack"
  | "spell"
  | "defend"
  | "support"
  | "utility";

export type TargetingMode =
  | { type: "self" }
  | { type: "singleEnemy" }
  | { type: "singleAlly"; includeSelf?: boolean }
  | { type: "allEnemies" }
  | { type: "allAllies"; includeSelf?: boolean }
  | { type: "row"; row: "front" | "back" }
  | { type: "randomEnemy"; count?: number }
  | { type: "scripted"; resolverId: string };

export interface ActionPowerSpec {
  base: number;
  variance: number;
  critMult: number;
}

export interface StatUseSpec {
  attack: StatKey;
  defense: StatKey;
}

export interface HitModelSpec {
  canMiss: boolean;
  base: number;
  critBase?: number;
  grazeWindow?: number;
}

export type BoosterType = "precision" | "focus" | "reaction";
export type BoosterOutcome = "miss" | "poor" | "good" | "perfect";

export interface BoosterContext {
  type: BoosterType;
  actorId: string;
  actionId: string;
  rng: SeededRNG;
  requested?: BoosterOutcome;
  accessibility: AccessibilitySettings;
}

export interface BoosterResult {
  type: BoosterType;
  outcome: BoosterOutcome;
  roll: number;
  damageMult: number;
  critBonus: number;
  statusBonus: number;
  guardBonus: number;
  reflectRatio: number;
  comboHits: number;
  counterChance: number;
  metadata?: Record<string, unknown>;
}

export interface AccessibilitySettings {
  autoGood?: boolean;
}

export interface ActionRequirement {
  stat?: StatKey;
  min?: number;
  resource?: ResourceType;
  itemTag?: string;
}

export interface ActionAIHints {
  archetypes?: string[];
  priority?: number;
  cadence?: "frequent" | "occasional" | "emergency";
  targetPreference?: "weakest" | "strongest" | "random" | "self";
}

export interface ActionFX {
  animation?: string;
  icon?: string;
  sfx?: string;
}

export interface ActionLimits {
  perTurn?: number;
  perEncounter?: number;
  cooldown?: number;
}

export interface ActionTelemetry {
  event?: string;
  payload?: Record<string, unknown>;
}

interface EffectBase<TType extends string> {
  type: TType;
  id?: string;
  tags?: string[];
  priority?: number;
}

export interface DamageEffect extends EffectBase<"Damage"> {
  element: string;
  powerScale?: number;
  flat?: number;
  allowCrit?: boolean;
  piercing?: number;
  guardBreak?: number;
  variance?: number;
  source?: "action" | "status";
}

export interface HitCheckEffect extends EffectBase<"HitCheck"> {
  accuracy?: number;
  canMiss?: boolean;
  canCrit?: boolean;
  enforceHit?: boolean;
  allowMissStatuses?: boolean;
}

export interface ApplyStatusEffect extends EffectBase<"ApplyStatus"> {
  statusId: string;
  chance: number;
  duration: number;
  stacks?: number;
  maxStacksOverride?: number;
  source?: "self" | "ally" | "enemy";
}

export interface CleanseEffect extends EffectBase<"Cleanse"> {
  tags?: string[];
  types?: Array<"beneficial" | "harmful">;
  max?: number;
}

export interface GuardEffect extends EffectBase<"Guard"> {
  ratio: number;
  duration: number;
  breakOnHit?: boolean;
}

export interface CounterEffect extends EffectBase<"Counter"> {
  chance: number;
  actionId: string;
  duration: number;
}

export interface BreakGuardEffect extends EffectBase<"BreakGuard"> {
  ratio: number;
  duration: number;
}

export interface DelayTurnEffect extends EffectBase<"DelayTurn"> {
  percent: number;
}

export interface ResourceChangeEffect extends EffectBase<"ResourceChange"> {
  resource: ResourceType;
  amount: number;
}

export interface OnBoosterEffect extends EffectBase<"OnBooster"> {
  outcomes: BoosterOutcome[];
  effects: EffectBrick[];
}

export interface DetonateEffect extends EffectBase<"Detonate"> {
  statusId: string;
  powerScale?: number;
  removeStacks?: boolean;
}

export interface AOESpreadEffect extends EffectBase<"AOESpread"> {
  statusId?: string;
  ratio: number;
  includeAllies?: boolean;
}

export type EffectBrick =
  | HitCheckEffect
  | DamageEffect
  | ApplyStatusEffect
  | CleanseEffect
  | GuardEffect
  | CounterEffect
  | BreakGuardEffect
  | DelayTurnEffect
  | ResourceChangeEffect
  | OnBoosterEffect
  | DetonateEffect
  | AOESpreadEffect;

export interface ActionContract {
  id: string;
  identity: string;
  version: number;
  name: string;
  category: ActionCategory;
  tags: string[];
  cost?: Partial<Record<ResourceType, number>>;
  requirements?: ActionRequirement[];
  targeting: TargetingMode;
  booster?: BoosterType;
  power?: ActionPowerSpec;
  statUse?: StatUseSpec;
  hitModel?: HitModelSpec;
  effects: EffectBrick[];
  ai?: ActionAIHints;
  fx?: ActionFX;
  limits?: ActionLimits;
  telemetry?: ActionTelemetry;
}

export type StatusType = "beneficial" | "harmful";

export interface StatusStacking {
  mode: "stack" | "refresh" | "replace";
  maxStacks: number;
}

export interface StatusDuration {
  turns: number;
  tickOn: Array<"turnStart" | "turnEnd">;
  maxDurationPerFight?: number;
}

export interface StatusHooksCaps {
  turnStart?: number;
  turnEnd?: number;
  onHit?: number;
  onDamaged?: number;
  onExpire?: number;
  onApply?: number;
  onTick?: number;
}

export interface StatusEffects {
  onApply?: EffectBrick[];
  turnStart?: EffectBrick[];
  turnEnd?: EffectBrick[];
  onHit?: EffectBrick[];
  onDamaged?: EffectBrick[];
  onExpire?: EffectBrick[];
}

export interface StatusContract {
  id: string;
  version: number;
  type: StatusType;
  school?: string;
  tags: string[];
  stacking: StatusStacking;
  duration: StatusDuration;
  effects: StatusEffects;
  immunities?: string[];
  blockedBy?: string[];
  cleansableBy?: string[];
  fx?: Record<string, string>;
  caps?: StatusHooksCaps;
}

export interface StatusInstance {
  id: string;
  statusId: string;
  sourceId?: string;
  stacks: number;
  remaining: number;
  appliedAtTurn: number;
  metadata?: Record<string, unknown>;
}

export interface GuardState {
  ratio: number;
  remaining: number;
  breakOnHit: boolean;
}

export interface CounterState {
  chance: number;
  actionId: string;
  remaining: number;
}

export interface CombatEntity {
  id: string;
  name: string;
  faction: "player" | "enemy";
  stats: CombatStats;
  resources: CombatResources;
  statuses: StatusInstance[];
  actions: ActionInstance[];
  items: string[];
  guard?: GuardState;
  counter?: CounterState;
  alive: boolean;
  initiative?: number;
  aiProfile?: string;
  aiPlan?: EnemyActionPlan[];
}

export interface ActionInstance {
  id: string;
  contract: ActionContract;
  source: "base" | "item" | "status" | "enemy";
  itemId?: string;
  modifiers?: ActionModifier[];
  boosterTuning?: Partial<BoosterTuning>;
}

export interface ActionModifier {
  id: string;
  targetActionId: string;
  tagsAdd?: string[];
  powerDelta?: number;
  effectsAppend?: EffectBrick[];
  boosterTweaks?: Partial<BoosterTuning>;
}

export interface BoosterTuning {
  missWindow: number;
  poorWindow: number;
  goodWindow: number;
  perfectWindow: number;
}

export interface ItemContract {
  id: string;
  name: string;
  grants?: string[];
  modifiers?: Array<Omit<ActionModifier, "id">>;
  tags?: string[];
}

export interface EnemyActionPlan {
  actionId: string;
  weight: number;
  targeting?: TargetingMode;
  boosterBias?: BoosterOutcome;
}

export interface EnemyContract {
  id: string;
  name: string;
  archetype: "Aggressive" | "Cunning" | "Stoic";
  stats: CombatStats;
  resources: CombatResources;
  actionPlan: EnemyActionPlan[];
  tags?: string[];
  items?: string[];
  loot?: {
    profileId?: string;
    bossTableId?: string;
  };
}

export interface InitiativeResult {
  player: number;
  enemy: number;
  first: "player" | "enemy";
}

export interface Encounter {
  id: string;
  seed: string;
  turn: number;
  round: number;
  order: string[];
  activeIndex: number;
  entities: Record<string, CombatEntity>;
  rng: SeededRNG;
  accessibility: AccessibilitySettings;
  initiative: InitiativeResult;
  telemetry: TelemetryRecord[];
}

export interface RNGContext {
  seed: string;
  rng: SeededRNG;
}

export interface PlayerDecision {
  actionId: string;
  targetIds: string[];
  boosterOutcome?: BoosterOutcome;
}

export interface ActionEventDamage {
  type: "damage";
  targetId: string;
  amount: number;
  crit: boolean;
  blocked: boolean;
  source: "action" | "status";
}

export interface ActionEventStatusApply {
  type: "status-apply";
  targetId: string;
  statusId: string;
  stacks: number;
  duration: number;
}

export interface ActionEventStatusExpire {
  type: "status-expire";
  targetId: string;
  statusId: string;
  remaining: number;
}

export interface ActionEventGuard {
  type: "guard";
  targetId: string;
  ratio: number;
  duration: number;
}

export interface ActionEventCounter {
  type: "counter";
  targetId: string;
  actionId: string;
  chance: number;
  duration: number;
}

export type ActionResolutionEvent =
  | ActionEventDamage
  | ActionEventStatusApply
  | ActionEventStatusExpire
  | ActionEventGuard
  | ActionEventCounter;

export interface Resolution {
  actorId: string;
  actionId: string;
  targetIds: string[];
  booster?: BoosterResult;
  events: ActionResolutionEvent[];
  telemetry: TelemetryRecord[];
}

export interface TelemetryRecord {
  type:
    | "initiative"
    | "action"
    | "status-apply"
    | "status-tick"
    | "status-expire";
  payload: Record<string, unknown>;
}

export interface EncounterUpdate {
  encounter: Encounter;
  resolution: Resolution;
}

export interface StatusTickRequest {
  encounter: Encounter;
  entity: CombatEntity;
  phase: "turnStart" | "turnEnd";
}

export interface BoosterRegistryEntry {
  type: BoosterType;
  resolve: (
    params: BoosterResolveParams,
    accessibility: AccessibilitySettings
  ) => BoosterResult;
}

export interface BoosterResolveParams {
  rng: SeededRNG;
  requested?: BoosterOutcome;
  tuning?: Partial<BoosterTuning>;
}

export interface TelemetryBus {
  push(record: TelemetryRecord): void;
}
