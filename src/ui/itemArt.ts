// An item's pictures (Docs/art/ui-inventory.md §3.2, sheet UI-I1): the icon
// the Bag, the pickers and the prize chips all draw for it, and a speed-up's
// type badge. Kept apart from the Bag's sheet so a screen that only draws an
// item does not pull in the Bag's.

import { ITEMS, type BoostKind, type ItemDef } from '../sim/data/definitions';
import type { CurrencyId, ItemId } from '../sim/state';
import { el } from './format';
import { iconEl, type IconName } from './kit';
import { ATLAS_CELLS } from './kit/atlas.generated';

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

/** Whether the atlas holds a picture drawn for this very item (sheets
 *  UI-I2…I4): a timed one carries its duration on a ribbon and a speed-up
 *  shows what it speeds up, so its tile needs no label and no badge. */
const ownArt = (id: ItemId): boolean => ATLAS_CELLS.has(id);

/** An item's picture: its own when it has one; else the chest of its coin,
 *  the winged hourglass, the boost of its kind, the flask, the tome, the key
 *  itself — so an item made in the data tool shows before its art lands. */
export const itemIcon = (id: ItemId): IconName => {
  if (ownArt(id)) return id as IconName;
  const def = ITEMS[id];
  switch (def.kind) {
    case 'key': return id as IconName;
    case 'chest': return (def.coin !== null ? CHEST_ICON[def.coin] : undefined) ?? 'chest';
    case 'choice': return 'choiceChest';
    case 'speedup': return 'speedup';
    case 'boost': return def.boost !== null ? BOOST_ICON[def.boost] : 'speedup';
    case 'flask': return 'flask';
    case 'tome': return 'tome';
  }
};

/** A tile's picture and the size printed above it. An item drawn for itself
 *  carries a duration in its art, so only a size the art cannot say (a
 *  flask's share, a tome's pages) is printed; a borrowed picture gets the
 *  label and a speed-up's type badge at its lower left. */
export function tileArt(id: ItemId, size: string): Node[] {
  const def = ITEMS[id];
  const own = ownArt(id);
  const art = iconEl(itemIcon(id), { size: 'lg' });
  const out: Node[] = [];
  if (size !== '' && !(own && def.seconds > 0)) out.push(el('span', { class: 'bag-tile-size' }, size));
  out.push(art);
  const badge = own || def.speeds === null ? undefined : SPEED_BADGE[def.speeds];
  if (badge !== undefined) out.push(el('span', { class: 'bag-tile-badge' }, iconEl(badge, { size: 'sm' })));
  return out;
}
