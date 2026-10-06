// What an item is, in words: its name with its size ("1h Wood chest") and
// the one line on what one does or is worth now. The Bag's popover and an
// offer's tooltips both say it this way (Docs/art/ui-inventory.md §3).

import type { BoostKind, ItemDef } from '../sim/data/definitions';
import type { CurrencyId, Wallet } from '../sim/state';
import { formatDuration, formatExact } from './format';

/** The size printed at the top of a tile: "10m", "1h", "8h" — or, for what
 *  has no duration, its value: "25%", "5"; a key, nothing. */
export const sizeLabel = (def: ItemDef): string =>
  def.kind === 'flask' ? `${formatExact(def.value)}%`
    : def.kind === 'tome' ? formatExact(def.value)
      : def.kind === 'key' ? ''
        : formatDuration(def.seconds);

/** The one coin a chest pays, and how much of it. */
export const chestCoin = (worth: Wallet): [CurrencyId, number] | null => {
  const entry = (Object.entries(worth) as Array<[CurrencyId, number]>)[0];
  return entry ?? null;
};

/** What a boost's popover says it raises. */
export const BOOST_WHAT: Record<BoostKind, string> = { Rent: 'Houses pay', Harvest: 'A tap takes', Mana: 'Mana fills' };

/** What a speed-up's popover says it shortens. */
export const SPEEDS_WHAT: Record<NonNullable<ItemDef['speeds']>, string> = {
  General: 'any build, training or workshop',
  Construction: 'a build or an upgrade',
  Training: 'a training line',
  Workshop: 'the item a workshop is making',
};

/** What the Bag calls an item in its popover: "1h Wood chest". */
export const itemName = (def: ItemDef): string => `${sizeLabel(def)} ${def.name}`.trim();

/** The popover's one line: what one is worth now. */
export const itemLine = (def: ItemDef, worth: Wallet): string => {
  const coin = chestCoin(worth);
  if (def.kind === 'chest' && coin !== null) {
    return `${formatDuration(def.seconds)} of ${coin[0]} — ${formatExact(coin[1])} now`;
  }
  if (def.kind === 'speedup' && def.speeds !== null) {
    return `Takes ${formatDuration(def.seconds)} off ${SPEEDS_WHAT[def.speeds]}`;
  }
  if (def.kind === 'choice') return `${formatDuration(def.seconds)} of the coin you pick`;
  if (def.kind === 'boost' && def.boost !== null) {
    return `${BOOST_WHAT[def.boost]} +${formatExact(def.value)}% for ${formatDuration(def.seconds)}`;
  }
  if (def.kind === 'flask') return `Fills ${formatExact(def.value)}% of the Mana pool`;
  if (def.kind === 'tome') return `${formatExact(def.value)} Knowledge, past the bar's cap`;
  if (def.kind === 'key') return 'One call on its banner, in the store';
  return '';
};
