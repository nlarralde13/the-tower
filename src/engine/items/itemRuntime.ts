import {
  ActionInstance,
  ActionModifier,
  ActionContract,
  ItemContract,
} from "@/engine/combat/types";
import {
  getActionDefinition,
  getItemDefinition,
} from "@/content/index";

const cloneActionContract = (contract: ActionContract): ActionContract => ({
  ...contract,
  tags: [...contract.tags],
  effects: [...contract.effects],
  power: contract.power ? { ...contract.power } : undefined,
  statUse: contract.statUse ? { ...contract.statUse } : undefined,
  hitModel: contract.hitModel ? { ...contract.hitModel } : undefined,
  cost: contract.cost ? { ...contract.cost } : undefined,
  requirements: contract.requirements ? [...contract.requirements] : undefined,
});

const buildModifierInstance = (
  item: ItemContract,
  modifier: Omit<ActionModifier, "id">
): ActionModifier => ({
  ...modifier,
  id: `${item.id}:${modifier.targetActionId}`,
});

const buildActionInstance = (
  actionId: string,
  source: "item",
  itemId: string,
  modifiers?: ActionModifier[]
): ActionInstance => {
  const contract = getActionDefinition(actionId);
  if (!contract) {
    throw new Error(`Action ${actionId} not found for item ${itemId}`);
  }
  const cloned = cloneActionContract(contract);
  return {
    id: cloned.id,
    contract: cloned,
    source,
    itemId,
    modifiers,
  };
};

export function grantActionsFromItems(items: string[]): ActionInstance[] {
  const granted: ActionInstance[] = [];
  for (const itemId of items) {
    const item = getItemDefinition(itemId);
    if (!item) continue;
    const modifiers = item.modifiers?.map((modifier) =>
      buildModifierInstance(item, modifier)
    );
    if (item.grants) {
      for (const actionId of item.grants) {
        const scopedMods = modifiers?.filter(
          (modifier) => modifier.targetActionId === actionId
        );
        const instance = buildActionInstance(actionId, "item", item.id, scopedMods);
        granted.push(instance);
      }
    }
    if (modifiers && (!item.grants || item.grants.length === 0)) {
      for (const modifier of modifiers) {
        const instance = buildActionInstance(
          modifier.targetActionId,
          "item",
          item.id,
          [modifier]
        );
        granted.push(instance);
      }
    }
  }
  return granted;
}
