// An item's pictures (Docs/art/ui-inventory.md §3.2, sheet UI-I1): the icon
// the Bag, the pickers and the prize chips all draw for it, and a speed-up's
// type badge. Kept apart from the Bag's sheet so a screen that only draws an
// item does not pull in the Bag's.

import { ITEMS, type BoostKind, type ItemDef } from '../sim/data/definitions';
import type { CurrencyId, ItemId } from '../sim/state';
import { el } from './format';
import { iconEl, type IconName } from './kit';

/** A typed speed-up's badge on its tile (§3.5): a hammer for construction,
 *  a helmet for training, an anvil for workshops; General has none. */
const SPEED_BADGE: Partial<Record<NonNullable<ItemDef['speeds']>, IconName>> = {
  Construction: 'build', Training: 'helmet', Workshop: 'anvil',
};

/** A chest's picture, by the coin it pays. */
const CHEST_ICON: Partial<Record<CurrencyId, IconName>> = {
  Gold: 'chestGold', Food: 'chestFood', Wood: 'chestWood', Stone: 'chestStone',
};

/** A boost's picture, by what it raises. */
export const BOOST_ICON: Record<BoostKind, IconName> = { Rent: 'boostRent', Harvest: 'boostHarvest', Mana: 'boostMana' };

/** An item's picture: the chest of its coin, the winged hourglass, the boost
 *  of its kind, the flask, the tome, the key itself. */
export const itemIcon = (id: ItemId): IconName => {
  const def = ITEMS[id];
  switch (def.kind) {
    case 'key': return id as IconName;
    case 'chest': return (def.coin !== null ? CHEST_ICON[def.coin] : undefined) ?? 'chest';
    case 'choice': return 'choiceChest';
    case 'speedup': return 'speedup';
    case 'boost': return def.boost !== null ? BOOST_ICON[def.boost] : 'speedup';
    case 'flask': return 'manaFlask';
    case 'tome': return 'knowledgeTome';
  }
};

/** A tile's picture, with a speed-up's type badge at its lower left. */
export function tileArt(id: ItemId): Node[] {
  const def = ITEMS[id];
  const art = iconEl(itemIcon(id), { size: 'lg' });
  const badge = def.speeds === null ? undefined : SPEED_BADGE[def.speeds];
  return badge === undefined ? [art] : [art, el('span', { class: 'bag-tile-badge' }, iconEl(badge, { size: 'sm' }))];
}
