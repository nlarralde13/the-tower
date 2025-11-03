import type {
  ActionContract,
  EnemyContract,
  ItemContract,
  StatusContract,
} from "@/engine/combat/types";

import slash from "@/content/actions/slash";
import fireball from "@/content/actions/fireball";
import defend from "@/content/actions/defend";
import bite from "@/content/actions/bite";
import scratch from "@/content/actions/scratch";
import cringe from "@/content/actions/cringe";
import firebolt from "@/content/actions/firebolt";
import weaken from "@/content/actions/weaken";

import bleed from "@/content/statuses/bleed";
import burn from "@/content/statuses/burn";
import guarded from "@/content/statuses/guarded";
import freeze from "@/content/statuses/freeze";

import starterSword from "@/content/items/starter-sword";
import starterStaff from "@/content/items/starter-staff";
import buckler from "@/content/items/buckler";

import rat from "@/content/enemies/rat";
import acolyte from "@/content/enemies/acolyte";

const actionEntries = [
  slash,
  fireball,
  defend,
  bite,
  scratch,
  cringe,
  firebolt,
  weaken,
] satisfies ActionContract[];

const statusEntries = [bleed, burn, guarded, freeze] satisfies StatusContract[];

const itemEntries = [starterSword, starterStaff, buckler] satisfies ItemContract[];

const enemyEntries = [rat, acolyte] satisfies EnemyContract[];

const actionRegistry = new Map(actionEntries.map((entry) => [entry.id, entry]));
const statusRegistry = new Map(statusEntries.map((entry) => [entry.id, entry]));
const itemRegistry = new Map(itemEntries.map((entry) => [entry.id, entry]));
const enemyRegistry = new Map(enemyEntries.map((entry) => [entry.id, entry]));

export const actions = actionEntries;
export const statuses = statusEntries;
export const items = itemEntries;
export const enemies = enemyEntries;

export function getActionDefinition(id: string): ActionContract | undefined {
  return actionRegistry.get(id);
}

export function getStatusDefinition(id: string): StatusContract | undefined {
  return statusRegistry.get(id);
}

export function getItemDefinition(id: string): ItemContract | undefined {
  return itemRegistry.get(id);
}

export function getEnemyDefinition(id: string): EnemyContract | undefined {
  return enemyRegistry.get(id);
}

