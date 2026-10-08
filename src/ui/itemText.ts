// What an item is, in words: its name with its size ("1h Wood chest") and
// the one line on what one does or is worth now. The Bag's popover and an
// offer's tooltips both say it this way (Docs/art/ui-inventory.md §3).

import { DISTRICTS, ITEMS, type BoostKind, type ItemDef } from '../sim/data/definitions';
import type { CurrencyId, DistrictId, ItemId, Wallet } from '../sim/state';
import { currencyName, formatDuration, formatExact } from './format';
import { tr } from '../i18n/tr';

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

/** What a running boost raises, and by how much: "Houses pay +25%". */
export const boostWhat = (kind: BoostKind, pct: string): string => {
  switch (kind) {
    case 'Rent': return tr('Houses pay +{n}%', { n: pct });
    case 'Harvest': return tr('A tap takes +{n}%', { n: pct });
    case 'Mana': return tr('Mana fills +{n}%', { n: pct });
  }
};

/** A boost's popover line: what it raises, by how much, for how long. */
const boostFor = (kind: BoostKind, pct: string, time: string): string => {
  switch (kind) {
    case 'Rent': return tr('Houses pay +{n}% for {time}', { n: pct, time });
    case 'Harvest': return tr('A tap takes +{n}% for {time}', { n: pct, time });
    case 'Mana': return tr('Mana fills +{n}% for {time}', { n: pct, time });
  }
};

/** A speed-up's popover line: how much it takes off, and off what. */
const speedsLine = (speeds: NonNullable<ItemDef['speeds']>, time: string): string => {
  switch (speeds) {
    case 'General': return tr('Takes {time} off any build, training or workshop', { time });
    case 'Construction': return tr('Takes {time} off a build or an upgrade', { time });
    case 'Training': return tr('Takes {time} off a training line', { time });
    case 'Workshop': return tr('Takes {time} off the item a workshop is making', { time });
  }
};

/** What the Bag calls an item in its popover: "1h Wood chest". */
export const itemName = (def: ItemDef): string =>
  tr('{size} {name}', { size: sizeLabel(def), name: def.name }).trim();

/** The popover's one line: what one is worth now. */
export const itemLine = (def: ItemDef, worth: Wallet): string => {
  const coin = chestCoin(worth);
  if (def.kind === 'chest' && coin !== null) {
    return tr('{time} of {coin} — {n} now',
      { time: formatDuration(def.seconds), coin: currencyName(coin[0]), n: formatExact(coin[1]) });
  }
  if (def.kind === 'speedup' && def.speeds !== null) {
    return speedsLine(def.speeds, formatDuration(def.seconds));
  }
  if (def.kind === 'choice') return tr('{time} of the coin you pick', { time: formatDuration(def.seconds) });
  if (def.kind === 'boost' && def.boost !== null) {
    return boostFor(def.boost, formatExact(def.value), formatDuration(def.seconds));
  }
  if (def.kind === 'flask') return tr('Fills {n}% of the Mana pool', { n: formatExact(def.value) });
  if (def.kind === 'tome') return tr("{n} Knowledge, past the bar's cap", { n: formatExact(def.value) });
  if (def.kind === 'key') return tr('One call on its banner, in the store');
  if (def.kind === 'part') {
    const ruin = (Object.keys(DISTRICTS) as DistrictId[])
      .find((id) => ITEMS[DISTRICTS[id].repairItem as ItemId] === def);
    return ruin === undefined ? tr('A piece of something ruined')
      : tr('Repairs the {name}', { name: DISTRICTS[ruin].name });
  }
  return '';
};
